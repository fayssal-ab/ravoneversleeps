import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { channelGone, deleteChannel, postInTicket, renameTicket } from "./discordBot";

// Ticket housekeeping: a Discord category holds at most 50 channels, so
// every ticket is tracked here; once its case is decided it is scheduled to
// close, and the daily cleanup (/api/cron/discord) deletes it.

const CLOSE_AFTER_DAYS = 3;

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= getPool().query(`CREATE TABLE IF NOT EXISTS discord_tickets (
    channel_id VARCHAR(32) PRIMARY KEY,
    kind VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    close_after DATETIME NULL,
    INDEX idx_tickets_close (close_after)
  ) ENGINE=InnoDB`).then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

export async function registerTicket(channelId: string, kind: "verify" | "challenge" | "vip" | "store"): Promise<void> {
  await ensureTable();
  await getPool().query("INSERT IGNORE INTO discord_tickets (channel_id, kind) VALUES (?, ?)", [channelId, kind]);
}

/**
 * Case decided: say so in the ticket, flip its name to ✅ / ❌ / 🔒 and schedule
 * it to close. Best effort.
 */
export async function scheduleClose(channelId: string | null, message: string, outcome?: "approved" | "rejected" | "closed"): Promise<void> {
  if (!channelId) return;
  await ensureTable();
  await postInTicket(channelId, `${message}\n\n_This ticket closes automatically in ${CLOSE_AFTER_DAYS} days._`).catch(() => {});
  if (outcome) await renameTicket(channelId, outcome);
  await getPool().query(
    `INSERT INTO discord_tickets (channel_id, kind, close_after) VALUES (?, 'other', UTC_TIMESTAMP() + INTERVAL ${CLOSE_AFTER_DAYS} DAY)
     ON DUPLICATE KEY UPDATE close_after = COALESCE(close_after, VALUES(close_after))`, [channelId]);
}

/** Delete tickets past their closing date. */
export async function cleanupTickets(): Promise<{ closed: number; failed: number; gone: number }> {
  await ensureTable();
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT channel_id FROM discord_tickets WHERE close_after IS NOT NULL AND close_after < UTC_TIMESTAMP() LIMIT 40");
  let closed = 0, failed = 0;
  for (const r of rows) {
    try {
      await deleteChannel(String(r.channel_id));
      closed++;
    } catch (e) {
      // already deleted by hand → forget it too
      if (!(e instanceof Error && e.message === "discord_404")) { failed++; continue; }
    }
    await forgetTicket(String(r.channel_id));
  }
  const gone = await forgetDeletedTickets().catch(() => 0);
  return { closed, failed, gone };
}

/**
 * A ticket was deleted: remove its case from the database. Open or rejected
 * cases go (Qzino username reset, VIP application and challenge claim rows
 * deleted, a waiting store request rejected); decided-in-favour ones stay on record (a verified player stays
 * verified, an approved VIP application stays) and only lose the link.
 */
export async function forgetTicket(channelId: string): Promise<void> {
  await ensureTable();
  const pool = getPool();
  await pool.query("DELETE FROM discord_tickets WHERE channel_id = ?", [channelId]);
  const steps = [
    // core columns only, so the reset works even before qzino_code / qzino_note exist
    `UPDATE user_accounts SET qzino_username = '', qzino_status = 'none'
      WHERE qzino_ticket = ? AND qzino_status IN ('pending', 'rejected')`,
    "UPDATE user_accounts SET qzino_code = NULL, qzino_note = NULL WHERE qzino_ticket = ? AND qzino_status = 'none'",
    "UPDATE user_accounts SET qzino_ticket = NULL WHERE qzino_ticket = ?",
    "DELETE FROM vip_applications WHERE ticket = ? AND status IN ('pending', 'rejected')",
    "UPDATE vip_applications SET ticket = NULL WHERE ticket = ?",
    "DELETE FROM challenge_claims WHERE ticket = ?",
    // a store request still waiting: turned down, its stock given back
    `UPDATE store_items i JOIN store_redemptions r ON r.item_id = i.id SET i.stock = i.stock + 1
      WHERE r.ticket = ? AND r.status = 'pending' AND i.stock IS NOT NULL`,
    "UPDATE store_redemptions SET status = 'rejected', admin_note = 'ticket deleted' WHERE ticket = ? AND status = 'pending'",
    "UPDATE store_redemptions SET ticket = NULL WHERE ticket = ?",
  ];
  for (const sql of steps) await pool.query(sql, [channelId]).catch(() => {}); // a table or column may not exist yet
}

/**
 * Tickets deleted by hand in Discord: every channel the site still points
 * at is checked, and one Discord reports gone (404) is forgotten like a
 * deleted ticket. Only a 404 counts, never a missing list entry.
 */
export async function forgetDeletedTickets(limit = 40): Promise<number> {
  await ensureTable();
  const pool = getPool();
  const ids = new Set<string>();
  for (const sql of [
    "SELECT channel_id AS id FROM discord_tickets",
    "SELECT qzino_ticket AS id FROM user_accounts WHERE qzino_ticket IS NOT NULL",
    "SELECT ticket AS id FROM vip_applications WHERE ticket IS NOT NULL",
    "SELECT ticket AS id FROM challenge_claims WHERE ticket IS NOT NULL",
    "SELECT ticket AS id FROM store_redemptions WHERE ticket IS NOT NULL",
  ]) {
    const [rows] = await pool.query<RowDataPacket[]>(sql).catch(() => [[] as RowDataPacket[]]);
    for (const r of rows) ids.add(String(r.id));
  }
  let gone = 0;
  for (const id of [...ids].slice(0, limit)) {
    if (await channelGone(id)) { await forgetTicket(id); gone++; }
  }
  return gone;
}

import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { deleteChannel, postInTicket } from "./discordBot";

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

export async function registerTicket(channelId: string, kind: "verify" | "challenge" | "vip"): Promise<void> {
  await ensureTable();
  await getPool().query("INSERT IGNORE INTO discord_tickets (channel_id, kind) VALUES (?, ?)", [channelId, kind]);
}

/** Case decided: say so in the ticket and schedule it to close. Best effort. */
export async function scheduleClose(channelId: string | null, message: string): Promise<void> {
  if (!channelId) return;
  await ensureTable();
  await postInTicket(channelId, `${message}\n\n_This ticket closes automatically in ${CLOSE_AFTER_DAYS} days._`).catch(() => {});
  await getPool().query(
    `INSERT INTO discord_tickets (channel_id, kind, close_after) VALUES (?, 'other', UTC_TIMESTAMP() + INTERVAL ${CLOSE_AFTER_DAYS} DAY)
     ON DUPLICATE KEY UPDATE close_after = COALESCE(close_after, VALUES(close_after))`, [channelId]);
}

/** Delete tickets past their closing date. */
export async function cleanupTickets(): Promise<{ closed: number; failed: number }> {
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
    await pool.query("DELETE FROM discord_tickets WHERE channel_id = ?", [r.channel_id]);
  }
  return { closed, failed };
}

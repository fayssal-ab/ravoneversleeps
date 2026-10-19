import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { openTicket, postInTicket, ticketUrl } from "./discordBot";
import { AppError } from "./tx";

// Qzino username verification and challenge claims, both handled by staff
// in private Discord tickets (lib/discordBot.ts). A viewer saves their Qzino
// username → status "pending" + ticket; an admin verifies or rejects it in
// Admin → Users. Store rewards, milestones and challenge claims need a
// verified username.

export type QzinoStatus = "none" | "pending" | "verified" | "rejected";

let ready: Promise<void> | null = null;
/** Migration 0013 on first use (DDL: never inside a transaction). */
export function ensureVerificationSchema(): Promise<void> {
  ready ??= (async () => {
    const pool = getPool();
    const [cols] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_accounts' AND COLUMN_NAME = 'qzino_status'");
    if (!cols[0]) {
      await pool.query("ALTER TABLE user_accounts ADD COLUMN qzino_status ENUM('none','pending','verified','rejected') NOT NULL DEFAULT 'none', ADD COLUMN qzino_ticket VARCHAR(32) NULL");
      await pool.query("UPDATE user_accounts SET qzino_status = 'verified' WHERE qzino_username <> '' AND qzino_status = 'none'");
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS challenge_claims (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      challenge_id BIGINT NOT NULL,
      account_id BIGINT NOT NULL,
      ticket VARCHAR(32) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_challenge_claim (challenge_id, account_id),
      INDEX idx_claims_challenge (challenge_id)
    ) ENGINE=InnoDB`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function discordIdOf(accountId: number): Promise<string | null> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT provider_user_id FROM user_identities WHERE account_id = ? AND provider = 'discord' LIMIT 1", [accountId]);
  return rows[0] ? String(rows[0].provider_user_id) : null;
}

export async function qzinoStatusOf(accountId: number): Promise<{ status: QzinoStatus; ticketUrl: string | null }> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT qzino_status, qzino_ticket FROM user_accounts WHERE id = ?", [accountId]);
  return { status: (rows[0]?.qzino_status ?? "none") as QzinoStatus, ticketUrl: ticketUrl(rows[0]?.qzino_ticket ?? null) };
}

/** Throws unless the account's Qzino username is verified. */
export async function requireVerifiedQzino(accountId: number): Promise<void> {
  const { status } = await qzinoStatusOf(accountId);
  if (status === "pending") throw new AppError("qzino_pending");
  if (status !== "verified") throw new AppError("qzino_unverified");
}

/** After a new username is saved: mark it pending and open a ticket (best effort). */
export async function requestQzinoVerification(accountId: number, username: string): Promise<void> {
  await ensureVerificationSchema();
  const pool = getPool();
  if (!username) {
    await pool.query("UPDATE user_accounts SET qzino_status = 'none', qzino_ticket = NULL WHERE id = ?", [accountId]);
    return;
  }
  await pool.query("UPDATE user_accounts SET qzino_status = 'pending', qzino_ticket = NULL WHERE id = ?", [accountId]);
  const discordId = await discordIdOf(accountId);
  if (!discordId) return;
  const [acc] = await pool.query<RowDataPacket[]>("SELECT display_name FROM user_accounts WHERE id = ?", [accountId]);
  const ticket = await openTicket({
    name: `verify-${username}`,
    discordUserId: discordId,
    message:
      `**Qzino username verification**\n` +
      `Account: **${String(acc[0]?.display_name ?? "")}** · Qzino username: **${username}**\n\n` +
      `Please send a screenshot of your Qzino profile showing this username (and that you joined with code RAVO50). ` +
      `A staff member will verify it on the site.`,
  }).catch((e: Error) => { console.error("verification ticket failed", e.message); return null; });
  if (ticket) await pool.query("UPDATE user_accounts SET qzino_ticket = ? WHERE id = ?", [ticket.channelId, accountId]);
}

export interface PendingVerification { account_id: number; display_name: string; qzino_username: string; ticket_url: string | null }

export async function pendingVerifications(): Promise<PendingVerification[]> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, display_name, qzino_username, qzino_ticket FROM user_accounts WHERE qzino_status = 'pending' ORDER BY id LIMIT 200");
  return rows.map((r) => ({ account_id: Number(r.id), display_name: String(r.display_name), qzino_username: String(r.qzino_username), ticket_url: ticketUrl(r.qzino_ticket ?? null) }));
}

/** Admin decision; posts it in the ticket. */
export async function decideVerification(accountId: number, verified: boolean): Promise<void> {
  await ensureVerificationSchema();
  const pool = getPool();
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE user_accounts SET qzino_status = ? WHERE id = ? AND qzino_status = 'pending'", [verified ? "verified" : "rejected", accountId]);
  if (!res.affectedRows) throw new AppError("invalid_input", "not pending");
  const [acc] = await pool.query<RowDataPacket[]>("SELECT qzino_ticket FROM user_accounts WHERE id = ?", [accountId]);
  if (acc[0]?.qzino_ticket) {
    await postInTicket(String(acc[0].qzino_ticket), verified
      ? "✅ Your Qzino username is **verified**. Store rewards, milestones and challenges are unlocked."
      : "❌ We couldn't verify this Qzino username. Update it on your account page to try again.").catch(() => {});
  }
}

// ── challenge claims ───────────────────────────────────────────────────

export interface ClaimInfo { ticket_url: string | null }

/** Viewer's claims by challenge id. */
export async function myChallengeClaims(accountId: number): Promise<Map<number, ClaimInfo>> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT challenge_id, ticket FROM challenge_claims WHERE account_id = ?", [accountId]);
  return new Map(rows.map((r) => [Number(r.challenge_id), { ticket_url: ticketUrl(r.ticket ?? null) }]));
}

/**
 * "I hit it": opens a proof ticket for an open challenge. One claim per
 * viewer per challenge; needs a verified Qzino username and Discord.
 */
export async function claimChallenge(accountId: number, challengeId: number): Promise<string | null> {
  await ensureVerificationSchema();
  await requireVerifiedQzino(accountId);
  const pool = getPool();
  const [ch] = await pool.query<RowDataPacket[]>("SELECT slot_name, target_multi, reward, min_bet, status FROM challenges WHERE id = ?", [challengeId]);
  if (!ch[0]) throw new AppError("not_found");
  if (ch[0].status !== "open") throw new AppError("challenge_closed");
  const discordId = await discordIdOf(accountId);
  if (!discordId) throw new AppError("discord_required");
  const [ins] = await pool.query<ResultSetHeader>("INSERT IGNORE INTO challenge_claims (challenge_id, account_id) VALUES (?, ?)", [challengeId, accountId]);
  if (!ins.affectedRows) throw new AppError("already_claimed");
  const [acc] = await pool.query<RowDataPacket[]>("SELECT display_name, qzino_username FROM user_accounts WHERE id = ?", [accountId]);
  const c = ch[0];
  const ticket = await openTicket({
    name: `challenge-${c.slot_name}-${acc[0]?.qzino_username ?? accountId}`,
    discordUserId: discordId,
    message:
      `**Challenge claim** · ${c.slot_name}: first to hit **${Number(c.target_multi)}x** wins **$${Number(c.reward)}**` +
      (Number(c.min_bet) > 0 ? ` (min bet $${Number(c.min_bet)})` : "") + `\n` +
      `Player: **${String(acc[0]?.display_name ?? "")}** · Qzino: **${String(acc[0]?.qzino_username ?? "")}**\n\n` +
      `📸 **Send your proof here**: a screenshot or clip where the bet and the win are visible. A staff member will check it.`,
  }).catch((e: Error) => { console.error("challenge ticket failed", e.message); return null; });
  if (ticket) await pool.query("UPDATE challenge_claims SET ticket = ? WHERE challenge_id = ? AND account_id = ?", [ticket.channelId, challengeId, accountId]);
  return ticket?.url ?? null;
}

export interface AdminClaim { challenge_id: number; display_name: string; qzino_username: string; ticket_url: string | null; created_at: string }

export async function challengeClaimsByChallenge(): Promise<Map<number, AdminClaim[]>> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT c.challenge_id, a.display_name, a.qzino_username, c.ticket, c.created_at
       FROM challenge_claims c JOIN user_accounts a ON a.id = c.account_id ORDER BY c.id`);
  const out = new Map<number, AdminClaim[]>();
  for (const r of rows) {
    const list = out.get(Number(r.challenge_id)) ?? [];
    list.push({ challenge_id: Number(r.challenge_id), display_name: String(r.display_name), qzino_username: String(r.qzino_username), ticket_url: ticketUrl(r.ticket ?? null), created_at: String(r.created_at) });
    out.set(Number(r.challenge_id), list);
  }
  return out;
}

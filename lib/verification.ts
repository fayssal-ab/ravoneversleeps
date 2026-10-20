import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomInt } from "node:crypto";
import { getPool } from "./db";
import { openTicket, ticketUrl } from "./discordBot";
import { liveStanding } from "./qboards";
import { registerTicket, scheduleClose } from "./tickets";
import { AppError } from "./tx";

// Qzino username verification and challenge claims, both handled by staff
// in private Discord tickets (lib/discordBot.ts). A viewer saves their Qzino
// username → status "pending", a one-off ownership code and a ticket. The
// proof is a short screen recording that starts on their Qzino profile
// (username visible) and ends typing the code in the ticket, so it can't be
// someone else's screenshot. An admin verifies or rejects it in Admin →
// Users, seeing the linked Discord + Kick, the username's leaderboard
// standing and any other account claiming the same username. A username is
// only ever verified on one account. Store rewards, milestones and challenge
// claims need a verified username.

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
    const [code] = await pool.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_accounts' AND COLUMN_NAME = 'qzino_code'");
    if (!code[0]) await pool.query("ALTER TABLE user_accounts ADD COLUMN qzino_code VARCHAR(16) NULL, ADD COLUMN qzino_note VARCHAR(255) NULL");
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

export interface QzinoState { status: QzinoStatus; ticketUrl: string | null; code: string | null; note: string | null }

export async function qzinoStatusOf(accountId: number): Promise<QzinoState> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT qzino_status, qzino_ticket, qzino_code, qzino_note FROM user_accounts WHERE id = ?", [accountId]);
  return {
    status: (rows[0]?.qzino_status ?? "none") as QzinoStatus, ticketUrl: ticketUrl(rows[0]?.qzino_ticket ?? null),
    code: rows[0]?.qzino_code ? String(rows[0].qzino_code) : null, note: rows[0]?.qzino_note ? String(rows[0].qzino_note) : null,
  };
}

/** "RAVO-7K3QX": no 0/O/1/I so it can't be misread in a recording. */
function newCode(): string {
  const abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "RAVO-" + Array.from({ length: 5 }, () => abc[randomInt(abc.length)]).join("");
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
    await pool.query("UPDATE user_accounts SET qzino_status = 'none', qzino_ticket = NULL, qzino_code = NULL, qzino_note = NULL WHERE id = ?", [accountId]);
    return;
  }
  const code = newCode();
  await pool.query("UPDATE user_accounts SET qzino_status = 'pending', qzino_ticket = NULL, qzino_code = ?, qzino_note = NULL WHERE id = ?", [code, accountId]);
  const discordId = await discordIdOf(accountId);
  if (!discordId) return;
  const [acc] = await pool.query<RowDataPacket[]>("SELECT display_name FROM user_accounts WHERE id = ?", [accountId]);
  const ticket = await openTicket({
    name: `verify-${username}`,
    discordUserId: discordId,
    message:
      `**Qzino username verification**\n` +
      `Account: **${String(acc[0]?.display_name ?? "")}** · Qzino username: **${username}** · Your code: **${code}**\n\n` +
      `To prove this Qzino account is yours, send a short **screen recording** (10–30 s) here:\n` +
      `1. Start on Qzino, logged in, on your profile page with the username **${username}** visible.\n` +
      `2. Without cutting, switch to this Discord ticket and type the code **${code}**.\n\n` +
      `Screenshots alone aren't accepted. A staff member will check it and verify you on the site.`,
  }).catch((e: Error) => { console.error("verification ticket failed", e.message); return null; });
  if (ticket) {
    await pool.query("UPDATE user_accounts SET qzino_ticket = ? WHERE id = ?", [ticket.channelId, accountId]);
    await registerTicket(ticket.channelId, "verify").catch(() => {});
  }
}

export interface PendingVerification {
  account_id: number; display_name: string; avatar: string; qzino_username: string; code: string | null; ticket_url: string | null;
  discord: string | null; kick: string | null; joined: string; age_days: number;
  /** other accounts claiming the same username right now */
  rivals: { account_id: number; display_name: string; status: QzinoStatus }[];
  /** where the username sits on the running leaderboard */
  standing: { rank: number; score: string; title: string } | null;
}

export async function pendingVerifications(): Promise<PendingVerification[]> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT a.id, a.display_name, a.avatar, a.qzino_username, a.qzino_ticket, a.qzino_code, a.created_at,
            DATEDIFF(CURRENT_TIMESTAMP, a.created_at) AS age_days,
            (SELECT username FROM user_identities WHERE account_id = a.id AND provider = 'discord' LIMIT 1) AS discord,
            (SELECT username FROM user_identities WHERE account_id = a.id AND provider = 'kick' LIMIT 1) AS kick
       FROM user_accounts a WHERE a.qzino_status = 'pending' ORDER BY a.id LIMIT 200`);
  const names = [...new Set(rows.map((r) => String(r.qzino_username).toLowerCase()))];
  const [others] = names.length
    ? await getPool().query<RowDataPacket[]>(
      "SELECT id, display_name, qzino_username, qzino_status FROM user_accounts WHERE LOWER(qzino_username) IN (?) AND qzino_status IN ('pending', 'verified')", [names])
    : [[] as RowDataPacket[]];
  const standings = new Map(await Promise.all(names.map(async (n) => [n, await liveStanding(n).catch(() => null)] as const)));
  return rows.map((r) => {
    const name = String(r.qzino_username).toLowerCase();
    return {
      account_id: Number(r.id), display_name: String(r.display_name), avatar: String(r.avatar ?? ""), qzino_username: String(r.qzino_username),
      code: r.qzino_code ? String(r.qzino_code) : null, ticket_url: ticketUrl(r.qzino_ticket ?? null),
      discord: r.discord ? String(r.discord) : null, kick: r.kick ? String(r.kick) : null, joined: String(r.created_at), age_days: Number(r.age_days ?? 0),
      rivals: others.filter((o) => String(o.qzino_username).toLowerCase() === name && Number(o.id) !== Number(r.id))
        .map((o) => ({ account_id: Number(o.id), display_name: String(o.display_name), status: o.qzino_status as QzinoStatus })),
      standing: standings.get(name) ?? null,
    };
  });
}

export const REJECT_REASONS = {
  no_code: "The recording didn't show your code typed in the ticket.",
  no_recording: "We need a screen recording, not a screenshot.",
  not_owner: "The recording didn't show this Qzino account logged in.",
  not_ravo: "This Qzino account isn't registered under code RAVO50.",
  other: "We couldn't confirm this username belongs to you.",
} as const;
export type RejectReason = keyof typeof REJECT_REASONS;

/**
 * Admin decision; posts it in the ticket. Verifying fails if another account
 * already owns the username, and rejects every other pending claim on it.
 */
export async function decideVerification(accountId: number, verified: boolean, reason: RejectReason = "other"): Promise<void> {
  await ensureVerificationSchema();
  const pool = getPool();
  const [me] = await pool.query<RowDataPacket[]>("SELECT qzino_username, qzino_ticket FROM user_accounts WHERE id = ? AND qzino_status = 'pending'", [accountId]);
  if (!me[0]) throw new AppError("invalid_input", "not pending");
  const username = String(me[0].qzino_username);
  if (verified) {
    const [owner] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM user_accounts WHERE LOWER(qzino_username) = LOWER(?) AND id <> ? AND qzino_status = 'verified' LIMIT 1", [username, accountId]);
    if (owner[0]) throw new AppError("qzino_taken", `already verified on account #${owner[0].id}`);
  }
  const note = verified ? null : REJECT_REASONS[reason];
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE user_accounts SET qzino_status = ?, qzino_note = ? WHERE id = ? AND qzino_status = 'pending'", [verified ? "verified" : "rejected", note, accountId]);
  if (!res.affectedRows) throw new AppError("invalid_input", "not pending");
  await scheduleClose(me[0].qzino_ticket ? String(me[0].qzino_ticket) : null, verified
    ? "✅ Your Qzino username is **verified**. Store rewards, milestones and challenges are unlocked."
    : `❌ We couldn't verify this Qzino username: ${note} Update it on your account page to try again.`);
  if (verified) {
    // the username is taken now: every other claim on it is turned down
    const [rivals] = await pool.query<RowDataPacket[]>(
      "SELECT id, qzino_ticket FROM user_accounts WHERE LOWER(qzino_username) = LOWER(?) AND id <> ? AND qzino_status = 'pending'", [username, accountId]);
    for (const r of rivals) {
      await pool.query("UPDATE user_accounts SET qzino_status = 'rejected', qzino_note = ? WHERE id = ?", ["This Qzino username was verified for another account.", r.id]);
      await scheduleClose(r.qzino_ticket ? String(r.qzino_ticket) : null, "❌ This Qzino username was verified for another account. If it's really yours, tell the team here before the ticket closes.").catch(() => {});
    }
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
  if (ticket) {
    await pool.query("UPDATE challenge_claims SET ticket = ? WHERE challenge_id = ? AND account_id = ?", [ticket.channelId, challengeId, accountId]);
    await registerTicket(ticket.channelId, "challenge").catch(() => {});
  }
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

/** Claims waiting on challenges that are still open (admin dashboard). */
export async function openChallengeClaimCount(): Promise<number> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM challenge_claims c JOIN challenges ch ON ch.id = c.challenge_id WHERE ch.status = 'open'");
  return Number(rows[0].n);
}


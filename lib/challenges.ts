import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { getSlot } from "./slots";
import { AppError } from "./tx";
import { scheduleClose } from "./tickets";

// Slot challenges: "first to hit <target>x on <slot> wins $<reward>", with a
// minimum bet. The team checks the proof (Discord) and marks the winner.

export interface Challenge {
  id: number; slot_name: string; provider: string; image_url: string | null;
  target_multi: string; reward: string; min_bet: string;
  status: "open" | "won" | "closed"; winner: string | null; winner_multi: string | null; won_at: string | null; created_at: string;
}

let ready: Promise<void> | null = null;
/** Migration 0012 on first use if it hasn't been run. */
function ensureTable(): Promise<void> {
  ready ??= getPool().query(`CREATE TABLE IF NOT EXISTS challenges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slot_id VARCHAR(191) NULL,
    slot_name VARCHAR(191) NOT NULL,
    provider VARCHAR(120) NOT NULL DEFAULT '',
    image_url VARCHAR(512) NULL,
    target_multi DECIMAL(12,2) NOT NULL,
    reward DECIMAL(20,2) NOT NULL,
    min_bet DECIMAL(20,2) NOT NULL DEFAULT 0,
    status ENUM('open','won','closed') NOT NULL DEFAULT 'open',
    winner VARCHAR(191) NULL,
    winner_multi DECIMAL(12,2) NULL,
    won_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_challenges_status (status, created_at)
  ) ENGINE=InnoDB`).then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

const COLS = "id, slot_name, provider, image_url, target_multi, reward, min_bet, status, winner, winner_multi, won_at, created_at";
const toChallenge = (r: RowDataPacket): Challenge => ({
  id: Number(r.id), slot_name: String(r.slot_name), provider: String(r.provider), image_url: r.image_url ? String(r.image_url) : null,
  target_multi: String(r.target_multi), reward: String(r.reward), min_bet: String(r.min_bet), status: r.status,
  winner: r.winner ? String(r.winner) : null, winner_multi: r.winner_multi != null ? String(r.winner_multi) : null,
  won_at: r.won_at ? String(r.won_at) : null, created_at: String(r.created_at),
});

/** Open challenges first (newest first), then the latest finished ones. */
export async function listChallenges(limit = 60): Promise<Challenge[]> {
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${COLS} FROM challenges ORDER BY FIELD(status, 'open', 'won', 'closed'), COALESCE(won_at, created_at) DESC, id DESC LIMIT ?`, [limit]);
  return rows.map(toChallenge);
}

export async function createChallenge(v: { slot_id: string; slot: string; provider: string; target_multi: string; reward: string; min_bet: string }): Promise<number> {
  await ensureTable();
  const cat = v.slot_id ? await getSlot(v.slot_id) : null;
  if (v.slot_id && !cat) throw new AppError("not_found", "slot not in the catalogue");
  const name = cat?.name ?? v.slot;
  if (!name) throw new AppError("invalid_input", "pick or type a slot");
  if (Number(v.target_multi) <= 0 || Number(v.reward) <= 0) throw new AppError("invalid_input", "target and reward must be above 0");
  const [res] = await getPool().query<ResultSetHeader>(
    "INSERT INTO challenges (slot_id, slot_name, provider, image_url, target_multi, reward, min_bet) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [cat?.id ?? null, name, cat?.provider ?? v.provider, cat?.imageUrl ?? null, v.target_multi, v.reward, v.min_bet || "0"]);
  return res.insertId;
}

/** Team verified the proof: mark the winner (only an open challenge). */
export async function markChallengeWon(id: number, winner: string, multi: string): Promise<void> {
  await ensureTable();
  const [res] = await getPool().query<ResultSetHeader>(
    "UPDATE challenges SET status = 'won', winner = ?, winner_multi = ?, won_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'open'", [winner, multi, id]);
  if (!res.affectedRows) throw new AppError("invalid_input", "only an open challenge can be won");
  await notifyClaimants(id, `🏆 This challenge has been won by **${winner}** (${Number(multi)}x). Thanks for playing!`);
}

/** Post the outcome in every claim ticket of a challenge and schedule them to close. */
async function notifyClaimants(challengeId: number, message: string): Promise<void> {
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT ticket FROM challenge_claims WHERE challenge_id = ? AND ticket IS NOT NULL", [challengeId]).catch(() => [[]] as unknown as [RowDataPacket[]]);
  for (const r of rows) await scheduleClose(String(r.ticket), message, "closed");
}

export async function setChallengeStatus(id: number, status: "open" | "closed"): Promise<void> {
  await ensureTable();
  if (status === "closed") await notifyClaimants(id, "This challenge has been closed by the team.");
  await getPool().query(
    "UPDATE challenges SET status = ?, winner = IF(? = 'open', NULL, winner), winner_multi = IF(? = 'open', NULL, winner_multi), won_at = IF(? = 'open', NULL, won_at) WHERE id = ?",
    [status, status, status, status, id]);
}

export async function deleteChallenge(id: number): Promise<void> {
  await ensureTable();
  await getPool().query("DELETE FROM challenges WHERE id = ?", [id]);
}

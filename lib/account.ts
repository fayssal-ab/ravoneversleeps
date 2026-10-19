import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { rankForXp, type Rank } from "./ranks";
import { AppError } from "./tx";
import { currentAccountId, type Provider } from "./userAuth";

// Accounts, points and the rank table. Every balance change goes through
// applyPoints inside a transaction and is written to points_ledger.

export async function getRanks(): Promise<Rank[]> {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>("SELECT level, name, min_xp FROM ranks ORDER BY level");
    return rows.map((r) => ({ level: Number(r.level), name: String(r.name), min_xp: Number(r.min_xp) }));
  } catch {
    return [];
  }
}

export interface Viewer {
  id: number;
  display_name: string;
  avatar: string;
  qzino_username: string;
  points: number;
  xp: number;
  level: number;
  identities: { provider: Provider; username: string }[];
}

export async function getViewerById(id: number, ranks?: Rank[]): Promise<Viewer | null> {
  const pool = getPool();
  const [[acc], [ids]] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT id, display_name, avatar, qzino_username, points, xp FROM user_accounts WHERE id = ? AND banned = 0", [id]),
    pool.query<RowDataPacket[]>("SELECT provider, username FROM user_identities WHERE account_id = ? ORDER BY linked_at", [id]),
  ]);
  const a = acc[0];
  if (!a) return null;
  const xp = Number(a.xp);
  const level = rankForXp(ranks ?? (await getRanks()), xp).level;
  return {
    id: Number(a.id), display_name: String(a.display_name), avatar: String(a.avatar), qzino_username: String(a.qzino_username),
    points: Number(a.points), xp, level, identities: ids as Viewer["identities"],
  };
}

/** The signed-in viewer, or null. Never throws (DB down → signed out). */
export async function getViewer(): Promise<Viewer | null> {
  try {
    const id = await currentAccountId();
    return id == null ? null : await getViewerById(id);
  } catch {
    return null;
  }
}

export type LedgerKind = "grant" | "deduct" | "redeem" | "refund" | "raffle";

/**
 * Change a balance inside the caller's transaction. Spending refuses to go
 * below zero; only `grant` raises xp (spending never lowers a rank).
 */
export async function applyPoints(
  conn: PoolConnection,
  accountId: number,
  delta: number,
  kind: LedgerKind,
  note = "",
  refId: number | null = null
): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>("SELECT points FROM user_accounts WHERE id = ? FOR UPDATE", [accountId]);
  if (!rows[0]) throw new AppError("not_found");
  const balance = Number(rows[0].points);
  if (balance + delta < 0) throw new AppError("insufficient_points");
  const xpGain = kind === "grant" && delta > 0 ? delta : 0;
  await conn.query("UPDATE user_accounts SET points = points + ?, xp = xp + ? WHERE id = ?", [delta, xpGain, accountId]);
  await conn.query<ResultSetHeader>(
    "INSERT INTO points_ledger (account_id, delta, kind, note, ref_id) VALUES (?, ?, ?, ?, ?)",
    [accountId, delta, kind, note.slice(0, 255), refId]
  );
  return balance + delta;
}

/**
 * A Qzino username can belong to one account only, and is locked once a
 * milestone has been claimed with it (an admin can still change it).
 */
export async function saveQzinoUsername(accountId: number, username: string): Promise<boolean> {
  const pool = getPool();
  const [[cur], [taken], [claims]] = await Promise.all([
    pool.query<RowDataPacket[]>("SELECT qzino_username FROM user_accounts WHERE id = ?", [accountId]),
    pool.query<RowDataPacket[]>("SELECT id FROM user_accounts WHERE ? <> '' AND LOWER(qzino_username) = LOWER(?) AND id <> ? LIMIT 1", [username, username, accountId]),
    pool.query<RowDataPacket[]>("SELECT 1 FROM milestone_claims WHERE account_id = ? LIMIT 1", [accountId]),
  ]);
  if (String(cur[0]?.qzino_username ?? "").toLowerCase() === username.toLowerCase()) return false;
  if (taken[0]) throw new AppError("qzino_taken");
  if (claims[0]) throw new AppError("qzino_locked");
  await pool.query("UPDATE user_accounts SET qzino_username = ? WHERE id = ?", [username, accountId]);
  return true;
}

export interface LedgerRow { id: number; delta: number; kind: LedgerKind; note: string; created_at: string }

export async function getLedger(accountId: number, limit = 30): Promise<LedgerRow[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id, delta, kind, note, created_at FROM points_ledger WHERE account_id = ? ORDER BY id DESC LIMIT ?",
    [accountId, limit]
  );
  return rows.map((r) => ({ id: Number(r.id), delta: Number(r.delta), kind: r.kind, note: String(r.note), created_at: String(r.created_at) }));
}

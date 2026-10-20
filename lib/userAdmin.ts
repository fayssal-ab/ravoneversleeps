import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { getQboardsBoard } from "./qboards";
import { applyPoints } from "./account";
import { AppError, withTx } from "./tx";
import { ensureVerificationSchema } from "./verification";

export interface AdminUser {
  id: number;
  display_name: string;
  qzino_username: string;
  points: number;
  xp: number;
  banned: boolean;
  created_at: string;
  last_login_at: string | null;
  providers: string;
  qzino_status: "none" | "pending" | "verified" | "rejected";
}

export type UserSort = "name" | "points" | "newest" | "login";
export type UserFilter = "all" | "verified" | "pending" | "unverified" | "banned";
const SORT_SQL: Record<UserSort, string> = {
  name: "a.display_name ASC, a.id",
  points: "a.points DESC, a.id",
  newest: "a.created_at DESC, a.id DESC",
  login: "a.last_login_at IS NULL, a.last_login_at DESC, a.id",
};
const FILTER_SQL: Record<UserFilter, string> = {
  all: "1 = 1",
  verified: "a.qzino_status = 'verified'",
  pending: "a.qzino_status = 'pending'",
  unverified: "a.qzino_status IN ('none', 'rejected')",
  banned: "a.banned = 1",
};

export async function searchUsers(q: string, opts: { sort?: UserSort; filter?: UserFilter; limit?: number } = {}): Promise<AdminUser[]> {
  await ensureVerificationSchema();
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT a.id, a.display_name, a.qzino_username, a.qzino_status, a.points, a.xp, a.banned, a.created_at, a.last_login_at,
            COALESCE(GROUP_CONCAT(CONCAT(i.provider, ':', i.username) ORDER BY i.provider SEPARATOR ' · '), '') AS providers
       FROM user_accounts a LEFT JOIN user_identities i ON i.account_id = a.id
      WHERE (? = '' OR a.display_name LIKE ? OR a.qzino_username LIKE ? OR i.username LIKE ?) AND ${FILTER_SQL[opts.filter ?? "all"]}
      GROUP BY a.id ORDER BY ${SORT_SQL[opts.sort ?? "name"]} LIMIT ?`,
    [q, like, like, like, opts.limit ?? 100]
  );
  return rows.map((r) => ({
    id: Number(r.id), display_name: String(r.display_name), qzino_username: String(r.qzino_username), points: Number(r.points),
    xp: Number(r.xp), banned: Boolean(Number(r.banned)), created_at: String(r.created_at), last_login_at: r.last_login_at ? String(r.last_login_at) : null,
    providers: String(r.providers), qzino_status: (r.qzino_status ?? "none") as AdminUser["qzino_status"],
  }));
}

/** Counts per filter for the Accounts tab. */
export async function userCounts(): Promise<Record<UserFilter, number>> {
  await ensureVerificationSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS all_, SUM(qzino_status = 'verified') AS verified, SUM(qzino_status = 'pending') AS pending,
            SUM(qzino_status IN ('none','rejected')) AS unverified, SUM(banned = 1) AS banned FROM user_accounts`);
  const r = rows[0];
  return { all: Number(r.all_), verified: Number(r.verified ?? 0), pending: Number(r.pending ?? 0), unverified: Number(r.unverified ?? 0), banned: Number(r.banned ?? 0) };
}

export interface LedgerEntry { id: number; account_id: number; display_name: string; delta: number; kind: string; note: string; created_at: string }

/** Latest points movements across every account (admin history). */
export async function recentLedger(limit = 150): Promise<LedgerEntry[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT l.id, l.account_id, a.display_name, l.delta, l.kind, l.note, l.created_at
       FROM points_ledger l JOIN user_accounts a ON a.id = l.account_id ORDER BY l.id DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ id: Number(r.id), account_id: Number(r.account_id), display_name: String(r.display_name), delta: Number(r.delta), kind: String(r.kind), note: String(r.note), created_at: String(r.created_at) }));
}

/** Grant (delta > 0, also raises xp) or deduct points from one account. */
export async function adjustPoints(accountId: number, delta: number, note: string): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) throw new AppError("invalid_input", "amount must be a non-zero whole number");
  await withTx((conn) => applyPoints(conn, accountId, delta, delta > 0 ? "grant" : "deduct", note));
}

/**
 * Bulk grant from pasted lines "name,points". The name matches a Qzino
 * username, a Kick/Discord username or a display name (case-insensitive,
 * first match wins). Unknown names are reported, not created.
 */
export async function bulkGrant(lines: { name: string; points: number }[], note: string): Promise<{ granted: number; unknown: string[] }> {
  const unknown: string[] = [];
  let granted = 0;
  await withTx(async (conn) => {
    for (const l of lines) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT a.id FROM user_accounts a LEFT JOIN user_identities i ON i.account_id = a.id
          WHERE LOWER(a.qzino_username) = LOWER(?) OR LOWER(i.username) = LOWER(?) OR LOWER(a.display_name) = LOWER(?)
          ORDER BY (LOWER(a.qzino_username) = LOWER(?)) DESC, a.id LIMIT 1`,
        [l.name, l.name, l.name, l.name]
      );
      if (!rows[0]) { unknown.push(l.name); continue; }
      await applyPoints(conn, Number(rows[0].id), l.points, "grant", note);
      granted++;
    }
  });
  return { granted, unknown };
}

export async function setBanned(accountId: number, banned: boolean): Promise<void> {
  await getPool().query("UPDATE user_accounts SET banned = ? WHERE id = ?", [banned ? 1 : 0, accountId]);
  if (banned) await getPool().query("DELETE FROM user_sessions WHERE account_id = ?", [accountId]);
}

/** Admin-entered usernames are trusted: a new one is verified straight away. */
export async function adminSetQzino(accountId: number, username: string): Promise<void> {
  await ensureVerificationSchema();
  if (username) {
    const [other] = await getPool().query<RowDataPacket[]>(
      "SELECT id FROM user_accounts WHERE LOWER(qzino_username) = LOWER(?) AND id <> ? AND qzino_status = 'verified' LIMIT 1", [username, accountId]);
    if (other[0]) throw new AppError("qzino_taken", `already verified on account #${other[0].id}`);
  }
  await getPool().query(
    `UPDATE user_accounts SET qzino_status = IF(? = '', 'none', IF(LOWER(qzino_username) = LOWER(?), qzino_status, 'verified')), qzino_username = ? WHERE id = ?`,
    [username, username, username, accountId]);
}

export interface Stats { users: number; points_out: number; pending: number; open_raffles: number; live_period: string | null; board_players: number }

export async function getStats(): Promise<Stats> {
  const [[u], [r], [rf], board] = await Promise.all([
    getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS n, COALESCE(SUM(points), 0) AS pts FROM user_accounts"),
    getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM store_redemptions WHERE status = 'pending'"),
    getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM raffles WHERE status = 'open'"),
    getQboardsBoard(1000).catch(() => null),
  ]);
  const live = board?.period?.state === "live" ? board : null;
  return {
    users: Number(u[0].n), points_out: Number(u[0].pts), pending: Number(r[0].n), open_raffles: Number(rf[0].n),
    live_period: live ? live.period!.title : null, board_players: live ? live.rows.length : 0,
  };
}

export async function saveRanks(rows: { level: number; name: string; min_xp: number }[]): Promise<void> {
  const sorted = [...rows].sort((a, b) => a.level - b.level);
  if (sorted[0]?.min_xp !== 0) throw new AppError("invalid_input", "level 1 must start at 0 XP");
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min_xp <= sorted[i - 1].min_xp) throw new AppError("invalid_input", `level ${sorted[i].level} needs more XP than level ${sorted[i - 1].level}`);
  }
  await withTx(async (conn) => {
    // two passes keep the UNIQUE(min_xp) index happy while thresholds shift
    for (const r of sorted) await conn.query("UPDATE ranks SET min_xp = ? WHERE level = ?", [1_000_000_000_000 + r.level, r.level]);
    for (const r of sorted) await conn.query("UPDATE ranks SET name = ?, min_xp = ? WHERE level = ?", [r.name, r.min_xp, r.level]);
  });
}

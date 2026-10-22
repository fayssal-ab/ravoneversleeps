import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { getQboardsBoard } from "./qboards";

// Leaderboard. The public board comes from Q-boards (lib/qboards.ts): the
// running monthly event plus the archive of finished ones. Periods entered
// by hand before the Q-boards sync (lb_periods) stay readable at
// /leaderboard?p=<id>.

export interface Period {
  id: number;
  title: string;
  starts_at: string; // "YYYY-MM-DD HH:MM:SS" UTC
  ends_at: string;
  prize_pool: string;
  state: "upcoming" | "live" | "ended";
}

export interface Prize { place: number; amount: string }
export interface BoardRow { rank: number; name: string; wagered: string; prize: string | null }
export interface PastPeriod extends Period { winner: string | null; link?: string }
export interface Board {
  period: Period | null; prizes: Prize[]; rows: BoardRow[]; previous: PastPeriod[];
  source?: "qboards"; scoreKind?: "points" | "wagered"; syncedAt?: string; syncDelayed?: boolean; eventId?: string;
}

const STATE_SQL = `CASE WHEN UTC_TIMESTAMP() < starts_at THEN 'upcoming' WHEN UTC_TIMESTAMP() < ends_at THEN 'live' ELSE 'ended' END`;
const toPeriod = (r: RowDataPacket): Period => ({
  id: Number(r.id), title: String(r.title), starts_at: String(r.starts_at), ends_at: String(r.ends_at),
  prize_pool: String(r.prize_pool), state: r.state,
});

export async function listPeriods(): Promise<Period[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, title, starts_at, ends_at, prize_pool, ${STATE_SQL} AS state FROM lb_periods ORDER BY starts_at DESC`);
  return rows.map(toPeriod);
}

/** Attach each ended period's #1. */
async function withWinners(list: Period[]): Promise<PastPeriod[]> {
  if (!list.length) return [];
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT e.period_id, e.username FROM lb_entries e
      JOIN (SELECT period_id, MAX(wagered) AS top FROM lb_entries WHERE period_id IN (?) GROUP BY period_id) t
        ON t.period_id = e.period_id AND t.top = e.wagered
      WHERE e.wagered > 0 ORDER BY e.updated_at, e.username`,
    [list.map((p) => p.id)]
  );
  const winner = new Map<number, string>();
  for (const r of rows) if (!winner.has(Number(r.period_id))) winner.set(Number(r.period_id), String(r.username));
  return list.map((p) => ({ ...p, winner: winner.get(p.id) ?? null }));
}

async function prizesFor(periodId: number): Promise<Prize[]> {
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT place, amount FROM lb_prizes WHERE period_id = ? ORDER BY place", [periodId]);
  return rows.map((r) => ({ place: Number(r.place), amount: String(r.amount) }));
}

/**
 * The board for a period id, or the current one: the live period, else the
 * next upcoming, else the most recent ended. `null` period = nothing yet.
 */
export async function getBoard(periodId?: number | string, limit = 100): Promise<Board> {
  if (periodId == null || typeof periodId === "string") {
    const external = await getQboardsBoard(limit, periodId).catch((err: unknown) => {
      // Allow existing installations to run before migration 0006 is applied.
      if ((err as { code?: string }).code === "ER_NO_SUCH_TABLE") return null;
      throw err;
    });
    // The public current board uses Q-boards points exclusively. Never fall
    // back to manual dollar wagers while waiting for the first scheduled import.
    return external ?? { period: null, prizes: [], rows: [], previous: [], source: "qboards", scoreKind: "points" };
  }
  const periods = await listPeriods();
  const period =
    (periodId != null ? periods.find((p) => p.id === periodId) : undefined) ??
    (periodId == null
      ? periods.find((p) => p.state === "live") ??
        [...periods].reverse().find((p) => p.state === "upcoming") ??
        periods.find((p) => p.state === "ended")
      : undefined) ??
    null;
  const previous = await withWinners(periods.filter((p) => p.state === "ended" && p.id !== period?.id).slice(0, 12));
  if (!period) return { period: null, prizes: [], rows: [], previous };

  const prizes = await prizesFor(period.id);
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT username, wagered, ROW_NUMBER() OVER (ORDER BY wagered DESC, updated_at, username) AS rnk
       FROM lb_entries WHERE period_id = ? AND wagered > 0 ORDER BY rnk LIMIT ?`,
    [period.id, limit]
  );
  const prizeByPlace = new Map(prizes.map((p) => [p.place, p.amount]));
  return {
    period,
    prizes,
    previous,
    rows: rows.map((r) => ({
      rank: Number(r.rnk),
      name: String(r.username),
      wagered: String(r.wagered),
      prize: prizeByPlace.get(Number(r.rnk)) ?? null,
    })),
  };
}

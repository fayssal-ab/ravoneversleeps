import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { formatMoney } from "./money";
import type { Board } from "./leaderboard";

// Prizes for the top 3 of the running leaderboard, set by Ravo in Admin →
// Leaderboard prizes (an amount like "$3,000" or an item like "AirPods Pro
// Max 2"). Places 4+ keep the prizes from Q-boards. Archived months show what
// Q-boards recorded.

export const DEFAULT_TOP_PRIZES = ["$3,000", "$2,000", "AirPods Pro Max 2"];
const KEY = "leaderboard_top_prizes";

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= getPool().query(`CREATE TABLE IF NOT EXISTS site_settings (
    k VARCHAR(64) PRIMARY KEY, v TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`).then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

export async function getTopPrizes(): Promise<string[]> {
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT v FROM site_settings WHERE k = ?", [KEY]);
  if (!rows[0]) return DEFAULT_TOP_PRIZES;
  try {
    const v = JSON.parse(String(rows[0].v));
    return Array.isArray(v) ? v.slice(0, 3).map((x) => String(x ?? "")) : DEFAULT_TOP_PRIZES;
  } catch { return DEFAULT_TOP_PRIZES; }
}

export async function saveTopPrizes(prizes: string[]): Promise<void> {
  await ensureTable();
  await getPool().query(
    "INSERT INTO site_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [KEY, JSON.stringify(prizes.slice(0, 3))]);
}

/** "$3,000" → 3000; anything that isn't a plain amount → null (an item). */
export function moneyValue(label: string): number | null {
  const m = label.trim().match(/^\$\s*([\d,]+(?:\.\d{1,2})?)$/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

export interface PrizeView {
  /** Prize label per place (1-based). */
  byPlace: Record<number, string>;
  /** Headline: total cash (+ items), e.g. "$5,155 + AirPods Pro Max 2". */
  pool: string;
}

/** Labels for every paid place: the top 3 from the settings, the rest from Q-boards. */
export function prizeView(board: Board, top: string[] | null): PrizeView {
  const byPlace: Record<number, string> = {};
  for (const p of board.prizes) byPlace[p.place] = formatMoney(p.amount, { cents: Number(p.amount) % 1 !== 0 });
  if (!top) return { byPlace, pool: board.period ? formatMoney(board.period.prize_pool, { cents: false }) : "" };
  let cash = 0;
  const items: string[] = [];
  top.forEach((label, i) => {
    const place = i + 1;
    if (!label.trim()) { delete byPlace[place]; return; }
    byPlace[place] = label.trim();
    const v = moneyValue(label);
    if (v != null) cash += v; else items.push(label.trim());
  });
  for (const p of board.prizes) if (p.place > 3) cash += Number(p.amount);
  const pool = [cash > 0 ? formatMoney(cash, { cents: cash % 1 !== 0 }) : "", ...items].filter(Boolean).join(" + ");
  return { byPlace, pool };
}

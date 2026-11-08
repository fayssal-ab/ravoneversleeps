import "server-only";
import { z } from "zod";

// QHub Open Leaderboard (q-hub.tv/leaderboard): viewers earn QHub Points by
// watching Ravo (and other creators) inside QHub, and 150 seats split the
// sponsors' prize pool. QHub has no public API: its leaderboard page is a
// Next.js page whose server payload (self.__next_f.push chunks) carries the
// board as `"board":{"items":[…],"total":N}`. We read that, validate it and
// cache it for 5 minutes. If the page changes shape, the last good board is
// kept in memory and the page says so.

export const QHUB_URL = "https://q-hub.tv";
export const QHUB_LEADERBOARD_URL = `${QHUB_URL}/leaderboard`;
export const QHUB_RAVO_URL = `${QHUB_URL}/streamers/ravoneversleeps`;

/** What each seat pays when the board closes (from q-hub.tv; the prize belongs to the seat). */
export const QHUB_SEAT_PRIZES: { from: number; to: number; usd: number }[] = [
  { from: 1, to: 1, usd: 1500 },
  { from: 2, to: 2, usd: 1000 },
  { from: 3, to: 3, usd: 750 },
  { from: 4, to: 10, usd: 300 },
  { from: 11, to: 25, usd: 160 },
  { from: 26, to: 50, usd: 40 },
  { from: 51, to: 100, usd: 15 },
  { from: 101, to: 150, usd: 10 },
];
export const QHUB_SEATS = QHUB_SEAT_PRIZES.at(-1)!.to;
export const QHUB_POOL = QHUB_SEAT_PRIZES.reduce((n, t) => n + (t.to - t.from + 1) * t.usd, 0);

export function seatPrize(rank: number): number | null {
  return QHUB_SEAT_PRIZES.find((t) => rank >= t.from && rank <= t.to)?.usd ?? null;
}

const boardSchema = z.object({
  total: z.number().int().min(0).max(100000),
  items: z.array(z.object({
    rank: z.number().int().positive(),
    nickname: z.string().max(80).nullable().transform((v) => v ?? ""),
    points: z.number().finite().min(0),
  }).loose()).max(5000),
}).loose();

export interface QhubRow { rank: number; name: string; anonymous: boolean; points: number; prize: number | null }
export interface QhubBoard { rows: QhubRow[]; total: number; closesAt: string | null; fetchedAt: string; stale: boolean }

/** The RSC payload pushed by the page, decoded into one string. */
function flightText(html: string): string {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    try { out += JSON.parse(m[1]) as string; } catch { /* skip a chunk we can't read */ }
  }
  return out;
}

/** The JSON value starting at `start` (balanced braces, strings respected). */
function jsonAt(text: string, start: number): unknown {
  if (start < 0) return undefined;
  let depth = 0, inStr = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    } else if (depth === 0 && (c === "," || c === "}")) {
      return JSON.parse(text.slice(start, i));
    }
  }
  return undefined;
}

export function parseQhubPage(html: string): Omit<QhubBoard, "fetchedAt" | "stale"> {
  const text = flightText(html);
  // the page also has a "board" block of UI strings: take the one holding items
  const at = text.indexOf('"board":{"items":');
  const board = boardSchema.parse(jsonAt(text, at < 0 ? -1 : at + '"board":'.length));
  const closes = (() => {
    const m = text.match(/"closesAt":("[^"]{10,40}"|null)/);
    const v = m ? JSON.parse(m[1]) as string | null : null;
    return v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
  })();
  const rows = board.items
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((r) => {
      const name = r.nickname.trim();
      return { rank: r.rank, name: name || "Anonymous", anonymous: !name, points: Math.floor(r.points), prize: seatPrize(r.rank) };
    });
  return { rows, total: Math.max(board.total, rows.length), closesAt: closes };
}

let lastGood: QhubBoard | null = null;

/** The live board (cached 5 min); the last good copy if QHub is down; null if never read. */
export async function getQhubBoard(): Promise<QhubBoard | null> {
  try {
    const res = await fetch(QHUB_LEADERBOARD_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "text/html", "User-Agent": "Mozilla/5.0 (compatible; RavoSite/1.0)" },
    });
    if (!res.ok) throw new Error(`QHub HTTP ${res.status}`);
    const board = { ...parseQhubPage(await res.text()), fetchedAt: new Date().toISOString(), stale: false };
    lastGood = board;
    return board;
  } catch (e) {
    console.error("QHub leaderboard read failed", e instanceof Error ? e.message : "unknown");
    return lastGood ? { ...lastGood, stale: true } : null;
  }
}

/** Where a QHub nickname sits on the board right now (case-insensitive). */
export async function qhubStanding(nickname: string): Promise<QhubRow | null> {
  const name = nickname.trim().toLowerCase();
  if (!name) return null;
  const board = await getQhubBoard().catch(() => null);
  return board?.rows.find((r) => !r.anonymous && r.name.toLowerCase() === name) ?? null;
}

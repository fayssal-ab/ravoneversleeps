import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { fetchQboardsEvents, fetchQboardsSnapshot, type QboardsSnapshot } from "./qboardsFeed";
import { maskUsername } from "./mask";
import type { Board, PastPeriod, Period } from "./leaderboard";

// Q-boards leaderboard. Every event (one per month) is kept as its own
// snapshot: the running one is refreshed on every sync, and an event that
// has ended gets one last sync after its end so the archive shows the final
// ranking. The public page shows the live event, else the next one, else the
// last finished one; finished events stay browsable as an archive.

/** Expected sync interval (netlify/functions/sync-leaderboard.mjs). */
export const SYNC_EVERY_HOURS = 8;

async function store(snapshot: QboardsSnapshot): Promise<void> {
  await getPool().query(
    `INSERT INTO qboards_snapshots (event_id, snapshot, synced_at) VALUES (?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE snapshot = VALUES(snapshot), synced_at = VALUES(synced_at)`,
    [snapshot.eventId, JSON.stringify(snapshot)],
  );
}

export async function syncQboards() {
  // Fetch and validate every page before atomically replacing the snapshot.
  // A failed fetch leaves the last successful leaderboard intact.
  const snapshot = await fetchQboardsSnapshot();
  await store(snapshot);
  // close out finished events that haven't been synced since they ended
  const finalized: string[] = [];
  try {
    const { all } = await fetchQboardsEvents();
    const [rows] = await getPool().query<RowDataPacket[]>("SELECT event_id, synced_at FROM qboards_snapshots");
    const syncedAt = new Map(rows.map((r) => [String(r.event_id), Date.parse(String(r.synced_at).replace(" ", "T") + "Z")]));
    for (const ev of all) {
      if (ev.id === snapshot.eventId || Date.parse(ev.endsAt) > Date.now()) continue;
      if ((syncedAt.get(ev.id) ?? 0) > Date.parse(ev.endsAt)) continue;
      await store(await fetchQboardsSnapshot(fetch, ev.id));
      finalized.push(ev.id);
    }
  } catch (err) {
    console.error("qboards archive sync failed", err instanceof Error ? err.message : "unknown");
  }
  return { eventId: snapshot.eventId, players: snapshot.rows.length, metric: "points", finalized };
}

interface Stored { snapshot: QboardsSnapshot; syncedAt: string; start: number; end: number }

function periodOf(s: QboardsSnapshot, now: number): Period {
  return {
    id: 0, title: s.title,
    starts_at: s.startsAt.slice(0, 19).replace("T", " "),
    ends_at: s.endsAt.slice(0, 19).replace("T", " "), prize_pool: s.prizePool,
    state: now < Date.parse(s.startsAt) ? "upcoming" : now < Date.parse(s.endsAt) ? "live" : "ended",
  };
}

/**
 * The board for `eventId`, or the current one: live event, else the next
 * upcoming, else the most recently finished. `previous` lists the other
 * finished events (the archive), newest first.
 */
export async function getQboardsBoard(limit: number, eventId?: string): Promise<Board | null> {
  const [records] = await getPool().query<RowDataPacket[]>("SELECT snapshot, synced_at FROM qboards_snapshots");
  const all: Stored[] = records.flatMap((r) => {
    const snapshot: QboardsSnapshot = typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot;
    if (snapshot.usePoints !== true) return [];
    return [{ snapshot, syncedAt: String(r.synced_at), start: Date.parse(snapshot.startsAt), end: Date.parse(snapshot.endsAt) }];
  });
  if (!all.length) return null;
  const now = Date.now();
  const byEnd = [...all].sort((a, b) => b.end - a.end);
  const chosen = eventId
    ? all.find((x) => x.snapshot.eventId === eventId)
    : all.find((x) => x.start <= now && now < x.end)
      ?? [...all].filter((x) => x.start > now).sort((a, b) => a.start - b.start)[0]
      ?? byEnd[0];
  if (!chosen) return null;
  const lastSync = Math.max(...all.map((x) => Date.parse(x.syncedAt.replace(" ", "T") + "Z")));
  const previous: PastPeriod[] = byEnd
    .filter((x) => x.end <= now && x.snapshot.eventId !== chosen.snapshot.eventId)
    .slice(0, 24)
    .map((x) => ({
      ...periodOf(x.snapshot, now),
      winner: x.snapshot.rows[0] ? maskUsername(x.snapshot.rows[0].username) : null,
      link: `/leaderboard?e=${x.snapshot.eventId}`,
    }));
  const s = chosen.snapshot;
  return {
    source: "qboards", scoreKind: "points", syncedAt: chosen.syncedAt, eventId: s.eventId,
    syncDelayed: !eventId && now - lastSync > (SYNC_EVERY_HOURS + 1) * 3600_000,
    period: periodOf(s, now),
    rows: s.rows.slice(0, limit).map((r) => ({ rank: r.rank, name: maskUsername(r.username), wagered: r.score, prize: r.prize })),
    prizes: s.rows.filter((r) => r.prize != null).map((r) => ({ place: r.rank, amount: r.prize! })),
    previous,
  };
}

/**
 * A player's points in the event running now (case-insensitive Qzino
 * username), with that event's month ("YYYY-MM" of its start, UTC). Null
 * when no event is running.
 */
export async function liveEventScore(username: string): Promise<{ score: string; month: string; title: string; endsAt: string } | null> {
  const [records] = await getPool().query<RowDataPacket[]>("SELECT snapshot FROM qboards_snapshots");
  const now = Date.now();
  for (const r of records) {
    const s: QboardsSnapshot = typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot;
    if (s.usePoints !== true || !(Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt))) continue;
    const row = username ? s.rows.find((x) => x.username.toLowerCase() === username.toLowerCase()) : undefined;
    return { score: row?.score ?? "0", month: s.startsAt.slice(0, 7), title: s.title, endsAt: s.endsAt };
  }
  return null;
}


/**
 * Rank and points of a Qzino username in the event running now (admin only:
 * how much is at stake when verifying who owns it). Null when not on it.
 */
export async function liveStanding(username: string): Promise<{ rank: number; score: string; title: string } | null> {
  if (!username) return null;
  const [records] = await getPool().query<RowDataPacket[]>("SELECT snapshot FROM qboards_snapshots");
  const now = Date.now();
  for (const r of records) {
    const s: QboardsSnapshot = typeof r.snapshot === "string" ? JSON.parse(r.snapshot) : r.snapshot;
    if (!(Date.parse(s.startsAt) <= now && now < Date.parse(s.endsAt))) continue;
    const row = s.rows.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (row) return { rank: row.rank, score: row.score, title: s.title };
  }
  return null;
}

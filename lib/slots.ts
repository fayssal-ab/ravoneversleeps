import "server-only";
import { randomInt } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { normalizeName, parseFeed, type Feed } from "./slotFeed";
import { AppError, lockApp, withTx } from "./tx";

export { normalizeName };

// Slot catalogue (ported from ONO): every slot with its name, provider, art
// and popularity rank (0 = most played), synced from a JSON feed
// (SLOTS_FEED_URL) once a day by the cron and on demand from Admin → Slots.
// All slots are kept, no casino-exclusive filter. Search is fuzzy (typos,
// missing words); tournaments draw random slots from the most played.

const FEED_URL = process.env.SLOTS_FEED_URL || "https://api.sharkz.gg/api/slots";
const SYNC_MAX_AGE_H = 24;
/** Random tournament slots come from the POOL_TOP most played with art. */
export const POOL_TOP = 1000;

export interface CatalogSlot { id: string; name: string; provider: string; imageUrl: string | null }

// Ravo plays on Qzino, so slots the feed marks "only on Stake" stay in the
// table (kept for later) but are hidden everywhere: picker, search, !join,
// !call and random tournament slots.
const SHOWN = "active = 1 AND stake_only = 0";
let stakeColumn: Promise<void> | null = null;
/** Adds slot_catalog.stake_only on first use (migration 0021). Outside a transaction (DDL commits). */
export function ensureCatalogSchema(): Promise<void> {
  stakeColumn ??= (async () => {
    const [c] = await getPool().query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'slot_catalog' AND COLUMN_NAME = 'stake_only'");
    if (!c[0]) await getPool().query("ALTER TABLE slot_catalog ADD COLUMN stake_only TINYINT(1) NOT NULL DEFAULT 0");
  })().catch((e) => { stakeColumn = null; throw e; });
  return stakeColumn;
}
export interface AssignedSlot { id: string; name: string; provider: string; imageUrl: string }
export interface ChosenSlot extends AssignedSlot { matched: boolean }

function trigrams(s: string): Set<string> {
  const p = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  return out;
}

/** Exact > prefix > every word present > contains > trigram similarity. 0 = no match. */
export function scoreName(query: string, name: string): number {
  if (!query) return 0;
  if (name === query) return 1000;
  if (name.startsWith(query)) return 800 - Math.min(name.length - query.length, 100);
  const words = query.split(" ");
  const nameWords = name.split(" ");
  if (words.every((w) => nameWords.some((nw) => nw.startsWith(w)))) return 600 - Math.min(name.length, 100);
  if (name.includes(query)) return 500;
  const a = trigrams(query);
  const b = trigrams(name);
  let common = 0;
  for (const g of a) if (b.has(g)) common++;
  const dice = (2 * common) / (a.size + b.size);
  return dice >= 0.45 ? Math.round(dice * 400) : 0;
}

// ── feed ──

export async function syncCatalog(): Promise<{ total: number; withArt: number; generated: string | null; stakeOnly: number }> {
  const res = await fetch(FEED_URL, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new AppError("slot_feed_failed", `feed answered ${res.status}`);
  const feed = (await res.json()) as Feed;
  const rows = parseFeed(feed);
  if (rows.length < 500) throw new AppError("slot_feed_failed", `only ${rows.length} slots in the feed`);
  const now = new Date().toISOString().slice(0, 19).replace("T", " "); // UTC, like the session
  await ensureCatalogSchema();
  await withTx(async (conn) => {
    await lockApp(conn, "slots");
    await conn.query("UPDATE slot_catalog SET active = 0");
    for (let i = 0; i < rows.length; i += 1000) {
      await conn.query(
        `INSERT INTO slot_catalog (id, slug, name, name_norm, provider, image_url, popularity, stake_only, active, synced_at) VALUES ?
         ON DUPLICATE KEY UPDATE name = VALUES(name), name_norm = VALUES(name_norm), provider = VALUES(provider),
           image_url = VALUES(image_url), popularity = VALUES(popularity), stake_only = VALUES(stake_only), active = 1, synced_at = VALUES(synced_at)`,
        [rows.slice(i, i + 1000).map((r) => [r.id, r.slug, r.name, normalizeName(r.name).slice(0, 191), r.provider, r.imageUrl, r.popularity, r.stakeOnly ? 1 : 0, 1, now])]
      );
    }
  });
  cache = null;
  return { total: rows.length, withArt: rows.filter((r) => r.imageUrl).length, generated: typeof feed.generated === "string" ? feed.generated : null, stakeOnly: rows.filter((r) => r.stakeOnly).length };
}

export async function catalogIsStale(): Promise<boolean> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n, MAX(synced_at) < UTC_TIMESTAMP() - INTERVAL ? HOUR AS stale FROM slot_catalog WHERE active = 1", [SYNC_MAX_AGE_H]);
  return Number(rows[0].n) === 0 || Number(rows[0].stale) === 1;
}

export async function getCatalogStats(): Promise<{ total: number; withArt: number; providers: number; syncedAt: string | null; hidden: number }> {
  await ensureCatalogSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) total, SUM(image_url IS NOT NULL) art, COUNT(DISTINCT provider) prov, MAX(synced_at) synced,
       (SELECT COUNT(*) FROM slot_catalog WHERE active = 1 AND stake_only = 1) hidden FROM slot_catalog WHERE ${SHOWN}`);
  const r = rows[0];
  return { total: Number(r.total), withArt: Number(r.art ?? 0), providers: Number(r.prov ?? 0), syncedAt: r.synced ? String(r.synced) : null, hidden: Number(r.hidden ?? 0) };
}

// ── search ──

interface CacheRow { id: string; name: string; norm: string; provider: string; image: string | null; popularity: number }
let cache: { rows: CacheRow[]; at: number } | null = null;

async function loadCache(): Promise<CacheRow[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  await ensureCatalogSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(`SELECT id, name, name_norm, provider, image_url, popularity FROM slot_catalog WHERE ${SHOWN}`);
  const list = rows.map((r) => ({
    id: String(r.id), name: String(r.name), norm: String(r.name_norm), provider: String(r.provider),
    image: r.image_url ? String(r.image_url) : null,
    popularity: r.popularity != null ? Number(r.popularity) : Number.MAX_SAFE_INTEGER,
  }));
  cache = { rows: list, at: Date.now() };
  return list;
}

const tier = (score: number) => (score >= 1000 ? 4 : score >= 700 ? 3 : score >= 500 ? 2 : 1);

/** Fuzzy search; within the same match tier the most played slot comes first. */
export async function searchCatalog(query: string, limit = 10): Promise<CatalogSlot[]> {
  const q = normalizeName(query).slice(0, 80);
  if (q.length < 2) return [];
  return (await loadCache())
    .map((r) => ({ r, s: scoreName(q, r.norm) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => tier(b.s) - tier(a.s) || (tier(a.s) === 1 ? b.s - a.s : 0) || a.r.popularity - b.r.popularity || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map(({ r }) => ({ id: r.id, name: r.name, provider: r.provider, imageUrl: r.image }));
}

export async function getSlot(id: string): Promise<CatalogSlot | null> {
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT id, name, provider, image_url FROM slot_catalog WHERE id = ?", [id]);
  const r = rows[0];
  return r ? { id: String(r.id), name: String(r.name), provider: String(r.provider), imageUrl: r.image_url ? String(r.image_url) : null } : null;
}

/** Popular slots with art (home/tournament decoration). */
export async function popularSlots(limit = 24): Promise<CatalogSlot[]> {
  try {
    await ensureCatalogSchema();
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, name, provider, image_url FROM slot_catalog WHERE ${SHOWN} AND image_url IS NOT NULL AND popularity IS NOT NULL ORDER BY popularity LIMIT ?`, [limit]);
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), provider: String(r.provider), imageUrl: String(r.image_url) }));
  } catch {
    return [];
  }
}

/** Uniformly random slot among the POOL_TOP most played with art (crypto.randomInt). */
export async function randomPoolSlot(conn: PoolConnection, exclude: string[] = []): Promise<AssignedSlot> {
  const base = `FROM slot_catalog WHERE ${SHOWN} AND image_url IS NOT NULL AND popularity IS NOT NULL AND popularity < ?`;
  const pick = async (withExclude: boolean) => {
    const cond = withExclude && exclude.length ? " AND id NOT IN (?)" : "";
    const args: unknown[] = withExclude && exclude.length ? [POOL_TOP, exclude] : [POOL_TOP];
    const [count] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS n ${base}${cond}`, args);
    const n = Number(count[0].n);
    if (n === 0) return null;
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT id, name, provider, image_url ${base}${cond} ORDER BY id LIMIT 1 OFFSET ?`, [...args, randomInt(n)]);
    return rows[0] ?? null;
  };
  const row = (await pick(true)) ?? (await pick(false));
  if (!row) throw new AppError("slot_pool_empty");
  return { id: String(row.id), name: String(row.name), provider: String(row.provider), imageUrl: String(row.image_url) };
}

/** Text after `!join`, minus Kick emote tokens; null when empty. */
export function cleanSlotRequest(raw: string): string | null {
  const t = raw.replace(/\[emote:\d+:[^\]]*\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return normalizeName(t).length >= 2 ? t : null;
}

/**
 * The slot a viewer asked for. Confident catalogue match → its name, provider
 * and art (most played wins among near-equal matches). Otherwise the name as
 * typed, never a different game.
 */
export async function findSlotByName(raw: string): Promise<ChosenSlot | null> {
  const typed = cleanSlotRequest(raw);
  if (!typed) return null;
  const q = normalizeName(typed);
  const scored = (await loadCache()).map((r) => ({ r, s: scoreName(q, r.norm) })).filter((x) => x.s >= 280);
  const top = scored.reduce((m, x) => Math.max(m, x.s), 0);
  const near = scored.filter((x) => x.s >= top - (top >= 500 ? 30 : 0));
  near.sort((a, b) => Number(Boolean(b.r.image)) - Number(Boolean(a.r.image)) || a.r.popularity - b.r.popularity || b.s - a.s);
  const best = near[0]?.r;
  if (!best) return { id: `typed/${q.replace(/ /g, "-")}`.slice(0, 191), name: typed, provider: "", imageUrl: "", matched: false };
  return { id: best.id, name: best.name, provider: best.provider, imageUrl: best.image ?? "", matched: true };
}

/**
 * Bonuses and tournament players saved by typed name (not in the catalogue
 * at the time) get the catalogue name, provider and art once a slot with
 * exactly that name exists (most played wins on duplicates).
 */
export async function upgradeTypedSlots(): Promise<number> {
  const rows = await loadCache();
  const byName = new Map<string, CacheRow>();
  for (const r of [...rows].sort((a, b) => a.popularity - b.popularity)) if (r.image && !byName.has(r.norm)) byName.set(r.norm, r);
  const pool = getPool();
  let n = 0;
  const [bonuses] = await pool.query<RowDataPacket[]>("SELECT id, slot FROM hunt_bonuses WHERE image_url IS NULL OR image_url = ''");
  for (const b of bonuses) {
    const r = byName.get(normalizeName(String(b.slot)));
    if (!r) continue;
    await pool.query("UPDATE hunt_bonuses SET slot_id = ?, slot = ?, provider = ?, image_url = ? WHERE id = ?", [r.id, r.name, r.provider, r.image, b.id]);
    n++;
  }
  const [players] = await pool.query<RowDataPacket[]>("SELECT id, slot_name FROM ko_participants WHERE slot_image = ''");
  for (const p of players) {
    const r = byName.get(normalizeName(String(p.slot_name)));
    if (!r) continue;
    await pool.query("UPDATE ko_participants SET slot_id = ?, slot_name = ?, slot_provider = ?, slot_image = ? WHERE id = ?", [r.id, r.name, r.provider, r.image, p.id]);
    n++;
  }
  return n;
}

/** Sync when the catalogue is empty or older than a day; never throws. */
export async function ensureCatalog(): Promise<void> {
  try {
    if (await catalogIsStale()) {
      await syncCatalog();
      await upgradeTypedSlots();
    }
  } catch (err) {
    console.error("slot catalogue sync failed", err instanceof Error ? err.message : "unknown");
  }
}

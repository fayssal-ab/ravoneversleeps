import "server-only";
import { randomInt } from "node:crypto";
import Decimal from "decimal.js";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { kickAvatars } from "./kickApi";
import { bossLine, bossName, spinWheel, stageChance, type BossTier } from "./reaping";
import { publicHunt, validWeights, type HuntState, type TierWeights } from "./hunt/engine";
import { randomPoolSlot } from "./slots";
import { AppError, lockApp, withTx } from "./tx";

// Single-elimination slot knockout fed by Kick chat (ported from ONO, made
// size-aware: the admin picks 4, 8, 16 or 32 players). Rules enforced here,
// server-side, under row locks:
//
// - registration: `!join [slot]` while open registers a Kick account (unique
//   per tournament) with the named slot, or a random one from the most played;
//   the last free seat closes registration atomically;
// - repeated `!join` before being rolled into the bracket only changes the slot;
// - roller: picks two distinct waiting players with crypto.randomInt into the
//   next empty first-round match ('rolled'); confirm locks them, cancel frees them;
// - battles: one live at a time; each side's bonus cost + payout is entered and
//   the higher multiplier wins (exact tie = replay). The loser is out, the
//   winner moves to the fixed next match;
// - the last round is the Grand Final; only the champion is crowned (no 2nd /
//   3rd place). Tournaments created before that also hold a 3rd-place match
//   (last round, match 1), which still plays out;
// - fewer players than seats: once registration is closed and nobody is left
//   to roll, empty first-round seats become void and lone players get byes.
// - mode 'reaping' adds computer bosses that ambush battles (rules in
//   lib/reaping.ts); bosses are participant rows with is_boss = 1.

export const SIZES = [4, 8, 16, 32] as const;
export type KoSize = (typeof SIZES)[number];

/** Number of rounds for a bracket size (4 → 2, 8 → 3, 16 → 4, 32 → 5). */
export const roundsFor = (size: number) => Math.round(Math.log2(size));
/** Matches in a round: halves each round; the last round = final + 3rd place. */
export const matchesIn = (size: number, round: number) => size / 2 ** round;

export function roundName(size: number, round: number): string {
  const fromEnd = roundsFor(size) - round;
  return fromEnd === 0 ? "Finals" : fromEnd === 1 ? "Semi-finals" : fromEnd === 2 ? "Quarter-finals" : `Round of ${2 ** (fromEnd + 1)}`;
}

export type ParticipantState = "registered" | "in_knockout" | "eliminated" | "champion";
export type MatchStatus = "empty" | "rolled" | "ready" | "live" | "done" | "bye" | "void";

export interface KoTournament {
  id: number; title: string; prize: string; status: "open" | "closed" | "finished" | "cancelled"; max_players: number;
  /** 1 = solo, 2 = duo (max_players is then the number of teams). */
  team_size: number;
  prize_1: string | null; prize_2: string | null; prize_3: string | null;
  champion_id: number | null; runner_up_id: number | null; third_id: number | null;
  roll_seq: number; focus_match_id: number | null; created_at: string; finished_at: string | null;
  /** 'reaping' = boss wheel mode, 'hunt' = The Reaping · Hunt (lib/hunt). */
  mode: "classic" | "reaping" | "hunt";
  /** Reaping: % chance a boss rises before a stage; final boss guaranteed; prize rolls over when the Cult wins. */
  boss_chance: number; final_boss: boolean; rollover: boolean;
}
export interface KoParticipant {
  id: number; username: string; slot_name: string; slot_provider: string; slot_image: string;
  /** Kick profile picture; null = none known (shown as an initial). */
  avatar: string | null;
  state: ParticipantState; disqualified: boolean; bracket_pos: number | null; rerolls: number; joined_at: string;
  /** Duo: captain's id (same for both members); null in solo / before teams. */
  team_id: number | null;
  /** Duo: the captain's teammate (set on captains by getKoState). */
  partner?: KoParticipant | null;
  /** Reaping: a computer boss (target multiplier, tier, intro line). */
  is_boss: boolean; boss_target: string | null; boss_tier: BossTier | null; boss_line: string | null;
  /** Knocked out by a boss. */
  reaped: boolean;
}
/** Reaping: the roll before a stage (spins counts re-spins, so clients replay the wheel). */
export interface BossRoll { id: number; round: number; chance: number; spawned: boolean; boss_id: number | null; match_id: number | null; spins: number; at: string }
export interface BattleResult { cost: string; payout: string; multi: string }
export interface KoMatch {
  id: number; round: number; match_index: number; status: MatchStatus;
  p1: KoParticipant | null; p2: KoParticipant | null; winner_id: number | null; roll_seq: number | null;
  p1_result: BattleResult | null; p2_result: BattleResult | null;
  /** Duo: the teammates' bonuses. */
  p1b_result: BattleResult | null; p2b_result: BattleResult | null;
  /** Side score: the multiplier (solo) or the sum of both multipliers (duo); a boss side shows its target. */
  p1_multi: string | null; p2_multi: string | null;
  /** Reaping: the boss ambushing this battle (both sides must reach its target). */
  boss: KoParticipant | null;
}
export interface KoState {
  tournament: KoTournament; rounds: number; participants: KoParticipant[]; matches: KoMatch[];
  registered: number; eligible: number;
  /** Seats: players (solo) or 2 × teams (duo). */
  capacity: number;
  /** Duo: teams have been drawn. */
  teamsMade: boolean;
  focus: KoMatch | null; live: KoMatch | null; pendingRoll: KoMatch | null; nextReady: KoMatch | null;
  champion: KoParticipant | null; runnerUp: KoParticipant | null; third: KoParticipant | null;
  /** Reaping: every boss that rose, the stage rolls, players reaped. Bosses aren't in `participants`. */
  bosses: KoParticipant[]; bossRolls: BossRoll[]; reaped: number;
  /** Hunt: the game once started (public view), else the chosen settings. */
  hunt: HuntState | null; huntSetup: HuntSetup | null;
}
export interface HuntSetup { waves: 1 | 2 | 3; chance: number; fall: "half" | "nothing"; weights?: TierWeights }

/** Higher multiplier (payout ÷ cost, exact decimals) wins; exact tie undecided. */
export function decideBattle(p1: { cost: string; payout: string }, p2: { cost: string; payout: string }): { side: 1 | 2 | "tie"; m1: string; m2: string } {
  const c1 = new Decimal(p1.cost), c2 = new Decimal(p2.cost);
  if (c1.lte(0) || c2.lte(0)) throw new AppError("invalid_input", "bonus cost must be above 0");
  const m1 = new Decimal(p1.payout).div(c1);
  const m2 = new Decimal(p2.payout).div(c2);
  const cmp = m1.cmp(m2);
  return { side: cmp === 0 ? "tie" : cmp > 0 ? 1 : 2, m1: m1.toFixed(2), m2: m2.toFixed(2) };
}

/** Duo: higher combined multiplier (a + b) wins; exact tie undecided. */
export function decideTeamBattle(
  p1: { cost: string; payout: string }, p1b: { cost: string; payout: string },
  p2: { cost: string; payout: string }, p2b: { cost: string; payout: string },
): { side: 1 | 2 | "tie"; m1: string; m2: string } {
  for (const b of [p1, p1b, p2, p2b]) if (new Decimal(b.cost).lte(0)) throw new AppError("invalid_input", "bonus cost must be above 0");
  const multi = (b: { cost: string; payout: string }) => new Decimal(b.payout).div(new Decimal(b.cost));
  const m1 = multi(p1).plus(multi(p1b));
  const m2 = multi(p2).plus(multi(p2b));
  const cmp = m1.cmp(m2);
  return { side: cmp === 0 ? "tie" : cmp > 0 ? 1 : 2, m1: m1.toFixed(2), m2: m2.toFixed(2) };
}

/** Side score; a duo side counts a bonus not entered yet as 0, so one result already shows. */
const sumMulti = (a: BattleResult | null, b: BattleResult | null, duo: boolean): string | null =>
  !duo ? a?.multi ?? null : !a && !b ? null : new Decimal(a?.multi ?? 0).plus(b?.multi ?? 0).toFixed(2);

function resultOf(cost: unknown, payout: unknown): BattleResult | null {
  if (cost == null || payout == null) return null;
  const c = new Decimal(String(cost));
  return { cost: String(cost), payout: String(payout), multi: c.gt(0) ? new Decimal(String(payout)).div(c).toFixed(2) : "0.00" };
}

/** `!join` at the start of the message; text after it names the slot (none = random). */
export const JOIN_RE = /^\s*!join(?:\s.*)?$/i;

/** Two distinct uniformly random indexes in [0, n). */
export function pickTwo(n: number, rand: (max: number) => number = randomInt): [number, number] {
  if (n < 2) throw new AppError("not_enough_players");
  const a = rand(n);
  let b = rand(n - 1);
  if (b >= a) b++;
  return [a, b];
}

/** Bracket play order: rounds in turn; in the last round the 3rd-place match goes before the final. */
const playKey = (m: { round: number; match_index: number }, last: number) => m.round * 10 + (m.round === last ? 1 - m.match_index : m.match_index);
const playOrderSql = (last: number) => `round, CASE WHEN round = ${Number(last)} THEN 1 - match_index ELSE match_index END`;
/** The stage being played: the lowest round with a battle still to draw or play. A round starts only once the one before is over. */
const currentStage = (matches: { round: unknown; status: unknown }[]): number | null =>
  matches.reduce<number | null>((min, m) => (["empty", "rolled", "ready", "live"].includes(String(m.status)) && (min == null || Number(m.round) < min) ? Number(m.round) : min), null);

// ── reads ──

const T_COLS = "id, title, prize, prize_1, prize_2, prize_3, status, max_players, team_size, champion_id, runner_up_id, third_id, roll_seq, focus_match_id, created_at, finished_at, mode, boss_chance, final_boss, rollover";
const P_COLS = "id, username, avatar, slot_name, slot_provider, slot_image, state, disqualified, team_id, bracket_pos, rerolls, joined_at, is_boss, boss_target, boss_tier, boss_line, reaped";
const toT = (r: RowDataPacket): KoTournament => ({
  ...(r as KoTournament), id: Number(r.id), max_players: Number(r.max_players), team_size: Number(r.team_size ?? 1), roll_seq: Number(r.roll_seq),
  mode: r.mode === "reaping" || r.mode === "hunt" ? r.mode : "classic", boss_chance: Number(r.boss_chance ?? 40), final_boss: Boolean(Number(r.final_boss ?? 1)), rollover: Boolean(Number(r.rollover ?? 0)),
});
const toP = (p: RowDataPacket): KoParticipant => ({
  ...(p as KoParticipant), id: Number(p.id), avatar: p.avatar || null, disqualified: Boolean(p.disqualified), team_id: p.team_id != null ? Number(p.team_id) : null,
  is_boss: Boolean(Number(p.is_boss ?? 0)), boss_target: p.boss_target != null ? new Decimal(String(p.boss_target)).toFixed(2) : null,
  boss_tier: (p.boss_tier as BossTier | null) ?? null, boss_line: p.boss_line ?? null, reaped: Boolean(Number(p.reaped ?? 0)),
});
/** Bracket units: everyone in solo, team captains in duo. */
const UNIT_SQL = "(team_id IS NULL OR team_id = id)";

/** Running tournament (open/closed), else the most recent finished one. */
export async function getFeaturedKo(): Promise<KoTournament | null> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${T_COLS} FROM ko_tournaments WHERE status IN ('open','closed','finished') ORDER BY FIELD(status,'open','closed','finished'), id DESC LIMIT 1`);
  return rows[0] ? toT(rows[0]) : null;
}

/** Admin archive: every tournament with its player count and champion, newest first. */
export async function listKoAdmin(): Promise<{ id: number; title: string; status: string; mode: string; max_players: number; team_size: number; created: string; players: number; champion: string | null }[]> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(`
    SELECT t.id, t.title, t.status, t.mode, t.max_players, t.team_size, DATE_FORMAT(t.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created,
      (SELECT COUNT(*) FROM ko_participants p WHERE p.tournament_id = t.id AND p.is_boss = 0) AS players,
      (SELECT username FROM ko_participants p WHERE p.id = t.champion_id) AS champion
    FROM ko_tournaments t ORDER BY t.id DESC`);
  return rows.map((r) => ({ id: Number(r.id), title: String(r.title), status: String(r.status), mode: String(r.mode ?? "classic"), max_players: Number(r.max_players), team_size: Number(r.team_size ?? 1), created: String(r.created), players: Number(r.players), champion: r.champion ?? null }));
}

/** Admin: delete a finished or cancelled tournament for good (players, battles and boss rolls go with it). */
export async function deleteKo(id: number): Promise<void> {
  await withTx(async (conn) => {
    const t = await lockKo(conn, id);
    if (t.status === "open" || t.status === "closed") throw new AppError("ko_running", "reset it first, a running tournament can't be deleted");
    await conn.query("DELETE FROM ko_boss_rolls WHERE tournament_id = ?", [id]);
    await conn.query("DELETE FROM ko_matches WHERE tournament_id = ?", [id]);
    await conn.query("DELETE FROM ko_participants WHERE tournament_id = ?", [id]);
    await conn.query("DELETE FROM ko_tournaments WHERE id = ?", [id]);
  });
}

export async function getKoById(id: number): Promise<KoTournament | null> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(`SELECT ${T_COLS} FROM ko_tournaments WHERE id = ?`, [id]);
  return rows[0] ? toT(rows[0]) : null;
}

export async function getKoArchive(limit = 12): Promise<(KoTournament & { champion: string | null; champion_slot: string | null; champion_image: string | null; champion_is_boss: boolean })[]> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT t.${T_COLS.split(", ").join(", t.")}, p.username AS champion, mate.username AS champion_mate, p.slot_name AS champion_slot, p.slot_image AS champion_image, p.is_boss AS champion_is_boss
       FROM ko_tournaments t
       LEFT JOIN ko_participants p ON p.id = t.champion_id
       LEFT JOIN ko_participants mate ON mate.team_id = p.id AND mate.id <> p.id
      WHERE t.status = 'finished' ORDER BY t.finished_at DESC, t.id DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({
    ...toT(r),
    champion: r.champion ? (r.champion_mate ? `${r.champion} & ${r.champion_mate}` : String(r.champion)) : null,
    champion_slot: r.champion_slot ?? null, champion_image: r.champion_image || null, champion_is_boss: Boolean(Number(r.champion_is_boss ?? 0)),
  }));
}

export async function getKoState(t: KoTournament): Promise<KoState> {
  await ensureKoSchema();
  const pool = getPool();
  const [[pRows], [mRows], [rRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT ${P_COLS} FROM ko_participants WHERE tournament_id = ? ORDER BY id`, [t.id]),
    pool.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY round, match_index", [t.id]),
    pool.query<RowDataPacket[]>("SELECT id, round, chance, spawned, boss_id, match_id, spins, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS at FROM ko_boss_rolls WHERE tournament_id = ? ORDER BY round", [t.id]),
  ]);
  let hunt: HuntState | null = null, huntSetup: HuntSetup | null = null;
  if (t.mode === "hunt") {
    const [h] = await pool.query<RowDataPacket[]>("SELECT hunt FROM ko_tournaments WHERE id = ?", [t.id]);
    const raw = h[0]?.hunt ? JSON.parse(String(h[0].hunt)) : null;
    if (raw?.v === 1) hunt = publicHunt(raw as HuntState);
    else if (raw?.setup) huntSetup = raw.setup as HuntSetup;
  }
  const everyone = pRows.map(toP);
  const participants = everyone.filter((p) => !p.is_boss);
  const bosses = everyone.filter((p) => p.is_boss);
  const byId = new Map(everyone.map((p) => [p.id, p]));
  const duo = t.team_size === 2;
  for (const p of participants) if (p.team_id != null && p.team_id !== p.id) { const cap = byId.get(p.team_id); if (cap) cap.partner = p; }
  const matches: KoMatch[] = mRows.map((m) => ({
    id: Number(m.id), round: Number(m.round), match_index: Number(m.match_index), status: m.status as MatchStatus,
    p1: m.p1_id ? byId.get(Number(m.p1_id)) ?? null : null,
    p2: m.p2_id ? byId.get(Number(m.p2_id)) ?? null : null,
    winner_id: m.winner_id ? Number(m.winner_id) : null,
    roll_seq: m.roll_seq != null ? Number(m.roll_seq) : null,
    p1_result: resultOf(m.p1_cost, m.p1_payout),
    p2_result: resultOf(m.p2_cost, m.p2_payout),
    p1b_result: resultOf(m.p1b_cost, m.p1b_payout),
    p2b_result: resultOf(m.p2b_cost, m.p2b_payout),
    p1_multi: null, p2_multi: null,
    boss: m.boss_id ? byId.get(Number(m.boss_id)) ?? null : null,
  }));
  for (const m of matches) {
    m.p1_multi = m.p1?.is_boss ? m.p1.boss_target : sumMulti(m.p1_result, m.p1b_result, duo);
    m.p2_multi = m.p2?.is_boss ? m.p2.boss_target : sumMulti(m.p2_result, m.p2b_result, duo);
  }
  const rounds = roundsFor(t.max_players);
  const inMatch = new Set<number>();
  for (const m of mRows) if (Number(m.round) === 1) { if (m.p1_id) inMatch.add(Number(m.p1_id)); if (m.p2_id) inMatch.add(Number(m.p2_id)); }
  const live = matches.find((m) => m.status === "live") ?? null;
  const pendingRoll = matches.find((m) => m.status === "rolled") ?? null;
  const stage = currentStage(matches);
  const nextReady = [...matches].sort((a, b) => playKey(a, rounds) - playKey(b, rounds)).find((m) => m.status === "ready" && m.round === stage) ?? null;
  const focus = (t.focus_match_id && matches.find((m) => m.id === Number(t.focus_match_id))) || live || pendingRoll || null;
  return {
    tournament: t, rounds, participants, matches,
    registered: participants.filter((p) => !p.disqualified).length,
    eligible: participants.filter((p) => p.state === "registered" && !p.disqualified && !inMatch.has(p.id) && (p.team_id == null || p.team_id === p.id) && (!duo || p.team_id != null)).length,
    capacity: t.max_players * t.team_size,
    teamsMade: duo && participants.some((p) => p.team_id != null),
    focus, live, pendingRoll, nextReady,
    champion: t.champion_id ? byId.get(Number(t.champion_id)) ?? null : null,
    runnerUp: t.runner_up_id ? byId.get(Number(t.runner_up_id)) ?? null : null,
    third: t.third_id ? byId.get(Number(t.third_id)) ?? null : null,
    bosses,
    bossRolls: rRows.map((r) => ({ id: Number(r.id), round: Number(r.round), chance: Number(r.chance), spawned: Boolean(Number(r.spawned)), boss_id: r.boss_id != null ? Number(r.boss_id) : null, match_id: r.match_id != null ? Number(r.match_id) : null, spins: Number(r.spins), at: String(r.at) })),
    reaped: participants.filter((p) => p.reaped).length,
    hunt, huntSetup,
  };
}

// ── lifecycle ──

async function lockKo(conn: PoolConnection, id: number): Promise<KoTournament> {
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT ${T_COLS} FROM ko_tournaments WHERE id = ? FOR UPDATE`, [id]);
  if (!rows[0]) throw new AppError("not_found");
  return toT(rows[0]);
}

async function lockRunning(conn: PoolConnection, id: number): Promise<KoTournament> {
  const t = await lockKo(conn, id);
  if (t.status === "finished") throw new AppError("ko_finished");
  if (t.status === "cancelled") throw new AppError("ko_cancelled");
  return t;
}

export interface ReapingOptions { chance: number; finalBoss: boolean; rollover: boolean }

export async function createKo(input: { title: string; prize: string; size: KoSize; duo?: boolean; prizes?: [string | null, string | null, string | null]; reaping?: ReapingOptions | null; hunt?: HuntSetup | null }): Promise<number> {
  await ensureKoSchema();
  if (!SIZES.includes(input.size)) throw new AppError("invalid_input", "size must be 4, 8, 16 or 32");
  return withTx(async (conn) => {
    await lockApp(conn, "ko");
    const [active] = await conn.query<RowDataPacket[]>("SELECT id FROM ko_tournaments WHERE status IN ('open','closed') LIMIT 1");
    if (active[0]) throw new AppError("ko_running", `#${active[0].id} is still running: finish or reset it first`);
    const [p1, p2, p3] = input.prizes ?? [null, null, null];
    const r = input.reaping ?? null;
    const h = input.hunt ?? null;
    if (r && h) throw new AppError("invalid_input", "pick one mode");
    if (h && !([1, 2, 3].includes(h.waves) && Number.isInteger(h.chance) && h.chance >= 0 && h.chance <= 100 && (h.fall === "half" || h.fall === "nothing"))) throw new AppError("invalid_input", "bad Hunt settings");
    if (h?.weights && !validWeights(h.weights)) throw new AppError("invalid_input", "rank odds must add up to 100%");
    if (r && !(Number.isInteger(r.chance) && r.chance >= 0 && r.chance <= 100)) throw new AppError("invalid_input", "boss chance must be 0 to 100");
    const [res] = await conn.query<ResultSetHeader>(
      "INSERT INTO ko_tournaments (title, prize, prize_1, prize_2, prize_3, status, max_players, team_size, mode, boss_chance, final_boss, rollover, hunt) VALUES (?, ?, ?, ?, ?, 'closed', ?, ?, ?, ?, ?, ?, ?)",
      [input.title, input.prize, p1, p2, p3, input.size, input.duo ? 2 : 1, r ? "reaping" : h ? "hunt" : "classic", r?.chance ?? 40, r ? Number(r.finalBoss) : 1, r ? Number(r.rollover) : 0, h ? JSON.stringify({ setup: h }) : null]
    );
    const id = res.insertId;
    const values: unknown[][] = [];
    for (let round = 1; round <= roundsFor(input.size); round++) for (let i = 0; i < matchesIn(input.size, round); i++) values.push([id, round, i]);
    await conn.query("INSERT INTO ko_matches (tournament_id, round, match_index) VALUES ?", [values]);
    return id;
  });
}

export async function openRegistration(id: number): Promise<void> {
  await withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    const [n] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n, SUM(team_id IS NOT NULL) AS teamed FROM ko_participants WHERE tournament_id = ? AND disqualified = 0 AND is_boss = 0", [id]);
    if (Number(n[0].n) >= t.max_players * t.team_size) throw new AppError("ko_full");
    if (Number(n[0].teamed) > 0) throw new AppError("teams_made");
    const [sealed] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_matches WHERE tournament_id = ? AND round = 1 AND status IN ('void','bye')", [id]);
    if (Number(sealed[0].n) > 0) throw new AppError("ko_sealed");
    const [rolls] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_boss_rolls WHERE tournament_id = ?", [id]);
    if (Number(rolls[0].n) > 0) throw new AppError("bracket_started");
    const [hs] = await conn.query<RowDataPacket[]>("SELECT hunt FROM ko_tournaments WHERE id = ?", [id]);
    if (hs[0]?.hunt && JSON.parse(String(hs[0].hunt)).v === 1) throw new AppError("bracket_started");
    await conn.query("UPDATE ko_tournaments SET status = 'open', opened_at = COALESCE(opened_at, UTC_TIMESTAMP()) WHERE id = ?", [id]);
  });
}

export async function closeRegistration(id: number): Promise<void> {
  await withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    if (t.status !== "open") throw new AppError("ko_not_open");
    await conn.query("UPDATE ko_tournaments SET status = 'closed', closed_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
    await propagate(conn, id);
  });
}

/** "Reset": the tournament is cancelled (kept for the record). */
export async function resetKo(id: number): Promise<void> {
  await withTx(async (conn) => {
    await lockRunning(conn, id);
    await conn.query("UPDATE ko_tournaments SET status = 'cancelled', focus_match_id = NULL WHERE id = ?", [id]);
  });
}

// ── disqualification ──

let dqColumn: Promise<void> | null = null;
/** Columns added after 0005 (migrations 0008, 0009, 0018, 0019). */
const SCHEMA_ADDS: [string, string][] = [
  ["ko_participants.disqualified", "ALTER TABLE ko_participants ADD COLUMN disqualified TINYINT(1) NOT NULL DEFAULT 0"],
  ["ko_tournaments.team_size", "ALTER TABLE ko_tournaments ADD COLUMN team_size TINYINT NOT NULL DEFAULT 1"],
  ["ko_participants.team_id", "ALTER TABLE ko_participants ADD COLUMN team_id BIGINT NULL"],
  ["ko_participants.avatar", "ALTER TABLE ko_participants ADD COLUMN avatar VARCHAR(512) NULL"],
  ["ko_matches.p1b_cost", "ALTER TABLE ko_matches ADD COLUMN p1b_cost DECIMAL(20,2) NULL, ADD COLUMN p1b_payout DECIMAL(20,2) NULL, ADD COLUMN p2b_cost DECIMAL(20,2) NULL, ADD COLUMN p2b_payout DECIMAL(20,2) NULL"],
  ["ko_tournaments.mode", "ALTER TABLE ko_tournaments ADD COLUMN mode VARCHAR(16) NOT NULL DEFAULT 'classic', ADD COLUMN boss_chance TINYINT UNSIGNED NOT NULL DEFAULT 40, ADD COLUMN final_boss TINYINT(1) NOT NULL DEFAULT 1, ADD COLUMN rollover TINYINT(1) NOT NULL DEFAULT 0"],
  ["ko_participants.is_boss", "ALTER TABLE ko_participants ADD COLUMN is_boss TINYINT(1) NOT NULL DEFAULT 0, ADD COLUMN boss_target DECIMAL(10,2) NULL, ADD COLUMN boss_tier VARCHAR(16) NULL, ADD COLUMN boss_line VARCHAR(191) NULL, ADD COLUMN reaped TINYINT(1) NOT NULL DEFAULT 0"],
  ["ko_matches.boss_id", "ALTER TABLE ko_matches ADD COLUMN boss_id BIGINT NULL"],
  ["ko_tournaments.hunt", "ALTER TABLE ko_tournaments ADD COLUMN hunt MEDIUMTEXT NULL"],
];
const BOSS_ROLLS_DDL = `CREATE TABLE IF NOT EXISTS ko_boss_rolls (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, tournament_id INT NOT NULL, round TINYINT NOT NULL,
  chance TINYINT UNSIGNED NOT NULL, spawned TINYINT(1) NOT NULL, boss_id BIGINT NULL, match_id BIGINT NULL,
  spins INT NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ko_boss_round (tournament_id, round),
  CONSTRAINT fk_ko_boss_t FOREIGN KEY (tournament_id) REFERENCES ko_tournaments(id) ON DELETE CASCADE
) ENGINE=InnoDB`;
const avatarTried = new Map<number, number>();
/**
 * Players who joined without a known picture (before avatars were stored, or
 * through the dashboard relay) get theirs from the Kick API, at most once a
 * minute per tournament. "" marks "asked, Kick has none".
 */
export async function fillKoAvatars(tournamentId: number): Promise<void> {
  if (Date.now() - (avatarTried.get(tournamentId) ?? 0) < 60_000) return;
  avatarTried.set(tournamentId, Date.now());
  await ensureKoSchema();
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, kick_user_id FROM ko_participants WHERE tournament_id = ? AND avatar IS NULL AND kick_user_id REGEXP '^[0-9]+$' LIMIT 50", [tournamentId]);
  if (!rows.length) return;
  const pics = await kickAvatars(rows.map((r) => String(r.kick_user_id)));
  for (const r of rows) await pool.query("UPDATE ko_participants SET avatar = ? WHERE id = ?", [pics.get(String(r.kick_user_id)) ?? "", r.id]);
}

/**
 * Migrations 0008/0009 add the DQ and duo columns; this adds them on first
 * use if the migrations haven't been run. Must run outside a transaction (DDL
 * commits implicitly), so entry points call it before withTx.
 */
export function ensureKoSchema(): Promise<void> {
  dqColumn ??= (async () => {
    const pool = getPool();
    const [cols] = await pool.query<RowDataPacket[]>(
      "SELECT CONCAT(TABLE_NAME, '.', COLUMN_NAME) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('ko_tournaments','ko_participants','ko_matches')");
    const have = new Set(cols.map((r) => String(r.c)));
    for (const [col, ddl] of SCHEMA_ADDS) if (!have.has(col)) await pool.query(ddl);
    await pool.query(BOSS_ROLLS_DDL);
  })().catch((e) => { dqColumn = null; throw e; });
  return dqColumn;
}

/**
 * Admin removes a player. Waiting players leave the pool (their seat frees
 * up); a player with a ready or live battle forfeits it to the opponent; a
 * player waiting for a later opponent is skipped (that opponent gets a bye).
 * Disqualified players can't !join again.
 */
export async function disqualifyPlayer(id: number, participantId: number): Promise<{ forfeit: number | null }> {
  await ensureKoSchema();
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    const [pRows] = await conn.query<RowDataPacket[]>("SELECT id, state, disqualified FROM ko_participants WHERE id = ? AND tournament_id = ? FOR UPDATE", [participantId, id]);
    let p = pRows[0];
    if (!p) throw new AppError("not_found");
    // duo with teams drawn: the whole team goes out, handled through its captain
    const [tm] = await conn.query<RowDataPacket[]>("SELECT team_id FROM ko_participants WHERE id = ?", [participantId]);
    if (tm[0]?.team_id != null && Number(tm[0].team_id) !== participantId) {
      participantId = Number(tm[0].team_id);
      const [cap] = await conn.query<RowDataPacket[]>("SELECT id, state, disqualified FROM ko_participants WHERE id = ? FOR UPDATE", [participantId]);
      p = cap[0];
    }
    const [isBoss] = await conn.query<RowDataPacket[]>("SELECT is_boss FROM ko_participants WHERE id = ?", [participantId]);
    if (Number(isBoss[0]?.is_boss)) throw new AppError("invalid_input", "a boss can't be disqualified");
    if (p.disqualified) throw new AppError("already_disqualified");
    if (p.state === "eliminated" || p.state === "champion") throw new AppError("player_out");
    const [mRows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM ko_matches WHERE tournament_id = ? AND (p1_id = ? OR p2_id = ?) AND status IN ('rolled','ready','live') FOR UPDATE", [id, participantId, participantId]);
    const m = mRows[0];
    if (m?.status === "rolled") throw new AppError("roll_pending");
    await conn.query("UPDATE ko_participants SET disqualified = 1, state = 'eliminated' WHERE id = ?", [participantId]);
    if (m) {
      const opp = Number(m.p1_id) === participantId ? 2 : 1;
      // walkover: the winner advances, nothing to compare
      await finishMatch(conn, t, m, opp);
      return { forfeit: Number(m.id) };
    }
    await propagate(conn, id);
    return { forfeit: null };
  });
}

// ── duo teams ──

/**
 * Duo: pair every waiting player at random (crypto). Registration must be
 * closed. An odd count is refused, never silently resolved: the admin adds a
 * player or disqualifies one first.
 */
export async function makeTeams(id: number): Promise<{ teams: number }> {
  await ensureKoSchema();
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    if (t.team_size !== 2) throw new AppError("not_duo");
    if (t.status !== "closed") throw new AppError("close_registration_first");
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id, team_id FROM ko_participants WHERE tournament_id = ? AND disqualified = 0 AND state = 'registered' FOR UPDATE", [id]);
    if (rows.some((r) => r.team_id != null)) throw new AppError("teams_made");
    const ids = rows.map((r) => Number(r.id));
    if (ids.length < 4) throw new AppError("not_enough_players", "a duo tournament needs at least 4 players");
    if (ids.length % 2) throw new AppError("odd_players", `${ids.length} players: add one or disqualify one so everyone has a teammate`);
    if (ids.length / 2 > t.max_players) throw new AppError("ko_full");
    for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    for (let i = 0; i < ids.length; i += 2) await conn.query("UPDATE ko_participants SET team_id = ? WHERE id IN (?, ?)", [ids[i], ids[i], ids[i + 1]]);
    return { teams: ids.length / 2 };
  });
}

/** Duo: undo the draw while no battle has been rolled yet. */
export async function undoTeams(id: number): Promise<void> {
  await withTx(async (conn) => {
    await lockRunning(conn, id);
    const [m] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_matches WHERE tournament_id = ? AND (p1_id IS NOT NULL OR status <> 'empty')", [id]);
    if (Number(m[0].n) > 0) throw new AppError("bracket_started");
    await conn.query("UPDATE ko_participants SET team_id = NULL WHERE tournament_id = ?", [id]);
  });
}

// ── chat registration ──

export interface JoinInput {
  kickUserId: string; username: string; messageId: string;
  /** Kick profile picture from the chat message, when known */
  avatar?: string | null;
  slot?: { id: string; name: string; provider: string; imageUrl: string } | null;
}
export type JoinOutcome =
  | "registered" | "rerolled" | "duplicate_message" | "no_tournament" | "registration_closed"
  | "full" | "locked_in_bracket" | "eliminated" | "disqualified" | "pending_roll" | "no_slots" | "slot_taken" | "already_joined";

/** Run inside a transaction. */
export async function recordJoin(conn: PoolConnection, input: JoinInput): Promise<{ outcome: JoinOutcome; count?: number; slot?: string }> {
  const [seen] = await conn.query<ResultSetHeader>("INSERT IGNORE INTO ko_join_seen (message_id) VALUES (?)", [input.messageId.slice(0, 191)]);
  if (!seen.affectedRows) return { outcome: "duplicate_message" };
  // The tournament row lock must be the FIRST read of this transaction so
  // later counts see every concurrent registration (REPEATABLE READ).
  const [locked] = await conn.query<RowDataPacket[]>(`SELECT ${T_COLS} FROM ko_tournaments WHERE status IN ('open','closed') ORDER BY id DESC LIMIT 1 FOR UPDATE`);
  const t = locked[0] ? toT(locked[0]) : null;
  if (!t) return { outcome: "no_tournament" };

  const [existing] = await conn.query<RowDataPacket[]>(
    "SELECT id, state, disqualified, slot_id FROM ko_participants WHERE tournament_id = ? AND kick_user_id = ? FOR UPDATE", [t.id, input.kickUserId]);
  const [everyone] = await conn.query<RowDataPacket[]>("SELECT kick_user_id, slot_id, disqualified, is_boss FROM ko_participants WHERE tournament_id = ? FOR SHARE", [t.id]);
  const taken = everyone.map((r) => String(r.slot_id));
  const assigned = everyone.filter((r) => !Number(r.is_boss));
  // A named slot can only be called by one player per tournament.
  if (t.mode !== "hunt" && input.slot && assigned.some((r) => !r.disqualified && String(r.slot_id) === input.slot!.id && String(r.kick_user_id) !== input.kickUserId))
    return { outcome: "slot_taken", slot: input.slot.name };

  if (existing[0]) {
    const p = existing[0];
    if (p.disqualified) return { outcome: "disqualified" };
    // Hunt: the monster brings the fight, nothing to change after joining
    if (t.mode === "hunt") return { outcome: "already_joined" };
    if (p.state === "eliminated") return { outcome: "eliminated" };
    if (p.state !== "registered") return { outcome: "locked_in_bracket" };
    const [inMatch] = await conn.query<RowDataPacket[]>("SELECT status FROM ko_matches WHERE tournament_id = ? AND (p1_id = ? OR p2_id = ?) LIMIT 1", [t.id, p.id, p.id]);
    if (inMatch[0]) return { outcome: inMatch[0].status === "rolled" ? "pending_roll" : "locked_in_bracket" };
    let slot = input.slot ?? null;
    if (!slot) {
      try { slot = await randomPoolSlot(conn, [...taken, String(p.slot_id)]); } catch { return { outcome: "no_slots" }; }
    }
    await conn.query(
      "UPDATE ko_participants SET slot_id = ?, slot_name = ?, slot_provider = ?, slot_image = ?, username = ?, avatar = COALESCE(?, avatar), rerolls = rerolls + 1 WHERE id = ?",
      [slot.id, slot.name, slot.provider, slot.imageUrl, input.username, input.avatar ?? null, p.id]);
    return { outcome: "rerolled", slot: slot.name };
  }

  if (t.status !== "open") return { outcome: "registration_closed" };
  const count = assigned.filter((r) => !r.disqualified).length;
  if (count >= t.max_players * t.team_size) return { outcome: "full" };
  // Hunt: a plain !join (a slot typed after it is ignored; the row just keeps a placeholder slot)
  let slot = t.mode === "hunt" ? null : input.slot ?? null;
  if (!slot) {
    try { slot = await randomPoolSlot(conn, taken); } catch { return { outcome: "no_slots" }; }
  }
  await conn.query(
    "INSERT INTO ko_participants (tournament_id, kick_user_id, username, avatar, slot_id, slot_name, slot_provider, slot_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [t.id, input.kickUserId, input.username, input.avatar ?? null, slot.id, slot.name, slot.provider, slot.imageUrl]);
  if (count + 1 >= t.max_players * t.team_size) await conn.query("UPDATE ko_tournaments SET status = 'closed', closed_at = UTC_TIMESTAMP() WHERE id = ?", [t.id]);
  return { outcome: "registered", count: count + 1, slot: slot.name };
}

/** Admin: add a player by hand (no Kick chat). */
export async function addPlayerManually(username: string, slot: JoinInput["slot"]): Promise<{ outcome: JoinOutcome }> {
  await ensureKoSchema();
  const id = `manual:${username.toLowerCase()}`;
  return withTx((conn) => recordJoin(conn, { kickUserId: id.slice(0, 64), username, messageId: `manual:${Date.now()}:${Math.random()}`, slot }));
}

// ── roller ──

export async function rollPlayers(id: number): Promise<{ matchId: number; p1: number; p2: number | null; bye: boolean }> {
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    if (t.mode === "hunt") throw new AppError("hunt_mode");
    const [matches] = await conn.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? AND round = 1 ORDER BY match_index FOR UPDATE", [id]);
    if (matches.some((m) => m.status === "rolled")) throw new AppError("roll_pending");
    const target = matches.find((m) => m.status === "empty");
    if (!target) throw new AppError("first_round_full");
    const used = new Set<number>();
    for (const m of matches) { if (m.p1_id) used.add(Number(m.p1_id)); if (m.p2_id) used.add(Number(m.p2_id)); }
    if (t.team_size === 2) {
      const [loose] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_participants WHERE tournament_id = ? AND state = 'registered' AND disqualified = 0 AND team_id IS NULL", [id]);
      if (Number(loose[0].n) > 0) throw new AppError("make_teams_first");
    }
    const [pRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM ko_participants WHERE tournament_id = ? AND state = 'registered' AND disqualified = 0 AND ${UNIT_SQL} ORDER BY id FOR UPDATE`, [id]);
    const pool = pRows.map((r) => Number(r.id)).filter((pid) => !used.has(pid));
    const seq = t.roll_seq + 1;

    if (pool.length === 1 && t.status === "closed") {
      const p1 = pool[0]; // last player with nobody left to face: bye
      await conn.query("UPDATE ko_matches SET p1_id = ?, status = 'bye', winner_id = ?, roll_seq = ?, rolled_at = UTC_TIMESTAMP(), finished_at = UTC_TIMESTAMP() WHERE id = ?", [p1, p1, seq, target.id]);
      await conn.query("UPDATE ko_participants SET state = 'in_knockout', bracket_pos = ? WHERE id = ?", [Number(target.match_index) * 2 + 1, p1]);
      await conn.query("UPDATE ko_tournaments SET roll_seq = ?, focus_match_id = ? WHERE id = ?", [seq, target.id, id]);
      await propagate(conn, id);
      return { matchId: Number(target.id), p1, p2: null, bye: true };
    }
    if (pool.length < 2) throw new AppError("not_enough_players", pool.length === 1 ? "close registration to give the last player a bye" : "no waiting players left");
    const [a, b] = pickTwo(pool.length);
    await conn.query("UPDATE ko_matches SET p1_id = ?, p2_id = ?, status = 'rolled', roll_seq = ?, rolled_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'empty'", [pool[a], pool[b], seq, target.id]);
    await conn.query("UPDATE ko_tournaments SET roll_seq = ?, focus_match_id = ? WHERE id = ?", [seq, target.id, id]);
    return { matchId: Number(target.id), p1: pool[a], p2: pool[b], bye: false };
  });
}

export async function confirmRoll(id: number): Promise<void> {
  await withTx(async (conn) => {
    await lockRunning(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? AND status = 'rolled' FOR UPDATE", [id]);
    const m = rows[0];
    if (!m) throw new AppError("no_pending_roll");
    const base = Number(m.match_index) * 2;
    await conn.query("UPDATE ko_participants SET state = 'in_knockout', bracket_pos = ? WHERE id = ? AND state = 'registered'", [base + 1, m.p1_id]);
    await conn.query("UPDATE ko_participants SET state = 'in_knockout', bracket_pos = ? WHERE id = ? AND state = 'registered'", [base + 2, m.p2_id]);
    await conn.query("UPDATE ko_matches SET status = 'ready' WHERE id = ?", [m.id]);
    await propagate(conn, id);
  });
}

export async function cancelRoll(id: number): Promise<void> {
  await withTx(async (conn) => {
    await lockRunning(conn, id);
    const [res] = await conn.query<ResultSetHeader>(
      "UPDATE ko_matches SET p1_id = NULL, p2_id = NULL, status = 'empty', roll_seq = NULL, rolled_at = NULL WHERE tournament_id = ? AND status = 'rolled'", [id]);
    if (!res.affectedRows) throw new AppError("no_pending_roll");
    await conn.query("UPDATE ko_tournaments SET focus_match_id = NULL WHERE id = ?", [id]);
  });
}

// ── reaping bosses ──

export interface BossRollResult { round: number; chance: number; spawned: boolean; bossId: number | null; matchId: number | null }

/**
 * Reaping: rolls whether a boss rises before the current stage (once per
 * stage, under the tournament lock). A boss ambushes one random battle of
 * the stage that has no boss in it; in round 1 only the battles that will
 * really be played (pairs of the fixed field, drawn in seat order) count.
 */
export async function rollBoss(id: number): Promise<BossRollResult> {
  await ensureKoSchema();
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    if (t.mode !== "reaping") throw new AppError("invalid_input", "not a Reaping tournament");
    if (t.status === "open") throw new AppError("close_registration_first");
    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY round, match_index FOR UPDATE", [id]);
    if (rows.some((m) => m.status === "live")) throw new AppError("battle_live");
    const stage = currentStage(rows as { round: unknown; status: unknown }[]);
    if (stage == null) throw new AppError("no_ready_battle");
    const [prev] = await conn.query<RowDataPacket[]>("SELECT * FROM ko_boss_rolls WHERE tournament_id = ? AND round = ?", [id, stage]);
    if (prev[0]) return { round: stage, chance: Number(prev[0].chance), spawned: Boolean(prev[0].spawned), bossId: prev[0].boss_id != null ? Number(prev[0].boss_id) : null, matchId: prev[0].match_id != null ? Number(prev[0].match_id) : null };

    const last = roundsFor(t.max_players);
    const [bossRows] = await conn.query<RowDataPacket[]>("SELECT id, username FROM ko_participants WHERE tournament_id = ? AND is_boss = 1", [id]);
    const bossIds = new Set(bossRows.map((r) => Number(r.id)));
    const chance = stageChance({ chance: t.boss_chance, isFinal: stage === last, finalBoss: t.final_boss, bossesSoFar: bossRows.length });
    let candidates = rows.filter((m) => Number(m.round) === stage && m.boss_id == null && !bossIds.has(Number(m.p1_id)) && !bossIds.has(Number(m.p2_id))
      && !(stage === last && Number(m.match_index) === 1));
    if (stage === 1) {
      const [u] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS n FROM ko_participants WHERE tournament_id = ? AND is_boss = 0 AND disqualified = 0 AND state IN ('registered','in_knockout') AND ${UNIT_SQL}${t.team_size === 2 ? " AND team_id IS NOT NULL" : ""}`, [id]);
      const pairs = Math.min(Math.floor(Number(u[0].n) / 2), matchesIn(t.max_players, 1));
      candidates = candidates.filter((m) => ["empty", "rolled", "ready"].includes(String(m.status)) && Number(m.match_index) < pairs);
    } else {
      candidates = candidates.filter((m) => m.status === "ready");
    }
    const spawned = candidates.length > 0 && randomInt(100) < chance;
    let bossId: number | null = null;
    let matchId: number | null = null;
    if (spawned) {
      const m = candidates[randomInt(candidates.length)];
      const { tier, target } = spinWheel(t.team_size === 2);
      const [slots] = await conn.query<RowDataPacket[]>("SELECT slot_id FROM ko_participants WHERE tournament_id = ?", [id]);
      const slot = await randomPoolSlot(conn, slots.map((r) => String(r.slot_id)));
      const [ins] = await conn.query<ResultSetHeader>(
        "INSERT INTO ko_participants (tournament_id, kick_user_id, username, avatar, slot_id, slot_name, slot_provider, slot_image, state, is_boss, boss_target, boss_tier, boss_line) VALUES (?, ?, ?, '', ?, ?, ?, ?, 'in_knockout', 1, ?, ?, ?)",
        [id, `boss:${stage}`, bossName(bossRows.map((r) => String(r.username))), slot.id, slot.name, slot.provider, slot.imageUrl, target, tier, bossLine(target)]);
      bossId = ins.insertId;
      matchId = Number(m.id);
      // duo: a boss is a team of one, so it counts as a bracket unit
      if (t.team_size === 2) await conn.query("UPDATE ko_participants SET team_id = id WHERE id = ?", [bossId]);
      await conn.query("UPDATE ko_matches SET boss_id = ? WHERE id = ?", [bossId, matchId]);
    }
    await conn.query("INSERT INTO ko_boss_rolls (tournament_id, round, chance, spawned, boss_id, match_id) VALUES (?, ?, ?, ?, ?, ?)", [id, stage, chance, spawned ? 1 : 0, bossId, matchId]);
    return { round: stage, chance, spawned, bossId, matchId };
  });
}

/** Host re-spins the wheel of the boss that just rose (before its battle starts): new tier, target and line. */
export async function respinBoss(id: number): Promise<{ target: number }> {
  await ensureKoSchema();
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT r.id, r.boss_id, m.status FROM ko_boss_rolls r JOIN ko_matches m ON m.id = r.match_id
        WHERE r.tournament_id = ? AND r.spawned = 1 AND m.boss_id = r.boss_id ORDER BY r.round DESC LIMIT 1 FOR UPDATE`, [id]);
    const r = rows[0];
    if (!r || !["empty", "rolled", "ready"].includes(String(r.status))) throw new AppError("invalid_input", "no boss waiting for its battle");
    const { tier, target } = spinWheel(t.team_size === 2);
    await conn.query("UPDATE ko_participants SET boss_target = ?, boss_tier = ?, boss_line = ? WHERE id = ?", [target, tier, bossLine(target), r.boss_id]);
    await conn.query("UPDATE ko_boss_rolls SET spins = spins + 1 WHERE id = ?", [r.id]);
    return { target };
  });
}

// ── battles ──

/** Starts the focused battle if ready, else the next ready one in bracket order. */
export async function startBattle(id: number): Promise<number> {
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    if (t.mode === "hunt") throw new AppError("hunt_mode");
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY ${playOrderSql(roundsFor(t.max_players))} FOR UPDATE`, [id]);
    if (rows.some((m) => m.status === "live")) throw new AppError("battle_live");
    if (rows.some((m) => m.status === "rolled")) throw new AppError("roll_pending");
    const stage = currentStage(rows as { round: unknown; status: unknown }[]);
    if (t.mode === "reaping") {
      if (t.status === "open") throw new AppError("close_registration_first");
      const [rolled] = await conn.query<RowDataPacket[]>("SELECT 1 FROM ko_boss_rolls WHERE tournament_id = ? AND round = ?", [id, stage]);
      if (!rolled[0]) throw new AppError("boss_roll_first");
    }
    const ready = rows.filter((x) => x.status === "ready" && Number(x.round) === stage);
    const m = ready.find((x) => Number(x.id) === Number(t.focus_match_id)) ?? ready[0];
    if (!m) throw new AppError(rows.some((x) => x.status === "ready") ? "stage_unfinished" : "no_ready_battle");
    await conn.query("UPDATE ko_matches SET status = 'live', started_at = UTC_TIMESTAMP() WHERE id = ?", [m.id]);
    await conn.query("UPDATE ko_tournaments SET focus_match_id = ? WHERE id = ?", [m.id, id]);
    return Number(m.id);
  });
}

/**
 * One button for the whole tournament ("Start next battle"): plays the next
 * battle that is ready in bracket order; when none is, draws two random
 * waiting players (teams in duo) and starts their battle straight away.
 * Duo: the first press closes registration and draws the teams. A last
 * player with nobody left gets a bye (nothing to start, press again).
 */
export async function playNext(id: number): Promise<{ matchId: number | null; bye: boolean; boss?: BossRollResult }> {
  const t = await getKoById(id);
  if (!t) throw new AppError("not_found");
  // after the final ("Save & start next") there is simply nothing left to start
  if (t.status !== "open" && t.status !== "closed") return { matchId: null, bye: false };
  if (t.mode === "hunt") throw new AppError("hunt_mode");
  let state = await getKoState(t);
  if (state.live) throw new AppError("battle_live");
  // Reaping: the field is fixed before the first boss roll, then every stage
  // opens with its roll; a boss rising stops here so the stream sees the
  // wheel before the battle starts (the next press plays on)
  if (t.mode === "reaping") {
    if (t.status === "open") await closeRegistration(id);
    if (t.team_size === 2 && !state.teamsMade) await makeTeams(id);
    state = await getKoState((await getKoById(id))!);
    const stage = currentStage(state.matches);
    if (stage != null && !state.bossRolls.some((r) => r.round === stage)) {
      const roll = await rollBoss(id);
      if (roll.spawned) return { matchId: null, bye: false, boss: roll };
      state = await getKoState((await getKoById(id))!);
    }
  }
  if (!state.pendingRoll && !state.nextReady) {
    if (t.team_size === 2 && !state.teamsMade) {
      if (t.status === "open") await closeRegistration(id);
      await makeTeams(id);
    }
    const r = await rollPlayers(id);
    if (r.bye) return { matchId: r.matchId, bye: true };
    state = await getKoState((await getKoById(id))!);
  }
  if (state.pendingRoll) await confirmRoll(id);
  return { matchId: await startBattle(id), bye: false };
}

/** Moves the focus to the next live/rolled/ready battle (or clears it). */
export async function focusNext(id: number): Promise<number | null> {
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM ko_matches WHERE tournament_id = ? AND status IN ('live','rolled','ready') ORDER BY FIELD(status,'live','rolled','ready'), ${playOrderSql(roundsFor(t.max_players))} LIMIT 1`, [id]);
    const next = rows[0] ? Number(rows[0].id) : null;
    await conn.query("UPDATE ko_tournaments SET focus_match_id = ? WHERE id = ?", [next, id]);
    return next;
  });
}

async function lockLiveMatch(conn: PoolConnection, id: number, matchId: number): Promise<{ t: KoTournament; m: RowDataPacket }> {
  const t = await lockRunning(conn, id);
  const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE id = ? AND tournament_id = ? FOR UPDATE", [matchId, id]);
  const m = rows[0];
  if (!m) throw new AppError("not_found");
  if (m.status !== "live") throw new AppError("battle_not_live");
  return { t, m };
}

export type BonusKey = "p1" | "p1b" | "p2" | "p2b";

/** One bonus of the live battle, saved as soon as it is known so stream shows it; no winner yet. */
export async function saveBonus(id: number, matchId: number, key: BonusKey, bonus: { cost: string; payout: string }): Promise<void> {
  await withTx(async (conn) => {
    const { t, m } = await lockLiveMatch(conn, id, matchId);
    if (t.team_size !== 2 && (key === "p1b" || key === "p2b")) throw new AppError("invalid_input", "solo battles have one bonus per side");
    const [side] = await conn.query<RowDataPacket[]>("SELECT is_boss FROM ko_participants WHERE id = ?", [key.startsWith("p1") ? m.p1_id : m.p2_id]);
    if (Number(side[0]?.is_boss)) throw new AppError("invalid_input", "the boss side plays its target, no bonus to enter");
    if (new Decimal(bonus.cost).lte(0)) throw new AppError("invalid_input", "bonus cost must be above 0");
    // key is one of four literals (validated above and by the API schema)
    await conn.query(`UPDATE ko_matches SET ${key}_cost = ?, ${key}_payout = ? WHERE id = ?`, [bonus.cost, bonus.payout, matchId]);
  });
}

type Bonus = { cost: string; payout: string };

/** Exact side score: the multiplier, or both teammates' multipliers added (duo). */
function sideScore(a: Bonus | undefined, b: Bonus | undefined, duo: boolean): Decimal {
  if (!a || (duo && !b)) throw new AppError("invalid_input", duo ? "duo battles need both bonuses of a team" : "missing bonus result");
  const one = (x: Bonus) => {
    const c = new Decimal(x.cost);
    if (c.lte(0)) throw new AppError("invalid_input", "bonus cost must be above 0");
    return new Decimal(x.payout).div(c);
  };
  return duo ? one(a).plus(one(b!)) : one(a);
}

/**
 * Results of the live battle; the higher multiplier wins (exact tie =
 * replay). Reaping: against a boss in the bracket only the player side plays
 * and must reach the boss's target; in an ambushed battle, if neither side
 * reaches the target the boss advances and both are reaped.
 */
export async function recordBattleResult(
  id: number, matchId: number, p1: Bonus | undefined, p2: Bonus | undefined,
  duo?: { p1b?: Bonus; p2b?: Bonus },
): Promise<{ winnerId: number; champion: boolean; m1: string; m2: string; reaped: boolean }> {
  return withTx(async (conn) => {
    const { t, m } = await lockLiveMatch(conn, id, matchId);
    const isDuo = t.team_size === 2;
    const ids = [m.p1_id, m.p2_id, m.boss_id].filter((x) => x != null).map(Number);
    const [bRows] = await conn.query<RowDataPacket[]>("SELECT id, boss_target FROM ko_participants WHERE id IN (?) AND is_boss = 1", [ids]);
    const target = new Map(bRows.map((r) => [Number(r.id), new Decimal(String(r.boss_target))]));
    const t1 = target.get(Number(m.p1_id)), t2 = target.get(Number(m.p2_id));
    const save = (key: "p1" | "p1b" | "p2" | "p2b", b: Bonus | undefined) =>
      conn.query(`UPDATE ko_matches SET ${key}_cost = ?, ${key}_payout = ? WHERE id = ?`, [b?.cost ?? null, b?.payout ?? null, matchId]);

    if (t1 || t2) {
      // a player (team) against a boss: reach its target or be reaped
      const human: 1 | 2 = t1 ? 2 : 1;
      const score = human === 1 ? sideScore(p1, duo?.p1b, isDuo) : sideScore(p2, duo?.p2b, isDuo);
      const need = (t1 ?? t2)!;
      if (human === 1) { await save("p1", p1); await save("p1b", isDuo ? duo?.p1b : undefined); }
      else { await save("p2", p2); await save("p2b", isDuo ? duo?.p2b : undefined); }
      const side: 1 | 2 = score.gte(need) ? human : human === 1 ? 2 : 1;
      const res = await finishMatch(conn, t, m, side, { reap: side !== human });
      const [m1, m2] = human === 1 ? [score.toFixed(2), need.toFixed(2)] : [need.toFixed(2), score.toFixed(2)];
      return { ...res, m1, m2, reaped: side !== human };
    }

    const e1 = sideScore(p1, duo?.p1b, isDuo), e2 = sideScore(p2, duo?.p2b, isDuo);
    const ambusher = m.boss_id != null ? target.get(Number(m.boss_id)) : undefined;
    // nobody reaches the ambushing boss: it advances, even on an exact tie
    if (!(ambusher && e1.lt(ambusher) && e2.lt(ambusher)) && e1.eq(e2)) throw new AppError("battle_tied", `both at x${e1.toFixed(2)}`);
    await conn.query(
      "UPDATE ko_matches SET p1_cost = ?, p1_payout = ?, p2_cost = ?, p2_payout = ?, p1b_cost = ?, p1b_payout = ?, p2b_cost = ?, p2b_payout = ? WHERE id = ?",
      [p1!.cost, p1!.payout, p2!.cost, p2!.payout, isDuo ? duo!.p1b!.cost : null, isDuo ? duo!.p1b!.payout : null, isDuo ? duo!.p2b!.cost : null, isDuo ? duo!.p2b!.payout : null, matchId]);
    if (ambusher && e1.lt(ambusher) && e2.lt(ambusher)) {
      return { ...(await finishReaped(conn, t, m)), m1: e1.toFixed(2), m2: e2.toFixed(2), reaped: true };
    }
    return { ...(await finishMatch(conn, t, m, e1.gt(e2) ? 1 : 2)), m1: e1.toFixed(2), m2: e2.toFixed(2), reaped: false };
  });
}

/** Ambushed battle where neither side reached the target: the boss takes the seat. */
async function finishReaped(conn: PoolConnection, t: KoTournament, m: RowDataPacket): Promise<{ winnerId: number; champion: boolean }> {
  const boss = Number(m.boss_id);
  await conn.query("UPDATE ko_matches SET status = 'done', winner_id = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [boss, m.id]);
  await conn.query("UPDATE ko_participants SET state = 'eliminated', reaped = 1 WHERE id IN (?, ?)", [m.p1_id, m.p2_id]);
  await conn.query("UPDATE ko_tournaments SET focus_match_id = ? WHERE id = ?", [m.id, t.id]);
  const champion = await propagate(conn, t.id);
  return { winnerId: boss, champion: champion === boss };
}

async function finishMatch(conn: PoolConnection, t: KoTournament, m: RowDataPacket, side: 1 | 2, opts: { reap?: boolean } = {}): Promise<{ winnerId: number; champion: boolean }> {
  const winner = Number(side === 1 ? m.p1_id : m.p2_id);
  const loser = Number(side === 1 ? m.p2_id : m.p1_id);
  await conn.query("UPDATE ko_matches SET status = 'done', winner_id = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [winner, m.id]);
  if (opts.reap) await conn.query("UPDATE ko_participants SET reaped = 1 WHERE id = ?", [loser]);
  // a player beat the ambushing boss (or won on a walkover): the boss is gone
  if (m.boss_id != null && Number(m.boss_id) !== winner) await conn.query("UPDATE ko_participants SET state = 'eliminated' WHERE id = ?", [m.boss_id]);
  // semi-final losers of older tournaments aren't out yet: they play the 3rd-place match
  const last = roundsFor(t.max_players);
  const [bronze] = await conn.query<RowDataPacket[]>("SELECT 1 FROM ko_matches WHERE tournament_id = ? AND round = ? AND match_index = 1", [t.id, last]);
  if (Number(m.round) !== last - 1 || !bronze[0]) await conn.query("UPDATE ko_participants SET state = 'eliminated' WHERE id = ?", [loser]);
  await conn.query("UPDATE ko_tournaments SET focus_match_id = ? WHERE id = ?", [m.id, t.id]);
  const champion = await propagate(conn, t.id);
  return { winnerId: winner, champion: champion === winner };
}

// ── bracket propagation ──

type Side = { kind: "player"; id: number } | { kind: "void" } | { kind: "pending" };

function loserSide(m: RowDataPacket | undefined): Side {
  if (!m) return { kind: "pending" };
  if (m.status === "done" && m.winner_id) {
    const loser = Number(m.winner_id) === Number(m.p1_id) ? m.p2_id : m.p1_id;
    return loser ? { kind: "player", id: Number(loser) } : { kind: "void" };
  }
  if (m.status === "bye" || m.status === "void") return { kind: "void" };
  return { kind: "pending" };
}

function feederSide(m: RowDataPacket | undefined): Side {
  if (!m) return { kind: "pending" };
  if ((m.status === "done" || m.status === "bye") && m.winner_id) return { kind: "player", id: Number(m.winner_id) };
  if (m.status === "void") return { kind: "void" };
  return { kind: "pending" };
}

/** Fills later rounds, resolves byes/voids, crowns the champion. Idempotent. */
async function propagate(conn: PoolConnection, id: number): Promise<number | null> {
  const [tRows] = await conn.query<RowDataPacket[]>("SELECT status, max_players FROM ko_tournaments WHERE id = ?", [id]);
  const closed = tRows[0]?.status === "closed";
  const last = roundsFor(Number(tRows[0]?.max_players ?? 16));
  const load = async () => (await conn.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY round, match_index", [id]))[0];
  let rows = await load();
  const [dqRows] = await conn.query<RowDataPacket[]>("SELECT id FROM ko_participants WHERE tournament_id = ? AND disqualified = 1", [id]);
  const dq = new Set(dqRows.map((r) => Number(r.id)));
  const out = (x: Side): Side => (x.kind === "player" && dq.has(x.id) ? { kind: "void" } : x);
  const [bossRows] = await conn.query<RowDataPacket[]>("SELECT id, boss_target FROM ko_participants WHERE tournament_id = ? AND is_boss = 1", [id]);
  const bossT = new Map(bossRows.map((r) => [Number(r.id), new Decimal(String(r.boss_target))]));

  if (closed) {
    const r1 = rows.filter((m) => Number(m.round) === 1);
    const used = new Set<number>();
    for (const m of r1) { if (m.p1_id) used.add(Number(m.p1_id)); if (m.p2_id) used.add(Number(m.p2_id)); }
    const [pRows] = await conn.query<RowDataPacket[]>(`SELECT id FROM ko_participants WHERE tournament_id = ? AND state = 'registered' AND disqualified = 0 AND ${UNIT_SQL}`, [id]);
    const unassigned = pRows.filter((p) => !used.has(Number(p.id))).length;
    if (unassigned === 0 && !r1.some((m) => m.status === "rolled")) {
      await conn.query("UPDATE ko_matches SET status = 'void' WHERE tournament_id = ? AND round = 1 AND status = 'empty'", [id]);
      rows = await load();
    }
  }

  for (let round = 2; round <= last; round++) {
    for (const m of rows.filter((x) => Number(x.round) === round)) {
      if (["live", "done", "bye", "void"].includes(m.status)) continue;
      const bronze = round === last && Number(m.match_index) === 1;
      const fi = bronze ? 0 : Number(m.match_index) * 2;
      const f1 = rows.find((x) => Number(x.round) === round - 1 && Number(x.match_index) === fi);
      const f2 = rows.find((x) => Number(x.round) === round - 1 && Number(x.match_index) === fi + 1);
      const a = out(bronze ? loserSide(f1) : feederSide(f1));
      const b = out(bronze ? loserSide(f2) : feederSide(f2));
      const p1 = a.kind === "player" ? a.id : null;
      const p2 = b.kind === "player" ? b.id : null;
      let status: MatchStatus = "empty";
      let winner: number | null = null;
      if (p1 && p2) status = "ready";
      else if (a.kind === "void" && b.kind === "void") status = "void";
      else if ((p1 && b.kind === "void") || (p2 && a.kind === "void")) { status = "bye"; winner = p1 ?? p2; }
      // two bosses meet: the stronger target advances, nothing to play
      if (p1 && p2 && bossT.has(p1) && bossT.has(p2)) { status = "done"; winner = bossT.get(p2)!.gt(bossT.get(p1)!) ? p2 : p1; }
      if (status !== m.status || p1 !== (m.p1_id ? Number(m.p1_id) : null) || p2 !== (m.p2_id ? Number(m.p2_id) : null)) {
        await conn.query(
          "UPDATE ko_matches SET p1_id = ?, p2_id = ?, status = ?, winner_id = ?, finished_at = IF(? IN ('bye','done'), UTC_TIMESTAMP(), NULL) WHERE id = ?",
          [p1, p2, status, winner, status, m.id]);
        if (status === "done") await conn.query("UPDATE ko_participants SET state = 'eliminated' WHERE id = ?", [winner === p1 ? p2 : p1]);
        Object.assign(m, { p1_id: p1, p2_id: p2, status, winner_id: winner });
      }
    }
  }

  // a boss whose ambushed battle turned into a bye or an empty seat (a DQ) leaves
  if (bossT.size) {
    await conn.query(
      "UPDATE ko_participants p JOIN ko_matches m ON m.boss_id = p.id SET p.state = 'eliminated', m.boss_id = NULL WHERE m.tournament_id = ? AND m.status IN ('void','bye') AND p.state = 'in_knockout'", [id]);
  }

  const final = rows.find((x) => Number(x.round) === last && Number(x.match_index) === 0);
  const bronze = rows.find((x) => Number(x.round) === last && Number(x.match_index) === 1);
  const finalDone = final && (final.status === "done" || final.status === "bye") && final.winner_id;
  const bronzeDone = !bronze || ["done", "bye", "void"].includes(bronze.status);
  if (!finalDone || !bronzeDone) { await syncPartners(conn, id); return null; }
  const champ = Number(final.winner_id);
  const runnerUp = final.status === "done" ? Number(Number(final.p1_id) === champ ? final.p2_id : final.p1_id) : null;
  const third = bronze && (bronze.status === "done" || bronze.status === "bye") && bronze.winner_id ? Number(bronze.winner_id) : null;
  await conn.query("UPDATE ko_participants SET state = 'champion' WHERE id = ?", [champ]);
  await conn.query("UPDATE ko_participants SET state = 'eliminated' WHERE tournament_id = ? AND state = 'in_knockout'", [id]);
  await conn.query(
    "UPDATE ko_tournaments SET status = 'finished', champion_id = ?, runner_up_id = ?, third_id = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?",
    [champ, runnerUp, third, id]);
  await syncPartners(conn, id);
  return champ;
}

/** Duo: teammates mirror their captain's bracket state. */
async function syncPartners(conn: PoolConnection, id: number): Promise<void> {
  await conn.query(
    "UPDATE ko_participants m JOIN ko_participants c ON c.id = m.team_id SET m.state = c.state, m.disqualified = c.disqualified, m.reaped = c.reaped WHERE m.tournament_id = ? AND m.team_id IS NOT NULL AND m.id <> m.team_id",
    [id]);
}

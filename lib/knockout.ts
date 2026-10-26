import "server-only";
import { randomInt } from "node:crypto";
import Decimal from "decimal.js";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { kickAvatars } from "./kickApi";
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
}
export interface BattleResult { cost: string; payout: string; multi: string }
export interface KoMatch {
  id: number; round: number; match_index: number; status: MatchStatus;
  p1: KoParticipant | null; p2: KoParticipant | null; winner_id: number | null; roll_seq: number | null;
  p1_result: BattleResult | null; p2_result: BattleResult | null;
  /** Duo: the teammates' bonuses. */
  p1b_result: BattleResult | null; p2b_result: BattleResult | null;
  /** Side score: the multiplier (solo) or the sum of both multipliers (duo). */
  p1_multi: string | null; p2_multi: string | null;
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
}

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

const T_COLS = "id, title, prize, prize_1, prize_2, prize_3, status, max_players, team_size, champion_id, runner_up_id, third_id, roll_seq, focus_match_id, created_at, finished_at";
const P_COLS = "id, username, avatar, slot_name, slot_provider, slot_image, state, disqualified, team_id, bracket_pos, rerolls, joined_at";
const toT = (r: RowDataPacket): KoTournament => ({ ...(r as KoTournament), id: Number(r.id), max_players: Number(r.max_players), team_size: Number(r.team_size ?? 1), roll_seq: Number(r.roll_seq) });
/** Bracket units: everyone in solo, team captains in duo. */
const UNIT_SQL = "(team_id IS NULL OR team_id = id)";

/** Running tournament (open/closed), else the most recent finished one. */
export async function getFeaturedKo(): Promise<KoTournament | null> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT ${T_COLS} FROM ko_tournaments WHERE status IN ('open','closed','finished') ORDER BY FIELD(status,'open','closed','finished'), id DESC LIMIT 1`);
  return rows[0] ? toT(rows[0]) : null;
}

export async function getKoById(id: number): Promise<KoTournament | null> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(`SELECT ${T_COLS} FROM ko_tournaments WHERE id = ?`, [id]);
  return rows[0] ? toT(rows[0]) : null;
}

export async function getKoArchive(limit = 12): Promise<(KoTournament & { champion: string | null; champion_slot: string | null; champion_image: string | null })[]> {
  await ensureKoSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT t.${T_COLS.split(", ").join(", t.")}, p.username AS champion, mate.username AS champion_mate, p.slot_name AS champion_slot, p.slot_image AS champion_image
       FROM ko_tournaments t
       LEFT JOIN ko_participants p ON p.id = t.champion_id
       LEFT JOIN ko_participants mate ON mate.team_id = p.id AND mate.id <> p.id
      WHERE t.status = 'finished' ORDER BY t.finished_at DESC, t.id DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({
    ...toT(r),
    champion: r.champion ? (r.champion_mate ? `${r.champion} & ${r.champion_mate}` : String(r.champion)) : null,
    champion_slot: r.champion_slot ?? null, champion_image: r.champion_image || null,
  }));
}

export async function getKoState(t: KoTournament): Promise<KoState> {
  await ensureKoSchema();
  const pool = getPool();
  const [[pRows], [mRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT ${P_COLS} FROM ko_participants WHERE tournament_id = ? ORDER BY id`, [t.id]),
    pool.query<RowDataPacket[]>("SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY round, match_index", [t.id]),
  ]);
  const participants: KoParticipant[] = pRows.map((p) => ({ ...(p as KoParticipant), id: Number(p.id), avatar: p.avatar || null, disqualified: Boolean(p.disqualified), team_id: p.team_id != null ? Number(p.team_id) : null }));
  const byId = new Map(participants.map((p) => [p.id, p]));
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
  }));
  for (const m of matches) { m.p1_multi = sumMulti(m.p1_result, m.p1b_result, duo); m.p2_multi = sumMulti(m.p2_result, m.p2b_result, duo); }
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

export async function createKo(input: { title: string; prize: string; size: KoSize; duo?: boolean; prizes?: [string | null, string | null, string | null] }): Promise<number> {
  await ensureKoSchema();
  if (!SIZES.includes(input.size)) throw new AppError("invalid_input", "size must be 4, 8, 16 or 32");
  return withTx(async (conn) => {
    await lockApp(conn, "ko");
    const [active] = await conn.query<RowDataPacket[]>("SELECT id FROM ko_tournaments WHERE status IN ('open','closed') LIMIT 1");
    if (active[0]) throw new AppError("ko_running", `#${active[0].id} is still running: finish or reset it first`);
    const [p1, p2, p3] = input.prizes ?? [null, null, null];
    const [res] = await conn.query<ResultSetHeader>(
      "INSERT INTO ko_tournaments (title, prize, prize_1, prize_2, prize_3, status, max_players, team_size) VALUES (?, ?, ?, ?, ?, 'closed', ?, ?)",
      [input.title, input.prize, p1, p2, p3, input.size, input.duo ? 2 : 1]
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
    const [n] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n, SUM(team_id IS NOT NULL) AS teamed FROM ko_participants WHERE tournament_id = ? AND disqualified = 0", [id]);
    if (Number(n[0].n) >= t.max_players * t.team_size) throw new AppError("ko_full");
    if (Number(n[0].teamed) > 0) throw new AppError("teams_made");
    const [sealed] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM ko_matches WHERE tournament_id = ? AND round = 1 AND status IN ('void','bye')", [id]);
    if (Number(sealed[0].n) > 0) throw new AppError("ko_sealed");
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
/** Columns added after 0005 (migrations 0008, 0009, 0018). */
const SCHEMA_ADDS: [string, string][] = [
  ["ko_participants.disqualified", "ALTER TABLE ko_participants ADD COLUMN disqualified TINYINT(1) NOT NULL DEFAULT 0"],
  ["ko_tournaments.team_size", "ALTER TABLE ko_tournaments ADD COLUMN team_size TINYINT NOT NULL DEFAULT 1"],
  ["ko_participants.team_id", "ALTER TABLE ko_participants ADD COLUMN team_id BIGINT NULL"],
  ["ko_participants.avatar", "ALTER TABLE ko_participants ADD COLUMN avatar VARCHAR(512) NULL"],
  ["ko_matches.p1b_cost", "ALTER TABLE ko_matches ADD COLUMN p1b_cost DECIMAL(20,2) NULL, ADD COLUMN p1b_payout DECIMAL(20,2) NULL, ADD COLUMN p2b_cost DECIMAL(20,2) NULL, ADD COLUMN p2b_payout DECIMAL(20,2) NULL"],
];
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
  | "full" | "locked_in_bracket" | "eliminated" | "disqualified" | "pending_roll" | "no_slots" | "slot_taken";

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
  const [assigned] = await conn.query<RowDataPacket[]>("SELECT kick_user_id, slot_id, disqualified FROM ko_participants WHERE tournament_id = ? FOR SHARE", [t.id]);
  const taken = assigned.map((r) => String(r.slot_id));
  // A named slot can only be called by one player per tournament.
  if (input.slot && assigned.some((r) => !r.disqualified && String(r.slot_id) === input.slot!.id && String(r.kick_user_id) !== input.kickUserId))
    return { outcome: "slot_taken", slot: input.slot.name };

  if (existing[0]) {
    const p = existing[0];
    if (p.disqualified) return { outcome: "disqualified" };
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
  let slot = input.slot ?? null;
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

// ── battles ──

/** Starts the focused battle if ready, else the next ready one in bracket order. */
export async function startBattle(id: number): Promise<number> {
  return withTx(async (conn) => {
    const t = await lockRunning(conn, id);
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT * FROM ko_matches WHERE tournament_id = ? ORDER BY ${playOrderSql(roundsFor(t.max_players))} FOR UPDATE`, [id]);
    if (rows.some((m) => m.status === "live")) throw new AppError("battle_live");
    if (rows.some((m) => m.status === "rolled")) throw new AppError("roll_pending");
    const stage = currentStage(rows as { round: unknown; status: unknown }[]);
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
export async function playNext(id: number): Promise<{ matchId: number | null; bye: boolean }> {
  const t = await getKoById(id);
  if (!t) throw new AppError("not_found");
  // after the final ("Save & start next") there is simply nothing left to start
  if (t.status !== "open" && t.status !== "closed") return { matchId: null, bye: false };
  let state = await getKoState(t);
  if (state.live) throw new AppError("battle_live");
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
    const { t } = await lockLiveMatch(conn, id, matchId);
    if (t.team_size !== 2 && (key === "p1b" || key === "p2b")) throw new AppError("invalid_input", "solo battles have one bonus per side");
    if (new Decimal(bonus.cost).lte(0)) throw new AppError("invalid_input", "bonus cost must be above 0");
    // key is one of four literals (validated above and by the API schema)
    await conn.query(`UPDATE ko_matches SET ${key}_cost = ?, ${key}_payout = ? WHERE id = ?`, [bonus.cost, bonus.payout, matchId]);
  });
}

/** Both bonus results of the live battle; the higher multiplier wins. */
export async function recordBattleResult(
  id: number, matchId: number, p1: { cost: string; payout: string }, p2: { cost: string; payout: string },
  duo?: { p1b: { cost: string; payout: string }; p2b: { cost: string; payout: string } },
): Promise<{ winnerId: number; champion: boolean; m1: string; m2: string }> {
  return withTx(async (conn) => {
    const { t, m } = await lockLiveMatch(conn, id, matchId);
    if (t.team_size === 2 && !duo) throw new AppError("invalid_input", "duo battles need all four bonuses");
    const dec = t.team_size === 2 && duo ? decideTeamBattle(p1, duo.p1b, p2, duo.p2b) : decideBattle(p1, p2);
    if (dec.side === "tie") throw new AppError("battle_tied", `both at x${dec.m1}`);
    await conn.query(
      "UPDATE ko_matches SET p1_cost = ?, p1_payout = ?, p2_cost = ?, p2_payout = ?, p1b_cost = ?, p1b_payout = ?, p2b_cost = ?, p2b_payout = ? WHERE id = ?",
      [p1.cost, p1.payout, p2.cost, p2.payout, duo?.p1b.cost ?? null, duo?.p1b.payout ?? null, duo?.p2b.cost ?? null, duo?.p2b.payout ?? null, matchId]);
    return { ...(await finishMatch(conn, t, m, dec.side as 1 | 2)), m1: dec.m1, m2: dec.m2 };
  });
}

async function finishMatch(conn: PoolConnection, t: KoTournament, m: RowDataPacket, side: 1 | 2): Promise<{ winnerId: number; champion: boolean }> {
  const winner = Number(side === 1 ? m.p1_id : m.p2_id);
  const loser = Number(side === 1 ? m.p2_id : m.p1_id);
  await conn.query("UPDATE ko_matches SET status = 'done', winner_id = ?, finished_at = UTC_TIMESTAMP() WHERE id = ?", [winner, m.id]);
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
      if (status !== m.status || p1 !== (m.p1_id ? Number(m.p1_id) : null) || p2 !== (m.p2_id ? Number(m.p2_id) : null)) {
        await conn.query(
          "UPDATE ko_matches SET p1_id = ?, p2_id = ?, status = ?, winner_id = ?, finished_at = IF(? = 'bye', UTC_TIMESTAMP(), NULL) WHERE id = ?",
          [p1, p2, status, winner, status, m.id]);
        Object.assign(m, { p1_id: p1, p2_id: p2, status, winner_id: winner });
      }
    }
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
    "UPDATE ko_participants m JOIN ko_participants c ON c.id = m.team_id SET m.state = c.state, m.disqualified = c.disqualified WHERE m.tournament_id = ? AND m.team_id IS NOT NULL AND m.id <> m.team_id",
    [id]);
}

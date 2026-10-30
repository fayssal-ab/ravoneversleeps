// "The Reaping · Hunt": rules of Ravo's prototype, as a pure state machine
// (no I/O). Every random step takes `rand(n)` → integer in [0, n), crypto on
// the server, so tests can script it. The state is saved as JSON per
// tournament (lib/hunt/store.ts) and shown read-only on stream and site.
//
// I. Hunt: every player (team) gets a random monster (weighted tier, own
//    slot, bonus buy, maybe an ability or a Cult curse). Both buy; the player
//    must win more than the monster (duo: the monster's win counts ×2) or is
//    reaped. Slaying a monster raises the player's prize multiplier to that
//    monster's bounty (the highest counts). 1–3 waves.
// II. Arena: survivors knock each other out, same buy for both, bigger win
//    goes through (exact tie: coin flip); an odd one out gets a free pass.
// III. Reckoning: the last one alive faces the Endboss with `chance` %. Spared
//    or Endboss slain: prize × bounty. Endboss wins: 50 % of the base prize or
//    nothing (setting). Everyone reaped in the Hunt: the Cult wins, no prize.
// A secret Seraph (1 in 1,000,000 per spawn) wins on sight.

import { AB, ANGEL, ANGEL_ODDS, CURSE_CHANCE, CURSES, ENDBOSSES, END, HUNT, SECRET } from "./bestiary.js";

export type Rand = (n: number) => number;
export class HuntError extends Error { constructor(public code: string, public detail?: string) { super(code); } }

export interface HuntConfig { title: string; prize: number; duo: boolean; waves: 1 | 2 | 3; chance: number; fall: "half" | "nothing" }
export interface Entrant { id: number; name: string; pids: number[]; alive: boolean; best: number; slain: number; byes: number; fate: string; bounty: number }
export interface Monster { tier: string; name: string; price: number; abOn: boolean; curse: string | null; revived: boolean; prebuy: boolean; secret: boolean; bounty: number }
export type Outcome = "p" | "b" | "rematch" | "revive" | "prebuy";
export interface Verdict { p: number; b: number; pf: number; bf: number; notes: string[]; out: Outcome }
export interface Fight { eid: number; monster: Monster | null; done: boolean; won: boolean | null; verdict: Verdict | null; keep: number | null }
export interface ArenaMatch { a: number; b: number; price: number; va: number | null; vb: number | null; done: boolean; winner: number | null; tie: boolean }
export interface ArenaRound { ms: ArenaMatch[]; bye: number | null }
export interface Reckon { champ: number; fate: "comes" | "spared" | null; boss: Monster | null; done: boolean; verdict: Verdict | null; keep: number | null }
export type ResultType = "wipe" | "champion" | "legend" | "fallen" | "judged";
export interface HuntResult { type: ResultType; champ: number | null; boss: string | null; pf: number | null; bf: number | null; payout: number }
export type LogTone = "g" | "gold" | "o" | "v" | "r" | "m" | "w";
/** What the stream should pop up: a monster for a fight, the Endboss's fate, the Endboss. */
export interface Reveal { seq: number; kind: "spawn" | "fate" | "endboss"; fight: number | null }
export interface HuntState {
  v: 1; cfg: HuntConfig; ents: Entrant[];
  phase: "hunt" | "arena" | "reckon" | "done"; wave: number;
  fights: Fight[]; waveUsed: string[];
  reaped: number; slain: number; bought: number;
  arena: { rounds: ArenaRound[] } | null; reckon: Reckon | null; result: HuntResult | null;
  bigWin: { v: number; name: string }; kills: Record<string, number>;
  log: { t: string; c: LogTone }[];
  /** bumps on every change (clients replay reveals once per seq) */
  seq: number; reveal: Reveal | null;
  /** host test tool: the next spawn is the Seraph (never sent to the public) */
  secretNext: boolean;
}

type TierDef = { id: string; w: number; c: string; prices: number[]; abChance: number; bounty: number; head: string; roster: MonsterDef[] };
type MonsterDef = { n: string; ab: string; s: string; bounty?: number };
type AbilityInfo = { name: string; desc: string; clutch?: number; act?: "coin" | "boss" | "rematch" | "player"; lucky?: boolean; playerRebuy?: boolean; revive?: boolean; boon?: boolean; rule?: boolean };
const TIERS = HUNT as unknown as TierDef[];
const BOSSES = ENDBOSSES as unknown as MonsterDef[];
const ABILITY = AB as unknown as Record<string, AbilityInfo>;
const CURSE = CURSES as unknown as Record<string, { name: string; desc: string; price?: number; clutch?: number; act?: "boss" }>;
const ENDT = END as unknown as { id: string; prices: number[]; abChance: number };

export const ARENA_BUYS = [100, 150, 200, 250, 300, 400, 500];
const LOG_MAX = 250;

const cents = (v: number) => Math.round(v * 100) / 100;
export const money = (v: number) => (v === Infinity ? "$∞" : "$" + cents(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));
const pick = <T,>(a: T[], rand: Rand) => a[rand(a.length)];
const chance = (p: number, rand: Rand) => rand(1_000_000) < p * 1_000_000;
function shuffle<T>(a: T[], rand: Rand): T[] { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rollTier(rand: Rand): TierDef {
  const total = TIERS.reduce((s, t) => s + t.w, 0);
  let x = rand(total);
  for (const t of TIERS) { if (x < t.w) return t; x -= t.w; }
  return TIERS[0];
}
export const monsterDef = (m: Monster): MonsterDef | null =>
  m.secret ? null : m.tier === "Endboss" ? BOSSES.find((b) => b.n === m.name) ?? null : TIERS.find((t) => t.id === m.tier)?.roster.find((r) => r.n === m.name) ?? null;

function log(s: HuntState, t: string, c: LogTone = "m") { s.log.unshift({ t, c }); if (s.log.length > LOG_MAX) s.log.length = LOG_MAX; }
const ent = (s: HuntState, id: number) => s.ents[id];
function trackWin(s: HuntState, name: string, v: number) { if (v > s.bigWin.v) s.bigWin = { v: cents(v), name }; }

function makeMonster(s: HuntState, tier: { id: string; prices: number[]; abChance: number; bounty?: number }, def: MonsterDef, rand: Rand): Monster {
  if (s.secretNext || chance(ANGEL_ODDS, rand)) {
    s.secretNext = false;
    return { tier: (SECRET as { id: string }).id, name: (ANGEL as { n: string }).n, price: Infinity, abOn: true, curse: null, revived: false, prebuy: false, secret: true, bounty: 0 };
  }
  const a = ABILITY[def.ab];
  // clutch-only abilities (no math of their own) are always on, like the prototype
  const abOn = tier.abChance >= 1 || Boolean(a?.clutch && !EFFECTS[def.ab]) || chance(tier.abChance, rand);
  const curse = chance(CURSE_CHANCE, rand) ? pick(Object.keys(CURSE), rand) : null;
  let price = pick(tier.prices, rand);
  if (curse && CURSE[curse].price) price *= CURSE[curse].price!;
  return { tier: tier.id, name: def.n, price, abOn, curse, revived: false, prebuy: false, secret: false, bounty: def.bounty ?? tier.bounty ?? 1 };
}

// ── abilities: the prototype's math, with server randomness ──
interface Ctx { p: number; b: number; price: number; pf: number; bf: number; notes: string[]; force: "p" | "b" | null; bossTies: boolean }
const EFFECTS: Record<string, (x: Ctx, rand: Rand) => void> = {
  gnaw: (x) => { x.pf *= 0.85; x.notes.push("Gnaw: your win −15%"); },
  snuff: (x) => { if (x.p < x.price) { x.force = "b"; x.notes.push("Snuff Out: you won less than the buy"); } },
  prank: (x) => { [x.pf, x.bf] = [x.bf, x.pf]; x.notes.push("Prank: the Imp swapped both wins!"); },
  trick: (x, r) => { const t = chance(0.5, r); x.pf *= t ? 1.25 : 0.75; x.notes.push(t ? "Treat: your win +25%" : "Trick: your win −25%"); },
  infection: (x) => { x.pf *= 0.7; x.notes.push("Infection: your win −30%"); },
  interest: (x) => { x.bf += x.price; x.notes.push(`Interest: +${money(x.price)} for the Banker`); },
  shackles: (x) => { if (x.pf > x.price * 10) { x.pf = x.price * 10; x.notes.push(`Shackles: your win capped at ${money(x.price * 10)}`); } },
  cleave: (x, r) => { const c = r(51); x.pf *= 1 - c / 100; x.notes.push(`Cleave: your win −${c}%`); },
  sacrifice: (x) => { x.bf += x.pf * 0.4; x.notes.push(`Sacrifice: ${money(x.pf * 0.4)} moved to the Priest`); x.pf *= 0.6; },
  scorch: (x) => { if (x.pf < x.price * 2) { x.pf = 0; x.notes.push("Scorched Earth: your win burned to $0"); } },
  zero: (x, r) => { if (chance(0.5, r)) { x.pf = 0; x.notes.push("Absolute Zero hit YOU: $0"); } else { x.bf = 0; x.notes.push("Absolute Zero hit the Saint himself: $0"); } },
  ninefold: (x) => { x.bf *= 3; x.notes.push("Ninefold Grip: his win ×3"); },
  doom: (x) => { x.bf *= 2; x.bossTies = true; x.notes.push("Doom Clock: his win ×2"); },
  pull: (x) => { x.pf *= 0.6; x.notes.push("Pull Under: your win −40%"); },
  embrace: (x) => { x.bf = x.bf * 2 + x.pf * 0.3; x.notes.push(`Embrace: her win ×2, she stole ${money(x.pf * 0.3)}`); x.pf *= 0.7; },
  harvest: (x) => { x.bf *= 1.5; x.notes.push("Harvest: his win ×1.5"); },
  fallsapart: (x) => { if (x.p > x.price) { x.force = "p"; x.notes.push("Falls Apart: you won more than the buy, the skeleton collapses"); } },
  squishy: (x) => { x.pf *= 2; x.notes.push("Squishy: your win ×2"); },
  weakbite: (x) => { x.bf *= 0.5; x.notes.push("Weak Bite: its win ×0.5"); },
  stacked: (x, r) => { if (x.pf > x.bf) { if (chance(0.5, r)) { [x.pf, x.bf] = [x.bf, x.pf]; x.notes.push("Stacked Deck: he swapped the wins!"); } else x.notes.push("Stacked Deck: he tried to swap and failed"); } },
};

/** One fight: p = the player's (team's) win, b = the monster's win. */
export function judge(p: number, b: number, m: Monster, duo: boolean, rand: Rand): Verdict {
  if (m.secret) return { p: 0, b: Infinity, pf: 0, bf: Infinity, notes: ["Judgment: the Seraph cannot be beaten"], out: "b" };
  const x: Ctx = { p, b, price: m.price, pf: p, bf: b * (duo ? 2 : 1), notes: [], force: null, bossTies: false };
  if (duo) x.notes.push("Duo: monster win ×2");
  const def = monsterDef(m);
  const ab = def?.ab ?? "";
  const a = ABILITY[ab];
  if (m.abOn && EFFECTS[ab]) EFFECTS[ab](x, rand);
  let out: Outcome = x.force ?? (x.pf > x.bf || (x.pf === x.bf && !x.bossTies) ? "p" : "b");
  const hi = Math.max(x.pf, x.bf);
  const close = (t: number) => hi > 0 && Math.abs(x.pf - x.bf) <= hi * t;
  const clutches: { name: string; clutch: number; act?: string }[] = [];
  if (m.abOn && a?.clutch) clutches.push({ name: a.name, clutch: a.clutch, act: a.act });
  if (m.curse && CURSE[m.curse].clutch) clutches.push({ name: CURSE[m.curse].name, clutch: CURSE[m.curse].clutch!, act: CURSE[m.curse].act });
  if (!x.force) for (const c of clutches) {
    if (!close(c.clutch)) continue;
    if (c.act === "coin") { out = chance(0.5, rand) ? "p" : "b"; x.notes.push(`${c.name}: it was close, the coin flip says ${out === "p" ? "YOU survive" : "the monster wins"}`); }
    if (c.act === "boss") { out = "b"; x.notes.push(`${c.name}: it was close, the monster takes it`); }
    if (c.act === "rematch") { out = "rematch"; x.notes.push(`${c.name}: too close, both buy again`); }
    if (c.act === "player") { if (out === "b") x.notes.push(`${c.name}: it was close, you take it`); out = "p"; }
    break;
  }
  if (out === "b" && m.abOn && a?.lucky && x.force !== "b") { const save = chance(0.5, rand); x.notes.push(save ? "Lucky Coin: heads, you are saved!" : "Lucky Coin: tails, no luck"); if (save) out = "p"; }
  if (out === "b" && m.abOn && a?.playerRebuy && !m.prebuy && x.force !== "b") out = "prebuy";
  if (out === "p" && m.abOn && a?.revive && !m.revived) out = "revive";
  return { p, b, pf: cents(x.pf), bf: cents(x.bf), notes: x.notes, out };
}

// ── setup ──

export function createHunt(cfg: HuntConfig, entrants: { name: string; pids: number[] }[], rand: Rand): HuntState {
  if (entrants.length < 2) throw new HuntError("not_enough_players", "the Hunt needs at least 2 players or teams");
  const list = shuffle(entrants.slice(), rand);
  const s: HuntState = {
    v: 1, cfg, ents: list.map((e, i) => ({ id: i, name: e.name, pids: e.pids, alive: true, best: 0, slain: 0, byes: 0, fate: "", bounty: 1 })),
    phase: "hunt", wave: 1, fights: [], waveUsed: [], reaped: 0, slain: 0, bought: 0,
    arena: null, reckon: null, result: null, bigWin: { v: 0, name: "" }, kills: {}, log: [], seq: 1, reveal: null, secretNext: false,
  };
  newWave(s);
  log(s, `The Reaping begins with ${s.ents.length} ${cfg.duo ? "teams" : "players"}. The Hunt is on.`, "g");
  return s;
}

function newWave(s: HuntState) {
  s.waveUsed = [];
  s.fights = s.ents.filter((e) => e.alive).map((e) => ({ eid: e.id, monster: null, done: false, won: null, verdict: null, keep: null }));
}

// ── I. hunt ──

function rollMonster(s: HuntState, rand: Rand): Monster {
  const t = rollTier(rand);
  let pool = t.roster.filter((r) => !s.waveUsed.includes(r.n));
  if (!pool.length) pool = t.roster;
  const def = pick(pool, rand);
  s.waveUsed.push(def.n);
  return makeMonster(s, t, def, rand);
}
function logSpawn(s: HuntState, m: Monster, e: Entrant) {
  const a = monsterDef(m) ? ABILITY[monsterDef(m)!.ab] : null;
  if (m.secret) { log(s, `A light descends on ${e.name}: THE SERAPH. One in a million.`, "w"); return; }
  log(s, `${m.name} (${m.tier}, ${money(m.price)} buy${m.abOn && a ? `, ${a.name}` : ""}${m.curse ? `, curse: ${CURSE[m.curse].name}` : ""}) hunts ${e.name}.`, m.tier === "Warlord" || m.tier === "Overlord" ? "o" : "m");
}
const needPhase = (s: HuntState, p: HuntState["phase"]) => { if (s.phase !== p) throw new HuntError("hunt_wrong_phase", `this needs the ${p} phase`); };
const bump = (s: HuntState, reveal?: Omit<Reveal, "seq">) => { s.seq++; if (reveal) s.reveal = { seq: s.seq, ...reveal }; };

/** Spawns the monster of the next player still waiting for one. */
export function spawnNext(s: HuntState, rand: Rand): number {
  needPhase(s, "hunt");
  const i = s.fights.findIndex((f) => !f.monster);
  if (i < 0) throw new HuntError("hunt_all_spawned");
  const f = s.fights[i];
  f.monster = rollMonster(s, rand);
  logSpawn(s, f.monster, ent(s, f.eid));
  bump(s, { kind: "spawn", fight: i });
  return i;
}

export function spawnAll(s: HuntState, rand: Rand) {
  needPhase(s, "hunt");
  if (!s.fights.some((f) => !f.monster)) throw new HuntError("hunt_all_spawned");
  while (s.fights.some((f) => !f.monster)) spawnNext(s, rand);
  s.reveal = null; // a whole wave at once: no single pop-up
}

/** Host re-rolls a monster that hasn't fought yet. */
export function rerollMonster(s: HuntState, i: number, rand: Rand) {
  needPhase(s, "hunt");
  const f = s.fights[i];
  if (!f?.monster || f.done) throw new HuntError("hunt_bad_fight");
  if (f.monster.secret) throw new HuntError("hunt_bad_fight", "the Seraph can't be re-rolled");
  s.waveUsed = s.waveUsed.filter((n) => n !== f.monster!.name);
  f.monster = rollMonster(s, rand);
  log(s, "Host re-rolled the monster.");
  logSpawn(s, f.monster, ent(s, f.eid));
  bump(s, { kind: "spawn", fight: i });
}

/** Player win `p` vs monster win `b` (the Seraph ignores both). */
export function fight(s: HuntState, i: number, p: number, b: number, rand: Rand): Verdict {
  needPhase(s, "hunt");
  const f = s.fights[i];
  if (!f?.monster || f.done) throw new HuntError("hunt_bad_fight");
  const e = ent(s, f.eid), m = f.monster;
  // revive keeps the player's first win, the monster buys again
  const pv = m.revived && f.keep != null ? f.keep : p;
  const v = judge(pv, b, m, s.cfg.duo, rand);
  if (!m.secret) s.bought += m.price * (s.cfg.duo ? 3 : 2);
  f.verdict = v;
  for (const n of v.notes) log(s, `${m.name} vs ${e.name}: ${n}`, "o");
  if (v.out === "rematch") { log(s, `Rematch: ${e.name} and ${m.name} buy again.`, "o"); bump(s); return v; }
  if (v.out === "revive") { m.revived = true; f.keep = pv; log(s, `${m.name} RISES FROM THE DEAD and buys again. ${e.name} keeps ${money(v.pf)}.`, "o"); bump(s); return v; }
  if (v.out === "prebuy") { m.prebuy = true; log(s, `${m.name} dozes off. ${e.name} gets a free second try.`, "g"); bump(s); return v; }
  f.done = true;
  e.best = Math.max(e.best, v.pf);
  trackWin(s, e.name, v.pf);
  if (v.out !== "p") s.kills[m.name] = (s.kills[m.name] ?? 0) + 1;
  if (v.out === "p") {
    f.won = true; e.slain++; s.slain++;
    const up = m.bounty > e.bounty;
    if (up) e.bounty = m.bounty;
    log(s, `${e.name} slays ${m.name}: ${money(v.pf)} vs ${money(v.bf)}.${up ? ` Prize multiplier now ×${e.bounty}.` : ""}`, "g");
  } else if (m.secret) {
    f.won = false; e.alive = false; e.fate = "Judged by the Seraph"; s.reaped++;
    log(s, `THE SERAPH has judged ${e.name}. One in a million.`, "w");
  } else {
    f.won = false; e.alive = false; e.fate = `Reaped by ${m.name}`; s.reaped++;
    log(s, `REAPED: ${e.name} ${money(v.pf)} vs ${m.name} ${money(v.bf)}.`, "v");
  }
  afterHunt(s, rand);
  bump(s);
  return v;
}

function afterHunt(s: HuntState, rand: Rand) {
  if (!s.fights.every((f) => f.done)) return;
  const alive = s.ents.filter((e) => e.alive);
  if (!alive.length) { finish(s, { type: "wipe", champ: null, boss: null, pf: null, bf: null }); log(s, "TOTAL REAPING: every hunter fell. The Cult wins.", "v"); return; }
  if (alive.length === 1) { log(s, `${alive[0].name} is the only one left alive. The Arena is skipped.`, "gold"); toReckon(s, alive[0]); return; }
  if (s.wave < s.cfg.waves) { s.wave++; newWave(s); log(s, `Wave ${s.wave} begins. ${alive.length} still alive.`, "g"); return; }
  s.phase = "arena";
  s.arena = { rounds: [] };
  log(s, `The Arena opens: ${alive.length} survivors fight each other.`, "gold");
  pushRound(s, shuffle(alive.map((e) => e.id), rand), rand);
}

// ── II. arena ──

function pushRound(s: HuntState, ids: number[], rand: Rand) {
  let bye: number | null = null;
  let list = ids.slice();
  if (list.length % 2) {
    const minB = Math.min(...list.map((id) => ent(s, id).byes));
    bye = list.filter((id) => ent(s, id).byes === minB).reduce((a, b) => (ent(s, b).best > ent(s, a).best ? b : a));
    ent(s, bye).byes++;
    list = list.filter((id) => id !== bye);
  }
  const ms: ArenaMatch[] = [];
  for (let i = 0; i < list.length; i += 2) ms.push({ a: list[i], b: list[i + 1], price: pick(ARENA_BUYS, rand), va: null, vb: null, done: false, winner: null, tie: false });
  s.arena!.rounds.push({ ms, bye });
  if (bye != null) log(s, `${ent(s, bye).name} gets a free pass this round (best win ${money(ent(s, bye).best)}).`);
}

export function arenaName(r: ArenaRound): string {
  const n = r.ms.length * 2 + (r.bye != null ? 1 : 0);
  return n === 2 ? "Arena Final" : n <= 4 ? "Arena Semis" : `Arena · ${n} left`;
}

export function arenaFight(s: HuntState, i: number, va: number, vb: number, rand: Rand) {
  needPhase(s, "arena");
  const r = s.arena!.rounds[s.arena!.rounds.length - 1];
  const m = r.ms[i];
  if (!m || m.done) throw new HuntError("hunt_bad_fight");
  m.va = va; m.vb = vb;
  m.tie = va === vb;
  m.winner = m.tie ? (chance(0.5, rand) ? m.a : m.b) : va > vb ? m.a : m.b;
  const lo = m.winner === m.a ? m.b : m.a;
  const W = ent(s, m.winner), Lo = ent(s, lo);
  Lo.alive = false; Lo.fate = `Knocked out by ${W.name}`;
  ent(s, m.a).best = Math.max(ent(s, m.a).best, va); ent(s, m.b).best = Math.max(ent(s, m.b).best, vb);
  m.done = true;
  trackWin(s, ent(s, m.a).name, va); trackWin(s, ent(s, m.b).name, vb);
  s.bought += m.price * 2 * (s.cfg.duo ? 2 : 1);
  log(s, `${W.name} beats ${Lo.name} (${money(Math.max(va, vb))} vs ${money(Math.min(va, vb))})${m.tie ? " on a coin flip" : ""}.`, "gold");
  if (r.ms.every((x) => x.done)) {
    const next = r.ms.map((x) => x.winner!);
    if (r.bye != null) next.push(r.bye);
    if (next.length === 1) { log(s, `${ent(s, next[0]).name} wins the Arena.`, "gold"); toReckon(s, ent(s, next[0])); }
    else pushRound(s, shuffle(next, rand), rand);
  }
  bump(s);
}

// ── III. reckoning ──

function toReckon(s: HuntState, e: Entrant) {
  s.phase = "reckon";
  s.reckon = { champ: e.id, fate: null, boss: null, done: false, verdict: null, keep: null };
  log(s, `${e.name} survived everything. ${s.cfg.chance}% chance the Endboss comes.`, "r");
}

export function revealFate(s: HuntState, rand: Rand) {
  needPhase(s, "reckon");
  const r = s.reckon!;
  if (r.fate) throw new HuntError("hunt_fate_known");
  r.fate = rand(100) < s.cfg.chance ? "comes" : "spared";
  const c = ent(s, r.champ);
  if (r.fate === "comes") log(s, "Fate: THE ENDBOSS COMES.", "r");
  else { log(s, `Fate: spared. ${c.name} wins.`, "g"); finish(s, { type: "champion", champ: c.id, boss: null, pf: null, bf: null }); }
  bump(s, { kind: "fate", fight: null });
}

/** Summons (or the host re-rolls) the Endboss before the duel is fought. */
export function summonEndboss(s: HuntState, rand: Rand) {
  needPhase(s, "reckon");
  const r = s.reckon!;
  if (r.fate !== "comes" || r.done) throw new HuntError("hunt_wrong_phase", "the Endboss isn't coming");
  const reroll = r.boss != null;
  if (r.boss?.secret) throw new HuntError("hunt_bad_fight", "the Seraph can't be re-rolled");
  r.boss = makeMonster(s, ENDT, pick(BOSSES, rand), rand);
  r.keep = null;
  if (reroll) log(s, "Host re-rolled the Endboss.");
  log(s, r.boss.secret ? "THE SERAPH DESCENDS instead of the Endboss." : `ENDBOSS: ${r.boss.name} (${money(r.boss.price)} buy, ${ABILITY[monsterDef(r.boss)!.ab].name}, bounty ×${r.boss.bounty}${r.boss.curse ? `, curse: ${CURSE[r.boss.curse].name}` : ""}).`, "r");
  bump(s, { kind: "endboss", fight: null });
}

export function bossFight(s: HuntState, p: number, b: number, rand: Rand): Verdict {
  needPhase(s, "reckon");
  const r = s.reckon!;
  if (!r.boss || r.done) throw new HuntError("hunt_bad_fight");
  const m = r.boss, c = ent(s, r.champ);
  const pv = m.revived && r.keep != null ? r.keep : p;
  const v = judge(pv, b, m, s.cfg.duo, rand);
  if (!m.secret) s.bought += m.price * (s.cfg.duo ? 3 : 2);
  r.verdict = v;
  for (const n of v.notes) log(s, `${m.name}: ${n}`, "o");
  if (v.out === "rematch") { log(s, "Rematch against the Endboss.", "o"); bump(s); return v; }
  if (v.out === "revive") { m.revived = true; r.keep = pv; log(s, `${m.name} rises again!`, "o"); bump(s); return v; }
  if (v.out === "prebuy") v.out = "b"; // no Endboss gives a second try
  r.done = true;
  c.best = Math.max(c.best, v.pf);
  trackWin(s, c.name, v.pf);
  if (v.out !== "p") s.kills[m.name] = (s.kills[m.name] ?? 0) + 1;
  if (v.out === "p") {
    c.bounty = Math.max(c.bounty, m.bounty);
    log(s, `LEGEND: ${c.name} slays ${m.name}: ${money(v.pf)} vs ${money(v.bf)}! Prize ×${c.bounty}.`, "gold");
    finish(s, { type: "legend", champ: c.id, boss: m.name, pf: v.pf, bf: v.bf });
  } else if (m.secret) {
    c.alive = false; c.fate = "Judged by the Seraph";
    log(s, `THE SERAPH has judged ${c.name}. One in a million.`, "w");
    finish(s, { type: "judged", champ: c.id, boss: m.name, pf: null, bf: null });
  } else {
    c.alive = false; c.fate = `Fell to ${m.name}`;
    log(s, `${m.name} crushes ${c.name}: ${money(v.bf)} vs ${money(v.pf)}. The Cult wins.`, "v");
    finish(s, { type: "fallen", champ: c.id, boss: m.name, pf: v.pf, bf: v.bf });
  }
  bump(s);
  return v;
}

/** Payout: spared / Legend = base × bounty; fell to the Endboss = 50 % of the base or nothing; wipe = nothing. */
function finish(s: HuntState, r: Omit<HuntResult, "payout">) {
  const base = s.cfg.prize;
  const champ = r.champ != null ? ent(s, r.champ) : null;
  const payout = r.type === "champion" || r.type === "legend" ? base * (champ?.bounty ?? 1)
    : r.type === "fallen" || r.type === "judged" ? (s.cfg.fall === "half" ? base / 2 : 0) : 0;
  s.phase = "done";
  s.result = { ...r, payout: cents(payout) };
}

/** What the public sees: everything but the host's test switch. */
export function publicHunt(s: HuntState): HuntState { return { ...s, secretNext: false }; }

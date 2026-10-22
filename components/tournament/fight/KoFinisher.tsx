"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Crown } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import type { KoMatch, KoParticipant } from "@/lib/knockout";
import { POSES as P, ease, rng, solve, track, type Body, type Key, type V } from "./rig";
import { fightTheme, play, type Sfx } from "./sfx";

// Street-fighter style K.O. finisher, played when a battle gets its winner:
// two shadow ninjas (player 1 neon, player 2 chrome) clash, the winner lands
// one of three finishers (iai blade dash, energy blast, rising slash), slow
// motion + screen shake, the loser's health drains, K.O., then the winner
// card. Duo battles put both teammates in the arena (the second one a step
// behind, a beat late). Drawn in SVG from a pose rig (./rig); nothing is
// loaded from outside. With sound, a synthesized battle theme plays until the
// K.O.

const W = 1600, H = 900, GROUND = 745;
const BASE = { l: 540, r: 1060 } as const;
const COLOR = { l: "#8dff4a", r: "#d9e1dc" } as const;
const GOLD = "#ffd76a";
const CLASH = 1220;
const SLOW = 700, RATE = 0.3;
/** Duo: the teammate stands this far behind, and moves this many ms later. */
const MATE_GAP = 175, MATE_LAG = 110;

type Side = "l" | "r";
type Variant = "blade" | "blast" | "rise";
const VARIANTS: Variant[] = ["blade", "blast", "rise"];

interface Script { hit: number; w: Key[]; l: Key[]; sfx: [number, Sfx][] }

// both fighters run in, square up, clash in the middle
const OPENING: Key[] = [
  { t: 0, p: { ...P.RUN, x: -420 } },
  { t: 420, p: { ...P.RUN, x: -40 }, e: ease.out },
  { t: 640, p: { ...P.IDLE, x: 0 } },
  { t: 1000, p: { ...P.IDLE, x: 0 } },
  { t: 1110, p: { ...P.RUN, x: 50 }, e: ease.in },
  { t: CLASH, p: { ...P.CLASH, x: 120 }, e: ease.out },
  { t: 1420, p: { ...P.CLASH, x: 112 } },
];
const W_RESET: Key[] = [{ t: 1600, p: { ...P.IDLE, x: 60 }, e: ease.out }, { t: 2000, p: { ...P.IDLE, x: 60 } }];
const L_RESET: Key[] = [{ t: 1520, p: { ...P.HIT, x: 40 }, e: ease.out }, { t: 1800, p: { ...P.IDLE, x: 20 } }, { t: 2000, p: { ...P.IDLE, x: 20 } }];

const SCRIPTS: Record<Variant, Script> = {
  // iai: draw, vanish through the opponent, a beat of silence, the cut lands
  blade: {
    hit: 3050,
    w: [...OPENING, ...W_RESET,
      { t: 2300, p: { ...P.DRAW, x: 40 } }, { t: 2640, p: { ...P.DRAW, x: 36 } },
      { t: 2720, p: { ...P.IAI, x: 780 }, e: ease.lin }, { t: 3600, p: { ...P.IAI, x: 780 } },
      { t: 3800, p: { ...P.IDLE, x: 780, face: -1 } }, { t: 4100, p: { ...P.VICTORY, x: 780, face: -1 }, e: ease.out }],
    l: [...OPENING, ...L_RESET,
      { t: 2720, p: { ...P.IDLE, x: 20, bob: 0 } }, { t: 3000, p: { ...P.IDLE, x: 20, bob: 0 } },
      { t: 3140, p: { ...P.HIT, x: 0 }, e: ease.out }, { t: 3700, p: { ...P.DOWN, x: -70 }, e: ease.in }],
    sfx: [[CLASH, "clash"], [2640, "whoosh"], [3050, "impact"]],
  },
  // charge an energy ball, throw it across the arena
  blast: {
    hit: 2950,
    w: [...OPENING, ...W_RESET,
      { t: 2250, p: { ...P.CHARGE, x: 40 } }, { t: 2650, p: { ...P.CHARGE, x: 30 } },
      { t: 2760, p: { ...P.CAST, x: 70 }, e: ease.out }, { t: 3400, p: { ...P.CAST, x: 70 } },
      { t: 3850, p: { ...P.VICTORY, x: 70 } }],
    l: [...OPENING, ...L_RESET,
      { t: 2950, p: { ...P.IDLE, x: 20, bob: 0 } }, { t: 3060, p: { ...P.HIT, x: -30 }, e: ease.out },
      { t: 3380, p: { ...P.FLY, x: -210 }, e: ease.out }, { t: 3800, p: { ...P.DOWN, x: -300 }, e: ease.in }],
    sfx: [[CLASH, "clash"], [2250, "charge"], [2760, "whoosh"], [2950, "blast"]],
  },
  // dash in, rising slash launches the opponent into a spin
  rise: {
    hit: 2450,
    w: [...OPENING, ...W_RESET,
      { t: 2200, p: { ...P.RUN, x: 300 }, e: ease.in }, { t: 2330, p: { ...P.CROUCH, x: 400 }, e: ease.out },
      { t: 2450, p: { ...P.RISE, x: 430 }, e: ease.out }, { t: 2800, p: { ...P.RISE, x: 440, air: 210, rot: -10 }, e: ease.out },
      { t: 3150, p: { ...P.CROUCH, x: 450 }, e: ease.in }, { t: 3350, p: { ...P.IDLE, x: 450 } },
      { t: 3850, p: { ...P.VICTORY, x: 450 } }],
    l: [...OPENING, ...L_RESET,
      { t: 2440, p: { ...P.IDLE, x: 20, bob: 0 } }, { t: 2560, p: { ...P.HIT, x: 0, air: 90 }, e: ease.out },
      { t: 2980, p: { ...P.FLY, x: -120, air: 320, rot: -200 }, e: ease.out },
      { t: 3450, p: { ...P.DOWN, x: -230, rot: -448 }, e: ease.in }],
    sfx: [[CLASH, "clash"], [2200, "whoosh"], [2450, "impact"], [2470, "whoosh"]],
  },
};

/** Real time → scene time: slow motion right after the finishing hit. */
const sceneTime = (r: number, hit: number) =>
  r < hit ? r : r < hit + SLOW ? hit + (r - hit) * RATE : hit + SLOW * RATE + (r - hit - SLOW);

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mid = (a: V, b: V, u = 0.5): V => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** 0 → 1 over [t0, t0 + d]. */
const prog = (t: number, t0: number, d: number) => clamp((t - t0) / d);
/** Instant drop, plus the red trailing bar that drains a moment later. */
function health(r: number, steps: [number, number][]): { now: number; trail: number } {
  let now = 1, trail = 1;
  for (const [t, to] of steps) if (r >= t) now = to;
  for (const [t, to] of steps) {
    if (r < t + 250) break;
    const u = clamp((r - t - 250) / 450);
    trail += (to - trail) * u;
    if (u < 1) break;
  }
  return { now, trail };
}

export interface FightCard { match: KoMatch; label: string }

function cardOf(m: KoMatch) {
  const win: Side = m.winner_id === m.p2?.id ? "r" : "l";
  const lose: Side = win === "l" ? "r" : "l";
  const pick = (s: Side) => ({ p: (s === "l" ? m.p1 : m.p2) as KoParticipant, multi: s === "l" ? m.p1_multi : m.p2_multi });
  const w = pick(win), l = pick(lose);
  const wm = w.multi != null ? Number(w.multi) : null, lm = l.multi != null ? Number(l.multi) : null;
  const perfect = lm === 0 && wm != null && wm > 0;
  const wHp = perfect ? 1 : wm && lm != null ? clamp(1 - lm / wm, 0.08, 0.92) : 0.4;
  return { win, lose, w, l, perfect, wHp, dq: wm == null || lm == null };
}

/** Fades, slams and slides for the HTML text layers, from real time. */
function slam(r: number, at: number, from = 3) {
  const u = prog(r, at, 240);
  const s = u < 1 ? from - (from - 1) * ease.out(u) : 1 + Math.sin(prog(r, at + 240, 260) * Math.PI) * 0.06;
  const j = r > at + 200 && r < at + 520 ? Math.sin(r * 1.7) * 6 : 0;
  return { opacity: r < at ? 0 : clamp(u * 2), transform: `translate(${j}px, ${j * 0.6}px) scale(${s})` };
}

const TITLE: CSSProperties = {
  fontStyle: "italic", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 0.85,
  WebkitTextStroke: "0.5vmin #1a0204", paintOrder: "stroke fill",
  filter: "drop-shadow(0 0.8vmin 0 #000) drop-shadow(0 0 3vmin rgb(255 95 109 / 0.55))",
};

function Fighter({ b, color }: { b: Body; color: string }) {
  const seg = (a: V, c: V, w: number) => <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} strokeWidth={w} />;
  const chest = mid(b.hip, b.neck, 0.6);
  const body = (grow: number) => (
    <>
      {seg(b.hip, b.kneeB, 30 + grow)}{seg(b.kneeB, b.footB, 24 + grow)}
      {seg(b.neck, b.elbowB, 22 + grow)}{seg(b.elbowB, b.handB, 19 + grow)}
      {seg(b.hip, chest, 40 + grow)}{seg(chest, b.neck, 50 + grow)}
      <circle cx={b.head[0]} cy={b.head[1]} r={b.headR + grow / 2} />
      {seg(b.hip, b.kneeF, 30 + grow)}{seg(b.kneeF, b.footF, 24 + grow)}
      {seg(b.neck, b.elbowF, 22 + grow)}{seg(b.elbowF, b.handF, 19 + grow)}
    </>
  );
  // guard: a short bar across the blade at the hand
  const d: V = [b.swordTip[0] - b.handF[0], b.swordTip[1] - b.handF[1]];
  const n = Math.hypot(d[0], d[1]) || 1;
  const g: V = [(-d[1] / n) * 14, (d[0] / n) * 14];
  const back: V = [b.sheathA[0] - (b.sheathB[0] - b.sheathA[0]) * 0.28, b.sheathA[1] - (b.sheathB[1] - b.sheathA[1]) * 0.28];
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx={b.hip[0]} cy={GROUND + 6} rx={clamp(110 - (GROUND - b.hip[1]) * 0.22, 26, 90)} ry={10} fill="#000" opacity={0.6} />
      {/* scabbard (and the sheathed handle) */}
      <g stroke="#0d1510">
        {seg(b.sheathA, b.sheathB, 9)}
        <g opacity={1 - b.swa} stroke="#1c261f">{seg(b.sheathA, back, 8)}</g>
      </g>
      <g stroke={color} fill={color} opacity={0.75} filter="url(#kof-glow)">{body(8)}</g>
      <g stroke="#020403" fill="#020403">{body(0)}</g>
      <polyline points={b.ribbon.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={6} opacity={0.9} />
      <g stroke={color} filter="url(#kof-soft)">{seg(b.eye[0], b.eye[1], 4)}</g>
      <g opacity={b.swa}>
        <g stroke={color} opacity={0.7} filter="url(#kof-glow)">{seg(b.handF, b.swordTip, 12)}</g>
        <g stroke="#eef7f1">{seg(b.handF, b.swordTip, 5)}</g>
        <g stroke="#0d1510">{seg(b.swordBase, b.handF, 8)}</g>
        <g stroke={color}>{seg([b.handF[0] - g[0], b.handF[1] - g[1]], [b.handF[0] + g[0], b.handF[1] + g[1]], 6)}</g>
      </g>
    </g>
  );
}

function Mate({ b, color }: { b: Body; color: string }) {
  const x = b.hip[0];
  return (
    <g transform={`translate(${x} ${GROUND}) scale(0.88) translate(${-x} ${-GROUND})`} opacity={0.9}>
      <Fighter b={b} color={color} />
    </g>
  );
}

/** Sword motion blur: the blade's sweep over the last frames. */
function Trail({ at, color }: { at: (t: number) => Body; color: string }) {
  const frames = [0, 1, 2, 3, 4].map((k) => at(-k * 12));
  if (frames[0].swa < 0.5 || dist(frames[0].swordTip, frames[1].swordTip) < 12) return null;
  return (
    <g fill={color}>
      {frames.slice(0, -1).map((f, k) => {
        const g = frames[k + 1];
        return <polygon key={k} opacity={0.32 * (1 - k / 4)} points={[f.handF, f.swordTip, g.swordTip, g.handF].map((p) => p.join(",")).join(" ")} />;
      })}
    </g>
  );
}

function Sparks({ s, t0, o, seed, n, color, power = 1 }: { s: number; t0: number; o: V; seed: number; n: number; color: string; power?: number }) {
  const dt = (s - t0) / 1000;
  if (dt < 0 || dt > 0.75) return null;
  const rand = rng(seed);
  return (
    <g strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const a = rand() * Math.PI * 2, v = (500 + rand() * 900) * power;
        const vx = Math.cos(a) * v, vy = Math.sin(a) * v - 200;
        const x = o[0] + vx * dt, y = o[1] + vy * dt + 900 * dt * dt;
        return <line key={i} x1={x} y1={y} x2={x - vx * 0.03} y2={y - (vy + 1800 * dt) * 0.03} stroke={i % 3 ? color : "#fff"} strokeWidth={i % 4 ? 3 : 5} opacity={1 - dt / 0.75} />;
      })}
    </g>
  );
}

function Ring({ s, t0, o, color, size = 1 }: { s: number; t0: number; o: V; color: string; size?: number }) {
  const u = prog(s, t0, 420);
  if (s < t0 || u >= 1) return null;
  return <circle cx={o[0]} cy={o[1]} r={20 + ease.out(u) * 320 * size} fill="none" stroke={color} strokeWidth={18 * (1 - u) + 1} opacity={1 - u} />;
}

/** Skyline, moon and the neon floor grid. Static. */
function Arena() {
  const city = useMemo(() => {
    const rand = rng(7);
    const out: { x: number; w: number; h: number; win: [number, number][] }[] = [];
    for (let x = -20; x < W; ) {
      const w = 60 + rand() * 90, h = 90 + rand() * 230;
      const win: [number, number][] = [];
      for (let k = 0; k < 6; k++) if (rand() > 0.45) win.push([x + 10 + rand() * (w - 24), GROUND - 40 - 16 - rand() * (h - 30)]);
      out.push({ x, w, h, win });
      x += w + 4;
    }
    return out;
  }, []);
  return (
    <>
      <rect width={W} height={H} fill="url(#kof-sky)" />
      <circle cx={800} cy={300} r={230} fill="url(#kof-moon)" />
      {city.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={GROUND - 40 - c.h} width={c.w} height={c.h + 40} fill={i % 2 ? "#06100a" : "#081409"} />
          {c.win.map(([x, y], k) => <rect key={k} x={x} y={y} width={7} height={10} fill="#8dff4a" opacity={0.22} />)}
        </g>
      ))}
      <rect y={GROUND} width={W} height={H - GROUND} fill="url(#kof-floor)" />
      <g stroke="#8dff4a" opacity={0.16}>
        {Array.from({ length: 21 }, (_, i) => <line key={i} x1={800 + (i - 10) * 46} y1={GROUND} x2={800 + (i - 10) * 300} y2={H} strokeWidth={1.5} />)}
        {[0.12, 0.3, 0.55, 0.85].map((k) => <line key={k} x1={0} x2={W} y1={GROUND + (H - GROUND) * k} y2={GROUND + (H - GROUND) * k} strokeWidth={1.5} />)}
      </g>
      <line x1={0} x2={W} y1={GROUND} y2={GROUND} stroke="#8dff4a" strokeWidth={3} opacity={0.55} filter="url(#kof-soft)" />
    </>
  );
}

function Bar({ hp, side }: { hp: { now: number; trail: number }; side: Side }) {
  const anchor = side === "l" ? "right-0" : "left-0";
  return (
    <div className="relative h-[3.4vmin] min-w-0 flex-1 overflow-hidden border-[0.35vmin] border-[#1d2a21] bg-[#130708]" style={{ transform: `skewX(${side === "l" ? -18 : 18}deg)` }}>
      <div className={`absolute inset-y-0 ${anchor} bg-[#ff3b4a]`} style={{ width: `${hp.trail * 100}%` }} />
      <div className={`absolute inset-y-0 ${anchor} bg-[linear-gradient(180deg,#fff6c4,#ffd76a_45%,#e0a21f)]`} style={{ width: `${hp.now * 100}%` }} />
      <div className="absolute inset-x-0 top-0 h-1/3 bg-white/25" />
    </div>
  );
}

/** Both teammates of a duo, the player alone in solo. */
const membersOf = (p: KoParticipant) => (p.partner ? [p, p.partner] : [p]);

function Portrait({ p, color }: { p: KoParticipant; color: string }) {
  const size = p.partner ? "7vmin" : "9vmin";
  return (
    <span className="flex shrink-0 gap-[0.5vmin] rounded-[1vmin] border-[0.4vmin] p-[0.3vmin]" style={{ borderColor: color, boxShadow: `0 0 2.4vmin -0.4vmin ${color}` }}>
      {membersOf(p).map((m) => <SlotArt key={m.id} name={m.slot_name} src={m.slot_image} fluid={size} rounded="rounded-[0.7vmin]" className="!border-0" />)}
    </span>
  );
}

const nameOf = (p: KoParticipant) => (p.partner ? `${p.username} & ${p.partner.username}` : p.username);
const slotsOf = (p: KoParticipant) => (p.partner ? `${p.slot_name} + ${p.partner.slot_name}` : p.slot_name);

/** The fight, full screen. Calls `onDone` when it has played out. */
export function KoFinisher({ card, sound = false, onDone }: { card: FightCard; sound?: boolean; onDone: () => void }) {
  const m = card.match;
  const info = useMemo(() => cardOf(m), [m]);
  const duo = Boolean(m.p1?.partner && m.p2?.partner);
  const variant = VARIANTS[m.id % VARIANTS.length];
  const script = SCRIPTS[variant];
  const hit = script.hit;
  const end = hit + 4600;
  const [r, setR] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  useEffect(() => {
    // reduced motion: skip the fight, show the K.O. and the winner
    const offset = matchMedia("(prefers-reduced-motion: reduce)").matches ? hit + 1500 : 0;
    const fired = new Set<number>();
    const start = performance.now();
    const music = sound && !offset ? fightTheme(hit / 1000 + 1) : null;
    let raf = 0;
    const tick = (now: number) => {
      const real = now - start + offset;
      const s = sceneTime(real, hit);
      if (sound && !offset) {
        script.sfx.forEach(([t, name], i) => { if (s >= t && !fired.has(i)) { fired.add(i); play(name); } });
        if (real >= hit + 220 && !fired.has(-1)) { fired.add(-1); music?.(); play("ko"); }
        if (real >= hit + 1500 && !fired.has(-2)) { fired.add(-2); play("fanfare"); }
      }
      setR(real);
      if (real >= end) done.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); music?.(); };
  }, [hit, end, script, sound]);

  const bodyAt = useMemo(() => {
    const tracks = { w: track(script.w), l: track(script.l) };
    return (who: "w" | "l", t: number, mate = false) => {
      const side = who === "w" ? info.win : info.lose;
      const face = side === "l" ? 1 : -1;
      return mate
        ? solve(tracks[who](t - MATE_LAG), BASE[side] - face * MATE_GAP, face, GROUND, t)
        : solve(tracks[who](t), BASE[side], face, GROUND, t);
    };
  }, [script, info]);
  const points = useMemo(() => {
    const at = bodyAt;
    const lb = at("l", hit);
    const w1 = at("w", 2640), w2 = at("w", 2720), cast = at("w", 2760);
    return {
      clash: mid(at("w", CLASH).swordTip, at("l", CLASH).swordTip),
      hit: mid(lb.hip, lb.neck, 0.55),
      dashFrom: mid(w1.hip, w1.neck), dashTo: mid(w2.hip, w2.neck),
      cast: mid(cast.handF, cast.handB),
    };
  }, [bodyAt, hit]);

  const s = sceneTime(r, hit);
  const wc = COLOR[info.win], lc = COLOR[info.lose];
  const wb = bodyAt("w", s), lb = bodyAt("l", s);

  // camera: shake on the clash and the hit, punch-in during the slow motion
  const shake = (t0: number, d: number, a: number) => (r >= t0 && r < t0 + d ? a * (1 - (r - t0) / d) : 0);
  const amp = shake(CLASH, 260, 7) + shake(hit, 620, 22);
  const zoom = 1 + 0.16 * (r < hit ? 0 : r < hit + 60 ? (r - hit) / 60 : r < hit + SLOW ? 1 : 1 - prog(r, hit + SLOW, 350));
  const [cx, cy] = points.hit;
  const flash = Math.max(r >= CLASH ? 0.35 * (1 - prog(r, CLASH, 120)) : 0, r >= hit ? 0.95 * (1 - prog(r, hit, 180)) : 0);

  const hpL = health(r, [[CLASH, 0.55], [hit, 0]]);
  const hpW = health(r, info.wHp < 1 ? [[CLASH, info.wHp]] : []);
  const hp = (side: Side) => (side === info.win ? hpW : hpL);
  const left = info.win === "l" ? info.w : info.l, right = info.win === "r" ? info.w : info.l;

  const fade = Math.min(prog(r, 0, 220), 1 - prog(r, end - 420, 420));
  const banner = prog(r, hit + 1500, 420);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden bg-[#020403]/90 font-head text-text" style={{ opacity: fade }} aria-live="polite">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
        <defs>
          <radialGradient id="kof-sky" cx="50%" cy="38%" r="75%"><stop offset="0" stopColor="#0f3d1f" /><stop offset="0.55" stopColor="#06150b" /><stop offset="1" stopColor="#020403" /></radialGradient>
          <radialGradient id="kof-moon"><stop offset="0" stopColor="#e9ffd9" stopOpacity="0.5" /><stop offset="0.45" stopColor="#8dff4a" stopOpacity="0.16" /><stop offset="1" stopColor="#8dff4a" stopOpacity="0" /></radialGradient>
          <linearGradient id="kof-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c1f12" /><stop offset="1" stopColor="#020403" /></linearGradient>
          <radialGradient id="kof-ball"><stop offset="0" stopColor="#fff" /><stop offset="0.35" stopColor={wc} /><stop offset="1" stopColor={wc} stopOpacity="0" /></radialGradient>
          <filter id="kof-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
          <filter id="kof-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g transform={`translate(${Math.sin(r * 0.9) * amp} ${Math.cos(r * 1.3) * amp}) translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`}>
          <Arena />
          {/* manga speed lines during the slow motion */}
          {r >= hit && r < hit + SLOW + 200 && (
            <g stroke="#fff" opacity={0.22 * (1 - prog(r, hit + SLOW - 100, 300))}>
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2 + (i % 2) * 0.05;
                return <line key={i} x1={cx + Math.cos(a) * 260} y1={cy + Math.sin(a) * 260} x2={cx + Math.cos(a) * 1400} y2={cy + Math.sin(a) * 1400} strokeWidth={i % 3 ? 3 : 7} />;
              })}
            </g>
          )}
          {duo && (
            // teammates a step behind: a touch smaller, standing on the same ground
            <>
              <Mate b={bodyAt("l", s, true)} color={lc} />
              <Mate b={bodyAt("w", s, true)} color={wc} />
            </>
          )}
          <Fighter b={lb} color={lc} />
          <Fighter b={wb} color={wc} />
          <Trail at={(d) => bodyAt("w", s + d)} color={s > 2100 ? GOLD : wc} />
          <Trail at={(d) => bodyAt("l", s + d)} color={lc} />

          <Sparks s={s} t0={CLASH} o={points.clash} seed={3} n={22} color={GOLD} power={0.8} />
          <Ring s={s} t0={CLASH} o={points.clash} color="#fff" size={0.45} />

          {variant === "blade" && (
            <>
              {s >= 2700 && s < 2980 && (
                <g opacity={1 - prog(s, 2760, 220)}>
                  <line x1={points.dashFrom[0]} y1={points.dashFrom[1]} x2={points.dashTo[0]} y2={points.dashTo[1]} stroke={wc} strokeWidth={26} filter="url(#kof-glow)" />
                  <line x1={points.dashFrom[0]} y1={points.dashFrom[1]} x2={points.dashTo[0]} y2={points.dashTo[1]} stroke="#fff" strokeWidth={6} />
                </g>
              )}
              {s >= hit && s < hit + 700 && (() => {
                const u = ease.out(prog(s, hit, 90)), len = 420 * u;
                const dx = Math.cos(-0.6) * len, dy = Math.sin(-0.6) * len;
                return (
                  <g opacity={1 - prog(s, hit + 200, 500)} strokeLinecap="round">
                    <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke={GOLD} strokeWidth={30} filter="url(#kof-glow)" />
                    <line x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} stroke="#fff" strokeWidth={8} />
                  </g>
                );
              })()}
            </>
          )}
          {variant === "blast" && (() => {
            if (s < 2250 || s >= hit) return null;
            const charging = s < 2760;
            const src = charging ? mid(wb.handF, wb.handB) : points.cast;
            const u = charging ? 0 : ease.in(prog(s, 2760, hit - 2760));
            const o = mid(src, points.hit, u);
            const rad = charging ? 6 + 30 * ease.out(prog(s, 2250, 510)) + Math.sin(s / 25) * 3 : 38;
            return (
              <g>
                {!charging && [1, 2, 3, 4].map((k) => {
                  const g = mid(src, points.hit, Math.max(0, u - k * 0.07));
                  return <circle key={k} cx={g[0]} cy={g[1]} r={rad * (1 - k * 0.16)} fill={wc} opacity={0.35 - k * 0.07} />;
                })}
                <circle cx={o[0]} cy={o[1]} r={rad * 2.4} fill="url(#kof-ball)" opacity={0.7} />
                <circle cx={o[0]} cy={o[1]} r={rad} fill="url(#kof-ball)" />
              </g>
            );
          })()}

          <Sparks s={s} t0={hit} o={points.hit} seed={11} n={46} color={GOLD} power={1.3} />
          <Sparks s={s} t0={hit} o={points.hit} seed={19} n={20} color={wc} power={0.9} />
          <Ring s={s} t0={hit} o={points.hit} color={wc} />
          <Ring s={s} t0={hit + 40} o={points.hit} color="#fff" size={0.7} />
        </g>
        <rect width={W} height={H} fill="#fff" opacity={flash} />
      </svg>

      {/* HUD: portraits, health bars, names */}
      <div className="absolute inset-x-0 top-0 px-[3vmin] pt-[3vmin]" style={{ transform: `translateY(${(1 - ease.out(prog(r, 100, 400))) * -120}%)` }}>
        <div className="mx-auto flex max-w-[150vmin] items-start gap-[1.6vmin]">
          <Portrait p={left.p} color={COLOR.l} />
          <div className="min-w-0 flex-1">
            <Bar hp={hp("l")} side="l" />
            <p className="mt-[0.8vmin] truncate text-[2.6vmin] font-bold uppercase tracking-wider" style={{ color: COLOR.l }}>{nameOf(left.p)}</p>
            <p className="truncate text-[1.7vmin] text-muted">{slotsOf(left.p)}</p>
          </div>
          <span className={`mt-[-0.4vmin] grid shrink-0 place-items-center rounded-[0.8vmin] border-[0.35vmin] px-[1.2vmin] text-[3.4vmin] font-black italic ${r >= hit ? "border-[#ff3b4a] bg-[#ff3b4a] text-white" : "border-[#ff3b4a] bg-black/70 text-[#ff3b4a]"}`}
            style={{ opacity: r >= hit ? 0.65 + 0.35 * Math.abs(Math.sin(r / 120)) : 1 }}>KO</span>
          <div className="min-w-0 flex-1 text-right">
            <Bar hp={hp("r")} side="r" />
            <p className="mt-[0.8vmin] truncate text-[2.6vmin] font-bold uppercase tracking-wider" style={{ color: COLOR.r }}>{nameOf(right.p)}</p>
            <p className="truncate text-[1.7vmin] text-muted">{slotsOf(right.p)}</p>
          </div>
          <Portrait p={right.p} color={COLOR.r} />
        </div>
        <p className="mt-[1vmin] text-center text-[1.8vmin] font-bold uppercase tracking-[0.3em] text-gold">{card.label}</p>
      </div>

      {/* FIGHT! */}
      {r > 380 && r < 1250 && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center" style={{ opacity: r > 1000 ? 1 - prog(r, 1000, 250) : 1 }}>
            {duo && <p className="text-[8vmin] text-gold" style={{ ...TITLE, ...slam(r, 380, 2) }}>2 VS 2</p>}
            <p className="bg-[linear-gradient(180deg,#ffffff,#c3ff8f_45%,#2e7d12)] bg-clip-text text-[20vmin] text-transparent"
              style={{ ...TITLE, ...slam(r, 400, 0.4), opacity: r < 400 ? 0 : 1 }}>FIGHT!</p>
          </div>
        </div>
      )}

      {/* K.O. */}
      {r >= hit + 200 && (
        <div className="absolute inset-0 grid place-items-center" style={{ transform: `translateY(${-14 * banner}vmin) scale(${1 - 0.3 * banner})` }}>
          <div className="text-center">
            <p className="bg-[linear-gradient(180deg,#fff6c4,#ffd76a_30%,#ff5f6d_62%,#8a1020)] bg-clip-text text-[30vmin] text-transparent" style={{ ...TITLE, ...slam(r, hit + 220) }}>K.O.</p>
            {info.perfect && (
              <p className="mt-[1vmin] bg-[linear-gradient(180deg,#fff,#ffd76a)] bg-clip-text text-[9vmin] text-transparent" style={{ ...TITLE, ...slam(r, hit + 900, 2) }}>PERFECT</p>
            )}
          </div>
        </div>
      )}

      {/* the winner */}
      {banner > 0 && (
        <div className="absolute inset-x-0 bottom-[6vmin] flex justify-center px-[3vmin]" style={{ opacity: banner, transform: `translateY(${(1 - ease.out(banner)) * 40}vmin)` }}>
          <div className="flex max-w-full items-center gap-[2.4vmin] rounded-[2vmin] border-[0.4vmin] border-gold/70 bg-black/80 px-[3vmin] py-[2vmin] shadow-[0_0_8vmin_-1vmin_rgb(255_215_106/0.55)]">
            {membersOf(info.w.p).map((x) => <SlotArt key={x.id} name={x.slot_name} src={x.slot_image} fluid={duo ? "12vmin" : "14vmin"} rounded="rounded-[1.2vmin]" />)}
            <div className="min-w-0">
              <p className="text-[1.9vmin] font-bold uppercase tracking-[0.35em] text-neon">Winner</p>
              <p className="truncate font-display text-[8vmin] leading-none text-gold">{nameOf(info.w.p)}</p>
              <p className="mt-[0.6vmin] truncate text-[2.2vmin] text-muted">{slotsOf(info.w.p)}</p>
              <p className="mt-[0.6vmin] font-mono text-[3.6vmin] font-bold">
                {info.dq ? <span className="text-danger">by disqualification</span> : <><span className="text-gold">x{info.w.multi}</span><span className="text-dim"> vs x{info.l.multi}</span></>}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Confetti { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; c: string }

/** Champion crowned: rays, confetti cannons, crown, CHAMPION, the prize counting up. */
export function ChampionFinale({ p, prize, title, sound = false, onDone }: { p: KoParticipant; prize: string | null; title: string; sound?: boolean; onDone: () => void }) {
  const [r, setR] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  const end = 8200;

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    const colors = ["#ffd76a", "#8dff4a", "#d9e1dc", "#c3ff8f", "#fff6c4"];
    const bits: Confetti[] = [];
    const fire = (fromLeft: boolean) => {
      if (!cv) return;
      for (let i = 0; i < 140; i++) {
        const a = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 40;
        const v = 14 + Math.random() * 16;
        bits.push({
          x: fromLeft ? 0 : cv.width, y: cv.height, vx: Math.cos((a * Math.PI) / 180) * v * (cv.width / 1400), vy: Math.sin((a * Math.PI) / 180) * v * (cv.height / 800),
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 8 + Math.random() * 8, h: 4 + Math.random() * 6, c: colors[i % colors.length],
        });
      }
    };
    const fired = new Set<string>();
    const once = (key: string, at: number, real: number, fn: () => void) => { if (real >= at && !fired.has(key)) { fired.add(key); fn(); } };
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const real = now - start;
      if (cv && (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight)) { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
      once("c1", 900, real, () => { fire(true); fire(false); });
      once("c2", 2400, real, () => { fire(true); fire(false); });
      if (sound) { once("s1", 900, real, () => play("ko")); once("s2", 1000, real, () => play("fanfare")); }
      if (g && cv) {
        g.clearRect(0, 0, cv.width, cv.height);
        for (const b of bits) {
          b.vy += 0.32; b.vx *= 0.99; b.vy *= 0.99; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
          g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.scale(1, Math.cos(b.rot * 2));
          g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); g.restore();
        }
      }
      setR(real);
      if (real >= end) done.current();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sound]);

  const fade = Math.min(prog(r, 0, 300), 1 - prog(r, end - 500, 500));
  const amount = prize != null ? Number(prize) * ease.out(prog(r, 1900, 1400)) : null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-[#020403]/90 font-head" style={{ opacity: fade }}>
      <div className="absolute left-1/2 top-1/2 size-[220vmax] opacity-60"
        style={{ background: "repeating-conic-gradient(from 0deg, rgb(255 215 106 / 0.22) 0deg 7deg, transparent 7deg 20deg)", transform: `translate(-50%, -50%) rotate(${r / 60}deg)`, maskImage: "radial-gradient(circle, #000 0, transparent 40%)", WebkitMaskImage: "radial-gradient(circle, #000 0, transparent 40%)" }} />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
      <div className="relative flex flex-col items-center px-[4vmin] text-center">
        <p className="text-[2.2vmin] font-bold uppercase tracking-[0.4em] text-neon" style={{ opacity: prog(r, 200, 400) }}>{title}</p>
        <Crown className="mt-[1.5vmin] size-[11vmin] text-gold drop-shadow-[0_0_3vmin_rgb(255_215_106/0.8)]"
          style={{ opacity: prog(r, 300, 200), transform: `translateY(${(1 - ease.out(prog(r, 300, 600))) * -60}vmin) rotate(${(1 - ease.out(prog(r, 300, 700))) * -40}deg)` }} />
        <div className="mt-[1vmin] rounded-[2vmin] border-[0.5vmin] border-gold p-[0.6vmin] shadow-[0_0_10vmin_-1vmin_rgb(255_215_106/0.7)]"
          style={{ opacity: prog(r, 500, 300), transform: `scale(${0.3 + 0.7 * ease.out(prog(r, 500, 500))})` }}>
          <div className="flex gap-[0.6vmin]">
            {membersOf(p).map((m) => <SlotArt key={m.id} name={m.slot_name} src={m.slot_image} fluid="24vmin" rounded="rounded-[1.4vmin]" className="!border-0" />)}
          </div>
        </div>
        <p className="mt-[2vmin] bg-[linear-gradient(180deg,#fff6c4,#ffd76a_45%,#b8860b)] bg-clip-text text-[15vmin] text-transparent"
          style={{ ...TITLE, filter: "drop-shadow(0 0.8vmin 0 #000) drop-shadow(0 0 4vmin rgb(255 215 106 / 0.6))", ...slam(r, 900, 3.4) }}>CHAMPION</p>
        <p className="mt-[1vmin] max-w-[90vw] truncate font-display text-[8vmin] leading-none text-text" style={{ opacity: prog(r, 1300, 400), transform: `translateY(${(1 - ease.out(prog(r, 1300, 500))) * 6}vmin)` }}>{nameOf(p)}</p>
        <p className="mt-[0.6vmin] text-[2.4vmin] text-neon" style={{ opacity: prog(r, 1500, 400) }}>{slotsOf(p)}</p>
        {amount != null && (
          <p className="mt-[1.5vmin] font-mono text-[7vmin] font-bold text-gold" style={{ opacity: prog(r, 1900, 300) }}>${Math.round(amount).toLocaleString("en-US")}</p>
        )}
      </div>
    </div>
  );
}

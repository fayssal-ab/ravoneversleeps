"use client";

import { animate, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skull } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import { AB, findMonster, tierById } from "@/lib/hunt/bestiary.js";
import { chatPicks, money, type HuntState, type Monster, type Reveal, type Roll } from "@/lib/hunt/engine";
import { play, type Sfx } from "../fight/sfx";
import { sting, type Stinger } from "./horror";
import { scoreHit, scoreMood, scoreResume, startScore, type Mood } from "./score";
import { Avatar, Emblem, Podium, Portrait, RANK, WinnerShowcase, tierColor } from "./HuntBoard";

// OBS "game" cinematics for the Hunt. Every event the host triggers plays in
// front of the stream HUD, and each kind has several variants (picked from
// the event number, so every viewer sees the same one) so it never feels
// repetitive:
//   spawn   → stir (flicker) · ritual (rune circle) · blackout (lightning)
//   slain   → slash · shatter · banish (burn)
//   reaped  → scythe · devour (jaws) · consume (soul drain)
//   Arena   → K.O. · OVERKILL (big margin) · PHOTO FINISH (coin flip)
// with horror stingers on top of an adaptive soundtrack (score.ts). Events queue, so a host
// faster than the poll never skips one. Sizes are in vh: any OBS source works.

type Look = { n: string; t?: string; l?: string; s?: string; ab?: string };
const look = (name: string) => findMonster(name) as Look | null;
const abName = (m: Monster) => { const d = look(m.name); return d?.ab ? (AB as unknown as Record<string, { name: string; boon?: boolean }>)[d.ab] : null; };
const css = (o: Record<string, string>) => o as React.CSSProperties;
const HEAVY = ["Warlord", "Overlord", "Endboss", "Secret"];
/** Same variant for everyone watching: derived from the event number. */
const pick = (seq: number, n: number, salt = 0) => (Math.imul(seq + salt * 7919, 2654435761) >>> 0) % n;

/** Queue of reveals newer than what this page has seen (nothing replays on load). */
export function useStageQueue(s: HuntState | null) {
  const [seen, setSeen] = useState<number | null>(null);
  const [queue, setQueue] = useState<Reveal[]>([]);
  const [snap, setSnap] = useState<HuntState | null>(null);
  if (s && s !== snap) {
    setSnap(s);
    const top = Math.max(0, ...(s.events ?? []).map((e) => e.seq), s.reveal?.seq ?? 0);
    // first look, or a new game (its counter starts over): nothing to replay
    if (seen == null || top < seen) setSeen(top);
    else if (top > seen) {
      const fresh = (s.events ?? (s.reveal ? [s.reveal] : [])).filter((e) => e.seq > seen);
      setQueue((q) => [...q, ...fresh].slice(-5));
      setSeen(top);
    }
  }
  return { current: queue[0] ?? null, next: () => setQueue((q) => q.slice(1)) };
}

function useTimeline(done: () => void, ms: number) {
  const cb = useRef(done);
  useEffect(() => { cb.current = done; }, [done]);
  useEffect(() => { const id = setTimeout(() => cb.current(), ms); return () => clearTimeout(id); }, [ms]);
}
type Cue = [number, Sfx | Stinger | "m:win" | "m:loss" | "m:end"];
const STINGERS = new Set<string>(["toll", "riser", "growl", "shriek", "choir", "heartbeat", "shatter", "burn", "whisper", "slam", "doom"]);
function useSound(sound: boolean, cues: Cue[]) {
  const key = cues.map((c) => c.join(":")).join("|");
  useEffect(() => {
    if (!sound) return;
    const fire = (name: Cue[1]) => (name === "m:win" ? scoreHit("win") : name === "m:loss" ? scoreHit("loss") : name === "m:end" ? scoreHit("end") : STINGERS.has(name) ? sting(name as Stinger) : play(name as Sfx));
    const ids = cues.map(([at, name]) => setTimeout(() => fire(name), Math.max(0, at)));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, key]);
}

// ── shared effects ──

function Embers({ color, n = 26 }: { color: string; n?: number }) {
  const dots = useMemo(() => Array.from({ length: n }, (_, i) => ({ left: `${(i * 37) % 100}%`, t: `${4 + (i % 5)}s`, d: `${(i % 9) * 0.35}s`, dx: `${((i % 7) - 3) * 3}vw` })), [n]);
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">{dots.map((p, i) => <span key={i} className="ember" style={css({ left: p.left, "--t": p.t, "--d": p.d, "--dx": p.dx, "--ec": color })} />)}</div>;
}
function Flash({ color, at = 0, peak = 0.85 }: { color: string; at?: number; peak?: number }) {
  return <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30" style={{ background: color }} initial={{ opacity: 0 }} animate={{ opacity: [0, peak, 0] }} transition={{ delay: at, duration: 0.55, times: [0, 0.12, 1] }} />;
}
function Shake({ at, strong = false, children }: { at: number; strong?: boolean; children: React.ReactNode }) {
  const k = strong ? 1.6 : 1;
  return (
    <motion.div className="relative size-full" animate={{ x: [0, -14 * k, 12 * k, -9 * k, 6 * k, -3 * k, 0], y: [0, 6 * k, -5 * k, 4 * k, -2 * k, 0, 0] }} transition={{ delay: at, duration: 0.55 }}>
      {children}
    </motion.div>
  );
}
/** Counts up to `to`; with `then`, moves on to a second value later (an ability changed the win). */
function Count({ to, at, dur = 1.8, then, className = "" }: { to: number; at: number; dur?: number; then?: { to: number; at: number }; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const next = then && then.to !== to ? then : null;
  const nTo = next?.to, nAt = next?.at;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (to === Infinity) { el.textContent = "$∞"; return; }
    const c = animate(0, to, { delay: at, duration: dur, ease: [0.15, 0.7, 0.2, 1], onUpdate: (v) => { el.textContent = money(v); } });
    const c2 = nTo != null && nAt != null ? animate(to, nTo, { delay: nAt, duration: 1, ease: "easeInOut", onUpdate: (v) => { el.textContent = money(v); } }) : null;
    return () => { c.stop(); c2?.stop(); };
  }, [to, at, dur, nTo, nAt]);
  return <span ref={ref} className={`hud-num ${className}`}>$0</span>;
}
function Stamp({ text, color, at, sub, tilt = -6 }: { text: string; color: string; at: number; sub?: string; tilt?: number }) {
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: at, duration: 0.01 }}>
      <motion.div initial={{ scale: 3.2, rotate: tilt * 2.3, opacity: 0 }} animate={{ scale: 1, rotate: tilt, opacity: 1 }} transition={{ delay: at, type: "spring", stiffness: 420, damping: 18 }} className="text-center">
        <p className="font-display leading-none" style={{ fontSize: text.length > 9 ? "13vh" : "17vh", color, textShadow: `0 0 4vh ${color}, 0 1vh 0 #000`, WebkitTextStroke: "0.25vh #000" }}>{text}</p>
        {sub && <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: at + 0.45 }} className="mt-[1vh] font-head text-[3.4vh] font-bold uppercase tracking-[0.2em] text-[#f1ece4] [text-shadow:0_0.4vh_0_#000]">{sub}</motion.p>}
      </motion.div>
    </motion.div>
  );
}

// ── finishing moves (drawn over the losing side's 36vh card) ──

type Move = "slash" | "shatter" | "burn" | "scythe" | "devour" | "drain" | "none";

function SlashFx({ at, color }: { at: number; color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-[-20%] z-20 overflow-hidden">
      {[-18, 14, -4].map((r, i) => (
        <motion.span key={i} className="absolute left-0 top-1/2 block h-[1.2vh] w-full origin-left" style={{ rotate: r, background: `linear-gradient(90deg, transparent, ${color}, #fff, ${color}, transparent)`, boxShadow: `0 0 3vh ${color}` }}
          initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ delay: at + i * 0.08, duration: 0.5, times: [0, 0.4, 1] }} />
      ))}
    </div>
  );
}
function ScytheFx({ at }: { at: number }) {
  return (
    <motion.svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[30%] z-30 size-[160%]" style={{ originX: 0.85, originY: 0.1 }}
      initial={{ rotate: -95, opacity: 0 }} animate={{ rotate: [-95, 50, 55], opacity: [0, 1, 0] }} transition={{ delay: at - 0.35, duration: 0.9, times: [0, 0.55, 1], ease: "easeIn" }}>
      <path d="M86 8 L60 92" stroke="#3a2a20" strokeWidth="3" strokeLinecap="round" />
      <path d="M86 8 Q40 -4 8 30 Q44 14 82 22 Z" fill="#d6dbe2" stroke="#fff" strokeWidth="0.6" style={{ filter: "drop-shadow(0 0 6px #b36bff)" }} />
    </motion.svg>
  );
}
function DevourFx({ at }: { at: number }) {
  const teeth = "polygon(0 0,100% 0,100% 70%,94% 100%,88% 70%,82% 100%,76% 70%,70% 100%,64% 70%,58% 100%,52% 70%,46% 100%,40% 70%,34% 100%,28% 70%,22% 100%,16% 70%,10% 100%,4% 70%,0 100%)";
  const jaw = { initial: { y: "-110%" }, animate: { y: ["-110%", "2%", "2%", "-110%"] }, transition: { delay: at - 0.15, duration: 1.6, times: [0, 0.18, 0.75, 1], ease: "easeIn" as const } };
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-[12%] z-30 overflow-hidden">
      <motion.div className="absolute inset-x-0 top-0 h-1/2 bg-[#050304]" style={{ clipPath: teeth }} {...jaw} />
      <div className="absolute inset-x-0 bottom-0 h-1/2 rotate-180"><motion.div className="size-full bg-[#050304]" style={{ clipPath: teeth }} {...jaw} /></div>
      <motion.div className="absolute inset-0 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: at + 0.1, duration: 1.1 }}>
        <span className="flex gap-[5vh]">{[0, 1].map((i) => <span key={i} className="block size-[3vh] rounded-full bg-[#ff3a3a] shadow-[0_0_3vh_#ff3a3a]" />)}</span>
      </motion.div>
    </div>
  );
}
function DrainFx({ at, toward }: { at: number; toward: "l" | "r" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      <motion.div className="absolute left-1/2 top-1/2 size-[30vh] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "conic-gradient(from 0deg, transparent, #b36bff, transparent 40%, #b36bff, transparent 70%)", mask: "radial-gradient(circle, transparent 30%, #000 32%, #000 60%, transparent 62%)" }}
        initial={{ opacity: 0, rotate: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], rotate: 540, scale: [0.4, 1.2, 0.2] }} transition={{ delay: at - 0.3, duration: 1.6 }} />
      <motion.span className="absolute left-1/2 top-1/2 block size-[6vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e9d8ff] shadow-[0_0_4vh_2vh_#b36bff]"
        initial={{ x: 0, opacity: 0, scale: 0.4 }} animate={{ x: [0, 0, toward === "r" ? "55vw" : "-55vw"], opacity: [0, 1, 0], scale: [0.4, 1.2, 0.3] }} transition={{ delay: at, duration: 1.3, times: [0, 0.3, 1], ease: "easeIn" }} />
    </div>
  );
}
function BurnEmbers({ at }: { at: number }) {
  const bits = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: ((i * 41) % 100) - 50, d: (i % 6) * 0.08 })), []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {bits.map((b, i) => (
        <motion.span key={i} className="absolute bottom-[20%] left-1/2 block size-[1vh] rounded-full bg-[#ffb03a] shadow-[0_0_1.6vh_#ff6a1a]"
          initial={{ x: `${b.x * 0.3}vh`, y: 0, opacity: 0 }} animate={{ x: `${b.x * 0.5}vh`, y: "-40vh", opacity: [0, 1, 0] }} transition={{ delay: at + b.d, duration: 1.6, ease: "easeOut" }} />
      ))}
    </div>
  );
}

/** One side's card; `move` plays on it at `at` when that side loses. */
function Card({ color, at, move, toward, children }: { color: string; at: number; move: Move; toward: "l" | "r"; children: React.ReactNode }) {
  const box = <div className="hud hud-lg hunt-live live" style={css({ "--hc": color })}><div className="grid size-[36vh] place-items-center overflow-hidden p-[1vh]">{children}</div></div>;
  const vanish =
    move === "shatter" ? { animate: { opacity: [1, 1, 0] }, transition: { delay: at, duration: 0.05, times: [0, 0.5, 1] } }
    : move === "burn" ? { animate: { filter: ["brightness(1) sepia(0)", "brightness(2.4) sepia(1) hue-rotate(-25deg)", "brightness(0) sepia(1)"], scaleY: [1, 1, 0.15], y: [0, 0, "-6vh"], opacity: [1, 1, 0] }, transition: { delay: at, duration: 1.3, times: [0, 0.35, 1] } }
    : move === "devour" ? { animate: { opacity: [1, 1, 0] }, transition: { delay: at + 0.2, duration: 0.1, times: [0, 0.5, 1] } }
    : move === "drain" ? { animate: { filter: ["grayscale(0)", "grayscale(1) brightness(0.6)"], scale: [1, 0.9] }, transition: { delay: at, duration: 1.2 } }
    : move === "scythe" ? { animate: { filter: ["grayscale(0)", "grayscale(1) brightness(0.45) sepia(0.4) hue-rotate(230deg)"], rotate: [0, -4] }, transition: { delay: at + 0.2, duration: 0.6 } }
    : null;
  return (
    <div className="relative">
      <motion.div {...(vanish ?? {})}>{box}</motion.div>
      {move === "shatter" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
          {Array.from({ length: 9 }, (_, i) => {
            const cx = i % 3, cy = Math.floor(i / 3);
            return (
              <motion.div key={i} className="absolute overflow-hidden" style={{ left: `${cx * 33.34}%`, top: `${cy * 33.34}%`, width: "33.34%", height: "33.34%" }}
                initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], x: [0, 0, `${(cx - 1) * 30 + (i % 2 ? 6 : -6)}vh`], y: [0, 0, `${(cy - 1) * 30 + 14}vh`], rotate: [0, 0, (i % 2 ? 1 : -1) * (40 + i * 9)] }}
                transition={{ delay: at, duration: 1.1, times: [0, 0.02, 0.15, 1], ease: "easeOut" }}>
                <div className="absolute" style={{ width: "300%", height: "300%", left: `${-cx * 100}%`, top: `${-cy * 100}%` }}>{box}</div>
              </motion.div>
            );
          })}
        </div>
      )}
      {move === "slash" && <SlashFx at={at} color="#8cff4a" />}
      {move === "scythe" && <ScytheFx at={at} />}
      {move === "devour" && <DevourFx at={at} />}
      {move === "drain" && <DrainFx at={at} toward={toward} />}
      {move === "burn" && <BurnEmbers at={at} />}
    </div>
  );
}

function Fighter({ side, name, pids, sub, slot, portrait, tier, color, total, raw, rawUntil, at, lost, max, move, hit }: {
  side: "l" | "r"; name: string; pids?: number[]; sub?: string; slot?: { name: string; image: string | null } | null; portrait?: { name: string; tier: string };
  tier?: string; color: string; total: number; at: number; lost: boolean; max: number; move: Move; hit: number;
  /** the win before the abilities and rolls, shown until `rawUntil` */
  raw?: number; rawUntil?: number;
}) {
  const first = raw ?? total;
  const pct = (v: number) => `${v === Infinity ? 100 : Math.max(4, (v / max) * 100)}%`;
  const two = raw != null && rawUntil != null && raw !== total;
  return (
    <motion.div className="flex min-w-0 flex-col items-center gap-[1.4vh] text-center"
      initial={{ x: side === "l" ? "-60vw" : "60vw" }} animate={{ x: 0, opacity: lost ? [1, 1, 0.45] : 1 }} transition={{ x: { type: "spring", stiffness: 140, damping: 18, delay: 0.1 }, opacity: { delay: hit + 0.8, duration: 0.6 } }}>
      <Card color={color} at={hit} move={lost ? move : "none"} toward={side === "l" ? "r" : "l"}>
        {portrait ? <Portrait name={portrait.name} tier={portrait.tier} size="33vh" />
          : slot ? <SlotArt name={slot.name} src={slot.image} fluid="33vh" rounded="rounded-none" /> : <Avatar e={{ name, pids }} size="24vh" />}
      </Card>
      <div className="flex max-w-full items-center gap-[1vh]">
        {tier ? <Emblem tier={tier} size={46} /> : (slot || portrait) && <Avatar e={{ name, pids }} size="6vh" />}
        <p className="truncate font-head text-[5vh] font-bold leading-tight text-[#f1ece4]">{name}</p>
      </div>
      {sub && <p className="-mt-[1vh] max-w-full truncate text-[2.4vh] text-[#b8b0a6]">{sub}</p>}
      <Count to={first} at={at} then={two ? { to: total, at: rawUntil! } : undefined} className="text-[8vh] font-bold leading-none" />
      <div className="hud-bar w-[36vh] !h-[1.4vh]" style={css({ "--hc": color })}>
        {two ? (
          <motion.i initial={{ width: "0%" }} animate={{ width: ["0%", pct(first), pct(first), pct(total)] }}
            transition={{ delay: at, duration: rawUntil! + 1 - at, times: [0, 1.8 / (rawUntil! + 1 - at), (rawUntil! - at) / (rawUntil! + 1 - at), 1] }} />
        ) : (
          <motion.i initial={{ width: "0%" }} animate={{ width: pct(total) }} transition={{ delay: at, duration: 1.8, ease: [0.15, 0.7, 0.2, 1] }} />
        )}
      </div>
    </motion.div>
  );
}

// ── spawn intros ──

function RitualCircle({ color, T }: { color: string; T: number }) {
  const star = Array.from({ length: 5 }, (_, i) => { const a = (-90 + i * 144) * (Math.PI / 180); return `${50 + Math.cos(a) * 40},${50 + Math.sin(a) * 40}`; }).join(" ");
  return (
    <motion.svg aria-hidden viewBox="0 0 100 100" className="absolute left-1/2 top-1/2 z-0 size-[80vh] -translate-x-1/2 -translate-y-1/2" initial={{ rotate: 0, opacity: 1 }} animate={{ rotate: 120, opacity: [1, 1, 0.15] }} transition={{ duration: T + 1.5, times: [0, 0.6, 1], ease: "linear" }}>
      {[46, 42].map((r, i) => <motion.circle key={r} cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth={i ? 0.4 : 0.8} style={{ filter: `drop-shadow(0 0 4px ${color})` }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: T * 0.7, delay: i * 0.2 }} />)}
      <motion.polygon points={star} fill="none" stroke={color} strokeWidth="0.6" style={{ filter: `drop-shadow(0 0 4px ${color})` }} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: T * 0.8, delay: 0.3 }} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30) * (Math.PI / 180);
        return <motion.text key={i} x={50 + Math.cos(a) * 44} y={50 + Math.sin(a) * 44 + 1.2} fontSize="3.4" fill={color} textAnchor="middle" initial={{ opacity: 0 }} animate={{ opacity: [0, 1] }} transition={{ delay: 0.2 + i * 0.07 }}>{"ᚱᚨᚢᛟᚾᛖᚢᛖᚱᛊᛚᛈ"[i]}</motion.text>;
      })}
    </motion.svg>
  );
}
function Blackout({ T }: { T: number }) {
  return (
    <>
      <motion.div aria-hidden className="absolute inset-0 z-20 bg-black" initial={{ opacity: 1 }} animate={{ opacity: [1, 0.6, 1, 0.3, 1, 1, 0] }} transition={{ duration: T, times: [0, 0.15, 0.22, 0.5, 0.56, 0.95, 1] }} />
      <motion.div aria-hidden className="absolute left-1/2 top-[40%] z-20 flex -translate-x-1/2 gap-[6vh]" initial={{ opacity: 0 }} animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ duration: T, times: [0, 0.3, 0.45, 0.9, 1] }}>
        {[0, 1].map((i) => <span key={i} className="block h-[2.4vh] w-[5vh] rounded-full bg-[#ff3a3a] shadow-[0_0_4vh_1vh_#ff3a3a]" />)}
      </motion.div>
      <motion.svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-20 size-full" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0, 1, 0] }} transition={{ delay: T - 0.35, duration: 0.45 }}>
        <path d="M58 0 L48 34 L56 36 L42 70 L50 72 L38 100" fill="none" stroke="#eaf4ff" strokeWidth="0.6" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 10px #9cc8ff)" }} />
      </motion.svg>
    </>
  );
}

const INTROS = ["stir", "ritual", "blackout"] as const;

function SpawnSeq({ s, ev, sound, onDone, endboss = false }: { s: HuntState; ev: Reveal; sound: boolean; onDone: () => void; endboss?: boolean }) {
  const f = ev.fight != null ? s.fights[ev.fight] : null;
  const m = endboss ? s.reckon?.boss ?? null : f?.monster ?? null;
  const target = endboss ? (s.reckon ? s.ents[s.reckon.champ] : null) : f ? s.ents[f.eid] : null;
  const tier = m?.secret ? "Secret" : m?.tier ?? "Minion";
  const c = m?.secret ? "#fff6d6" : tierColor(tier);
  const heavy = HEAVY.includes(tier);
  const intro = endboss ? "ritual" : INTROS[pick(ev.seq, 3)];
  const T = endboss ? 2.4 : intro === "stir" ? 1.4 : 2;
  const entrance = intro === "stir" ? { initial: { scale: 2.1, filter: "blur(14px)", opacity: 0 }, animate: { scale: 1, filter: "blur(0px)", opacity: 1 } }
    : intro === "ritual" ? { initial: { y: "40vh", filter: "blur(10px)", opacity: 0 }, animate: { y: 0, filter: "blur(0px)", opacity: 1 } }
    : { initial: { x: 0, opacity: 0 }, animate: { x: [0, -30, 24, -12, 0], opacity: [0, 1, 0.4, 1, 1] } };
  useTimeline(onDone, (endboss ? 9800 : heavy ? 8200 : 7000) + (T - 1.4) * 1000);
  const cues: Cue[] = intro === "stir" ? [[0, "whisper"], [300, "riser"], [T * 1000, heavy ? "blast" : "slam"]]
    : intro === "ritual" ? [[0, "choir"], [500, "riser"], [T * 1000, "slam"], ...(endboss ? [[T * 1000 + 150, "doom"] as Cue, [T * 1000 + 900, "growl"] as Cue] : [])]
    : [[0, "heartbeat"], [T * 1000 - 400, "shriek"], [T * 1000, "slam"]];
  if (heavy && !endboss) cues.push([T * 1000 + 500, "growl"]);
  useSound(sound, cues);
  if (!m || !target) { onDone(); return null; }
  const def = look(m.name);
  const ab = abName(m);
  const head = m.secret ? "A light descends" : endboss ? "The Endboss awakens" : ((tierById(tier) as { head?: string } | null)?.head ?? "Something stirs…");
  return (
    <Shake at={T} strong={heavy}>
      <Embers color={c} />
      <Flash color={c} at={T} />
      {intro === "ritual" && <RitualCircle color={endboss ? "#ff5a5a" : c} T={T} />}
      {intro === "blackout" && <Blackout T={T} />}
      {endboss && (
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 size-full">
          {["M50 0 L46 22 L55 38 L44 60 L52 100", "M0 40 L22 44 L35 36 L50 50", "M100 30 L78 38 L64 33 L50 50", "M50 50 L40 70 L18 78 L0 92", "M50 50 L66 72 L84 80 L100 96"].map((d, i) => (
            <motion.path key={i} d={d} fill="none" stroke="#ff5a5a" strokeWidth="0.35" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px #ff5a5a)" }}
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 0.5] }} transition={{ delay: T + 0.05 * i, duration: 0.45 }} />
          ))}
        </svg>
      )}
      {intro === "stir" && (
        // the CSS flicker runs on the inner span so it can't override the fade-out
        <motion.p className="absolute inset-x-0 top-[38%] z-0 text-center font-display text-[11vh] text-[#d9cfc4]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], visibility: ["visible", "visible", "visible", "hidden"] }} transition={{ duration: T, times: [0, 0.2, 0.85, 1] }}>
          <span className="flicker">Something stirs…</span>
        </motion.p>
      )}
      <motion.div className="absolute inset-0 z-[25] grid grid-cols-[auto_1fr] items-center gap-[4vw] px-[6vw]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T, duration: 0.01 }}>
        <motion.div className="relative" initial={entrance.initial} animate={entrance.animate} transition={{ delay: T, ...(intro === "blackout" ? { duration: 0.45 } : { type: "spring", stiffness: 160, damping: 15 }) }}>
          <div aria-hidden className="rays absolute left-1/2 top-1/2 size-[90vh] -translate-x-1/2 -translate-y-1/2 opacity-40" style={css({ "--rc": c })} />
          <div className="hud hud-lg hunt-live live" style={css({ "--hc": c })}><div className="p-[1.4vh]"><Portrait name={m.name} tier={tier} size="58vh" /></div></div>
          <motion.div className="absolute -right-[3vh] -top-[3vh]" initial={{ rotate: -200, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: T + 0.35, type: "spring", stiffness: 200, damping: 13 }}><Emblem tier={tier} size={90} /></motion.div>
        </motion.div>
        <div className="min-w-0">
          <motion.span className="hud-tab !text-[2.2vh]" style={css({ "--hc": c })} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: T + 0.25 }}>
            {m.secret ? "Secret boss · 1 in 1,000,000" : endboss ? `Endboss · bounty ×${m.bounty}` : `${tier} · ${RANK[tier]} · tier ${(tierById(tier) as { roman?: string }).roman}`}
          </motion.span>
          <motion.p className="mt-[1vh] font-head text-[3vh] font-bold uppercase tracking-[0.2em]" style={{ color: c }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T + 0.35 }}>{head}</motion.p>
          {/* letters drop one by one, words never break in the middle */}
          <h2 className="mt-[0.5vh] font-display leading-[0.9] text-[#f3ede6] [text-shadow:0_0.8vh_0_#000]" style={{ fontSize: m.name.length > 20 ? "8.5vh" : m.name.length > 14 ? "10vh" : "13vh" }} aria-label={m.name}>
            {m.name.split(" ").map((word, w, words) => {
              const start = words.slice(0, w).join(" ").length + (w ? 1 : 0);
              return (
                <span key={w} className="inline-block whitespace-nowrap">
                  {word.split("").map((ch, i) => (
                    <motion.span key={i} className="inline-block will-change-transform" initial={{ y: "-0.6em", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: T + 0.4 + (start + i) * 0.035, type: "spring", stiffness: 500, damping: 20 }}>{ch}</motion.span>
                  ))}
                  {w < words.length - 1 && " "}
                </span>
              );
            })}
          </h2>
          {def?.l && <motion.p className="mt-[1vh] text-[3vh] italic text-[#c9c0b6]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T + 1.1 }}>“{def.l}”</motion.p>}
          <motion.p className="mt-[2vh] font-head text-[3.4vh] font-bold uppercase tracking-[0.12em] text-[#f1ece4]" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: T + 1.3 }}>
            hunts <span className="text-neon">{target.name}</span>
          </motion.p>
          <div className="mt-[2vh] grid max-w-[70vh] grid-cols-3 gap-[1vh]">
            {[["Bonus buy", money(m.price)], ["Slot", m.secret ? "∞" : chatPicks(m) ? "Chat picks" : def?.s ?? ""], ["Bounty", m.bounty > 1 ? `×${m.bounty}` : "none"]].map(([l, v], i) => (
              <motion.div key={l} className="hud hud-sm" style={css({ "--hc": "rgb(255 255 255 / 0.18)" })} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: T + 1.5 + i * 0.12 }}>
                <div className="p-[1.2vh]"><p className="font-head text-[1.6vh] uppercase tracking-[0.2em] text-dim">{l}</p><p className={`truncate font-bold ${l === "Slot" ? "text-[2.6vh]" : "hud-num text-[3.6vh] text-gold"}`}>{v}</p></div>
              </motion.div>
            ))}
          </div>
          {ab && (m.abOn || endboss || m.secret) && (
            <motion.div className="hud hud-sm mt-[1.5vh] max-w-[70vh]" style={css({ "--hc": ab.boon ? "#8cff4a" : c })} initial={{ x: 80, opacity: 0, skewX: -12 }} animate={{ x: 0, opacity: 1, skewX: 0 }} transition={{ delay: T + 2, type: "spring", stiffness: 300, damping: 22 }}>
              <p className="px-[1.4vh] py-[1vh] font-head text-[2.6vh] font-bold uppercase tracking-[0.14em]" style={{ color: ab.boon ? "#8cff4a" : c }}>{ab.boon ? "⬢ Boon" : "⚡ Ability"} · {ab.name}</p>
            </motion.div>
          )}
          {!m.secret && <motion.p className="mt-[1.5vh] font-head text-[2.4vh] uppercase tracking-[0.16em] text-dim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T + 2.4 }}>Type <b className="text-neon">!call &lt;slot&gt;</b> to pick your slot</motion.p>}
        </div>
      </motion.div>
    </Shake>
  );
}

// ── random moments: coin flips and rolled % play out on stream ──

const ROLL_S = 3.2; // seconds each roll is on screen
const ARENA_ROLL = 3;
function rollCues(r: Roll, at: number): Cue[] {
  return r.kind === "coin"
    ? [[at, "whoosh"], [at + 300, "riser"], [at + 1900, r.good ? "impact" : "slam"], [at + 2000, r.good ? "choir" : "toll"]]
    : [[at, "whoosh"], [at + 200, "riser"], [at + 2100, r.good ? "impact" : "slam"]];
}

/** A coin that spins and lands on a face, or a % that rolls and stops: then the outcome. */
function RollShow({ roll, at }: { roll: Roll; at: number }) {
  const tone = roll.good ? "#8cff4a" : "#ff5a5a";
  const LAND = 1.9;
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-[45] grid place-items-center bg-black/55" initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }} transition={{ delay: at, duration: ROLL_S, times: [0, 0.08, 0.9, 1] }}>
      <div className="flex flex-col items-center gap-[2.4vh]">
        <span className="hud-tab !text-[2.6vh]" style={css({ "--hc": "#f5c95a" })}>{roll.title}</span>
        {roll.kind === "coin" ? <Coin roll={roll} at={at} land={LAND} /> : <Roller roll={roll} at={at} land={LAND} />}
        <motion.p className="font-display text-[8vh] leading-none [text-shadow:0_0.6vh_0_#000]" style={{ color: tone }} initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 1 }} transition={{ delay: at + LAND, duration: 0.45 }}>
          {roll.kind === "coin" ? roll.faces[roll.pick] : `−${roll.value}%`}
        </motion.p>
      </div>
    </motion.div>
  );
}
function Coin({ roll, at, land }: { roll: Extract<Roll, { kind: "coin" }>; at: number; land: number }) {
  const face = (i: 0 | 1) => (
    <span className="absolute inset-0 grid place-items-center rounded-full border-[0.8vh] p-[2vh] text-center font-head text-[3vh] font-bold uppercase leading-tight [backface-visibility:hidden]"
      style={{ transform: i ? "rotateY(180deg)" : undefined, borderColor: "#c99a2e", color: "#2a1d05", background: i ? "radial-gradient(circle at 35% 30%, #e8e2d6, #9d968a)" : "radial-gradient(circle at 35% 30%, #ffe7a0, #c99a2e)" }}>
      {roll.faces[i]}
    </span>
  );
  return (
    <div className="[perspective:120vh]">
      <motion.div className="relative size-[30vh] [transform-style:preserve-3d]" initial={{ rotateY: 0, y: 0 }}
        animate={{ rotateY: 360 * 6 + (roll.pick ? 180 : 0), y: ["0vh", "-14vh", "0vh"] }}
        transition={{ delay: at + 0.2, duration: land - 0.2, ease: [0.2, 0.6, 0.3, 1], y: { delay: at + 0.2, duration: land - 0.2, times: [0, 0.4, 1] } }}>
        {face(0)}{face(1)}
      </motion.div>
    </div>
  );
}
function Roller({ roll, at, land }: { roll: Extract<Roll, { kind: "pct" }>; at: number; land: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // spins through 0..max a few times and slows down onto the rolled value
    const span = (roll.max + 1) * 4 + roll.value;
    const c = animate(0, span, { delay: at + 0.2, duration: land - 0.2, ease: [0.1, 0.7, 0.25, 1], onUpdate: (v) => { el.textContent = `${Math.floor(v) % (roll.max + 1)}%`; } });
    return () => c.stop();
  }, [roll.max, roll.value, at, land]);
  return (
    <div className="hud hud-lg" style={css({ "--hc": "#f5c95a" })}>
      <span ref={ref} className="hud-num block min-w-[30vh] px-[4vh] py-[2vh] text-center text-[16vh] font-bold leading-none text-[#f1ece4]">0%</span>
    </div>
  );
}

// ── fights ──

const WIN_MOVES: { move: Move; text: string; cue: Sfx | Stinger }[] = [
  { move: "slash", text: "Slain", cue: "ko" },
  { move: "shatter", text: "Shattered", cue: "shatter" },
  { move: "burn", text: "Banished", cue: "burn" },
];
const LOSS_MOVES: { move: Move; text: string; cues: Cue[] }[] = [
  { move: "scythe", text: "Reaped", cues: [[-350, "whisper"], [0, "slam"]] },
  { move: "devour", text: "Devoured", cues: [[-200, "growl"], [100, "slam"]] },
  { move: "drain", text: "Consumed", cues: [[-300, "choir"], [200, "shriek"]] },
];

function FightSeq({ s, ev, sound, onDone, duel = false }: { s: HuntState; ev: Reveal; sound: boolean; onDone: () => void; duel?: boolean }) {
  const f = !duel && ev.fight != null ? s.fights[ev.fight] : null;
  const m = duel ? s.reckon?.boss ?? null : f?.monster ?? null;
  const v = duel ? s.reckon?.verdict ?? null : f?.verdict ?? null;
  const e = duel ? (s.reckon ? s.ents[s.reckon.champ] : null) : f ? s.ents[f.eid] : null;
  const call = duel ? s.reckon?.call : f?.call;
  // every random moment (coin flip, rolled %) plays out before the result
  const rolls = v?.rolls ?? [];
  const ROLL0 = 3.2;
  const settle = ROLL0 + rolls.length * ROLL_S; // the wins move to their final values here
  const HIT = rolls.length ? settle + 1.6 : 4.4;
  const extra = (HIT - 4.4) * 1000;
  const finale = Boolean(duel && s.result && v && v.out !== "rematch" && v.out !== "revive");
  const win = WIN_MOVES[pick(ev.seq, 3, 1)], loss = LOSS_MOVES[pick(ev.seq, 3, 2)];
  const cues: Cue[] = [[300, "whoosh"], [900, "clash"], [HIT * 1000 - 1600, "heartbeat"], ...rolls.flatMap((x, i) => rollCues(x, (ROLL0 + i * ROLL_S) * 1000))];
  if (v?.out === "p") cues.push([HIT * 1000, win.cue], [HIT * 1000 + 50, "impact"], [HIT * 1000 + 100, "m:win"]);
  else if (v?.out === "b") { for (const [d, n] of loss.cues) cues.push([HIT * 1000 + d, n]); cues.push([HIT * 1000 + 100, "m:loss"]); }
  else cues.push([HIT * 1000, "impact"], [HIT * 1000 + 200, "riser"]);
  if (finale) cues.push([HIT * 1000 + 3000, "m:end"], [HIT * 1000 + 3600, s.result!.type === "legend" || s.result!.type === "champion" ? "fanfare" : "doom"]);
  // the finale holds longer when 2nd / 3rd are paid too (their prizes follow the winner)
  useTimeline(onDone, extra + (finale ? ((s.result?.podium?.length ?? 0) > 1 ? 20000 : 13800) : 8600));
  useSound(sound, cues);
  if (!m || !v || !e) { onDone(); return null; }
  const rawB = v.b === Infinity ? Infinity : v.b * (s.cfg.duo ? 2 : 1);
  const tier = m.secret ? "Secret" : m.tier;
  const c = m.secret ? "#fff6d6" : tierColor(tier);
  const max = Math.max(v.pf, v.bf === Infinity ? v.pf : v.bf, 1);
  const out = m.secret && v.out === "b" ? { text: "Judged", color: "#fff6d6" }
    : v.out === "p" ? { text: win.text, color: "#8cff4a" } : v.out === "b" ? { text: loss.text, color: "#b36bff" }
    : v.out === "rematch" ? { text: "Rematch", color: "#ff8a3d" } : v.out === "revive" ? { text: "It rises", color: "#ff8a3d" } : { text: "Second try", color: "#8cff4a" };
  const bountyUp = v.out === "p" && m.bounty > 1 && e.bounty === m.bounty;
  const settled = v.out === "p" || v.out === "b";
  return (
    <Shake at={HIT} strong={v.out === "b" || HEAVY.includes(tier)}>
      <Embers color={c} n={18} />
      <Flash color={out.color} at={HIT} peak={settled ? 0.85 : 0.5} />
      <p className="absolute inset-x-0 top-[3vh] z-10 text-center"><span className="hud-tab !text-[2.2vh]" style={css({ "--hc": c })}>{duel ? "The Reckoning · final duel" : `The Hunt · wave ${s.wave}`} · buy {money(m.price)}</span></p>
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center gap-[2vw] px-[5vw] pt-[6vh]">
        <Fighter side="l" name={e.name} pids={e.pids} sub={call ? `plays ${call.name}` : undefined} slot={call ?? null} color="#8cff4a" total={v.pf} raw={v.p} rawUntil={settle} at={1.2}
          lost={v.out === "b"} max={max} move={m.secret ? "drain" : loss.move} hit={HIT} />
        <motion.span className="font-display text-[18vh] leading-none" initial={{ scale: 0, rotate: -30 }} animate={{ scale: [0, 1.4, 1], rotate: 0, opacity: [1, 1, 0] }} transition={{ delay: 0.8, duration: 0.5, opacity: { delay: HIT - 0.15, duration: 0.2, times: [0, 0.1, 1] } }}>
          <span className="chrome">V</span><span className="neon-text">S</span>
        </motion.span>
        <Fighter side="r" name={m.name} sub={m.secret ? "∞" : `plays ${look(m.name)?.s ?? ""}`} portrait={{ name: m.name, tier }} tier={tier} color={c} total={v.bf} raw={rawB} rawUntil={settle} at={1.2}
          lost={v.out === "p"} max={max} move={win.move} hit={HIT} />
      </div>
      <div className="absolute inset-x-0 bottom-[5vh] z-30 flex flex-col items-center gap-[0.8vh]">
        {v.notes.filter((n) => !n.startsWith("Duo:")).slice(0, 3).map((n, i) => (
          <motion.p key={i} className="hud hud-sm" style={css({ "--hc": "#f5c95a" })} initial={{ scale: 0.6, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: [0, 1, 1, 0.85], y: 0 }} transition={{ delay: (rolls.length ? settle : 3) + i * 0.45, duration: 0.4 }}>
            <span className="block px-[2vh] py-[0.8vh] font-head text-[2.6vh] font-bold text-gold">⚡ {n}</span>
          </motion.p>
        ))}
      </div>
      {rolls.map((x, i) => <RollShow key={i} roll={x} at={ROLL0 + i * ROLL_S} />)}
      <Stamp text={out.text} color={out.color} at={HIT + (v.out === "b" ? 0.25 : 0)} tilt={pick(ev.seq, 2, 3) ? -6 : 5}
        sub={v.out === "p" ? `${e.name} survives` : v.out === "b" ? (duel ? "The Cult takes the crown" : `${e.name} is out`) : v.out === "rematch" ? "Both buy again" : v.out === "revive" ? `${m.name} buys again` : `${e.name} gets a free second try`} />
      {bountyUp && !duel && (
        <motion.div className="absolute inset-x-0 top-[66%] z-40 text-center" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 1], opacity: 1 }} transition={{ delay: HIT + 1, duration: 0.5 }}>
          <span className="hud-tab !px-[3vh] !py-[1vh] !text-[4vh]" style={css({ "--hc": "#f5c95a" })}>Prize ×{m.bounty}</span>
        </motion.div>
      )}
      {finale && <Finale s={s} at={HIT + 3.6} />}
    </Shake>
  );
}

function Finale({ s, at }: { s: HuntState; at: number }) {
  const R = s.result!;
  const c = R.champ != null ? s.ents[R.champ] : null;
  const win = R.type === "legend" || R.type === "champion";
  const color = win ? "#f5c95a" : R.type === "judged" ? "#fff6d6" : "#b36bff";
  const bits = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: `${(i * 23) % 100}vw`, d: (i % 10) * 0.12, r: (i * 47) % 360 })), []);
  return (
    <motion.div className="absolute inset-0 z-50 grid place-items-center overflow-hidden" style={{ background: win ? "radial-gradient(circle, #2a1f0a, #050403 70%)" : "radial-gradient(circle, #1a0d26, #040306 70%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: at, duration: 0.4 }}>
      <div aria-hidden className="rays absolute left-1/2 top-1/2 size-[160vh] -translate-x-1/2 -translate-y-1/2 opacity-50" style={css({ "--rc": color })} />
      {bits.map((b, i) => (
        <motion.span key={i} aria-hidden className="absolute top-[-6vh]" style={{ left: b.x, color }} initial={{ y: 0, rotate: 0, opacity: 0 }}
          animate={{ y: "115vh", rotate: b.r, opacity: [0, 1, 1] }} transition={{ delay: at + 0.3 + b.d, duration: 3.2, ease: "easeIn" }}>
          {win ? <span className="block size-[1.6vh] rotate-45" style={{ background: i % 3 ? color : "#8cff4a" }} /> : <Skull className="size-[4vh]" />}
        </motion.span>
      ))}
      {win && c ? (
        // mounted only when the finale shows, so its own reveal plays then
        <>
          <Delayed at={at + 0.2}><div className="w-[90vw]"><WinnerShowcase s={s} eid={c.id} legend={R.type === "legend"} size="1.55vh" /></div></Delayed>
          {(R.podium?.length ?? 0) > 1 && (
            <Delayed at={at + 6.5}>
              <motion.div className="absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(circle,#2a1f0a,#050403_70%)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <div className="w-[80vw] text-center">
                  <p className="mb-[2vh] font-display text-[9vh] leading-none text-[#f6efe6] [text-shadow:0_1vh_0_#000]">The prizes</p>
                  <Podium s={s} big />
                </div>
              </motion.div>
            </Delayed>
          )}
        </>
      ) : (
      <motion.div className="relative text-center" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: at + 0.3, type: "spring", stiffness: 180, damping: 14 }}>
        <Skull className="mx-auto size-[14vh]" style={{ color }} />
        <p className="font-head text-[3.4vh] font-bold uppercase tracking-[0.3em]" style={{ color }}>{R.type === "legend" ? "Endboss slain · Legend" : R.type === "champion" ? "Champion" : R.type === "judged" ? "Judged" : "The champion fell"}</p>
        <p className="font-display leading-none text-[#f6efe6] [text-shadow:0_1vh_0_#000]" style={{ fontSize: "16vh" }}>{win ? c?.name : "The Cult wins"}</p>
        {win ? <p className="mt-[2vh] font-head text-[4.4vh] font-bold text-[#f1ece4]">takes home <span className="hud-num text-gold">{money(R.payout)}</span></p>
          : R.payout > 0 && c ? <p className="mt-[2vh] font-head text-[3.6vh] text-[#d8d0c6]">{c.name} keeps <span className="hud-num text-gold">{money(R.payout)}</span></p> : null}
        {(R.podium?.length ?? 0) > 1 && <div className="mt-[3vh]"><Podium s={s} big /></div>}
      </motion.div>
      )}
    </motion.div>
  );
}

/** Renders its children only after `at` seconds (so their entrance animations start then). */
function Delayed({ at, children }: { at: number; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), at * 1000); return () => clearTimeout(id); }, [at]);
  return on ? <>{children}</> : null;
}

function ArenaSeq({ s, ev, sound, onDone }: { s: HuntState; ev: Reveal; sound: boolean; onDone: () => void }) {
  const m = ev.round != null && ev.fight != null ? s.arena?.rounds[ev.round]?.ms[ev.fight] : undefined;
  const HIT = m?.tie ? ARENA_ROLL + ROLL_S + 0.6 : 3.8; // a tie: the coin flip plays first
  const big = m?.va != null && m.vb != null && Math.max(m.va, m.vb) >= 3 * Math.max(1, Math.min(m.va, m.vb));
  const kind: { text: string; move: Move } = m?.tie ? { text: "Photo finish", move: "slash" } : big ? { text: "Overkill", move: "shatter" } : { text: "K.O.", move: (["slash", "burn"] as Move[])[pick(ev.seq, 2, 4)] };
  const tieRoll: Roll | null = m?.tie ? { kind: "coin", title: "", faces: ["", ""], pick: 0, good: true } : null;
  useTimeline(onDone, 7400 + (HIT - 3.8) * 1000);
  useSound(sound, [...(tieRoll ? rollCues(tieRoll, ARENA_ROLL * 1000) : []), [300, "whoosh"], [800, "clash"], [HIT * 1000 - 1500, "heartbeat"], [HIT * 1000, kind.move === "shatter" ? "shatter" : kind.move === "burn" ? "burn" : "ko"], [HIT * 1000 + 60, "impact"], [HIT * 1000 + 100, "m:win"]]);
  if (!m?.done || m.va == null || m.vb == null) { onDone(); return null; }
  const A = s.ents[m.a], B = s.ents[m.b];
  const max = Math.max(m.va, m.vb, 1);
  const aWon = m.winner === m.a;
  return (
    <Shake at={HIT} strong={big}>
      <Embers color="#f5c95a" n={14} />
      <Flash color="#f5c95a" at={HIT} />
      <p className="absolute inset-x-0 top-[3vh] z-10 text-center"><span className="hud-tab !text-[2.2vh]" style={css({ "--hc": "#f5c95a" })}>The Arena · both buy {money(m.price)}</span></p>
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center gap-[2vw] px-[5vw] pt-[6vh]">
        <Fighter side="l" name={A.name} pids={A.pids} color="#8cff4a" total={m.va} at={1} lost={!aWon} max={max} move={kind.move} hit={HIT} />
        <motion.span className="font-display text-[18vh] leading-none" animate={{ opacity: [1, 1, 0] }} transition={{ delay: HIT - 0.15, duration: 0.2 }}><span className="chrome">V</span><span className="neon-text">S</span></motion.span>
        <Fighter side="r" name={B.name} pids={B.pids} color="#d9e1dc" total={m.vb} at={1} lost={aWon} max={max} move={kind.move} hit={HIT} />
      </div>
      {m.tie && <RollShow roll={{ kind: "coin", title: "Photo finish · coin flip", faces: [A.name, B.name], pick: aWon ? 0 : 1, good: true }} at={ARENA_ROLL} />}
      <Stamp text={kind.text} color="#f5c95a" at={HIT} sub={`${(aWon ? A : B).name} goes through${m.tie ? " · coin flip" : ""}`} />
    </Shake>
  );
}

function FateSeq({ s, sound, onDone }: { s: HuntState; sound: boolean; onDone: () => void }) {
  const r = s.reckon;
  const comes = r?.fate === "comes";
  const T = 3;
  useTimeline(onDone, 7200);
  useSound(sound, [[0, "heartbeat"], [1400, "heartbeat"], [600, "riser"], [T * 1000, comes ? "doom" : "choir"], ...(comes ? [[T * 1000 + 100, "slam"] as Cue] : [])]);
  if (!r?.fate) { onDone(); return null; }
  const color = comes ? "#ff5a5a" : "#8cff4a";
  return (
    <Shake at={T} strong={comes}>
      <Embers color="#ff5a5a" n={comes ? 30 : 10} />
      <Flash color={color} at={T} />
      <div className="absolute inset-0 grid place-items-center text-center">
        <motion.div animate={{ opacity: [1, 1, 0] }} transition={{ duration: T, times: [0, 0.9, 1] }} className="absolute">
          <p className="font-head text-[3.4vh] font-bold uppercase tracking-[0.3em] text-[#d9a0a0]">{s.ents[r.champ].name} is the last one standing</p>
          <p className="heartbeat font-display text-[14vh] leading-none text-[#f1ece4]">Does he come?</p>
          <svg viewBox="0 0 100 100" className="mx-auto mt-[2vh] size-[18vh] -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#2a1414" strokeWidth="6" />
            <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#ff5a5a" strokeWidth="6" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: s.cfg.chance / 100 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
          </svg>
          <p className="font-head text-[3vh] font-bold text-[#ff9a9a]">{s.cfg.chance}% chance</p>
        </motion.div>
        <motion.div initial={{ scale: 3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: T, type: "spring", stiffness: 300, damping: 16 }}>
          <p className="font-display leading-none" style={{ fontSize: "22vh", color, textShadow: `0 0 5vh ${color}, 0 1vh 0 #000` }}>{comes ? "He comes" : "Spared"}</p>
          <p className="mt-[1vh] font-head text-[3.4vh] font-bold uppercase tracking-[0.2em] text-[#f1ece4]">{comes ? "The Endboss awakens" : "The Cult sleeps tonight"}</p>
        </motion.div>
      </div>
    </Shake>
  );
}

function CallToast({ s, fight, sound, onDone }: { s: HuntState; fight: number | null; sound: boolean; onDone: () => void }) {
  const call = fight == null ? s.reckon?.call : s.fights[fight]?.call;
  useTimeline(onDone, 3600);
  useSound(sound, [[0, "whoosh"]]);
  if (!call) { onDone(); return null; }
  return (
    <motion.div className="pointer-events-none fixed bottom-[4vh] left-1/2 z-[220] -translate-x-1/2" initial={{ y: "20vh", opacity: 0 }} animate={{ y: 0, opacity: [0, 1, 1, 0] }} transition={{ duration: 3.4, times: [0, 0.1, 0.85, 1] }}>
      <div className="hud" style={css({ "--hc": "#8cff4a" })}>
        <div className="flex items-center gap-[1.4vh] px-[2vh] py-[1.2vh]">
          <SlotArt name={call.name} src={call.image} fluid="8vh" rounded="rounded-md" />
          <div><p className="font-head text-[2vh] font-bold uppercase tracking-[0.2em] text-neon">!call</p><p className="font-head text-[3.4vh] font-bold text-[#f1ece4]">{call.by} <span className="text-dim">plays</span> {call.name}</p></div>
        </div>
      </div>
    </motion.div>
  );
}

/** Plays queued Hunt events full screen over the stream HUD, on an adaptive soundtrack (score.ts). */
export function HuntStage({ s, sound = true, bed = true }: { s: HuntState; sound?: boolean; bed?: boolean }) {
  const { current, next } = useStageQueue(s);
  useEffect(() => (sound && bed ? startScore() : undefined), [sound, bed]);
  // the music follows the game: the phase, harder while a fight plays, silent once it's over
  const kind = current?.kind ?? null;
  const mood: Mood = kind === "duel" || kind === "endboss" || kind === "fate" ? "boss"
    : kind === "fight" || kind === "spawn" ? "fight"
    : kind === "arena" ? "arena"
    : s.phase === "done" ? "silent" : s.phase === "arena" ? "arena" : s.phase === "reckon" ? "boss" : "hunt";
  useEffect(() => { scoreMood(mood); }, [mood]);
  useEffect(() => { if (s.phase === "done") { if (!kind) scoreHit("end"); } else scoreResume(); }, [s.phase, kind]);
  if (!current) return null;
  if (current.kind === "call") return <CallToast key={current.seq} s={s} fight={current.fight} sound={sound} onDone={next} />;
  let seq: React.ReactNode = null;
  if (current.kind === "spawn") seq = <SpawnSeq key={current.seq} s={s} ev={current} sound={sound} onDone={next} />;
  else if (current.kind === "endboss") seq = <SpawnSeq key={current.seq} s={s} ev={current} sound={sound} onDone={next} endboss />;
  else if (current.kind === "fight") seq = <FightSeq key={current.seq} s={s} ev={current} sound={sound} onDone={next} />;
  else if (current.kind === "duel") seq = <FightSeq key={current.seq} s={s} ev={current} sound={sound} onDone={next} duel />;
  else if (current.kind === "arena") seq = <ArenaSeq key={current.seq} s={s} ev={current} sound={sound} onDone={next} />;
  else if (current.kind === "fate") seq = <FateSeq key={current.seq} s={s} sound={sound} onDone={next} />;
  if (!seq) { next(); return null; }
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#141a15,#020303_75%)]">
      <div aria-hidden className="hud-scan pointer-events-none absolute inset-0 z-[60] opacity-60" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[60] shadow-[inset_0_0_18vh_6vh_#000]" />
      {seq}
    </div>
  );
}

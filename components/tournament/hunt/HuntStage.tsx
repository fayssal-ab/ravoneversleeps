"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Skull } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import { AB, findMonster, tierById } from "@/lib/hunt/bestiary.js";
import { money, type HuntState, type Monster, type Reveal, type Verdict } from "@/lib/hunt/engine";
import { play, type Sfx } from "../fight/sfx";
import { Avatar, Emblem, Portrait, RANK, tierColor } from "./HuntBoard";

// OBS "game" sequences for the Hunt: every event the host triggers plays
// as a short cinematic in front of the stream HUD (spawn → intro, fight →
// counters + impact + stamp, Arena → K.O., fate → heartbeat, Endboss →
// cracks, final duel → Legend / Cult finale). Events queue, so a host who
// plays faster than the poll never skips one. Sizes are in vh so any OBS
// source size works.

type Look = { n: string; t?: string; l?: string; s?: string; ab?: string };
const look = (name: string) => findMonster(name) as Look | null;
const abName = (m: Monster) => { const d = look(m.name); return d?.ab ? (AB as unknown as Record<string, { name: string; boon?: boolean }>)[d.ab] : null; };
const css = (o: Record<string, string>) => o as React.CSSProperties;
const HEAVY = ["Warlord", "Overlord", "Endboss", "Secret"];

/** Queue of reveals newer than what this page has seen (nothing replays on load). */
export function useStageQueue(s: HuntState | null) {
  const [seen, setSeen] = useState<number | null>(null);
  const [queue, setQueue] = useState<Reveal[]>([]);
  const [snap, setSnap] = useState<HuntState | null>(null);
  if (s && s !== snap) {
    setSnap(s);
    const top = Math.max(0, ...(s.events ?? []).map((e) => e.seq), s.reveal?.seq ?? 0);
    if (seen == null) setSeen(top);
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
function useSfx(sound: boolean, cues: [number, Sfx][]) {
  const key = cues.map((c) => c.join(":")).join("|");
  useEffect(() => {
    if (!sound) return;
    const ids = cues.map(([at, name]) => setTimeout(() => play(name), at));
    return () => ids.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sound, key]);
}

function Embers({ color, n = 26 }: { color: string; n?: number }) {
  const dots = useMemo(() => Array.from({ length: n }, (_, i) => ({ left: `${(i * 37) % 100}%`, t: `${4 + (i % 5)}s`, d: `${(i % 9) * 0.35}s`, dx: `${((i % 7) - 3) * 3}vw` })), [n]);
  return <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">{dots.map((p, i) => <span key={i} className="ember" style={css({ left: p.left, "--t": p.t, "--d": p.d, "--dx": p.dx, "--ec": color })} />)}</div>;
}

function Flash({ color, at = 0 }: { color: string; at?: number }) {
  return <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-30" style={{ background: color }} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0] }} transition={{ delay: at, duration: 0.55, times: [0, 0.12, 1] }} />;
}

/** Shake wrapper: kicks at `at` seconds. */
function Shake({ at, strong = false, children }: { at: number; strong?: boolean; children: React.ReactNode }) {
  const k = strong ? 1.6 : 1;
  return (
    <motion.div className="relative size-full" animate={{ x: [0, -14 * k, 12 * k, -9 * k, 6 * k, -3 * k, 0], y: [0, 6 * k, -5 * k, 4 * k, -2 * k, 0, 0] }} transition={{ delay: at, duration: 0.55 }}>
      {children}
    </motion.div>
  );
}

function Count({ to, at, dur = 1.8, className = "" }: { to: number; at: number; dur?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (to === Infinity) { el.textContent = "$∞"; return; }
    const c = animate(0, to, { delay: at, duration: dur, ease: [0.15, 0.7, 0.2, 1], onUpdate: (v) => { el.textContent = money(v); } });
    return () => c.stop();
  }, [to, at, dur]);
  return <span ref={ref} className={`hud-num ${className}`}>$0</span>;
}

function Stamp({ text, color, at, sub }: { text: string; color: string; at: number; sub?: string }) {
  return (
    <motion.div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: at, duration: 0.01 }}>
      <motion.div initial={{ scale: 3.2, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ delay: at, type: "spring", stiffness: 420, damping: 18 }} className="text-center">
        <p className="font-display leading-none" style={{ fontSize: "17vh", color, textShadow: `0 0 4vh ${color}, 0 1vh 0 #000, 0 -0.3vh 0 #fff4` , WebkitTextStroke: "0.25vh #000" }}>{text}</p>
        {sub && <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: at + 0.45 }} className="mt-[1vh] font-head text-[3.4vh] font-bold uppercase tracking-[0.2em] text-[#f1ece4] [text-shadow:0_0.4vh_0_#000]">{sub}</motion.p>}
      </motion.div>
    </motion.div>
  );
}

/** Diagonal slash streaks over the loser. */
function Slash({ at, color }: { at: number; color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {[-18, 14, -4].map((r, i) => (
        <motion.span key={i} className="absolute left-[-10%] top-1/2 block h-[1.2vh] w-[120%] origin-left" style={{ rotate: r, background: `linear-gradient(90deg, transparent, ${color}, #fff, ${color}, transparent)`, boxShadow: `0 0 3vh ${color}` }}
          initial={{ scaleX: 0, opacity: 1 }} animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }} transition={{ delay: at + i * 0.08, duration: 0.5, times: [0, 0.4, 1] }} />
      ))}
    </div>
  );
}

// ── sequences ──

function SpawnSeq({ s, fight, sound, onDone, endboss = false }: { s: HuntState; fight: number | null; sound: boolean; onDone: () => void; endboss?: boolean }) {
  const f = fight != null ? s.fights[fight] : null;
  const m = endboss ? s.reckon?.boss ?? null : f?.monster ?? null;
  const target = endboss ? (s.reckon ? s.ents[s.reckon.champ] : null) : f ? s.ents[f.eid] : null;
  const tier = m?.secret ? "Secret" : m?.tier ?? "Minion";
  const c = m?.secret ? "#fff6d6" : tierColor(tier);
  const heavy = HEAVY.includes(tier);
  const T = endboss ? 2.2 : 1.4; // reveal moment
  useTimeline(onDone, endboss ? 9500 : heavy ? 8000 : 6800);
  useSfx(sound, [[0, "charge"], [T * 1000, heavy ? "blast" : "impact"], ...(endboss ? [[T * 1000 + 700, "blast"] as [number, Sfx]] : [])]);
  if (!m || !target) { onDone(); return null; }
  const def = look(m.name);
  const ab = abName(m);
  const head = m.secret ? "A light descends" : endboss ? "The Endboss awakens" : ((tierById(tier) as { head?: string } | null)?.head ?? "Something stirs…");
  return (
    <Shake at={T} strong={heavy}>
      <Embers color={c} />
      <Flash color={c} at={T} />
      {endboss && (
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-10 size-full">
          {["M50 0 L46 22 L55 38 L44 60 L52 100", "M0 40 L22 44 L35 36 L50 50", "M100 30 L78 38 L64 33 L50 50", "M50 50 L40 70 L18 78 L0 92", "M50 50 L66 72 L84 80 L100 96"].map((d, i) => (
            <motion.path key={i} d={d} fill="none" stroke="#ff5a5a" strokeWidth="0.35" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px #ff5a5a)" }}
              initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [0, 1, 0.5] }} transition={{ delay: T + 0.05 * i, duration: 0.45 }} />
          ))}
        </svg>
      )}
      {/* the CSS flicker runs on the inner span so it can't override the fade-out */}
      <motion.p className="absolute inset-x-0 top-[38%] z-0 text-center font-display text-[11vh] text-[#d9cfc4]" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], visibility: ["visible", "visible", "visible", "hidden"] }} transition={{ duration: T, times: [0, 0.2, 0.85, 1] }}>
        <span className="flicker">{endboss ? "The ground shakes…" : "Something stirs…"}</span>
      </motion.p>
      <motion.div className="absolute inset-0 grid grid-cols-[auto_1fr] items-center gap-[4vw] px-[6vw]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T, duration: 0.01 }}>
        <motion.div className="relative" initial={{ scale: 2.1, filter: "blur(14px)", opacity: 0 }} animate={{ scale: 1, filter: "blur(0px)", opacity: 1 }} transition={{ delay: T, type: "spring", stiffness: 160, damping: 15 }}>
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
                  {w < words.length - 1 && "\u00a0"}
                </span>
              );
            })}
          </h2>
          {def?.l && <motion.p className="mt-[1vh] text-[3vh] italic text-[#c9c0b6]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: T + 1.1 }}>“{def.l}”</motion.p>}
          <motion.p className="mt-[2vh] font-head text-[3.4vh] font-bold uppercase tracking-[0.12em] text-[#f1ece4]" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: T + 1.3 }}>
            hunts <span className="text-neon">{target.name}</span>
          </motion.p>
          <div className="mt-[2vh] grid max-w-[70vh] grid-cols-3 gap-[1vh]">
            {[["Bonus buy", money(m.price)], ["Slot", m.secret ? "∞" : m.curse === "blind" ? "Chat picks" : def?.s ?? ""], ["Bounty", m.bounty > 1 ? `×${m.bounty}` : "none"]].map(([l, v], i) => (
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

/** A player (team) or a monster on one side of a fight. */
function Fighter({ side, name, pids, sub, slot, portrait, tier, color, total, at, lost, max }: {
  side: "l" | "r"; name: string; pids?: number[]; sub?: string; slot?: { name: string; image: string | null } | null; portrait?: { name: string; tier: string };
  tier?: string; color: string; total: number; at: number; lost: boolean; max: number; hit: number;
}) {
  return (
    <motion.div className={`flex min-w-0 flex-col items-center gap-[1.4vh] text-center transition-[filter,opacity] duration-500 ${lost ? "opacity-50 grayscale" : ""}`}
      initial={{ x: side === "l" ? "-60vw" : "60vw" }} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.1 }}>
      <div className="hud hud-lg hunt-live live" style={css({ "--hc": color })}>
        <div className="grid size-[36vh] place-items-center p-[1vh]">
          {portrait ? <Portrait name={portrait.name} tier={portrait.tier} size="33vh" />
            : slot ? <SlotArt name={slot.name} src={slot.image} fluid="33vh" rounded="rounded-none" /> : <Avatar e={{ name, pids }} size="24vh" />}
        </div>
      </div>
      <div className="flex max-w-full items-center gap-[1vh]">
        {tier ? <Emblem tier={tier} size={46} /> : (slot || portrait) && <Avatar e={{ name, pids }} size="6vh" />}
        <p className="truncate font-head text-[5vh] font-bold leading-tight text-[#f1ece4]">{name}</p>
      </div>
      {sub && <p className="-mt-[1vh] max-w-full truncate text-[2.4vh] text-[#b8b0a6]">{sub}</p>}
      <Count to={total} at={at} className="text-[8vh] font-bold leading-none" />
      <div className="hud-bar w-[36vh] !h-[1.4vh]" style={css({ "--hc": color })}>
        <motion.i initial={{ width: "0%" }} animate={{ width: `${total === Infinity ? 100 : Math.max(4, (total / max) * 100)}%` }} transition={{ delay: at, duration: 1.8, ease: [0.15, 0.7, 0.2, 1] }} />
      </div>
    </motion.div>
  );
}

const OUT: Record<Verdict["out"], { text: string; color: string }> = {
  p: { text: "Slain", color: "#8cff4a" }, b: { text: "Reaped", color: "#b36bff" }, rematch: { text: "Rematch", color: "#ff8a3d" },
  revive: { text: "It rises", color: "#ff8a3d" }, prebuy: { text: "Second try", color: "#8cff4a" },
};

function FightSeq({ s, fight, sound, onDone, duel = false }: { s: HuntState; fight: number | null; sound: boolean; onDone: () => void; duel?: boolean }) {
  const f = !duel && fight != null ? s.fights[fight] : null;
  const m = duel ? s.reckon?.boss ?? null : f?.monster ?? null;
  const v = duel ? s.reckon?.verdict ?? null : f?.verdict ?? null;
  const e = duel ? (s.reckon ? s.ents[s.reckon.champ] : null) : f ? s.ents[f.eid] : null;
  const call = duel ? s.reckon?.call : f?.call;
  const HIT = 4.4;
  const finale = duel && s.result && v && v.out !== "rematch" && v.out !== "revive";
  useTimeline(onDone, finale ? 13500 : 8200);
  useSfx(sound, [[300, "whoosh"], [900, "clash"], [HIT * 1000 - 300, "charge"], [HIT * 1000, v?.out === "p" || v?.out === "prebuy" ? "impact" : "ko"], ...(finale ? [[HIT * 1000 + 3600, s.result!.type === "legend" ? "fanfare" : "blast"] as [number, Sfx]] : [])]);
  if (!m || !v || !e) { onDone(); return null; }
  const tier = m.secret ? "Secret" : m.tier;
  const c = m.secret ? "#fff6d6" : tierColor(tier);
  const max = Math.max(v.pf, v.bf === Infinity ? v.pf : v.bf, 1);
  const out = m.secret && v.out === "b" ? { text: "Judged", color: "#fff6d6" } : OUT[v.out];
  const playerLost = v.out === "b";
  const bountyUp = v.out === "p" && m.bounty > 1 && e.bounty === m.bounty;
  return (
    <Shake at={HIT} strong={playerLost || HEAVY.includes(tier)}>
      <Embers color={c} n={18} />
      <Flash color={out.color} at={HIT} />
      <p className="absolute inset-x-0 top-[3vh] z-10 text-center"><span className="hud-tab !text-[2.2vh]" style={css({ "--hc": c })}>{duel ? "The Reckoning · final duel" : `The Hunt · wave ${s.wave}`} · buy {money(m.price)}</span></p>
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center gap-[2vw] px-[5vw] pt-[6vh]">
        <div className="relative">
          <Fighter side="l" name={e.name} pids={e.pids} sub={call ? `plays ${call.name}` : undefined} slot={call ?? null} color="#8cff4a" total={v.pf} at={1.2} lost={playerLost} max={max} hit={HIT} />
          {playerLost && <Slash at={HIT} color={out.color} />}
        </div>
        <motion.span className="font-display text-[18vh] leading-none" initial={{ scale: 0, rotate: -30 }} animate={{ scale: [0, 1.4, 1], rotate: 0 }} transition={{ delay: 0.8, duration: 0.5 }}>
          <span className="chrome">V</span><span className="neon-text">S</span>
        </motion.span>
        <div className="relative">
          <Fighter side="r" name={m.name} sub={m.secret ? "∞" : `plays ${look(m.name)?.s ?? ""}`} portrait={{ name: m.name, tier }} tier={tier} color={c} total={v.bf} at={1.2} lost={v.out === "p"} max={max} hit={HIT} />
          {v.out === "p" && <Slash at={HIT} color={out.color} />}
        </div>
      </div>
      {/* ability triggers */}
      <div className="absolute inset-x-0 bottom-[5vh] z-30 flex flex-col items-center gap-[0.8vh]">
        {v.notes.filter((n) => !n.startsWith("Duo:")).slice(0, 3).map((n, i) => (
          <motion.p key={i} className="hud hud-sm" style={css({ "--hc": "#f5c95a" })} initial={{ scale: 0.6, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: [0, 1, 1, 0.85], y: 0 }} transition={{ delay: 3 + i * 0.45, duration: 0.4 }}>
            <span className="block px-[2vh] py-[0.8vh] font-head text-[2.6vh] font-bold text-gold">⚡ {n}</span>
          </motion.p>
        ))}
      </div>
      <Stamp text={out.text} color={out.color} at={HIT} sub={v.out === "p" ? `${e.name} survives` : v.out === "b" ? (duel ? "The Cult takes the crown" : `${e.name} is out`) : v.out === "rematch" ? "Both buy again" : v.out === "revive" ? `${m.name} buys again` : `${e.name} gets a free second try`} />
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
      <motion.div className="relative text-center" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: at + 0.3, type: "spring", stiffness: 180, damping: 14 }}>
        {win ? <Crown className="mx-auto size-[14vh] text-gold drop-shadow-[0_0_3vh_#f5c95a]" /> : <Skull className="mx-auto size-[14vh]" style={{ color }} />}
        <p className="font-head text-[3.4vh] font-bold uppercase tracking-[0.3em]" style={{ color }}>{R.type === "legend" ? "Endboss slain · Legend" : R.type === "champion" ? "Champion" : R.type === "judged" ? "Judged" : "The champion fell"}</p>
        <p className="font-display leading-none text-[#f6efe6] [text-shadow:0_1vh_0_#000]" style={{ fontSize: "16vh" }}>{win ? c?.name : "The Cult wins"}</p>
        {win ? <p className="mt-[2vh] font-head text-[4.4vh] font-bold text-[#f1ece4]">takes home <span className="hud-num text-gold">{money(R.payout)}</span></p>
          : R.payout > 0 && c ? <p className="mt-[2vh] font-head text-[3.6vh] text-[#d8d0c6]">{c.name} keeps <span className="hud-num text-gold">{money(R.payout)}</span></p> : null}
      </motion.div>
    </motion.div>
  );
}

function ArenaSeq({ s, round, fight, sound, onDone }: { s: HuntState; round: number; fight: number; sound: boolean; onDone: () => void }) {
  const m = s.arena?.rounds[round]?.ms[fight];
  const HIT = 3.8;
  useTimeline(onDone, 7200);
  useSfx(sound, [[300, "whoosh"], [800, "clash"], [HIT * 1000, "ko"]]);
  if (!m?.done || m.va == null || m.vb == null) { onDone(); return null; }
  const A = s.ents[m.a], B = s.ents[m.b];
  const max = Math.max(m.va, m.vb, 1);
  const aWon = m.winner === m.a;
  return (
    <Shake at={HIT}>
      <Embers color="#f5c95a" n={14} />
      <Flash color="#f5c95a" at={HIT} />
      <p className="absolute inset-x-0 top-[3vh] z-10 text-center"><span className="hud-tab !text-[2.2vh]" style={css({ "--hc": "#f5c95a" })}>The Arena · both buy {money(m.price)}</span></p>
      <div className="absolute inset-0 grid grid-cols-[1fr_auto_1fr] items-center gap-[2vw] px-[5vw] pt-[6vh]">
        <div className="relative"><Fighter side="l" name={A.name} pids={A.pids} color="#8cff4a" total={m.va} at={1} lost={!aWon} max={max} hit={HIT} />{!aWon && <Slash at={HIT} color="#f5c95a" />}</div>
        <span className="font-display text-[18vh] leading-none"><span className="chrome">V</span><span className="neon-text">S</span></span>
        <div className="relative"><Fighter side="r" name={B.name} pids={B.pids} color="#d9e1dc" total={m.vb} at={1} lost={aWon} max={max} hit={HIT} />{aWon && <Slash at={HIT} color="#f5c95a" />}</div>
      </div>
      <Stamp text="K.O." color="#f5c95a" at={HIT} sub={`${(aWon ? A : B).name} goes through${m.tie ? " · coin flip" : ""}`} />
    </Shake>
  );
}

function FateSeq({ s, sound, onDone }: { s: HuntState; sound: boolean; onDone: () => void }) {
  const r = s.reckon;
  const comes = r?.fate === "comes";
  const T = 3;
  useTimeline(onDone, 7000);
  useSfx(sound, [[0, "charge"], [1200, "charge"], [T * 1000, comes ? "blast" : "whoosh"]]);
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

function CallToast({ s, fight, onDone }: { s: HuntState; fight: number | null; onDone: () => void }) {
  const call = fight == null ? s.reckon?.call : s.fights[fight]?.call;
  useTimeline(onDone, 3600);
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

/** Plays queued Hunt events full screen over the stream HUD. */
export function HuntStage({ s, sound = true }: { s: HuntState; sound?: boolean }) {
  const reduce = useReducedMotion();
  const { current, next } = useStageQueue(s);
  if (!current) return null;
  if (current.kind === "call") return <CallToast key={current.seq} s={s} fight={current.fight} onDone={next} />;
  let seq: React.ReactNode = null;
  if (current.kind === "spawn") seq = <SpawnSeq key={current.seq} s={s} fight={current.fight} sound={sound} onDone={next} />;
  else if (current.kind === "endboss") seq = <SpawnSeq key={current.seq} s={s} fight={null} sound={sound} onDone={next} endboss />;
  else if (current.kind === "fight") seq = <FightSeq key={current.seq} s={s} fight={current.fight} sound={sound} onDone={next} />;
  else if (current.kind === "duel") seq = <FightSeq key={current.seq} s={s} fight={null} sound={sound} onDone={next} duel />;
  else if (current.kind === "arena" && current.round != null && current.fight != null) seq = <ArenaSeq key={current.seq} s={s} round={current.round} fight={current.fight} sound={sound} onDone={next} />;
  else if (current.kind === "fate") seq = <FateSeq key={current.seq} s={s} sound={sound} onDone={next} />;
  if (!seq) { next(); return null; }
  return (
    <div className={`fixed inset-0 z-[200] overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#141a15,#020303_75%)] ${reduce ? "" : ""}`}>
      <div aria-hidden className="hud-scan pointer-events-none absolute inset-0 z-[60] opacity-60" />
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[60] shadow-[inset_0_0_18vh_6vh_#000]" />
      {seq}
    </div>
  );
}

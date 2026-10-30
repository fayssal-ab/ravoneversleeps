"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Skull } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import type { BossRoll, KoMatch, KoParticipant, KoState } from "@/lib/knockout";
import { TIERS, tierOf } from "@/lib/reapingTiers";

// "The Reaping" presentation: the boss wheel, the boss card and the banner
// on an ambushed battle. The wheel only shows the server's result (the
// target is rolled server-side with crypto); it spins once per roll / re-spin.

/** 24 equal slices shared out by tier weight (≈ 45 / 30 / 18 / 7 %). */
const SLICES = (() => {
  const counts = [11, 7, 4, 2];
  const out: { tier: (typeof TIERS)[number]; from: number; to: number }[] = [];
  TIERS.forEach((t, i) => {
    const n = counts[i];
    const step = (t.max - t.min + 1) / n;
    for (let k = 0; k < n; k++) out.push({ tier: t, from: Math.round(t.min + k * step), to: Math.round(t.min + (k + 1) * step) - 1 });
  });
  return out;
})();
const SLICE_DEG = 360 / SLICES.length;

/** Angle (clockwise from the top) of a base target, inside its tier's arc. */
function angleOf(base: number): number {
  const i = SLICES.findIndex((s) => base >= s.from && base <= s.to);
  const idx = i < 0 ? 0 : i;
  const s = SLICES[idx];
  const within = s.to > s.from ? (base - s.from) / (s.to - s.from) : 0.5;
  return (idx + 0.1 + within * 0.8) * SLICE_DEG;
}

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
};

/** Weighted boss wheel; lands `target` (×2 in duo) under the pointer, then calls onDone. */
export function BossWheel({ target, duo, size, spinKey, animateSpin, onDone }: {
  target: number; duo: boolean; size: string; spinKey: string; animateSpin: boolean; onDone?: () => void;
}) {
  const reduce = useReducedMotion();
  const base = duo ? target / 2 : target;
  const rot = useMotionValue(0);
  const shake = useMotionValue(0);
  const tier = tierOf(TIERS.find((t) => base >= t.min && base <= t.max)?.key);
  const heavy = tier.key === "warlord" || tier.key === "overlord";

  useEffect(() => {
    const final = 360 * 6 - angleOf(base);
    if (!animateSpin || reduce) { rot.set(final); onDone?.(); return; }
    rot.set(0);
    let alive = true;
    animate(rot, final, { duration: 3.6, ease: [0.12, 0.7, 0.18, 1] }).then(() => {
      if (!alive) return;
      if (heavy) animate(shake, [0, -10, 9, -7, 6, -3, 0], { duration: 0.5 });
      onDone?.();
    });
    return () => { alive = false; };
    // spinKey: a re-spin replays the wheel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinKey, base, animateSpin, reduce]);

  return (
    <motion.div style={{ x: shake, width: size, height: size }} className="relative shrink-0">
      {/* pointer */}
      <svg viewBox="0 0 20 24" className="absolute left-1/2 top-0 z-10 w-[9%] -translate-x-1/2 -translate-y-[35%] drop-shadow-[0_2px_6px_rgb(0_0_0/0.8)]" aria-hidden>
        <path d="M10 24 0 4a10 6 0 0 1 20 0Z" fill="#e7ece9" />
      </svg>
      <motion.svg viewBox="0 0 100 100" style={{ rotate: rot }} className="size-full" role="img" aria-label={`Boss wheel: ${target}x`}>
        <circle cx="50" cy="50" r="49.5" fill="#050806" stroke="#2a3a2e" strokeWidth="1" />
        {SLICES.map((s, i) => {
          const a0 = i * SLICE_DEG, a1 = (i + 1) * SLICE_DEG;
          const [x0, y0] = polar(47, a0), [x1, y1] = polar(47, a1);
          const [lx, ly] = polar(37, a0 + SLICE_DEG / 2);
          return (
            <g key={i}>
              <path d={`M50 50 L${x0} ${y0} A47 47 0 0 1 ${x1} ${y1} Z`} fill={s.tier.color} fillOpacity={i % 2 ? 0.55 : 0.8} stroke="#050806" strokeWidth="0.5" />
              <text x={lx} y={ly} fill="#050806" fontSize="3.4" fontWeight="800" textAnchor="middle" dominantBaseline="middle"
                transform={`rotate(${a0 + SLICE_DEG / 2} ${lx} ${ly})`} className="font-mono">
                {duo ? s.from * 2 : s.from}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="13" fill="#050806" stroke="#e7ece9" strokeOpacity="0.4" strokeWidth="0.8" />
      </motion.svg>
      <Skull className="absolute left-1/2 top-1/2 size-[14%] -translate-x-1/2 -translate-y-1/2 text-[#e7ece9]" aria-hidden />
    </motion.div>
  );
}

/** The boss: tier, name, target, slot and intro line, glowing in the tier colour. */
export function BossCard({ boss, duo, big = false, className = "" }: { boss: KoParticipant; duo: boolean; big?: boolean; className?: string }) {
  const tier = tierOf(boss.boss_tier);
  const target = Number(boss.boss_target ?? 0);
  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 bg-[radial-gradient(ellipse_at_50%_0%,rgb(176_107_255/0.14),#07050a_70%)] text-center ${big ? "p-[3vh]" : "p-5 sm:p-6"} ${className}`}
      style={{ borderColor: tier.color, boxShadow: `0 0 60px -12px ${tier.color}` }}>
      <p className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-head font-bold uppercase tracking-[0.2em] ${big ? "text-[2.4vh]" : "text-[11px]"}`} style={{ borderColor: tier.color, color: tier.color }}>
        <Skull className={big ? "size-[2.6vh]" : "size-3.5"} /> Boss · {tier.label}
      </p>
      <p className={`mt-2 break-words font-display leading-[0.95] text-[#efe9f5] ${big ? "text-[7vh]" : "text-3xl sm:text-4xl"}`}>{boss.username}</p>
      <p className={`mt-3 font-head font-bold uppercase tracking-[0.25em] text-muted ${big ? "text-[2.4vh]" : "text-[11px]"}`}>Target{duo ? " · team total" : ""}</p>
      <p className={`font-mono font-bold leading-none ${big ? "text-[11vh]" : "text-6xl"}`} style={{ color: tier.color, textShadow: `0 0 30px ${tier.color}66` }}>{target}x</p>
      <div className={`mx-auto flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-black/40 text-left ${big ? "mt-[2vh] p-[1vh]" : "mt-4 p-2"}`}>
        <SlotArt name={boss.slot_name} src={boss.slot_image} size={44} fluid={big ? "8vh" : undefined} rounded="rounded-lg" />
        <span className="min-w-0">
          <span className={`block truncate font-semibold ${big ? "text-[2.8vh]" : "text-sm"}`}>{boss.slot_name}</span>
          <span className={`block truncate text-dim ${big ? "text-[2vh]" : "text-xs"}`}>{boss.slot_provider}</span>
        </span>
      </div>
      {boss.boss_line && <p className={`mt-3 italic text-muted ${big ? "text-[3vh]" : "text-sm"}`}>“{boss.boss_line}”</p>}
    </div>
  );
}

/** Wheel, then the card (side by side when there's room). */
export function BossReveal({ boss, roll, duo, big = false, animateSpin, onDone }: {
  boss: KoParticipant; roll: BossRoll; duo: boolean; big?: boolean; animateSpin: boolean; onDone?: () => void;
}) {
  const [landed, setLanded] = useState(!animateSpin);
  const key = `${roll.id}-${roll.spins}`;
  // a new spin (or a re-spin) hides the card until the wheel lands again
  const sig = animateSpin ? key : null;
  const [shownSig, setShownSig] = useState(sig);
  if (shownSig !== sig) { setShownSig(sig); if (animateSpin) setLanded(false); }
  const done = useCallback(() => { setLanded(true); onDone?.(); }, [onDone]);
  return (
    <div className={`flex flex-col items-center ${big ? "gap-[3vh] lg:flex-row lg:justify-center lg:gap-[4vw]" : "gap-6 md:flex-row md:justify-center"}`}>
      <div className="flex flex-col items-center gap-3">
        <p className={`font-head font-bold uppercase tracking-[0.25em] text-[#c9a6ff] ${big ? "text-[3vh]" : "text-xs"} ${landed ? "" : "animate-pulse"}`}>
          {landed ? `A boss rises · round ${roll.round}` : "The Cult spins the wheel…"}
        </p>
        <BossWheel target={Number(boss.boss_target ?? 0)} duo={duo} size={big ? "min(52vh, 30vw)" : "clamp(220px, 62vw, 320px)"} spinKey={key} animateSpin={animateSpin} onDone={done} />
      </div>
      <div className={`w-full transition duration-500 ${big ? "max-w-[40vw]" : "max-w-sm"} ${landed ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`} aria-hidden={!landed}>
        <BossCard boss={boss} duo={duo} big={big} />
      </div>
    </div>
  );
}

/** Strip over an ambushed battle: who ambushes and the target both sides must reach. */
export function BossBanner({ match, duo, big = false }: { match: KoMatch; duo: boolean; big?: boolean }) {
  const boss = match.boss;
  if (!boss) return null;
  const tier = tierOf(boss.boss_tier);
  const reaped = match.winner_id === boss.id;
  return (
    <div className={`mx-auto flex w-fit max-w-full items-center gap-3 rounded-2xl border-2 bg-[#0b0710]/90 ${big ? "mb-[2vh] px-[2vh] py-[1vh]" : "mb-4 px-3 py-2"}`}
      style={{ borderColor: tier.color, boxShadow: `0 0 30px -10px ${tier.color}` }}>
      <Skull className={`shrink-0 ${big ? "size-[5vh]" : "size-6"}`} style={{ color: tier.color }} />
      <span className="min-w-0 text-left">
        <span className={`block truncate font-head font-bold ${big ? "text-[3.6vh]" : "text-sm sm:text-base"}`}>
          {reaped ? <>REAPED · {boss.username} advances</> : <>Ambush · {boss.username}</>}
        </span>
        <span className={`block truncate text-muted ${big ? "text-[2.4vh]" : "text-xs"}`}>
          {tier.label} · reach <b className="font-mono" style={{ color: tier.color }}>{Number(boss.boss_target)}x</b>{duo ? " as a team" : ""} or get reaped
        </span>
      </span>
    </div>
  );
}

/** The boss that rose for the current stage and is still waiting for its battle. */
export function waitingBoss(state: KoState | null): { roll: BossRoll; boss: KoParticipant; key: string } | null {
  if (!state || state.tournament.mode !== "reaping") return null;
  const roll = [...state.bossRolls].reverse().find((r) => r.spawned && r.boss_id != null);
  if (!roll) return null;
  const m = state.matches.find((x) => x.id === roll.match_id);
  const boss = state.bosses.find((b) => b.id === roll.boss_id);
  if (!m || !boss || m.boss?.id !== boss.id || !["empty", "rolled", "ready"].includes(m.status)) return null;
  return { roll, boss, key: `${roll.id}-${roll.spins}` };
}

const FRESH_MS = 90_000;

/**
 * Which boss reveal to show and whether its wheel should spin: a roll seen
 * when the page opens only spins if it's fresh, later rolls and re-spins
 * always do (once).
 */
const noop = () => () => {};

export function useBossReveal(state: KoState | null) {
  const w = useMemo(() => waitingBoss(state), [state]);
  // decided in the browser only (the server render never spins), from the time the page opened
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [openedAt] = useState(() => Date.now());
  const [seen, setSeen] = useState<{ init: boolean; done: string[] }>({ init: false, done: [] });
  if (mounted && state && !seen.init) {
    const stale = w && openedAt - Date.parse(w.roll.at) > FRESH_MS && w.roll.spins === 1;
    setSeen({ init: true, done: stale ? [w.key] : [] });
  }
  const key = w?.key ?? null;
  const finish = useCallback(() => { if (key) setSeen((s) => (s.done.includes(key) ? s : { ...s, done: [...s.done, key] })); }, [key]);
  return { waiting: w, animateSpin: Boolean(w && seen.init && !seen.done.includes(w.key)), finish };
}

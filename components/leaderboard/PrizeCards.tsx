"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BoardRowView } from "./Board";

// Top 3 as award plaques hanging on cables from a rail: 2 · 1 · 3, the
// champion hung highest. Brushed-metal frame in the place colour, a dark glass
// panel with screws. The plaques sway slightly at rest and swing toward the
// pointer around their hanging point on soft springs, with a glare that
// follows it; hover (short intent delay), tap or focus flips the plaque on a
// spring to show the prize on its back.

const SLOTS = [
  { place: 2, suit: "♥", label: "Runner-up", drop: "3.5rem", color: "var(--color-silver)" },
  { place: 1, suit: "♠", label: "Champion", drop: "1.5rem", color: "var(--color-gold)" },
  { place: 3, suit: "♣", label: "Third", drop: "4.5rem", color: "var(--color-bronze)" },
] as const;

const SOFT = { stiffness: 70, damping: 16, mass: 0.8 };
const FLIP = { stiffness: 75, damping: 13, mass: 0.9 };

const points = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " pts";
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Screws() {
  return <>{["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((p) => <span key={p} aria-hidden className={`plaque-screw ${p}`} />)}</>;
}

function Plaque({ slot, row, prize, score, index }: {
  slot: (typeof SLOTS)[number]; row?: BoardRowView; prize?: string; score: (n: number) => string; index: number;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [10, -6]), SOFT);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), SOFT);
  const rz = useSpring(useTransform(px, [-0.5, 0.5], [2.5, -2.5]), SOFT);
  const gx = useTransform(px, [-0.5, 0.5], ["10%", "90%"]);
  const gy = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgb(255 255 255 / 0.14), transparent 50%)`;
  const champ = slot.place === 1;
  const [flipped, setFlipped] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flip = useSpring(0, FLIP);

  useEffect(() => { flip.set(flipped ? 180 : 0); }, [flipped, flip]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  return (
    <motion.li
      className="plaque-slot relative list-none [perspective:1100px]"
      style={{ paddingTop: slot.drop, "--c": slot.color } as CSSProperties}
      initial={reduce ? false : { opacity: 0, y: -80 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 55, damping: 11, delay: [0.15, 0, 0.3][index] }}
    >
      <div className="plaque-sway" style={{ animationDelay: `-${index * 2.1}s`, transformOrigin: `50% -${slot.drop}` }}>
        {/* cables up to the ceiling */}
        <span aria-hidden className="plaque-cable left-[22%]" style={{ height: slot.drop }} />
        <span aria-hidden className="plaque-cable right-[22%]" style={{ height: slot.drop }} />

        <motion.button
          type="button"
          aria-label={`${slot.label}: ${row ? row.name : "open spot"}${prize ? `, prize ${prize}` : ""}. Flip the plaque`}
          aria-pressed={flipped}
          className="plaque relative block w-full cursor-pointer rounded-[0.9rem] text-left outline-offset-4 [transform-style:preserve-3d] [will-change:transform]"
          style={reduce ? undefined : { rotateX: rx, rotateY: ry, rotateZ: rz }}
          onClick={() => setFlipped((f) => !f)}
          onPointerEnter={(e) => { if (e.pointerType === "mouse") hoverTimer.current = setTimeout(() => setFlipped(true), 140); }}
          onPointerMove={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width - 0.5);
            py.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={(e) => {
            clearTimeout(hoverTimer.current);
            px.set(0); py.set(0);
            if (e.pointerType === "mouse") setFlipped(false);
          }}
          onFocus={() => setFlipped(true)}
          onBlur={() => setFlipped(false)}
        >
          <motion.span className="relative block [transform-style:preserve-3d]" style={{ rotateY: reduce ? (flipped ? 180 : 0) : flip }}>
            {/* thickness, between the two faces */}
            {[-3, -1, 1, 3].map((z) => <span key={z} aria-hidden className="plaque-edge" style={{ transform: `translateZ(${z}px)` }} />)}

            {/* front: who */}
            <span className={`plaque-frame plaque-face ${champ ? "plaque-frame-champ" : ""}`} style={{ transform: "translateZ(4px)" }}>
              <span className="plaque-glass block">
                <Screws />
                <span className="relative flex h-full flex-col items-center px-2 pb-2 pt-4 text-center sm:px-5 sm:pb-4 sm:pt-7">
                  <span className="flex items-center gap-1.5 sm:gap-2.5">
                    <span className="plaque-rank font-display leading-none" style={{ fontSize: champ ? "clamp(2.2rem,6vw,4.4rem)" : "clamp(1.9rem,5vw,3.6rem)" }}>{String(slot.place).padStart(2, "0")}</span>
                    <span aria-hidden className="text-base text-[var(--c)] sm:text-3xl">{slot.suit}</span>
                  </span>
                  <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-muted sm:mt-2 sm:text-[10px] sm:tracking-[0.3em]">{slot.label}</span>
                  <span className="plaque-rule my-2 sm:my-3" aria-hidden />
                  <span className={`max-w-full truncate font-head font-bold ${champ ? "text-sm sm:text-3xl" : "text-xs sm:text-2xl"} ${row ? "text-text" : "text-dim"}`}>{row ? row.name : "Open spot"}</span>
                  <span className="mt-0.5 font-mono text-[10px] font-bold text-[var(--c)] sm:mt-1 sm:text-base">{score(row?.score ?? 0)}</span>
                  {/* nameplate: hint */}
                  <span className="plaque-plate mt-auto w-full text-center">
                    <span className="block text-[7px] font-bold uppercase tracking-[0.25em] text-black/60 sm:text-[9px]">Prize</span>
                    <span className="block font-head text-[10px] font-bold uppercase tracking-widest text-[#0b0f0c] sm:text-sm"><span className="sm:hidden">Tap</span><span className="hidden sm:inline">Hover</span> to reveal</span>
                  </span>
                </span>
                <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
              </span>
            </span>

            {/* back: the prize */}
            <span className={`plaque-frame plaque-face plaque-face-back ${champ ? "plaque-frame-champ" : ""}`} style={{ transform: "rotateY(180deg) translateZ(4px)" }}>
              <span className="plaque-glass plaque-glass-back block h-full">
                <Screws />
                <span className="relative flex h-full flex-col items-center justify-center px-2 pb-2 pt-4 text-center sm:px-5 sm:pb-4">
                  <span aria-hidden className="text-xl text-[var(--c)] sm:text-4xl">{slot.suit}</span>
                  <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.25em] text-muted sm:mt-2 sm:text-[10px] sm:tracking-[0.3em]">Prize</span>
                  <span className={`plaque-rank mt-1 block max-w-full font-display leading-none ${prize && prize.length > 9 ? "text-xl sm:text-4xl" : "text-3xl sm:text-6xl"}`}>{prize ?? "—"}</span>
                  <span className="plaque-rule my-2 sm:my-3" aria-hidden />
                  <span className="text-[9px] text-muted sm:text-xs">for {slot.label.toLowerCase()}</span>
                </span>
                <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
              </span>
            </span>
          </motion.span>
        </motion.button>
      </div>
    </motion.li>
  );
}

export function PrizeCards({ rows, prizes, scoreKind = "points" }: { rows: BoardRowView[]; prizes: Record<number, string>; scoreKind?: "points" | "wagered" }) {
  const score = scoreKind === "points" ? points : money;
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* the rail they hang from */}
      <div aria-hidden className="plaque-rail" />
      <ol className="relative grid grid-cols-3 items-start gap-2 px-1 sm:gap-6">
        {SLOTS.map((slot, i) => (
          <Plaque key={slot.place} slot={slot} index={i} row={rows.find((r) => r.rank === slot.place)} prize={prizes[slot.place]} score={score} />
        ))}
      </ol>
    </div>
  );
}

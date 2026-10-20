"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { CSSProperties } from "react";
import type { BoardRowView } from "./Board";

// Top 3 as award plaques hanging on cables from a rail: 2 · 1 · 3, the
// champion hung highest. Brushed-metal frame in the place colour, a dark glass
// panel with screws, and the prize on a metal nameplate (always visible).
// The plaques sway slightly at rest and swing toward the pointer around
// their hanging point on soft springs, with a glare that follows it.

const SLOTS = [
  { place: 2, suit: "♥", label: "Runner-up", drop: "3.5rem", color: "var(--color-silver)" },
  { place: 1, suit: "♠", label: "Champion", drop: "1.5rem", color: "var(--color-gold)" },
  { place: 3, suit: "♣", label: "Third", drop: "4.5rem", color: "var(--color-bronze)" },
] as const;

const SOFT = { stiffness: 70, damping: 16, mass: 0.8 };

const points = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " pts";
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

        <motion.div
          className="plaque relative [transform-style:preserve-3d] [will-change:transform]"
          style={reduce ? undefined : { rotateX: rx, rotateY: ry, rotateZ: rz }}
          onPointerMove={(e) => {
            if (reduce) return;
            const r = e.currentTarget.getBoundingClientRect();
            px.set((e.clientX - r.left) / r.width - 0.5);
            py.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => { px.set(0); py.set(0); }}
        >
          {/* thickness */}
          {[-5, -3.5, -2].map((z) => <span key={z} aria-hidden className="plaque-edge" style={{ transform: `translateZ(${z}px)` }} />)}

          <div className={`plaque-frame ${champ ? "plaque-frame-champ" : ""}`}>
            <div className="plaque-glass">
              {/* screws */}
              {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((p) => <span key={p} aria-hidden className={`plaque-screw ${p}`} />)}

              <div className="relative flex h-full flex-col items-center px-2 pb-2 pt-4 text-center sm:px-5 sm:pb-4 sm:pt-7">
                <span className="flex items-center gap-1.5 sm:gap-2.5">
                  <span className="plaque-rank font-display leading-none" style={{ fontSize: champ ? "clamp(2.2rem,6vw,4.4rem)" : "clamp(1.9rem,5vw,3.6rem)" }}>{String(slot.place).padStart(2, "0")}</span>
                  <span aria-hidden className="text-base text-[var(--c)] sm:text-3xl">{slot.suit}</span>
                </span>
                <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-muted sm:mt-2 sm:text-[10px] sm:tracking-[0.3em]">{slot.label}</span>
                <span className="plaque-rule my-2 sm:my-3" aria-hidden />
                <span className={`max-w-full truncate font-head font-bold ${champ ? "text-sm sm:text-3xl" : "text-xs sm:text-2xl"} ${row ? "text-text" : "text-dim"}`}>{row ? row.name : "Open spot"}</span>
                <span className="mt-0.5 font-mono text-[10px] font-bold text-[var(--c)] sm:mt-1 sm:text-base">{score(row?.score ?? 0)}</span>

                {/* nameplate */}
                <span className="plaque-plate mt-auto w-full">
                  <span className="block text-[7px] font-bold uppercase tracking-[0.25em] text-black/60 sm:text-[9px]">Prize</span>
                  <span className={`block truncate font-head font-bold text-[#0b0f0c] ${prize && prize.length > 9 ? "text-[10px] sm:text-base" : "text-sm sm:text-2xl"}`}>{prize ?? "—"}</span>
                </span>
              </div>
              <motion.span aria-hidden className="pointer-events-none absolute inset-0" style={{ background: glare }} />
            </div>
          </div>
        </motion.div>
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

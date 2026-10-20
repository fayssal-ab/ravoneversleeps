"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useState } from "react";
import type { BoardRowView } from "./Board";

// Top 3 as playing cards laid on a table: 2 · 1 · 3, the champion raised.
// The card follows the pointer in 3D; hover, focus or tap flips it to show
// the prize on its back. Transforms only (GPU), long eased transitions.

const SLOTS = [
  { place: 2, suit: "♥", label: "Runner-up", tilt: -6, lift: 28, color: "var(--color-silver)" },
  { place: 1, suit: "♠", label: "Champion", tilt: 0, lift: 0, color: "var(--color-gold)" },
  { place: 3, suit: "♣", label: "Third", tilt: 6, lift: 28, color: "var(--color-bronze)" },
] as const;

const points = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " pts";
const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Corner({ place, suit, color, flip = false }: { place: number; suit: string; color: string; flip?: boolean }) {
  return (
    <span className={`absolute flex flex-col items-center leading-none ${flip ? "bottom-2 right-2 rotate-180 sm:bottom-3 sm:right-3" : "left-2 top-2 sm:left-3 sm:top-3"}`} style={{ color }}>
      <span className="font-display text-lg sm:text-3xl">{place}</span>
      <span className="text-xs sm:text-lg">{suit}</span>
    </span>
  );
}

function Card({ slot, row, prize, score, index }: {
  slot: (typeof SLOTS)[number]; row?: BoardRowView; prize?: string; score: (n: number) => string; index: number;
}) {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const px = useMotionValue(0), py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), { stiffness: 140, damping: 18 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-10, 10]), { stiffness: 140, damping: 18 });
  const champ = slot.place === 1;

  return (
    <motion.li
      className="relative list-none [perspective:1100px]"
      style={{ marginTop: slot.lift }}
      initial={reduce ? false : { opacity: 0, y: 60, rotate: slot.tilt * 2 }}
      whileInView={{ opacity: 1, y: 0, rotate: slot.tilt }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.9, delay: [0.15, 0, 0.3][index], ease: [0.2, 0.7, 0.2, 1] }}
    >
      <motion.button
        type="button"
        aria-label={`${slot.label}: ${row ? row.name : "open spot"}${prize ? `, prize ${prize}` : ""}. Flip the card`}
        aria-pressed={flipped}
        onClick={() => setFlipped((f) => !f)}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setFlipped(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setFlipped(false); px.set(0); py.set(0); }}
        onPointerMove={(e) => {
          if (reduce) return;
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width - 0.5);
          py.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onFocus={() => setFlipped(true)}
        onBlur={() => setFlipped(false)}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry }}
        className={`relative block aspect-[5/7] w-full cursor-pointer rounded-2xl outline-offset-4 [transform-style:preserve-3d] ${champ ? "drop-shadow-[0_30px_40px_rgb(0_0_0/0.7)]" : "drop-shadow-[0_22px_30px_rgb(0_0_0/0.6)]"}`}
      >
        <span
          className="absolute inset-0 [transform-style:preserve-3d]"
          style={{ transform: `rotateY(${flipped ? 180 : 0}deg)`, transition: reduce ? "none" : "transform 0.75s cubic-bezier(0.2, 0.7, 0.2, 1)" }}
        >
          {/* front: who */}
          <span className="absolute inset-0 overflow-hidden rounded-2xl border bg-[linear-gradient(160deg,#121c15,#0a100c_60%)] [backface-visibility:hidden]" style={{ borderColor: `color-mix(in oklab, ${slot.color} 45%, transparent)` }}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: slot.color }} />
            <Corner place={slot.place} suit={slot.suit} color={slot.color} />
            <Corner place={slot.place} suit={slot.suit} color={slot.color} flip />
            <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[9rem] leading-none opacity-[0.06] sm:text-[11rem]" style={{ color: slot.color }}>{slot.suit}</span>
            <span className="relative flex size-full flex-col items-center justify-center gap-1 px-5 text-center sm:px-6">
              <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-muted sm:text-[10px] sm:tracking-[0.25em]">{slot.label}</span>
              <span className={`max-w-full truncate font-head font-bold ${champ ? "text-sm sm:text-3xl" : "text-xs sm:text-2xl"} ${row ? "text-text" : "text-dim"}`}>{row ? row.name : "Open spot"}</span>
              <span className="mt-3 hidden text-[10px] font-semibold uppercase tracking-[0.25em] text-dim sm:block">Points</span>
              <span className="mt-1 font-mono text-[10px] font-bold leading-tight sm:mt-0 sm:text-lg" style={{ color: slot.color }}>{score(row?.score ?? 0)}</span>
            </span>
          </span>
          {/* back: the prize */}
          <span className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl border bg-[radial-gradient(ellipse_at_50%_40%,#17251b,#070b08_75%)] p-3 [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ borderColor: slot.color }}>
            <span className="absolute inset-2 rounded-xl border border-white/[0.06]" />
            <span className="relative text-center">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-muted">Prize</span>
              <span className={`mt-1 block font-display leading-none ${prize && prize.length > 9 ? "text-2xl sm:text-4xl" : "text-4xl sm:text-6xl"}`} style={{ color: slot.color }}>{prize ?? "—"}</span>
              <span className="mt-2 block text-xs text-muted">for {slot.label.toLowerCase()}</span>
            </span>
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
}

export function PrizeCards({ rows, prizes, scoreKind = "points" }: { rows: BoardRowView[]; prizes: Record<number, string>; scoreKind?: "points" | "wagered" }) {
  const score = scoreKind === "points" ? points : money;
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* table */}
      <div aria-hidden className="pointer-events-none absolute inset-x-[-10%] bottom-[-8%] top-[35%] rounded-[50%] border-t border-neon/15 bg-[radial-gradient(ellipse_at_50%_0%,rgb(141_255_74/0.07),transparent_65%)]" />
      <ol className="relative grid grid-cols-3 items-start gap-2 px-1 sm:gap-6">
        {SLOTS.map((slot, i) => (
          <Card key={slot.place} slot={slot} index={i} row={rows.find((r) => r.rank === slot.place)} prize={prizes[slot.place]} score={score} />
        ))}
      </ol>
      <p className="relative mt-8 text-center text-xs text-dim">Hover, tap or focus a card to see the prize.</p>
    </div>
  );
}

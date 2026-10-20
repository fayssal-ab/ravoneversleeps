"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { CSSProperties } from "react";

// Home top 3 as a real 3D podium: three solid blocks (front, top, sides and
// back are CSS faces with depth) standing 2 · 1 · 3, each with a spinning
// suit coin floating over it. The whole stage turns with the pointer.

export type PodiumEntry = { name: string | null; score: string | null; prize: string | null };

const SPOTS = [
  { place: 2, idx: 1, suit: "♥", label: "2nd", color: "var(--color-silver)", h: "h-[13rem] sm:h-[15.5rem]" },
  { place: 1, idx: 0, suit: "♠", label: "1st", color: "var(--color-gold)", h: "h-[15.5rem] sm:h-[19rem]" },
  { place: 3, idx: 2, suit: "♣", label: "3rd", color: "var(--color-bronze)", h: "h-[11.5rem] sm:h-[13.5rem]" },
] as const;

function Coin({ suit, color }: { suit: string; color: string }) {
  return (
    <span className="podium-coin" style={{ "--c": color } as CSSProperties} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => <i key={i} className="podium-coin-edge" style={{ transform: `translateZ(${i - 2.5}px)` }} />)}
      <i className="podium-coin-face" style={{ transform: "translateZ(3px)" }}>{suit}</i>
      <i className="podium-coin-face" style={{ transform: "rotateY(180deg) translateZ(3px)" }}>{suit}</i>
    </span>
  );
}

export function Podium3D({ entries }: { entries: PodiumEntry[] }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), { stiffness: 90, damping: 16 });
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [-4, -16]), { stiffness: 90, damping: 16 });

  return (
    <div
      className="podium-scene relative pt-16 pb-6 sm:pt-20"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => { px.set(0); py.set(0); }}
    >
      <motion.div className="podium-stage" style={reduce ? { rotateX: -10 } : { rotateX: rx, rotateY: ry }}>
      <span aria-hidden className="podium-floor" />
      <ol className="podium-row grid grid-cols-3 items-end gap-3 sm:gap-5">
        {SPOTS.map((s) => {
          const e = entries[s.idx];
          const champ = s.place === 1;
          return (
            <li key={s.place} className={`podium-block ${s.h}`} style={{ "--c": s.color } as CSSProperties}>
              <span className="podium-face podium-back" aria-hidden />
              <span className="podium-face podium-left" aria-hidden />
              <span className="podium-face podium-right" aria-hidden />
              <span className="podium-face podium-top" aria-hidden />
              <span className="podium-coin-wrap" aria-hidden><Coin suit={s.suit} color={s.color} /></span>

              {/* front: who and what */}
              <span className="podium-face podium-front flex flex-col items-center px-2 pt-4 pb-3 text-center sm:px-4 sm:pt-5 sm:pb-4">
                <span className="podium-rank font-display leading-none" style={{ fontSize: champ ? "clamp(2.6rem,7vw,4.4rem)" : "clamp(2.1rem,5.6vw,3.5rem)" }}>{s.label}</span>
                <span className={`mt-2 block w-full truncate font-head font-bold ${champ ? "text-sm sm:text-xl" : "text-xs sm:text-lg"} ${e?.name ? "text-text" : "text-dim"}`}>{e?.name ?? "Open spot"}</span>
                <span className="block w-full truncate font-mono text-[10px] text-muted sm:text-xs">{e?.score ?? "—"}</span>
                {e?.prize && (
                  <span className="podium-plate mt-auto w-full">
                    <span className="block text-[8px] font-semibold uppercase tracking-[0.2em] text-dim sm:text-[10px]">Prize</span>
                    <span className={`block truncate font-head font-bold ${e.prize.length > 9 ? "text-[11px] sm:text-sm" : "text-sm sm:text-xl"}`} style={{ color: s.color }}>{e.prize}</span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      </motion.div>
    </div>
  );
}

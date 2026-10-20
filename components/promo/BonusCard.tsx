"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { CSSProperties } from "react";
import { QzinoLogo } from "@/components/ui/QzinoLogo";

// The $50 welcome-bonus card: neon rays turning behind the amount, the chrome
// spike art breathing, card suits rising through it, a running neon border
// and a sheen. Tilts in 3D with the pointer; the amount floats above the card.

const SUITS = [
  { s: "♠", left: "8%", size: 26, dur: 9, delay: 0 },
  { s: "♥", left: "24%", size: 18, dur: 11, delay: 4 },
  { s: "♦", left: "46%", size: 22, dur: 8, delay: 2 },
  { s: "♣", left: "66%", size: 30, dur: 12, delay: 6 },
  { s: "♠", left: "84%", size: 20, dur: 10, delay: 1 },
  { s: "♦", left: "34%", size: 14, dur: 7, delay: 5 },
  { s: "♥", left: "74%", size: 16, dur: 9, delay: 7 },
];

export function BonusCard({ href, code }: { href: string; code: string }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), { stiffness: 150, damping: 15 });
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), { stiffness: 150, damping: 15 });

  return (
    <div className="mx-auto w-full max-w-xs [perspective:1000px]">
      <motion.a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`Claim a $50 bonus on Qzino with code ${code}`}
        className="bonus-card group relative block aspect-[4/5] w-full rounded-3xl"
        style={reduce ? undefined : { rotateX: rx, rotateY: ry }}
        onPointerMove={(e) => {
          if (reduce) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          px.set(x - 0.5); py.set(y - 0.5);
          e.currentTarget.style.setProperty("--gx", `${x * 100}%`);
          e.currentTarget.style.setProperty("--gy", `${y * 100}%`);
        }}
        onPointerLeave={() => { px.set(0); py.set(0); }}
      >
        {/* running neon border */}
        <span aria-hidden className="bonus-border" />
        <span aria-hidden className="absolute inset-[2px] overflow-hidden rounded-[calc(1.5rem-2px)] bg-[#020403]">
          <span className="bonus-rays" />
          <span className="bonus-spikes" />
          <span className="bonus-glow" />
          {SUITS.map((s, i) => (
            <span key={i} className="bonus-suit" style={{ left: s.left, fontSize: s.size, animationDuration: `${s.dur}s`, animationDelay: `-${s.delay}s` } as CSSProperties}>{s.s}</span>
          ))}
          <span className="bonus-scan" />
          <span className="bonus-sheen" />
          <span className="bonus-pointer" />
        </span>

        <span className="relative flex size-full flex-col items-center justify-between p-6 text-center [transform-style:preserve-3d]">
          <span className="[transform:translateZ(30px)]"><QzinoLogo className="h-7 w-auto" /></span>
          <span className="block [transform:translateZ(70px)]">
            <span className="block font-head text-xs font-bold uppercase tracking-[0.3em] text-neon [text-shadow:0_0_12px_rgb(141_255_74/0.7)]">Welcome bonus</span>
            <span className="bonus-amount chrome mt-1 block font-display text-[6.5rem] leading-none">$50</span>
          </span>
          <span className="block [transform:translateZ(40px)]">
            <span className="block text-[0.65rem] uppercase tracking-[0.25em] text-text/80">Promo code</span>
            <span className="mt-1 block rounded-xl border border-neon/60 bg-black/70 px-4 py-2 font-mono text-2xl font-bold tracking-[0.2em] text-neon shadow-[0_0_24px_rgb(141_255_74/0.25)] backdrop-blur-sm">{code}</span>
            <span className="mt-3 block text-[0.65rem] text-text/60">18+ · terms apply on Qzino</span>
          </span>
        </span>
      </motion.a>
    </div>
  );
}

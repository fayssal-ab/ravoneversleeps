"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, type CSSProperties } from "react";

// Real 3D objects floating over the hero art: CSS cubes (dice with green
// pips) and poker chips with thickness. They turn slowly (CSS keyframes, GPU
// only), bob up and down, and drift a little with the pointer for depth.

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const FACES: [number, string][] = [
  [1, "rotateY(0deg)"], [6, "rotateY(180deg)"], [2, "rotateY(90deg)"], [5, "rotateY(-90deg)"], [3, "rotateX(90deg)"], [4, "rotateX(-90deg)"],
];

function Die({ size, spin, delay }: { size: number; spin: number; delay: number }) {
  return (
    <div className="die3d" style={{ width: size, height: size, "--z": `${size / 2}px`, animationDuration: `${spin}s`, animationDelay: `-${delay}s` } as CSSProperties}>
      {FACES.map(([n, t]) => (
        <span key={n} className="die3d-face" style={{ transform: `${t} translateZ(var(--z))` }}>
          {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n].includes(i) ? "pip" : undefined} />)}
        </span>
      ))}
    </div>
  );
}

function Chip({ size, spin, delay, tone }: { size: number; spin: number; delay: number; tone: "green" | "black" }) {
  return (
    <div className={`chip3d chip3d-${tone}`} style={{ width: size, height: size, animationDuration: `${spin}s`, animationDelay: `-${delay}s` } as CSSProperties}>
      {/* thickness: stacked layers */}
      {Array.from({ length: 7 }, (_, i) => <span key={i} className="chip3d-layer" style={{ transform: `translateZ(${(i - 3) * (size / 70)}px)` }} />)}
      <span className="chip3d-face" style={{ transform: `translateZ(${(size / 70) * 3.5}px)` }} />
      <span className="chip3d-face" style={{ transform: `rotateY(180deg) translateZ(${(size / 70) * 3.5}px)` }} />
    </div>
  );
}

type Item = { kind: "die" | "chip"; tone?: "green" | "black"; size: number; left: string; top: string; spin: number; delay: number; depth: number; bob: number; mobile?: boolean };

const ITEMS: Item[] = [
  { kind: "die", size: 64, left: "9%", top: "20%", spin: 18, delay: 2, depth: 26, bob: 4.5, mobile: true },
  { kind: "chip", tone: "green", size: 88, left: "17%", top: "62%", spin: 14, delay: 5, depth: 40, bob: 6 },
  { kind: "chip", tone: "black", size: 56, left: "4%", top: "44%", spin: 11, delay: 1, depth: 18, bob: 5.2 },
  { kind: "die", size: 42, left: "28%", top: "12%", spin: 13, delay: 7, depth: 14, bob: 3.8 },
  { kind: "chip", tone: "green", size: 46, left: "80%", top: "10%", spin: 12, delay: 3, depth: 22, bob: 4.2, mobile: true },
];

function Floating({ it, mx, my }: { it: Item; mx: MotionValue<number>; my: MotionValue<number> }) {
  const reduce = useReducedMotion();
  const x = useTransform(mx, [-1, 1], [-it.depth, it.depth]);
  const y = useTransform(my, [-1, 1], [-it.depth * 0.6, it.depth * 0.6]);
  return (
    <motion.div className={`absolute [perspective:700px] ${it.mobile ? "" : "max-sm:hidden"}`} style={{ left: it.left, top: it.top, x, y }}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -14, 0] }}
        transition={{ duration: it.bob, repeat: Infinity, ease: "easeInOut", delay: it.delay / 3 }}
        className="drop-shadow-[0_18px_22px_rgb(0_0_0/0.55)]"
      >
        {it.kind === "die" ? <Die size={it.size} spin={it.spin} delay={it.delay} /> : <Chip size={it.size} spin={it.spin} delay={it.delay} tone={it.tone ?? "green"} />}
      </motion.div>
    </motion.div>
  );
}

export function Float3D() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const mx = useSpring(px, { stiffness: 40, damping: 16 });
  const my = useSpring(py, { stiffness: 40, damping: 16 });
  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => { px.set((e.clientX / window.innerWidth) * 2 - 1); py.set((e.clientY / window.innerHeight) * 2 - 1); };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, px, py]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {ITEMS.map((it, i) => <Floating key={i} it={it} mx={mx} my={my} />)}
    </div>
  );
}

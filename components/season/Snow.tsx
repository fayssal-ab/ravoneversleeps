"use client";

import { motion, useReducedMotion } from "motion/react";

// Light snowfall behind the page: a couple dozen small silver flakes, slow,
// never in the way. Fixed values so server and client render the same.
const FLAKES = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  size: 2 + ((i * 7) % 4),
  dur: 14 + ((i * 5) % 12),
  delay: -((i * 3.7) % 20),
  sway: ((i % 2 ? 1 : -1) * (10 + ((i * 13) % 30))),
  op: 0.25 + ((i * 11) % 40) / 100,
}));

export function Snow() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[-5] overflow-hidden" aria-hidden>
      {FLAKES.map((f, i) => (
        <motion.span
          key={i}
          className="absolute -top-4 block rounded-full bg-silver"
          style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.op, boxShadow: "0 0 6px rgb(233 245 236 / 0.6)" }}
          animate={{ y: ["0vh", "110vh"], x: [0, f.sway, 0, -f.sway / 2] }}
          transition={{
            y: { duration: f.dur, repeat: Infinity, ease: "linear", delay: f.delay },
            x: { duration: f.dur / 2, repeat: Infinity, ease: "easeInOut", delay: f.delay },
          }}
        />
      ))}
    </div>
  );
}

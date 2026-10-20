"use client";

import Image from "next/image";
import { motion, useReducedMotion, type MotionValue } from "motion/react";

// Hero background: Ravo's looping card-suit video (public/media/hero/bg-loop.*,
// made seamless with a crossfade). On phones, where only the dark middle of
// the loop shows, suit sprites lifted from the old wallpaper flip at the edges.

const SUITS = [
  { k: "heartL", left: 4.38, top: 29.39, width: 8.71, height: 19.79, dur: 5.5, delay: 0 },
  { k: "diamond", left: 12.17, top: 68.02, width: 7.96, height: 22.47, dur: 4.2, delay: 1.1 },
  { k: "club", left: 26.71, top: 78.57, width: 8.71, height: 18.84, dur: 6.4, delay: 0.5 },
  { k: "spadeT", left: 62.13, top: 9.68, width: 8.13, height: 17.2, dur: 5, delay: 1.8 },
  { k: "heartR", left: 82.46, top: 45.46, width: 8.71, height: 20.92, dur: 6, delay: 0.8 },
  { k: "spadeB", left: 79.67, top: 71.13, width: 9.79, height: 22.3, dur: 4.6, delay: 2.4 },
] as const;

const MOBILE = [
  { k: "spadeT", left: "-5%", top: "13%", size: "6.5rem" },
  { k: "heartR", left: "78%", top: "8%", size: "6rem" },
  { k: "diamond", left: "84%", top: "50%", size: "6rem" },
  { k: "club", left: "-6%", top: "58%", size: "6.5rem" },
] as const;

type SuitDef = (typeof SUITS)[number];

function Suit({ s, reduce, style }: { s: SuitDef; reduce: boolean; style: React.CSSProperties }) {
  return (
    <motion.div
      aria-hidden
      className="absolute"
      style={style}
      animate={reduce ? undefined : { y: ["0%", "-6%", "0%"] }}
      transition={{ duration: s.dur * 0.9, repeat: Infinity, ease: "easeInOut", delay: s.delay }}
    >
      <motion.div
        className="relative size-full drop-shadow-[0_0_18px_rgb(141_255_74/0.45)]"
        animate={reduce ? undefined : { rotateY: [0, 360] }}
        transition={{ duration: s.dur, repeat: Infinity, ease: [0.65, 0, 0.35, 1], repeatDelay: 1.2, delay: s.delay }}
      >
        <Image src={`/media/hero/${s.k}.webp`} alt="" fill sizes="220px" className="object-contain mix-blend-screen" />
      </motion.div>
    </motion.div>
  );
}

export function HeroBackdrop({ y }: { y: MotionValue<string> }) {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#040a05]">
      {/* Ravo's animated card-suit loop (seamless 5 s, muted); poster while it
          loads and for reduced motion */}
      <motion.div className="absolute inset-0" style={{ y }}>
        <Image src="/media/hero/bg-loop.webp" alt="" fill priority sizes="100vw" className="object-cover" />
        {!reduce && (
          <video
            autoPlay muted loop playsInline preload="auto" poster="/media/hero/bg-loop.webp" aria-hidden
            className="absolute inset-0 size-full object-cover"
          >
            <source src="/media/hero/bg-loop.webm" type="video/webm" />
            <source src="/media/hero/bg-loop.mp4" type="video/mp4" />
          </video>
        )}
      </motion.div>
      {/* phones only see the dark middle of the loop: a few suits at the edges */}
      <div className="absolute inset-0 [perspective:700px] sm:hidden">
        {MOBILE.map((m) => {
          const s = SUITS.find((x) => x.k === m.k)!;
          return <Suit key={m.k} s={s} reduce={!!reduce} style={{ left: m.left, top: m.top, width: m.size, height: m.size }} />;
        })}
      </div>
      {/* keep the copy readable in the middle */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgb(4_10_5/0.5),transparent_60%)]" />
    </div>
  );
}

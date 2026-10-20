"use client";

import Image from "next/image";
import { motion, useReducedMotion, type MotionValue } from "motion/react";

// Hero background: one sharp still (public/media/hero/bg-3d.webp, 3D dice,
// cards and green chips under a soft light beam) with a very slow zoom so it
// never feels frozen. Dark centre keeps the reels and copy readable.
export function HeroBackdrop({ y }: { y: MotionValue<string> }) {
  const reduce = useReducedMotion();
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050806]">
      <motion.div className="absolute inset-0" style={{ y }}>
        {/* the art sits on the right, fading in from the dark left, so the
            dice/cards/chips frame the reels instead of hiding behind them */}
        <motion.div
          className="absolute inset-y-0 right-0 w-[150vw] opacity-45 hero-art-mask sm:inset-y-auto sm:bottom-[4%] sm:right-[-6%] sm:aspect-video sm:w-[min(88vw,1250px)] sm:opacity-100"
          animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image src="/media/hero/bg-3d.webp" alt="" fill priority quality={90} sizes="(min-width: 640px) 80vw, 150vw" className="object-cover object-right sm:object-contain" />
        </motion.div>
        {/* the light beam continues across the left */}
        <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(141_255_74/0.06)_0%,transparent_35%)]" />
      </motion.div>
      {/* calm the centre for the reels + copy, fade into the page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_55%_at_50%_50%,rgb(5_8_6/0.55),transparent_75%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--color-bg)]" />
    </div>
  );
}

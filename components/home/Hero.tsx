"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Paw } from "@/components/decor/shapes";
import { useSiteReady } from "@/components/shell/siteReady";
import { HeroBackdrop } from "./HeroBackdrop";
import { SlotReels } from "./SlotReels";

const TITLE = "NEVERSLEEPS".split("");
/** Seconds after the preloader: the reels have landed on RAVO by then. */
const CLIMB_AT = 2.55;

// Toastyy-style mascot band in RAVO's world: the dancing pug over a chrome
// spike wallpaper with spinning card suits, the name in metal chrome, and the
// band dripping slime into the page. Just RAVO up top, nothing else.
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const ready = useSiteReady();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "25%"]);
  const pugY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]);

  return (
    <section
      ref={ref}
      className="relative isolate -mt-[calc(var(--nav-h)+1.5rem)] pt-[calc(var(--nav-h)+2rem)]"
    >
      {/* band */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <HeroBackdrop y={bgY} />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 text-center sm:px-6 sm:pb-20">
        {/* mascot stage */}
        <motion.div style={{ y: pugY }} className="relative h-56 w-56 sm:h-72 sm:w-72">
          <motion.div aria-hidden className="absolute inset-6 rounded-full bg-neon/30 blur-3xl" animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 3.5, repeat: Infinity }} />
          {/* the pug climbs up from behind the RAVO reels once they've landed:
              peeks, holds, then pulls himself up (clipped at the reels' edge) */}
          <div className="absolute inset-x-[-15%] -top-[25%] bottom-0 overflow-hidden">
            <motion.div
              className="absolute inset-x-[13%] bottom-0 top-[20%]"
              initial={{ y: "110%" }}
              animate={ready ? { y: reduce ? "0%" : ["110%", "62%", "66%", "0%"] } : undefined}
              transition={{ delay: reduce ? 0 : CLIMB_AT, duration: reduce ? 0 : 1.25, times: [0, 0.32, 0.5, 1], ease: [0.3, 0.8, 0.3, 1.1] }}
            >
              <Image src="/media/ravo-mascot.webp" alt="Ravo the pug" fill priority sizes="288px" className="animate-dance object-contain drop-shadow-[0_20px_40px_rgb(0_0_0/0.6)]" />
            </motion.div>
          </div>
        </motion.div>

        {/* the playable machine is a sibling of the real heading, so the lever
            (a button) never ends up inside the <h1> text */}
        <h1 className="sr-only">RAVONEVERSLEEPS</h1>
        <div className="relative z-10 -mt-10 font-display leading-[0.82] sm:-mt-14">
          <span className="relative block">
            <SlotReels start={ready} />
            {/* paws gripping the reels' top edge before the climb */}
            {!reduce && [-1, 1].map((side) => (
              <motion.span
                key={side}
                aria-hidden
                className="absolute top-0 z-20 block"
                style={{ left: `calc(50% + ${side} * clamp(2.2rem, 9vw, 5.6rem) - clamp(0.95rem, 3.5vw, 2.2rem))` }}
                initial={{ y: "30%", opacity: 0, scale: 0.6, rotate: side * 12 }}
                animate={ready ? { y: ["30%", "-72%", "-62%", "-72%", "-62%", "-90%"], opacity: [0, 1, 1, 1, 1, 0], scale: [0.6, 1, 1, 1, 1, 0.9], rotate: side * 12 } : undefined}
                transition={{ delay: CLIMB_AT - 0.45, duration: 1.6, times: [0, 0.18, 0.32, 0.46, 0.6, 1] }}
              >
                <Paw className="size-[clamp(1.9rem,7vw,4.4rem)] text-[#2b1d16] drop-shadow-[0_3px_0_#120c09]" />
              </motion.span>
            ))}
          </span>
          <span className="mt-3 block text-[clamp(1.9rem,7vw,5rem)]" aria-hidden>
            {TITLE.map((ch, i) => (
              <span key={i} aria-hidden className="hero-intro hero-drop neon-text inline-block" style={{ "--d": `${1 + i * 0.04}s` } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </div>
      </div>

    </section>
  );
}

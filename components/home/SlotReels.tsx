"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Chip, Club, Paw, Spade } from "@/components/decor/shapes";

// Hero slot machine: four chrome-framed reels. Each reel rests on its letter
// (so the headline always reads RAVO: before the spin, without JS, with
// reduced motion), spins through the symbols once when the site is ready and
// locks back on R · A · V · O one by one, then a light sweeps the reels.

const SYMBOLS = ["paw", "chip", "spade", "7", "club", "$"] as const;
type Sym = (typeof SYMBOLS)[number];
const LETTERS = ["R", "A", "V", "O"];
const STRIP = 14; // symbols between the starting and landing letter

// Glyphs are drawn with CSS (content: attr(data-g)) so the reels add no
// text to the page: the <h1> reads "RAVONEVERSLEEPS" for search engines,
// link previews and screen readers, never "R$7$7…".
const glyph = "before:content-[attr(data-g)]";

function Symbol({ s }: { s: Sym }) {
  if (s === "7" || s === "$") return <span data-g={s} className={`font-display text-[0.9em] text-neon/80 ${glyph}`} />;
  const Cmp = { paw: Paw, chip: Chip, spade: Spade, club: Club }[s];
  return <Cmp className="size-[0.62em] text-neon/70" />;
}

function Letter({ letter, r }: { letter: string; r: number }) {
  return (
    <span className="grid h-[1.15em] w-full place-items-center font-display leading-none">
      <span data-g={letter} className={`${r % 2 ? "neon-text" : "chrome"} ${glyph}`} />
    </span>
  );
}

export function SlotReels({ start }: { start: boolean }) {
  const reduce = useReducedMotion();
  const [landed, setLanded] = useState(0);
  // deterministic strips (no hydration mismatch)
  const strips = useMemo(() => LETTERS.map((_, r) => Array.from({ length: STRIP }, (_, i) => SYMBOLS[(i * 5 + r * 3) % SYMBOLS.length])), []);
  const all = landed >= LETTERS.length || (start && !!reduce);

  return (
    <div className="relative mx-auto flex items-center justify-center gap-[0.12em] text-[clamp(3.4rem,13vw,8.5rem)]" aria-label="RAVO">
      {LETTERS.map((letter, r) => (
        <div
          key={letter}
          className="relative rounded-[0.18em] bg-[linear-gradient(160deg,#f4fff0,#7f8c85_30%,#dfe7e2_50%,#3c5a40_75%,#c3ff8f)] p-[0.045em] shadow-[0_0.12em_0.4em_-0.1em_rgb(0_0_0/0.9)]"
          aria-hidden
        >
          <div className={`relative h-[1.15em] w-[0.86em] overflow-hidden rounded-[0.14em] bg-[radial-gradient(ellipse_at_50%_30%,#14261a,#040605_75%)] transition-shadow duration-500 ${all ? "shadow-[inset_0_0_0.3em_rgb(141_255_74/0.35),0_0_0.35em_rgb(141_255_74/0.45)]" : ""}`}>
            {/* glass shine */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[0.18em] bg-gradient-to-b from-black/80 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[0.18em] bg-gradient-to-t from-black/80 to-transparent" />
            <motion.div
              className="flex flex-col items-center"
              initial={{ y: 0, filter: "blur(0px)" }}
              animate={
                start && !reduce
                  ? { y: [0, `-${(STRIP + 1) * 1.15}em`], filter: ["blur(0px)", "blur(3px)", "blur(3px)", "blur(0px)"] }
                  : { y: 0 }
              }
              transition={{ duration: reduce ? 0 : 1.1 + r * 0.38, delay: reduce ? 0 : 0.15, ease: [0.2, 0.8, 0.25, 1.06] }}
              onAnimationComplete={() => start && setLanded((n) => n + 1)}
            >
              <Letter letter={letter} r={r} />
              {strips[r].map((s, i) => (
                <span key={i} className="grid h-[1.15em] w-full place-items-center"><Symbol s={s} /></span>
              ))}
              <Letter letter={letter} r={r} />
            </motion.div>
            {/* light sweep once every reel has landed */}
            {all && !reduce && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 z-30 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ left: "-60%" }}
                animate={{ left: "130%" }}
                transition={{ duration: 0.9, delay: r * 0.08, repeat: Infinity, repeatDelay: 4.5 }}
              />
            )}
          </div>
        </div>
      ))}

      {/* lever: chrome housing on the side, thick arm, glowing ball; pulled when the reels start */}
      <div className="absolute -right-[0.5em] top-[0.05em] h-[1.05em] w-[0.4em]" aria-hidden>
        {/* housing */}
        <span className="absolute bottom-0 left-0 block h-[0.5em] w-[0.27em] rounded-r-[0.1em] bg-[linear-gradient(180deg,#f4fff0,#7f8c85_40%,#3c5a40)] shadow-[0_0.04em_0.12em_rgb(0_0_0/0.8)]" />
        <span className="absolute bottom-[0.17em] left-[0.085em] block size-[0.12em] rounded-full bg-[#040605] ring-[0.015em] ring-neon/60" />
        {/* arm + ball */}
        <motion.span
          className="absolute bottom-[0.22em] left-[0.11em] block w-[0.09em] origin-bottom rounded-full bg-[linear-gradient(90deg,#7f8c85,#f4fff0_45%,#7f8c85)]"
          style={{ height: "0.8em" }}
          initial={{ scaleY: 1, rotate: 0 }}
          animate={start && !reduce ? { scaleY: [1, -0.15, -0.15, 1], rotate: [0, 6, 6, 0] } : { scaleY: 1, rotate: 0 }}
          transition={{ duration: 0.85, times: [0, 0.3, 0.45, 1], ease: "easeInOut" }}
        >
          <span className="absolute -top-[0.17em] left-1/2 block size-[0.3em] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e9ffd6,#8dff4a_45%,#2e7d12)] shadow-[0_0_0.25em_var(--color-neon)]" />
        </motion.span>
      </div>
    </div>
  );
}

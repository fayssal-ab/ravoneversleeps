"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Chip, Club, Paw, Spade } from "@/components/decor/shapes";

// Hero slot machine you can play. Four chrome reels rest on R · A · V · O.
// When the site is ready they spin once and land on RAVO; after that the
// lever (or a tap on the reels) spins them for real: random symbols, each
// reel stopping a little after the previous one. RAVO across, or 7-7-7-7,
// is a jackpot; the second pull always lands RAVO.
//
// Glyphs are drawn with CSS (content: attr(data-g)) so the reels add no
// text to the page: the <h1> reads "RAVONEVERSLEEPS" for search engines,
// link previews and screen readers, never "R$7$7…".

const SYMBOLS = ["paw", "chip", "spade", "7", "club", "$"] as const;
type Sym = (typeof SYMBOLS)[number] | "letter";
const LETTERS = ["R", "A", "V", "O"];
const CELL = 1.15; // em, one symbol
const glyph = "before:content-[attr(data-g)]";

function Cell({ s, letter, r }: { s: Sym; letter: string; r: number }) {
  if (s === "letter") {
    return (
      <span className="grid h-[1.15em] w-full place-items-center font-display leading-none">
        <span data-g={letter} className={`${r % 2 ? "neon-text" : "chrome"} ${glyph}`} />
      </span>
    );
  }
  if (s === "7" || s === "$") {
    return <span className="grid h-[1.15em] w-full place-items-center"><span data-g={s} className={`font-display text-[0.9em] text-neon/80 ${glyph}`} /></span>;
  }
  const Cmp = { paw: Paw, chip: Chip, spade: Spade, club: Club }[s];
  return <span className="grid h-[1.15em] w-full place-items-center"><Cmp className="size-[0.62em] text-neon/70" /></span>;
}

const POOL: Sym[] = ["letter", ...SYMBOLS];
const pick = () => POOL[Math.floor(Math.random() * POOL.length)];

/** Outcome of a player spin: ~1 in 7 a RAVO jackpot, ~1 in 20 a 7777, else random. */
function outcome(): Sym[] {
  const roll = Math.random();
  if (roll < 0.14) return ["letter", "letter", "letter", "letter"];
  if (roll < 0.19) return ["7", "7", "7", "7"];
  return LETTERS.map(pick);
}

// first spin on load: deterministic strips (no hydration mismatch), lands on RAVO
const introStrip = (r: number): Sym[] => ["letter", ...Array.from({ length: 14 }, (_, i) => SYMBOLS[(i * 5 + r * 3) % SYMBOLS.length]), "letter"];

export function SlotReels({ start }: { start: boolean }) {
  const reduce = useReducedMotion();
  const [spin, setSpin] = useState(0); // 0 = intro spin, then one per pull
  const [strips, setStrips] = useState<Sym[][]>(() => LETTERS.map((_, r) => introStrip(r)));
  const [stopped, setStopped] = useState(0);
  const [pulling, setPulling] = useState(false);
  const finals = useRef<Sym[]>(LETTERS.map(() => "letter"));
  // reduced motion: no animation runs, so the reels count as stopped at once
  const settled = stopped >= LETTERS.length || (!!reduce && start);
  const busy = (start && !settled) || pulling;
  const result = strips.map((s) => s[s.length - 1]);
  const jackpot = spin > 0 && settled && (result.every((s) => s === "letter") || result.every((s) => s === "7"));
  const ravoJackpot = jackpot && result[0] === "letter";

  const doSpin = useCallback(() => {
    if (!start || busy) return;
    // the visitor's 2nd pull always lands RAVO (spin 0 is the intro)
    const next = spin === 1 ? LETTERS.map((): Sym => "letter") : outcome();
    setStrips(finals.current.map((from, r) => {
      const fillers = Array.from({ length: 14 + r * 4 }, pick);
      return [from, ...fillers, next[r]];
    }));
    finals.current = next;
    setStopped(0);
    setSpin((n) => n + 1);
    setPulling(true);
    setTimeout(() => setPulling(false), 850);
  }, [start, busy, spin]);

  // keyboard: Space/Enter on the machine
  const onKey = (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); doSpin(); } };

  const leverDown = useMemo(() => (spin === 0 ? start : pulling), [spin, start, pulling]);

  return (
    <div className="relative mx-auto flex items-center justify-center gap-[0.12em] text-[clamp(3.4rem,13vw,8.5rem)]">
      {LETTERS.map((letter, r) => {
        const strip = strips[r];
        const travel = `-${(strip.length - 1) * CELL}em`;
        return (
          <div
            key={letter}
            onClick={doSpin}
            className={`relative cursor-pointer rounded-[0.18em] bg-[linear-gradient(160deg,#f4fff0,#7f8c85_30%,#dfe7e2_50%,#3c5a40_75%,#c3ff8f)] p-[0.045em] shadow-[0_0.12em_0.4em_-0.1em_rgb(0_0_0/0.9)] transition-transform active:scale-[0.98]`}
            aria-hidden
          >
            <div className={`relative h-[1.15em] w-[0.86em] overflow-hidden rounded-[0.14em] bg-[radial-gradient(ellipse_at_50%_30%,#14261a,#040605_75%)] transition-shadow duration-500 ${
              settled ? (jackpot ? "shadow-[inset_0_0_0.35em_rgb(255_215_106/0.5),0_0_0.5em_rgb(255_215_106/0.7)]" : "shadow-[inset_0_0_0.3em_rgb(141_255_74/0.35),0_0_0.35em_rgb(141_255_74/0.45)]") : ""
            }`}>
              {/* glass shine */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/3 bg-gradient-to-b from-white/10 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[0.18em] bg-gradient-to-b from-black/80 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[0.18em] bg-gradient-to-t from-black/80 to-transparent" />
              <motion.div
                key={spin}
                className="flex flex-col items-center will-change-transform [backface-visibility:hidden]"
                initial={{ y: 0 }}
                animate={start ? (reduce ? { y: travel } : { y: [0, travel] }) : { y: 0 }}
                transition={{ duration: reduce ? 0 : (spin === 0 ? 1.1 : 1.0) + r * 0.38, delay: reduce ? 0 : spin === 0 ? 0.15 : 0.25, ease: [0.16, 0.84, 0.24, 1.04] }}
                onAnimationComplete={() => start && setStopped((n) => n + 1)}
              >
                {strip.map((s, i) => <Cell key={i} s={s} letter={letter} r={r} />)}
              </motion.div>
              {/* light sweep once every reel has stopped */}
              {settled && !reduce && (
                <motion.div
                  key={`sweep-${spin}`}
                  className="pointer-events-none absolute inset-y-0 z-30 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  initial={{ left: "-60%" }}
                  animate={{ left: "130%" }}
                  transition={{ duration: 0.9, delay: r * 0.08, repeat: Infinity, repeatDelay: 4.5 }}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* jackpot banner (player spins only) */}
      <AnimatePresence>
        {jackpot && spin > 0 && (
          <motion.span
            key={`win-${spin}`}
            aria-hidden
            initial={{ opacity: 0, scale: 0.6, y: "-40%" }}
            animate={{ opacity: 1, scale: 1, y: "-60%" }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 14 }}
            className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-gold bg-bg/90 px-[0.4em] py-[0.08em] font-display text-[0.32em] text-gold shadow-[0_0_0.6em_rgb(255_215_106/0.6)]"
          >
            <span data-g={ravoJackpot ? "JACKPOT · RAVO" : "JACKPOT · 7777"} className={glyph} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* lever: pull it to spin */}
      <button
        type="button"
        onClick={doSpin}
        onKeyDown={onKey}
        disabled={!start}
        aria-label={busy ? "Spinning" : "Pull the lever to spin"}
        title="Pull to spin"
        className="absolute -right-[0.55em] top-[0.05em] h-[1.05em] w-[0.5em] cursor-pointer rounded-[0.1em] outline-offset-4 disabled:cursor-default"
      >
        {/* housing */}
        <span className="absolute bottom-0 left-0 block h-[0.5em] w-[0.27em] rounded-r-[0.1em] bg-[linear-gradient(180deg,#f4fff0,#7f8c85_40%,#3c5a40)] shadow-[0_0.04em_0.12em_rgb(0_0_0/0.8)]" />
        <span className="absolute bottom-[0.17em] left-[0.085em] block size-[0.12em] rounded-full bg-[#040605] ring-[0.015em] ring-neon/60" />
        {/* arm + ball */}
        <motion.span
          key={`lever-${spin}`}
          className="absolute bottom-[0.22em] left-[0.11em] block w-[0.09em] origin-bottom rounded-full bg-[linear-gradient(90deg,#7f8c85,#f4fff0_45%,#7f8c85)]"
          style={{ height: "0.8em" }}
          initial={{ scaleY: 1, rotate: 0 }}
          animate={leverDown && !reduce ? { scaleY: [1, -0.15, -0.15, 1], rotate: [0, 6, 6, 0] } : { scaleY: 1, rotate: 0 }}
          transition={{ duration: 0.85, times: [0, 0.3, 0.45, 1], ease: "easeInOut" }}
        >
          <span className={`absolute -top-[0.17em] left-1/2 block size-[0.3em] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e9ffd6,#8dff4a_45%,#2e7d12)] shadow-[0_0_0.25em_var(--color-neon)] ${settled && !busy ? "animate-pulse" : ""}`} />
        </motion.span>
      </button>

      {/* hint, once the intro spin is done */}
      {settled && spin === 0 && start && !reduce && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: [0, 1, 1, 0.6, 1], x: [-6, 0, 0, 4, 0] }}
          transition={{ duration: 2.4, delay: 1.5, repeat: Infinity, repeatDelay: 2 }}
          className="pointer-events-none absolute -right-[0.7em] top-[-0.28em] hidden whitespace-nowrap font-pixel text-[0.13em] uppercase tracking-[0.2em] text-neon sm:block"
        >
          <span data-g="Pull me ↓" className={glyph} />
        </motion.span>
      )}
    </div>
  );
}

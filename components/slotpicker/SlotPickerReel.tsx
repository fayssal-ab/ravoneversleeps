"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, Copy, Shuffle } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";

export interface PickerSlot { id: string; name: string; provider: string; image: string }

// Random slot picker: a horizontal reel of slot art that spins and eases
// out on a random slot under the centre marker. The winner is drawn first
// (crypto random, never one of the last few picks) and placed near the end
// of a freshly built strip; the reel then glides to it. Reduced motion jumps
// straight to the result.

const STRIP = 56;  // new cards per spin
const TAIL = 7;    // cards after the winner, so the reel never shows a gap
const KEEP = 6;    // cards kept from the last spin on each side of its winner
const SPIN_S = 4.6;
const RECENT = 6;
const SIZES = [50, 150, 300] as const;

const rand = (n: number) => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
};

export function SlotPickerReel({ slots }: { slots: PickerSlot[] }) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState<(typeof SIZES)[number]>(300);
  const [provider, setProvider] = useState<string>("");
  // first strip is deterministic so server and browser render the same
  const [strip, setStrip] = useState<PickerSlot[]>(() => slots.slice(0, STRIP));
  const [winner, setWinner] = useState<PickerSlot | null>(null);
  const [winAt, setWinAt] = useState(-1);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<PickerSlot[]>([]);
  const [copied, setCopied] = useState(false);
  const x = useMotionValue(0);
  const windowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // the 8 providers with the most slots in the pool
  const providers = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of slots) if (s.provider) count.set(s.provider, (count.get(s.provider) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p]) => p);
  }, [slots]);

  const pool = useMemo(() => {
    const top = slots.slice(0, size);
    const list = provider ? top.filter((s) => s.provider === provider) : top;
    return list.length >= 2 ? list : top;
  }, [slots, size, provider]);

  const spin = useCallback(() => {
    if (spinning) return;
    const recent = new Set(history.slice(0, RECENT).map((s) => s.id));
    const fresh = pool.filter((s) => !recent.has(s.id));
    const from = fresh.length ? fresh : pool;
    const win = from[rand(from.length)];
    // a re-spin starts from what's on screen: the cards around the last
    // winner lead the new strip, and x shifts so nothing visibly jumps
    const head = winAt >= 0 ? strip.slice(Math.max(0, winAt - KEEP)) : [];
    const fill = Array.from({ length: STRIP }, () => pool[rand(pool.length)]);
    const at = head.length + STRIP - TAIL;
    fill[STRIP - TAIL] = win;
    const next = [...head, ...fill];
    // warm the cache so the art is there when the cards fly past
    for (const s of fill) if (s.image) new Image().src = s.image;

    const card0 = trackRef.current?.children[0] as HTMLElement | undefined;
    const gap0 = trackRef.current ? parseFloat(getComputedStyle(trackRef.current).columnGap) || 0 : 0;
    const shift = card0 && winAt >= 0 ? Math.max(0, winAt - KEEP) * (card0.offsetWidth + gap0) : 0;

    setStrip(next);
    setWinAt(-1);
    setWinner(null);
    setCopied(false);
    setSpinning(true);
    x.set(x.get() + shift);

    // measure after the new strip is painted
    requestAnimationFrame(() => {
      const card = trackRef.current?.children[0] as HTMLElement | undefined;
      const view = windowRef.current;
      if (!card || !view) return;
      const gap = parseFloat(getComputedStyle(trackRef.current!).columnGap) || 0;
      const step = card.offsetWidth + gap;
      // land somewhere inside the winning card, not always dead centre
      const jitter = (rand(1000) / 1000 - 0.5) * card.offsetWidth * 0.6;
      const target = -(at * step + card.offsetWidth / 2 - view.offsetWidth / 2 + jitter);
      const done = () => {
        setSpinning(false);
        setWinner(win);
        setWinAt(at);
        setHistory((h) => [win, ...h.filter((s) => s.id !== win.id)].slice(0, 8));
      };
      if (reduce) { x.set(target); done(); return; }
      animate(x, target, { duration: SPIN_S, ease: [0.08, 0.82, 0.17, 1] }).then(done);
    });
  }, [spinning, history, pool, reduce, x, strip, winAt]);

  const copy = async () => {
    if (!winner) return;
    try {
      await navigator.clipboard.writeText(winner.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked: nothing to do */ }
  };

  const chip = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3 py-2 sm:px-3.5 font-head text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 ${on ? "border-neon bg-neon text-neon-ink" : "border-line text-muted hover:border-line-hot hover:text-text"}`;

  return (
    <div className="space-y-6">
      {/* filters */}
      <div className="panel space-y-4 p-4 sm:p-5">
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <span className="mr-1 shrink-0 font-head text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-dim">Pool</span>
          {SIZES.map((n) => (
            <button key={n} type="button" disabled={spinning} onClick={() => setSize(n)} className={chip(size === n)} aria-pressed={size === n}>Top {n}</button>
          ))}
        </div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <span className="mr-1 shrink-0 font-head text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-dim">Provider</span>
          <button type="button" disabled={spinning} onClick={() => setProvider("")} className={chip(provider === "")} aria-pressed={provider === ""}>All</button>
          {providers.map((p) => (
            <button key={p} type="button" disabled={spinning} onClick={() => setProvider(p)} className={chip(provider === p)} aria-pressed={provider === p}>{p}</button>
          ))}
        </div>
      </div>

      {/* reel */}
      <section className="panel relative overflow-hidden px-0 py-4 sm:py-6" aria-label="Slot reel">
        {/* py: room for the winner card's scale-up, the window clips overflow */}
        <div ref={windowRef} className="relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]">
          <motion.div ref={trackRef} style={{ x }} className="flex w-max gap-3 will-change-transform sm:gap-4">
            {strip.map((s, i) => (
              <div
                key={`${i}-${s.id}`}
                className={`w-28 shrink-0 transition duration-500 sm:w-40 ${winner && i === winAt ? "scale-105" : winner ? "opacity-40" : ""}`}
              >
                <div className={`overflow-hidden rounded-2xl border-2 transition-colors duration-500 ${winner && i === winAt ? "border-neon shadow-[0_0_28px_rgb(141_255_74/0.45)]" : "border-transparent"}`}>
                  <SlotArt name={s.name} src={s.image || null} fluid="100%" rounded="rounded-[0.9rem]" className="!aspect-square !h-auto" />
                </div>
              </div>
            ))}
          </motion.div>
        </div>
        {/* centre marker */}
        <div aria-hidden className={`pointer-events-none absolute inset-y-3 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-neon shadow-[0_0_14px_var(--color-neon)] transition-opacity duration-500 ${winner ? "opacity-0" : ""}`} />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1.5 size-0 -translate-x-1/2 border-x-[9px] border-t-[11px] border-x-transparent border-t-neon" />
        <div aria-hidden className="pointer-events-none absolute bottom-1.5 left-1/2 size-0 -translate-x-1/2 border-x-[9px] border-b-[11px] border-x-transparent border-b-neon" />
      </section>

      {/* action + result */}
      <div className="grid items-stretch gap-4 md:grid-cols-[1fr_1.3fr]">
        <div className="panel flex flex-col items-center justify-center gap-3 p-6 text-center">
          <button type="button" onClick={spin} disabled={spinning} className="btn btn-neon w-full max-w-xs px-8 py-4 text-base disabled:opacity-70">
            <Shuffle className={`size-5 ${spinning ? "animate-spin [animation-duration:1.2s]" : ""}`} />
            {spinning ? "Spinning…" : winner ? "Spin again" : "Spin"}
          </button>
          <p className="text-xs text-dim">{pool.length} slots in the pool{provider ? ` · ${provider}` : ""}</p>
        </div>

        <div className="panel relative min-h-36 overflow-hidden p-5" aria-live="polite">
          {winner ? (
            <motion.div key={winner.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex items-center gap-4">
              <SlotArt name={winner.name} src={winner.image || null} size={96} className="sm:!size-28" />
              <div className="min-w-0 flex-1">
                <p className="font-head text-[0.7rem] font-bold uppercase tracking-[0.2em] text-neon">Your slot</p>
                <p className="mt-1 break-words font-head text-2xl font-bold leading-tight sm:text-3xl">{winner.name}</p>
                <p className="mt-0.5 truncate text-sm text-muted">{winner.provider}</p>
                <button type="button" onClick={copy} className="btn btn-ghost btn-sm mt-3">
                  {copied ? <><Check className="size-4 text-neon" /> Copied</> : <><Copy className="size-4" /> Copy name</>}
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-muted">
              {spinning ? "Picking…" : "Hit spin and the reel picks your next slot."}
            </div>
          )}
        </div>
      </div>

      {history.length > 1 && (
        <section>
          <h2 className="mb-3 font-head text-xs font-bold uppercase tracking-[0.2em] text-dim">Recent picks</h2>
          <ul className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {history.slice(1).map((s) => (
              <li key={s.id} className="flex w-56 shrink-0 items-center gap-3 rounded-xl border border-line bg-bg-2 p-2">
                <SlotArt name={s.name} src={s.image || null} size={44} rounded="rounded-lg" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block truncate text-xs text-dim">{s.provider}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-dim">Just for fun: the picker doesn&apos;t place bets or link to any game. 18+, play responsibly.</p>
    </div>
  );
}

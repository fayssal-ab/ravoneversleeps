"use client";

import { AnimatePresence, motion } from "motion/react";
import { Crown, History, ScrollText, Search } from "lucide-react";
import { useState } from "react";

/** prize: a label, "$3,000" or "AirPods Pro Max 2" */
export interface BoardRowView { rank: number; name: string; score: number; prize: string | null }

const PODIUM = [
  { place: 2, color: "var(--color-silver)", delay: 0.15, glow: "rgb(217 225 220 / 0.3)", lift: "sm:mt-10" },
  { place: 1, color: "var(--color-gold)", delay: 0, glow: "rgb(255 215 106 / 0.4)", lift: "" },
  { place: 3, color: "var(--color-bronze)", delay: 0.3, glow: "rgb(224 154 92 / 0.3)", lift: "sm:mt-10" },
];

const PODIUM_ALT: Record<number, string> = { 1: "King", 2: "Prince", 3: "Aristocrat" };

const points = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " pts";

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Top-3 cards, #1 raised in the middle. Missing places render as an open seat. */
export function Podium({ rows, prizes, scoreKind = "wagered" }: { rows: BoardRowView[]; prizes: Record<number, string>; scoreKind?: "points" | "wagered" }) {
  const score = scoreKind === "points" ? points : money;
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-3 items-start gap-2 sm:gap-5">
      {PODIUM.map((slot) => {
        const r = rows.find((x) => x.rank === slot.place);
        const prize = prizes[slot.place];
        return (
          <motion.div
            key={slot.place}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: slot.delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6 }}
            className={`relative flex flex-col items-center rounded-[1.4rem] border-2 bg-surface px-2 pb-5 pt-6 text-center sm:px-5 sm:pb-7 sm:pt-8 ${slot.lift}`}
            style={{ borderColor: slot.color, boxShadow: `0 6px 0 ${slot.glow}, 0 30px 60px -30px ${slot.glow}` }}
          >
            {slot.place === 1 && (
              <motion.div className="absolute -top-6 left-1/2 -translate-x-1/2" animate={{ y: [0, -5, 0], rotate: [-6, 6, -6] }} transition={{ duration: 3, repeat: Infinity }}>
                <Crown className="size-9" style={{ color: slot.color, filter: `drop-shadow(0 0 10px ${slot.glow})` }} />
              </motion.div>
            )}
            <div className="relative">
              <div
                className="relative size-16 overflow-hidden rounded-full border-[3px] bg-black sm:size-28"
                style={{ borderColor: slot.color, boxShadow: `0 0 30px ${slot.glow}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/podium/${slot.place}.webp`} alt={PODIUM_ALT[slot.place]} draggable={false} className="size-full scale-110 object-cover brightness-125" />
              </div>
              <span className="absolute -bottom-2 left-1/2 grid size-7 -translate-x-1/2 place-items-center rounded-full font-mono text-sm font-bold text-bg" style={{ background: slot.color }}>{slot.place}</span>
            </div>
            <p className="mt-5 max-w-full truncate font-head text-sm font-bold sm:text-lg">{r ? r.name : "Open seat"}</p>
            <p className="mt-2 text-[0.6rem] uppercase tracking-[0.2em] text-dim">{scoreKind === "points" ? "Points" : "Wagered"}</p>
            <p className="font-mono text-sm font-bold sm:text-xl" style={{ color: slot.color }}>{score(r?.score ?? 0)}</p>
            {prize != null && (
              <span className="mt-4 max-w-full rounded-xl px-3 py-1.5 text-center font-head text-xs font-bold leading-tight text-bg shadow-[0_3px_0_rgb(0_0_0/0.4)] sm:px-5 sm:text-lg" style={{ background: slot.color }}>
                {prize}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/** Ranked rows from 4th place down (or everything with `fromRank` = 1). */
export function BoardTable({ rows, fromRank = 4, scoreKind = "wagered" }: { rows: BoardRowView[]; fromRank?: number; scoreKind?: "points" | "wagered" }) {
  const score = scoreKind === "points" ? points : money;
  const list = rows.filter((r) => r.rank >= fromRank);
  if (!list.length) return null;
  return (
    <div>
      <div className="grid grid-cols-[3rem_1fr_auto] gap-4 px-4 pb-2 font-head text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-dim sm:grid-cols-[3.5rem_1fr_10rem_7rem] sm:px-5">
        <span>Rank</span><span>Player</span><span className="text-right">{scoreKind === "points" ? "Points" : "Wagered"}</span><span className="hidden text-right sm:block">Prize</span>
      </div>
      <ol className="space-y-2">
        {list.map((r, i) => (
          <motion.li
            key={`${r.rank}-${r.name}`}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}
            className="panel group grid grid-cols-[3rem_1fr_auto] items-center gap-4 px-4 py-3 transition hover:border-line-hot hover:bg-surface-2 sm:grid-cols-[3.5rem_1fr_10rem_7rem] sm:px-5"
          >
            <span className={`grid size-8 place-items-center rounded-full font-mono text-sm font-bold ${r.prize != null ? "bg-neon text-neon-ink" : "bg-surface-3 text-muted"}`}>{r.rank}</span>
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-hot font-head text-xs font-bold text-muted">{r.name.slice(0, 1).toUpperCase()}</span>
              <span className="truncate font-head font-semibold">{r.name}</span>
            </span>
            <span className="text-right font-mono text-sm font-bold text-neon">
              {score(r.score)}
              {r.prize != null && <span className="mt-1 block text-xs text-gold sm:hidden">{r.prize}</span>}
            </span>
            <span className="hidden justify-end sm:flex">
              {r.prize != null ? <span className="rounded-full bg-gold px-3 py-0.5 font-mono text-xs font-bold text-bg">{r.prize}</span> : <span className="text-dim">—</span>}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** Table + player search + rules dialog (toolbar above the rows). */
export function BoardExplorer({ rows, rules, scoreKind = "wagered" }: { rows: BoardRowView[]; rules: string[]; scoreKind?: "points" | "wagered" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players" className="field !rounded-full !pl-10" aria-label="Search players" />
        </label>
        <button type="button" onClick={() => setOpen(true)} className="btn btn-neon btn-sm"><ScrollText className="size-4" /> Rules</button>
        <a href="#history" className="btn btn-ghost btn-sm"><History className="size-4" /> History</a>
      </div>
      {shown.length ? <BoardTable rows={shown} fromRank={q ? 1 : 4} scoreKind={scoreKind} /> : <p className="panel p-6 text-center text-sm text-muted">No player matches “{q}”.</p>}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-modal="true" aria-label="Leaderboard rules" className="panel neon-frame is-on w-full max-w-lg p-6"
              initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <p className="font-display text-3xl"><span className="chrome">Rules</span></p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
                {rules.map((r) => <li key={r}>{r}</li>)}
              </ol>
              <div className="mt-6 flex justify-end"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} autoFocus>Got it</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

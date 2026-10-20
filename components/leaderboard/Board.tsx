"use client";

import { AnimatePresence, motion } from "motion/react";
import { History, ScrollText, Search } from "lucide-react";
import { useState } from "react";

/** prize: a label, "$3,000" or "AirPods Pro Max 2" */
export interface BoardRowView { rank: number; name: string; score: number; prize: string | null }

const points = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " pts";

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

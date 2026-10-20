"use client";

import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { ClipModal, clipDuration } from "@/components/clips/ClipGrid";
import type { Clip } from "@/lib/clips";

// "From the stream": Ravo's latest Kick clips on a film strip right under
// the hero. It drifts sideways on its own (pauses on hover / focus, stays
// still with reduced motion); clicking a frame plays the clip on the site.

function Frame({ c, onOpen, tabbable }: { c: Clip; onOpen: (c: Clip) => void; tabbable: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(c)}
      tabIndex={tabbable ? 0 : -1}
      aria-hidden={!tabbable}
      className="group relative w-60 shrink-0 overflow-hidden rounded-lg bg-black text-left ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-neon/60 sm:w-72"
    >
      <span className="relative block aspect-video">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.thumbnail} alt="" loading="lazy" draggable={false} className="size-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white/90">{clipDuration(c.duration)}</span>
        <span className="absolute left-2 top-2 grid size-8 place-items-center rounded-full bg-neon/90 text-neon-ink opacity-0 transition group-hover:opacity-100">
          <Play className="ml-0.5 size-4 fill-current" />
        </span>
        <span className="absolute inset-x-3 bottom-2">
          <span className="block truncate font-head text-sm font-bold text-white">{c.title}</span>
          <span className="block text-[11px] text-white/60">{c.views.toLocaleString("en-US")} views{c.creator ? ` · ${c.creator}` : ""}</span>
        </span>
      </span>
      <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-neon transition duration-500 group-hover:scale-x-100" />
    </button>
  );
}

export function ClipStrip({ clips }: { clips: Clip[] }) {
  const [open, setOpen] = useState<Clip | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (!clips.length) return null;
  const list = clips.slice(0, 8);
  return (
    <section className="relative">
      <div className="mx-auto flex max-w-6xl items-end justify-between px-4 sm:px-6">
        <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-muted">Fresh from the stream</p>
        <Link href="/clips" className="inline-flex items-center gap-1.5 py-2 font-head text-xs font-bold uppercase tracking-[0.2em] text-neon hover:text-text">
          All clips <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* film strip: sprocket holes top and bottom, frames drifting by */}
      <div className="film-strip group/strip mt-3 overflow-hidden py-5">
        <div className="film-track flex w-max gap-4 px-2">
          {[...list, ...list].map((c, i) => <Frame key={`${c.id}-${i}`} c={c} onOpen={setOpen} tabbable={i < list.length} />)}
        </div>
      </div>

      <ClipModal clip={open} onClose={close} />
    </section>
  );
}

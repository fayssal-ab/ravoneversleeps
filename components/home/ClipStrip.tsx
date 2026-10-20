"use client";

import Link from "next/link";
import { ArrowRight, Clock, Play } from "lucide-react";
import { useCallback, useState } from "react";
import { ClipModal, clipDuration } from "@/components/clips/ClipGrid";
import type { Clip } from "@/lib/clips";

// "From the stream": Ravo's latest Kick clips as a row of slightly tilted
// cards right under the hero (scrolls sideways on phones), then a ticker of
// clip titles. Clicking a card plays the clip on the site.

const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1", "rotate-1"];

export function ClipStrip({ clips }: { clips: Clip[] }) {
  const [open, setOpen] = useState<Clip | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (!clips.length) return null;
  const list = clips.slice(0, 6);
  const ticker = [...list, ...list];
  return (
    <section className="relative">
      <div className="mx-auto flex max-w-6xl items-end justify-between px-4 sm:px-6">
        <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-muted">From the stream</p>
        <Link href="/clips" className="inline-flex items-center gap-1.5 py-2 font-head text-xs font-bold uppercase tracking-[0.2em] text-neon hover:text-text">
          All clips <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <ul className="mx-auto mt-4 flex max-w-[90rem] snap-x gap-5 overflow-x-auto px-4 pb-6 pt-3 sm:px-6 [scrollbar-width:none] lg:justify-center">
        {list.map((c, i) => (
          <li key={c.id} className={`w-64 shrink-0 snap-start sm:w-72 ${TILT[i % TILT.length]} transition duration-300 hover:rotate-0 hover:-translate-y-1.5`}>
            <button type="button" onClick={() => setOpen(c)} className="group block w-full rounded-xl bg-[#e9f5ec] p-2 pb-3 text-left text-bg shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)]">
              <span className="relative block aspect-video overflow-hidden rounded-lg bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail} alt="" loading="lazy" draggable={false} className="size-full object-cover" />
                <span className="absolute left-2 top-1 font-display text-3xl text-white drop-shadow-[0_2px_6px_rgb(0_0_0/0.9)]">{String(i + 1).padStart(2, "0")}</span>
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white"><Clock className="size-3" />{clipDuration(c.duration)}</span>
                <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/35">
                  <span className="grid size-11 scale-90 place-items-center rounded-full bg-neon text-neon-ink opacity-0 transition group-hover:scale-100 group-hover:opacity-100"><Play className="ml-0.5 size-5 fill-current" /></span>
                </span>
              </span>
              <span className="mt-2 block truncate px-1 font-head text-sm font-bold">{c.title}</span>
              <span className="block px-1 text-xs text-bg/60">{c.views.toLocaleString("en-US")} views</span>
            </button>
          </li>
        ))}
      </ul>

      {/* ticker of clip titles */}
      <div className="overflow-hidden border-y border-white/[0.06] bg-surface/60 py-3">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-head text-sm font-bold uppercase tracking-wider text-text/80">
          {ticker.map((c, i) => (
            <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2">
              <span className="text-[10px] tracking-[0.2em] text-neon">Clip</span>{c.title} <span className="text-dim">{clipDuration(c.duration)}</span>
            </span>
          ))}
        </div>
      </div>

      <ClipModal clip={open} onClose={close} />
    </section>
  );
}

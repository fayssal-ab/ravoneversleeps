"use client";

import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Eye, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Clip } from "@/lib/clips";

const dur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const ago = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d) || d < 0) return "";
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))} min ago`;
  if (d < 86400) return `${Math.round(d / 3600)} h ago`;
  if (d < 86400 * 30) return `${Math.round(d / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** HLS player: hls.js (loaded on demand) where supported, native HLS otherwise (iPhone). */
function Player({ clip }: { clip: Clip }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroy: (() => void) | undefined;
    let cancelled = false;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 20 });
        hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) setFailed(true); });
        hls.loadSource(clip.video);
        hls.attachMedia(video);
        destroy = () => hls.destroy();
      } else {
        video.src = clip.video;
      }
      video.play().catch(() => {});
    });
    return () => { cancelled = true; destroy?.(); };
  }, [clip.video]);
  if (failed) {
    return (
      <div className="grid size-full place-items-center bg-black p-6 text-center">
        <p className="text-sm text-muted">This clip can&apos;t play here. <a href={clip.url} target="_blank" rel="noopener noreferrer" className="text-neon underline">Watch it on Kick</a></p>
      </div>
    );
  }
  return <video ref={ref} controls playsInline poster={clip.thumbnail} onError={() => setFailed(true)} className="size-full bg-black object-contain" />;
}

/** Clip player in a modal (portal, Esc/backdrop to close). */
export function ClipModal({ clip, onClose }: { clip: Clip | null; onClose: () => void }) {
  useEffect(() => {
    if (!clip) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.documentElement.style.overflow = ""; };
  }, [clip, onClose]);
  if (typeof document === "undefined") return null;
  return (
    <>
      {/* portal: above the fixed navbar, outside the page's stacking context */}
      {createPortal(
      <AnimatePresence>
        {clip && (
          <motion.div
            role="dialog" aria-modal aria-label={clip.title}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-8"
            onClick={() => onClose()}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              className="w-full max-w-5xl overflow-hidden rounded-2xl border border-line-hot bg-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video"><Player clip={clip} /></div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-head text-lg font-bold">{clip.title}</p>
                  <p className="text-xs text-muted">{clip.views.toLocaleString("en-US")} views{clip.creator && ` · clipped by ${clip.creator}`}</p>
                </div>
                <div className="flex gap-2">
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="size-4" /> On Kick</a>
                  <button type="button" onClick={() => onClose()} className="btn btn-neon btn-sm" aria-label="Close"><X className="size-4" /> Close</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}

export const clipDuration = dur;
export const clipAgo = ago;

export function ClipGrid({ clips }: { clips: Clip[] }) {
  const [open, setOpen] = useState<Clip | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => setOpen(c)} className="group block w-full overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:-translate-y-1 hover:border-line-hot">
              <span className="relative block aspect-video overflow-hidden bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumbnail} alt="" loading="lazy" draggable={false} className="size-full object-cover transition duration-500 group-hover:scale-105" />
                <span className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
                  <span className="grid size-14 scale-90 place-items-center rounded-full bg-neon text-neon-ink opacity-0 shadow-[0_0_30px_rgb(141_255_74/0.6)] transition group-hover:scale-100 group-hover:opacity-100">
                    <Play className="ml-0.5 size-6 fill-current" />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 font-mono text-xs font-bold">{dur(c.duration)}</span>
              </span>
              <span className="block p-4">
                <span className="line-clamp-1 font-head text-base font-bold">{c.title}</span>
                <span className="mt-1 flex items-center gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{c.views.toLocaleString("en-US")}</span>
                  {c.creator && <span className="truncate">clipped by <span className="text-text">{c.creator}</span></span>}
                  <span className="ml-auto shrink-0 text-dim">{ago(c.createdAt)}</span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ClipModal clip={open} onClose={close} />
    </>
  );
}

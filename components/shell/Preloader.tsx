"use client";

import { useEffect, useState } from "react";
import { announceReady } from "./siteReady";

// First-load screen (on every full page load): the spinning pug inside a
// neon ring and a progress bar that follows the real loading. It stays until
// the page, fonts and on-screen images are loaded and decoded so the site
// appears complete, never popping in. Shown at least MIN_MS so it's always
// seen, capped at MAX_MS after navigation start (not after hydration, which
// is late on slow phones) so a slow image never blocks the site. A CSS
// failsafe ([data-preloader] in globals.css) hides it even if JS never runs.
const MIN_MS = 900;
const MAX_MS = 3500;

// Only images inside the viewport on both axes: the home clip strip scrolls
// sideways, and its off-screen lazy thumbnails never load, which used to hold
// the screen on "Waking Ravo up…" until the cap.
function visibleImages(): HTMLImageElement[] {
  return Array.from(document.images).filter((img) => {
    if (img.closest("[data-preloader]")) return false;
    if (img.loading === "lazy" && !img.complete && !img.currentSrc) return false;
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  });
}

function imageReady(img: HTMLImageElement): Promise<void> {
  const decode = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  if (img.complete) return decode();
  return new Promise((resolve) => {
    img.addEventListener("load", () => decode().then(resolve), { once: true });
    img.addEventListener("error", () => resolve(), { once: true });
  });
}

export function Preloader() {
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);
  const [pct, setPct] = useState(6);

  // images can't be dragged out of the page (Firefox ignores the CSS rule)
  useEffect(() => {
    const noDrag = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement || (e.target instanceof Element && e.target.closest("svg"))) e.preventDefault();
    };
    document.addEventListener("dragstart", noDrag);
    return () => document.removeEventListener("dragstart", noDrag);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    let finished = false;
    document.documentElement.style.overflow = "hidden";

    const finish = () => {
      if (finished) return;
      finished = true;
      setPct(100);
      const wait = Math.max(0, (reduced ? 300 : MIN_MS) - (Date.now() - start));
      timers.push(setTimeout(() => {
        setOut(true);
        announceReady();
        document.documentElement.style.overflow = "";
        timers.push(setTimeout(() => setGone(true), 650));
      }, wait));
    };

    const pageLoaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });
    const fonts = document.fonts?.ready.then(() => undefined).catch(() => undefined) ?? Promise.resolve();

    pageLoaded.then(() => {
      const imgs = visibleImages();
      let done = 0;
      const total = imgs.length + 1;
      const tick = () => { done++; setPct(Math.min(96, 6 + Math.round((done / total) * 90))); };
      return Promise.all([fonts.then(tick), ...imgs.map((img) => imageReady(img).then(tick))]);
    }).then(finish);
    timers.push(setTimeout(finish, Math.max(0, MAX_MS - performance.now())));
    return () => {
      timers.forEach(clearTimeout);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (gone) return null;

  return (
    <div
      data-preloader
      aria-hidden
      style={{ background: "radial-gradient(60rem 40rem at 50% 35%, rgb(141 255 74 / 0.10), transparent 60%), #040605" }}
      className={`fixed inset-0 z-[10000] grid place-items-center transition-opacity duration-[650ms] ${out ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center px-6 text-center">
        <div className="relative size-48 sm:size-56">
          {/* neon ring + orbiting spark */}
          <div className="absolute inset-0 rounded-full border-2 border-neon/15" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-neon border-r-neon/40 [animation-duration:1.1s] [filter:drop-shadow(0_0_10px_var(--color-neon))]" />
          <div className="absolute inset-4 rounded-full bg-neon/15 blur-2xl" />
          {/* the pug keeps spinning */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/media/ravo-mascot.webp"
            alt=""
            width={760}
            height={834}
            fetchPriority="high"
            draggable={false}
            className="absolute inset-6 m-auto size-[calc(100%-3rem)] animate-spin-slow object-contain [animation-duration:2.8s] drop-shadow-[0_10px_30px_rgb(0_0_0/0.6)]"
          />
        </div>
        <p className="mt-7 font-display text-4xl leading-none sm:text-5xl">
          <span className="chrome">RAVO</span><span className="neon-text">NEVERSLEEPS</span>
        </p>
        <p className="mt-3 font-pixel text-xs uppercase tracking-[0.25em] text-muted">Waking Ravo up…</p>
        <div className="mt-5 h-1.5 w-60 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-neon-deep),var(--color-neon),var(--color-neon-bright))] shadow-[0_0_12px_var(--color-neon)] transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-xs text-dim">{pct}%</p>
      </div>
    </div>
  );
}

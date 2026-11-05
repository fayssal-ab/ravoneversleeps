"use client";

import { useEffect, useRef, useState } from "react";
import { announceReady, isSceneReady, onSceneChange } from "./siteReady";

// First-load screen (on every full page load): the spinning pug inside a
// neon ring and a progress bar that follows the real loading. It stays until
// the page, fonts, on-screen images AND the on-screen 3D scenes ([data-scene]
// slots in the first screen, which report their first drawn frame) are ready, so
// the site appears complete, never popping in. The bar glides toward the real
// progress and creeps while waiting, so it never jumps or freezes; it only
// runs to 100% once everything is done. Shown at least MIN_MS, capped at
// MAX_MS after navigation start so a slow phone is never stuck. A CSS
// failsafe ([data-preloader] in globals.css) hides it even if JS never runs.
const MIN_MS = 1200;
const MAX_MS = 9000;

// share of the bar for each part of the loading
const W = { page: 25, fonts: 10, images: 25, scenes: 40 } as const;

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
  const [stage, setStage] = useState("Waking Ravo up…");
  const bar = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLParagraphElement>(null);

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
    const start = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    document.documentElement.style.overflow = "hidden";

    // real progress, 0…100
    const got = { page: 0, fonts: 0, images: 0, scenes: 0 };
    const real = () => got.page * W.page + got.fonts * W.fonts + got.images * W.images + got.scenes * W.scenes;
    let done = false;
    let shown = 0;
    let raf = 0;
    let exiting = false;

    const draw = (v: number) => {
      const n = Math.floor(v);
      if (bar.current) bar.current.style.width = `${v}%`;
      if (label.current) label.current.textContent = `${n}%`;
    };

    const exit = () => {
      if (exiting) return;
      exiting = true;
      setOut(true);
      announceReady();
      document.documentElement.style.overflow = "";
      timers.push(setTimeout(() => setGone(true), 650));
    };

    // the bar glides toward the real progress, by time (not per frame) so a
    // slow device moves it just as smoothly: never jumps, never sits still
    // (creeps a little past the last milestone while waiting), and only runs
    // to 100 once everything is ready
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const goal = done ? 100 : Math.min(95, real());
      if (shown < goal) {
        // ease toward the goal (time constant ~0.45 s, ~0.15 s once done),
        // with a floor so the last stretch doesn't crawl
        const k = done ? 7 : 2.2;
        shown += Math.max((goal - shown) * (1 - Math.exp(-k * dt)), (done ? 60 : 6) * dt);
      } else if (!done) {
        shown += 1.2 * dt; // creep while waiting
      }
      shown = Math.min(shown, done ? 100 : Math.min(95, goal + 5));
      draw(shown);
      if (done && shown >= 100) {
        const wait = Math.max(0, (reduced ? 300 : MIN_MS) - (performance.now() - start));
        timers.push(setTimeout(exit, wait + 180));
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const finish = () => { done = true; };

    const pageLoaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", () => resolve(), { once: true });
    });
    const fonts = (document.fonts?.ready.then(() => undefined).catch(() => undefined) ?? Promise.resolve()).then(() => { got.fonts = 1; });

    // 3D: every [data-scene] slot visible in the first screen must draw
    // its first frame (the slots are in the server HTML, so they're known now)
    const ids = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      })
      .map((el) => el.dataset.scene ?? "");
    const scenes = new Promise<void>((resolve) => {
      const check = () => {
        const ok = ids.filter(isSceneReady).length;
        got.scenes = ids.length === 0 ? 1 : ok / ids.length;
        if (ok >= ids.length) { off(); resolve(); }
      };
      const off = onSceneChange(check);
      check();
    });
    if (ids.length) timers.push(setTimeout(() => { if (got.scenes < 1) setStage("Setting up the table…"); }, 700));

    pageLoaded.then(() => {
      got.page = 1;
      const imgs = visibleImages();
      let n = 0;
      if (imgs.length === 0) got.images = 1;
      return Promise.all([fonts, ...imgs.map((img) => imageReady(img).then(() => { n++; got.images = n / imgs.length; }))]);
    })
      .then(() => scenes)
      .then(() => { setStage("Almost there…"); finish(); });

    timers.push(setTimeout(finish, Math.max(0, MAX_MS - performance.now())));
    return () => {
      cancelAnimationFrame(raf);
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
        <p className="mt-3 font-pixel text-xs uppercase tracking-[0.25em] text-muted">{stage}</p>
        <div className="mt-5 h-1.5 w-60 overflow-hidden rounded-full bg-surface-3">
          <div
            ref={bar}
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-neon-deep),var(--color-neon),var(--color-neon-bright))] shadow-[0_0_12px_var(--color-neon)]"
            style={{ width: "0%" }}
          />
        </div>
        <p ref={label} className="mt-2 font-mono text-xs tabular-nums text-dim">0%</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

// The preloader announces when it starts fading out so intro animations
// (hero reels, pug, title) play in front of the visitor instead of behind
// the loading screen.
declare global {
  interface Window { __ravoReady?: boolean }
}

export const READY_EVENT = "ravo:ready";

export function announceReady() {
  window.__ravoReady = true;
  // starts the CSS hero intro (.ravo-ready .hero-intro in globals.css)
  document.documentElement.classList.add("ravo-ready");
  window.dispatchEvent(new Event(READY_EVENT));
}

/** True once the preloader is fading out (or after a safety timeout). */
export function useSiteReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    if (window.__ravoReady) {
      const t = setTimeout(go, 0);
      return () => clearTimeout(t);
    }
    window.addEventListener(READY_EVENT, go, { once: true });
    const t = setTimeout(go, 11000);
    return () => { window.removeEventListener(READY_EVENT, go); clearTimeout(t); };
  }, []);
  return ready;
}

// 3D scenes on screen at load: each 3D slot is marked in the server HTML
// with data-scene="<id>", so the preloader knows from the first byte which
// ones to wait for (only those visible in the first screen); each scene
// calls sceneReady(id) once it has drawn its first frame (or can't run).
const ready = new Set<string>();
const sceneListeners = new Set<() => void>();

export function sceneReady(id: string) {
  if (ready.has(id)) return;
  ready.add(id);
  sceneListeners.forEach((f) => f());
}

export function isSceneReady(id: string): boolean {
  return ready.has(id);
}

export function onSceneChange(f: () => void): () => void {
  sceneListeners.add(f);
  return () => { sceneListeners.delete(f); };
}

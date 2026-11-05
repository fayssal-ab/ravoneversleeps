"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Smooth, eased wheel/trackpad scrolling for the whole site (Lenis). It
// drives the real window scroll, so sticky bars, CSS scroll-driven reveals
// and the browser's own scrolling keep working. Off with reduced motion and
// on touch screens (their native momentum is already smooth).
export function SmoothScroll() {
  const lenis = useRef<Lenis | null>(null);
  const path = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.11, wheelMultiplier: 0.95, anchors: { offset: -96 }, allowNestedScroll: true });
    lenis.current = l;
    return () => { l.destroy(); lenis.current = null; };
  }, []);

  // new page: start at the top right away, no smooth glide back up
  useEffect(() => { lenis.current?.scrollTo(0, { immediate: true }); }, [path]);

  return null;
}

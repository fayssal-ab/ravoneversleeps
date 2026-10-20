"use client";

import { useEffect, useRef, useState } from "react";

// Ravo's pug-run film (1080p). Nothing downloads until it is near the
// screen; pauses when scrolled away; reduced motion keeps the poster.

export function PugVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); v.play().catch(() => {}); }
      else v.pause();
    }, { rootMargin: "300px" });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  // <source> children added after mount need an explicit load()
  useEffect(() => {
    const v = ref.current;
    if (!near || !v) return;
    v.load();
    v.play().catch(() => {});
  }, [near]);

  return (
    <video ref={ref} muted loop playsInline preload="none" poster="/media/pug-run-poster.jpg" aria-hidden className={className}>
      {near && <source src="/media/pug-run-1080.mp4" type="video/mp4" />}
    </video>
  );
}

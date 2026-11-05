"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

// Every 3D scene on the site goes through this: the WebGL canvas is only
// created once its box comes near the screen, stops drawing while it's
// scrolled away, and lowers its resolution on slow devices, so several
// scenes on one page stay smooth.
export function LazyCanvas({ className = "", children, ...props }: CanvasProps & { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dpr, setDpr] = useState(1.5);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (e.isIntersecting) setMounted(true);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className={className} aria-hidden>
      {mounted && (
        <Canvas
          dpr={dpr}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          frameloop={!visible ? "never" : reduce ? "demand" : "always"}
          {...props}
        >
          <PerformanceMonitor onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))} onDecline={() => setDpr(1)} />
          <AdaptiveDpr pixelated={false} />
          {children}
        </Canvas>
      )}
    </div>
  );
}

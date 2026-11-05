"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

// Every 3D scene on the site goes through this: the WebGL canvas is only
// created once its box comes near the screen, stops drawing while it's
// scrolled away, and lowers its resolution on slow devices, so several
// scenes on one page stay smooth. Without WebGL (old phones, GPU switched
// off) or if a scene throws, the box simply stays empty: the page around it
// never breaks.

let webgl: boolean | null = null;
function hasWebGL() {
  if (webgl == null) {
    try {
      const c = document.createElement("canvas");
      webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch { webgl = false; }
  }
  return webgl;
}

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("3D scene disabled:", e); }
  render() { return this.state.failed ? null : this.props.children; }
}
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
      if (e.isIntersecting && hasWebGL()) setMounted(true);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className={className} aria-hidden>
      {mounted && (
        <Guard>
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
        </Guard>
      )}
    </div>
  );
}

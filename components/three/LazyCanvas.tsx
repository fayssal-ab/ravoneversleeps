"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber";
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

class Guard extends Component<{ children: ReactNode; onFail?: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("3D scene disabled:", e); this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Reports once a couple of frames have been drawn (textures uploaded,
 *  lighting baked), nudging on-demand scenes so they get those frames. */
function FirstFrames({ onReady }: { onReady: () => void }) {
  const n = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [invalidate]);
  useFrame(() => {
    if (n.current > 2) return;
    n.current += 1;
    if (n.current === 3) onReady();
    else invalidate();
  });
  return null;
}
export function LazyCanvas({ className = "", children, frameloop, onReady, ...props }: CanvasProps & { className?: string; onReady?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  // capped at 1.5×: sharper adds little on these small props, costs a lot
  const [dpr, setDpr] = useState(1.25);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      setVisible(e.isIntersecting);
      if (!e.isIntersecting) return;
      if (hasWebGL()) setMounted(true);
      else onReady?.(); // nothing to wait for

    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [onReady]);

  return (
    <div ref={box} className={className} aria-hidden>
      {mounted && (
        <Guard onFail={onReady}>
        <Canvas
          dpr={dpr}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          {...props}
          frameloop={!visible ? "never" : reduce ? "demand" : (frameloop ?? "always")}
        >
          <PerformanceMonitor onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio))} onDecline={() => setDpr(1)} />
          <AdaptiveDpr pixelated={false} />
          {children}
          {onReady && <FirstFrames onReady={onReady} />}
        </Canvas>
        </Guard>
      )}
    </div>
  );
}

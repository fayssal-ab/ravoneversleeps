"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade/slide in when scrolled into view. Pure CSS (scroll-driven animation,
 * `.reveal` in globals.css): content is visible without JavaScript, in
 * browsers without support and with reduced motion.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

/** Children appear as they scroll in (same CSS reveal, per child). */
export function Stagger({ children, className }: { children: ReactNode[]; className?: string; step?: number }) {
  return (
    <div className={className}>
      {/* min-w-0: grid items default to their content width, so long text
          inside a card pushed it past the screen edge instead of truncating */}
      {children.map((c, i) => <div key={i} className="reveal min-w-0">{c}</div>)}
    </div>
  );
}

/** Formatted number (kept as a component so callers stay unchanged). */
export function CountUp({ value, prefix = "", suffix = "", decimals = 0, className }: { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  return <span className={className}>{prefix + value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix}</span>;
}

/** Card that tracks the cursor for the .spotlight glow and tilts slightly. */
export function SpotlightCard({ children, className = "", tilt = true }: { children: ReactNode; className?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={`spotlight ${className}`}
      style={tilt && !reduce ? { rotateX: rx, rotateY: ry, transformPerspective: 900 } : undefined}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        el.style.setProperty("--mx", `${x}px`);
        el.style.setProperty("--my", `${y}px`);
        if (tilt) {
          ry.set(((x / r.width) - 0.5) * 6);
          rx.set(-((y / r.height) - 0.5) * 6);
        }
      }}
      onPointerLeave={() => {
        animate(rx, 0, { duration: 0.4 });
        animate(ry, 0, { duration: 0.4 });
        ref.current?.style.setProperty("--my", "-400px");
      }}
    >
      {children}
    </motion.div>
  );
}

/** Live countdown to a UTC "YYYY-MM-DD HH:MM:SS" timestamp. */
export function Countdown({ to, className = "", size = "md" }: { to: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const target = new Date(to.replace(" ", "T") + "Z").getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, 1000);
    return () => { cancelAnimationFrame(first); clearInterval(t); };
  }, []);
  const left = Math.max(0, target - (now ?? target));
  const parts = [
    { v: Math.floor(left / 86_400_000), l: "Days" },
    { v: Math.floor(left / 3_600_000) % 24, l: "Hrs" },
    { v: Math.floor(left / 60_000) % 60, l: "Min" },
    { v: Math.floor(left / 1000) % 60, l: "Sec" },
  ];
  const box = size === "lg" ? "min-w-[3.6rem] px-2 py-2.5 text-2xl min-[400px]:min-w-[4.5rem] min-[400px]:px-3 min-[400px]:py-3 min-[400px]:text-3xl sm:min-w-[5.5rem] sm:text-4xl" : size === "sm" ? "min-w-[2.6rem] px-1.5 py-1 text-base" : "min-w-[3.6rem] px-2 py-2 text-2xl";
  return (
    <div className={`flex items-center gap-1 min-[400px]:gap-2 ${className}`} aria-label="Time left" suppressHydrationWarning>
      {parts.map((p, i) => (
        <div key={p.l} className="flex items-center gap-1 min-[400px]:gap-2">
          <div className={`rounded-xl border border-line-hot bg-bg/70 text-center font-mono font-bold text-neon shadow-[inset_0_0_18px_rgb(141_255_74/0.08)] ${box}`}>
            <span className="tabular-nums" suppressHydrationWarning>{now == null ? "--" : String(p.v).padStart(2, "0")}</span>
            <span className="block font-pixel text-[0.55rem] font-normal tracking-[0.2em] text-dim">{p.l}</span>
          </div>
          {i < parts.length - 1 && <span className="font-mono text-xl text-neon/40">:</span>}
        </div>
      ))}
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/constants";

// "Channel switch" between pages: the screen is cut into scanline strips
// that tear away left and right with a green edge, while a small on-screen
// display shows the channel number and the page name, like flipping to
// another stream. Skipped on the very first load (the preloader covers it)
// and with reduced motion. The page itself only fades and rises, and ends
// with no transform, so fixed popups inside pages keep working.

const STRIPS = 7;
const EASE = [0.7, 0, 0.2, 1] as const;
const PAGES = NAV.flatMap((n) => (n.children ? n.children.map((c) => ({ href: c.href, label: c.label })) : [{ href: n.href, label: n.label }]));

function channel(path: string): { ch: string; label: string } {
  const i = PAGES.findIndex((p) => (p.href === "/" ? path === "/" : path.startsWith(p.href)));
  const label = i >= 0 ? PAGES[i].label : path.startsWith("/account") ? "Account" : "Ravo";
  return { ch: String((i >= 0 ? i : PAGES.length) + 1).padStart(2, "0"), label };
}

export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  // first load: the preloader is the intro, no channel switch behind it
  const [play] = useState(() => typeof window !== "undefined" && !!window.__ravoReady && !reduce);
  const { ch, label } = channel(path);

  return (
    <>
      {play && (
        <>
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[90] flex flex-col">
            {Array.from({ length: STRIPS }).map((_, i) => {
              const dir = i % 2 ? 1 : -1;
              return (
                <motion.div
                  key={i}
                  className="relative flex-1 overflow-hidden bg-bg"
                  style={{ marginTop: i ? -1 : 0 }}
                  initial={{ x: 0 }}
                  animate={{ x: `${dir * 105}%` }}
                  transition={{ duration: 0.55, delay: 0.3 + Math.abs(i - (STRIPS - 1) / 2) * 0.04, ease: EASE }}
                >
                  <span className="absolute inset-y-0 w-[3px] bg-neon shadow-[0_0_24px_var(--color-neon)]" style={{ [dir > 0 ? "left" : "right"]: 0 }} />
                  <span className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(0deg,rgb(255_255_255/0.07)_0_1px,transparent_1px_4px)]" />
                </motion.div>
              );
            })}
          </div>

          {/* on-screen display */}
          <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[91] grid place-items-center px-6"
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.16, delay: 0.34 }}>
            <motion.div initial={{ scaleY: 0.03, scaleX: 1.35, filter: "brightness(3)" }} animate={{ scaleY: 1, scaleX: 1, filter: "brightness(1)" }} transition={{ duration: 0.16, ease: "easeOut" }}>
              <div className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.3em] text-dim">
                <span>CH</span>
                <span className="text-neon">{ch}</span>
                <span className="flex items-end gap-[3px]">
                  {[4, 7, 10, 13].map((h) => <span key={h} className="w-[3px] bg-neon" style={{ height: h }} />)}
                </span>
                <span className="ms-2 flex items-center gap-1.5 text-danger"><span className="size-2 rounded-full bg-danger" /> LIVE</span>
              </div>
              <p className="relative mt-3 text-center font-display text-[clamp(2.6rem,11vw,8rem)] leading-none">
                <span className="absolute inset-0 translate-x-[3px] text-neon opacity-60 mix-blend-screen">{label}</span>
                <span className="absolute inset-0 -translate-x-[3px] text-gold opacity-50 mix-blend-screen">{label}</span>
                <span className="chrome relative">{label}</span>
              </p>
            </motion.div>
          </motion.div>
        </>
      )}

      <motion.div
        initial={play ? { opacity: 0, y: 24 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </>
  );
}

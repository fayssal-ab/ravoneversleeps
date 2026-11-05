"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

// Tiny "Happy holidays · 2027 in 57d" pill. Days are computed in the browser
// (the visitor's own midnight), so the server renders it without a number.
export function NewYearChip({ year }: { year: number }) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setDays(Math.max(0, Math.ceil((new Date(year, 0, 1).getTime() - Date.now()) / 86_400_000)));
    const first = requestAnimationFrame(tick);
    const t = setInterval(tick, 60_000);
    return () => { cancelAnimationFrame(first); clearInterval(t); };
  }, [year]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.22em] text-muted backdrop-blur">
      <motion.span aria-hidden className="text-silver" animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>❄</motion.span>
      Happy holidays
      <span className="text-dim">·</span>
      <span className="text-neon">{days == null ? year : days === 0 ? `Happy ${year}!` : `${year} in ${days}d`}</span>
    </span>
  );
}

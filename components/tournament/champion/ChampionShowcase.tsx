"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef } from "react";
import { SlotArt } from "@/components/ui/SlotArt";

// The winner, as a reveal worth a stream: a hand-drawn gold crown with an
// emerald and rubies and a light sweep, a gold laurel around the champion's
// slot art in a gilded frame, the name in metal gold letter by letter, a
// folded ribbon, the prize counting up, turning light rays, rising gold
// dust and a one-time confetti burst. Everything is sized in `em` from the
// root font size, so one component serves a card (px) and the OBS stage (vh).
// `cult` turns it violet with a bone crown for "The Cult wins".

export type ShowcaseVariant = "champion" | "legend" | "cult";

const PAL = {
  champion: { hi: "#fff8d6", mid: "#f5c95a", lo: "#a86f12", deep: "#4a3005", glow: "#f5c95a", gem: ["#e9ffd2", "#8cff4a", "#1f6b0a"], ribbon: "#0f2a12" },
  legend: { hi: "#fffbe8", mid: "#ffd76a", lo: "#c0781a", deep: "#5a3206", glow: "#ffcf5a", gem: ["#fff3c4", "#ff8a3d", "#8a2a05"], ribbon: "#2a1406" },
  cult: { hi: "#f3e8ff", mid: "#c9a6ff", lo: "#6b3fb0", deep: "#1e0f33", glow: "#b36bff", gem: ["#ffd6e2", "#ff3a5a", "#6b0a1f"], ribbon: "#160a24" },
} as const;

/** The crown alone (also used small, e.g. in lists). */
export function Crown3D({ variant = "champion", className = "", shine = true }: { variant?: ShowcaseVariant; className?: string; shine?: boolean }) {
  const id = useId().replace(/:/g, "");
  const p = PAL[variant];
  const peaks = [[22, 58], [61, 30], [100, 14], [139, 30], [178, 58]];
  const body = "M14 104 L22 58 L44 82 L61 30 L80 74 L100 14 L120 74 L139 30 L156 82 L178 58 L186 104 Z";
  return (
    <svg viewBox="0 0 200 140" className={className} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.hi} /><stop offset=".38" stopColor={p.mid} /><stop offset=".62" stopColor={p.lo} /><stop offset="1" stopColor={p.deep} />
        </linearGradient>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.mid} /><stop offset=".5" stopColor={p.hi} /><stop offset=".55" stopColor={p.lo} /><stop offset="1" stopColor={p.deep} />
        </linearGradient>
        <radialGradient id={`e${id}`} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor={p.gem[0]} /><stop offset=".45" stopColor={p.gem[1]} /><stop offset="1" stopColor={p.gem[2]} /></radialGradient>
        <radialGradient id={`r${id}`} cx=".35" cy=".3" r=".75"><stop offset="0" stopColor="#ffd6dc" /><stop offset=".5" stopColor="#e0193a" /><stop offset="1" stopColor="#5a0410" /></radialGradient>
        <radialGradient id={`o${id}`} cx=".35" cy=".3" r=".7"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor={p.hi} /><stop offset="1" stopColor={p.lo} /></radialGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`c${id}`}><path d={body} /><rect x="12" y="98" width="176" height="30" rx="6" /></clipPath>
        <filter id={`f${id}`} x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000" floodOpacity=".6" /></filter>
      </defs>
      <g filter={`url(#f${id})`}>
        {/* points */}
        <path d={body} fill={`url(#g${id})`} stroke={p.deep} strokeWidth="2.5" strokeLinejoin="round" />
        {/* inner arches (depth) */}
        <path d="M30 100 L36 78 L50 92 L64 52 L82 86 L100 40 L118 86 L136 52 L150 92 L164 78 L170 100 Z" fill={p.deep} opacity=".28" />
        {/* filigree */}
        <path d="M40 96 Q50 84 60 96 M80 96 Q90 80 100 92 Q110 80 120 96 M140 96 Q150 84 160 96" fill="none" stroke={p.hi} strokeOpacity=".55" strokeWidth="1.6" />
        {/* top-edge highlight */}
        <path d="M22 58 L44 82 L61 30 L80 74 L100 14 L120 74 L139 30 L156 82 L178 58" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.4" strokeLinejoin="round" />
        {/* band */}
        <rect x="12" y="98" width="176" height="30" rx="6" fill={`url(#b${id})`} stroke={p.deep} strokeWidth="2.5" />
        <rect x="18" y="102" width="164" height="3" rx="1.5" fill="#fff" opacity=".45" />
        {[34, 56, 144, 166].map((x) => <circle key={x} cx={x} cy={113} r="3" fill={p.hi} stroke={p.deep} strokeWidth="1" />)}
        {/* gems */}
        {[[78, 113, 7], [122, 113, 7]].map(([x, y, r]) => <g key={x}><ellipse cx={x} cy={y} rx={r} ry={r * 1.15} fill={`url(#r${id})`} stroke={p.deep} strokeWidth="1.6" /><ellipse cx={x - 2} cy={y - 3} rx="2" ry="1.4" fill="#fff" opacity=".8" /></g>)}
        <path d="M100 99 L112 113 L100 127 L88 113 Z" fill={`url(#e${id})`} stroke={p.deep} strokeWidth="1.8" />
        <path d="M100 99 L100 127 M88 113 L112 113" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
        <path d="M95 106 L100 101 L103 105" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1.4" />
        {/* orbs on the peaks */}
        {peaks.map(([x, y]) => <g key={x}><circle cx={x} cy={y - 5} r={x === 100 ? 8 : 6} fill={`url(#o${id})`} stroke={p.deep} strokeWidth="1.6" /><circle cx={x - 2} cy={y - 8} r="1.8" fill="#fff" /></g>)}
      </g>
      {/* light sweep across the metal */}
      {shine && (
        <g clipPath={`url(#c${id})`}>
          <rect x="-80" y="0" width="60" height="140" fill={`url(#s${id})`} transform="skewX(-18)">
            <animate attributeName="x" values="-80;260;260" dur="3.2s" repeatCount="indefinite" />
          </rect>
        </g>
      )}
    </svg>
  );
}

/** Gold laurel: almond leaves in pairs along two arcs (bottom → top), with berries. */
function Laurel({ color }: { color: (typeof PAL)[ShowcaseVariant] }) {
  const id = useId().replace(/:/g, "");
  const { leaves, berries, stem } = useMemo(() => {
    const cx = 100, cy = 112, R = 86, from = 100, to = 232, n = 12;
    const pt = (deg: number, r = R) => { const a = (deg * Math.PI) / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const; };
    const out: { x: number; y: number; r: number; s: number }[] = [];
    const ber: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const deg = from + ((to - from) * i) / (n - 1);
      const s = 1.15 - (i / (n - 1)) * 0.5; // leaves shrink toward the tip
      const tangent = deg + 90; // the stem's direction at this point (growing upward)
      for (const side of [-1, 1]) {
        const [x, y] = pt(deg, R + side * 5);
        out.push({ x, y, r: tangent + 180 + side * 38, s });
      }
      if (i % 3 === 1) { const [x, y] = pt(deg + 4, R - 9); ber.push({ x, y }); }
    }
    const [sx, sy] = pt(from), [ex, ey] = pt(to + 6);
    return { leaves: out, berries: ber, stem: `M${sx} ${sy} A${R} ${R} 0 0 1 ${ex} ${ey}` };
  }, []);
  return (
    <svg viewBox="0 0 200 220" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={color.lo} /><stop offset=".45" stopColor={color.hi} /><stop offset="1" stopColor={color.mid} /></linearGradient>
        <radialGradient id={`bb${id}`} cx=".35" cy=".3" r=".7"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor={color.mid} /><stop offset="1" stopColor={color.lo} /></radialGradient>
      </defs>
      {[false, true].map((mirror) => (
        <g key={String(mirror)} transform={mirror ? "translate(200 0) scale(-1 1)" : undefined}>
          <motion.path d={stem} fill="none" stroke={color.lo} strokeWidth="2.4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.4, duration: 0.8 }} />
          {leaves.map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}>
              <motion.path d="M0 0 C4 -6 12 -6 18 0 C12 6 4 6 0 0 Z" fill={`url(#l${id})`} stroke={color.deep} strokeWidth=".7"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.45 + (i >> 1) * 0.06, type: "spring", stiffness: 320, damping: 15 }} />
              <path d="M1 0 L15 0" stroke={color.deep} strokeOpacity=".45" strokeWidth=".6" />
            </g>
          ))}
          {berries.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r="2.6" fill={`url(#bb${id})`} stroke={color.deep} strokeWidth=".5" />)}
        </g>
      ))}
    </svg>
  );
}

function Ribbon({ text, color }: { text: string; color: (typeof PAL)[ShowcaseVariant] }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 64" className="mx-auto block w-[18em]" aria-hidden>
      <defs><linearGradient id={`rb${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color.hi} /><stop offset=".5" stopColor={color.mid} /><stop offset="1" stopColor={color.lo} /></linearGradient></defs>
      {/* tails, folded behind */}
      <path d="M8 22 L48 22 L48 54 L8 54 L22 38 Z" fill={color.deep} stroke={`url(#rb${id})`} strokeWidth="2" />
      <path d="M312 22 L272 22 L272 54 L312 54 L298 38 Z" fill={color.deep} stroke={`url(#rb${id})`} strokeWidth="2" />
      <path d="M48 54 L60 46 L60 54 Z M272 54 L260 46 L260 54 Z" fill="#000" opacity=".6" />
      {/* front */}
      <path d="M44 12 Q160 2 276 12 L276 46 Q160 36 44 46 Z" fill={color.ribbon} stroke={`url(#rb${id})`} strokeWidth="2.5" />
      <text x="160" y="35" textAnchor="middle" fontSize="20" fontWeight="900" letterSpacing="8" fill={`url(#rb${id})`} style={{ fontFamily: "var(--font-head)" }}>{text}</text>
    </svg>
  );
}

function Prize({ value, start }: { value: number; start: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
    if (reduce) { el.textContent = fmt(value); return; }
    const c = animate(0, value, { delay: start, duration: 1.6, ease: [0.16, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = fmt(v); } });
    return () => c.stop();
  }, [value, start, reduce]);
  return <span ref={ref}>$0</span>;
}

/**
 * `size` is the root font size: "1rem" on a page card, "1.55vh" on the OBS
 * stage. `slots` is the champion's slot art (two for a duo team).
 */
export function ChampionShowcase({ name, slots, prize, label, sub, variant = "champion", size = "1rem", celebrate = true }: {
  name: string; slots: { name: string; image: string | null }[]; prize?: number | null; label?: string; sub?: string;
  variant?: ShowcaseVariant; size?: string; celebrate?: boolean;
}) {
  const reduce = useReducedMotion();
  const c = PAL[variant];
  const burst = useMemo(() => Array.from({ length: celebrate ? 46 : 0 }, (_, i) => {
    const a = (i / 46) * Math.PI * 2 + (i % 3) * 0.2;
    const d = 9 + (i % 5) * 3.2;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75 - 4, r: (i * 53) % 360, c: [c.mid, "#8cff4a", "#ffffff", c.hi][i % 4], w: i % 2 ? 0.55 : 0.35, delay: 0.35 + (i % 6) * 0.03 };
  }), [celebrate, c.mid, c.hi]);
  const dust = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: `${8 + ((i * 41) % 84)}%`, t: `${4 + (i % 4)}s`, d: `${(i % 8) * 0.4}s`, dx: `${((i % 5) - 2) * 2}em` })), []);
  const letters = name.split("");
  const nameSize = name.length > 22 ? 2.6 : name.length > 14 ? 3.4 : 4.4;
  return (
    <div className="relative isolate mx-auto w-full max-w-[44em] overflow-hidden text-center" style={{ fontSize: size }}>
      {/* rays + glow */}
      {/* sized to the card's width so the light always fades out before an edge */}
      <div aria-hidden className="absolute left-1/2 top-[34%] -z-10 aspect-square w-[min(46em,100%)] -translate-x-1/2 -translate-y-1/2">
        <div className="rays size-full opacity-60" style={{ ["--rc" as string]: c.glow, mask: "radial-gradient(closest-side, #000 18%, transparent 100%)", WebkitMask: "radial-gradient(closest-side, #000 18%, transparent 100%)" }} />
      </div>
      <div aria-hidden className="absolute left-1/2 top-[34%] -z-10 aspect-square w-[min(30em,80%)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[3em]" style={{ background: `radial-gradient(circle, ${c.glow}66, transparent 70%)` }} />
      {/* rising gold dust */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {dust.map((p, i) => <span key={i} className="ember" style={{ left: p.left, ["--t" as string]: p.t, ["--d" as string]: p.d, ["--dx" as string]: p.dx, ["--ec" as string]: c.mid }} />)}
      </div>

      <div className="relative px-[1.5em] pb-[1.8em] pt-[1em]">
        {/* crown drops in and settles */}
        <motion.div className="relative z-10 mx-auto w-[11em]" initial={reduce ? false : { y: "-6em", rotate: -12, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 170, damping: 11, delay: 0.1 }}>
          <motion.div animate={reduce ? undefined : { y: [0, -0.35, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.2 }} style={{ fontSize: "1em" }}>
            <Crown3D variant={variant} className="w-full drop-shadow-[0_0.4em_1.2em_rgba(0,0,0,0.6)]" />
          </motion.div>
        </motion.div>

        {/* gilded frame + laurel */}
        <motion.div className="relative mx-auto -mt-[1.2em] w-[17em]" style={{ aspectRatio: "200 / 220" }} initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 14, delay: 0.25 }}>
          <Laurel color={c} />
          <div className="absolute left-1/2 top-[16%] flex -translate-x-1/2 gap-[0.5em]">
            {slots.slice(0, 2).map((s, i) => (
              <div key={i} className="relative p-[0.32em]" style={{ background: `linear-gradient(150deg, ${c.hi}, ${c.mid} 30%, ${c.lo} 60%, ${c.hi} 80%, ${c.lo})`, clipPath: "polygon(12% 0,88% 0,100% 12%,100% 88%,88% 100%,12% 100%,0 88%,0 12%)" }}>
                <div className="relative overflow-hidden" style={{ clipPath: "polygon(11% 0,89% 0,100% 11%,100% 89%,89% 100%,11% 100%,0 89%,0 11%)" }}>
                  <SlotArt name={s.name} src={s.image} fluid={slots.length > 1 ? "6.6em" : "9em"} rounded="rounded-none" className="!border-0" />
                  <span aria-hidden className="ko-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ribbon */}
        <motion.div className="relative z-10 -mt-[2.6em]" initial={reduce ? false : { scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.6, type: "spring", stiffness: 220, damping: 16 }}>
          <Ribbon text={label ?? (variant === "legend" ? "LEGEND" : variant === "cult" ? "THE CULT" : "CHAMPION")} color={c} />
        </motion.div>

        {/* the name in metal */}
        <h2 className="mt-[0.4em] font-display leading-[0.95]" style={{ fontSize: `${nameSize}em` }} aria-label={name}>
          {letters.map((ch, i) => (
            <motion.span key={i} className="inline-block" initial={reduce ? false : { y: "0.5em", opacity: 0, rotateX: 80 }} animate={{ y: 0, opacity: 1, rotateX: 0 }}
              transition={{ delay: 0.75 + i * 0.035, type: "spring", stiffness: 420, damping: 20 }}
              style={{ backgroundImage: `linear-gradient(180deg, ${c.hi} 10%, ${c.mid} 45%, ${c.lo} 58%, ${c.hi} 92%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0.06em 0 ${c.deep}) drop-shadow(0 0 0.25em ${c.glow}88)` }}>
              {ch === " " ? " " : ch}
            </motion.span>
          ))}
        </h2>
        {sub && <motion.p className="mt-[0.5em] text-[1.05em] text-[#d8d0c4]" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>{sub}</motion.p>}
        {prize != null && prize > 0 && (
          <motion.p className="hud-num mt-[0.4em] font-bold leading-none" style={{ fontSize: "3.2em", color: c.mid, textShadow: `0 0.06em 0 ${c.deep}, 0 0 0.4em ${c.glow}99` }}
            initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.3, type: "spring", stiffness: 260, damping: 15 }}>
            <Prize value={prize} start={1.35} />
          </motion.p>
        )}
      </div>

      {/* one-time confetti burst from the crown */}
      {!reduce && burst.map((b, i) => (
        <motion.span key={i} aria-hidden className="pointer-events-none absolute left-1/2 top-[18%] block" style={{ width: `${b.w}em`, height: `${b.w * 1.8}em`, background: b.c, borderRadius: "0.08em" }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }} animate={{ x: `${b.x}em`, y: [`0em`, `${b.y}em`, `${b.y + 14}em`], rotate: b.r * 3, opacity: [0, 1, 1, 0] }}
          transition={{ delay: b.delay, duration: 2.6, times: [0, 0.3, 1], ease: "easeOut" }} />
      ))}
    </div>
  );
}

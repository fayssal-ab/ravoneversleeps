"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Coins } from "lucide-react";
import { useRef, type ReactNode } from "react";

export interface StoreItemView {
  id: number; name: string; description: string;
  kind: "cash" | "bonus" | "game" | "merch" | "other";
  price: number; stock: number | null;
}

const KIND_LABEL: Record<StoreItemView["kind"], string> = { cash: "Qzino tip", bonus: "Bonus buy", game: "Played on stream", merch: "Merch", other: "Reward" };
const KIND_SUIT: Record<StoreItemView["kind"], string> = { cash: "♦", bonus: "♠", game: "♣", merch: "♥", other: "♠" };

// Gentle springs: the card glides after the pointer and settles back with
// no snap. Layers sit at different depths (preserve-3d), so the value and
// the price float above the art as it tilts. Nothing on the 3D path clips
// (overflow would flatten it); the art clips inside its own layer.
const SPRING = { stiffness: 140, damping: 18, mass: 0.6 };

/** "$40 bonus buy" → "$40", "Keno: $1 x15" → "Keno" (a "Name:" prefix wins). */
function headline(name: string): string {
  if (name.includes(":")) return name.split(":")[0].trim();
  return name.match(/\$\d[\d,]*/)?.[0] ?? name.split(/[·-]/)[0].trim().split(" ").slice(0, 2).join(" ");
}

export function StoreCard({ item, index, action }: { item: StoreItemView; index: number; action: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0), hover = useMotionValue(0);
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [12, -12]), SPRING);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-16, 16]), SPRING);
  const lift = useSpring(useTransform(hover, [0, 1], [0, -10]), SPRING);
  const gx = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const gy = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgb(255 255 255 / 0.18), transparent 55%)`;
  const soldOut = item.stock != null && item.stock <= 0;

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType === "touch") return;
    const r = ref.current!.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const leave = () => { px.set(0); py.set(0); hover.set(0); };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 40, rotateX: -18 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 90, damping: 16, delay: (index % 3) * 0.08 }}
      style={{ perspective: 1100 }}
      className="h-full"
    >
      <motion.div
        ref={ref}
        onPointerMove={move}
        onPointerEnter={() => hover.set(1)}
        onPointerLeave={leave}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, y: lift, transformStyle: "preserve-3d" }}
        className={`store-card relative flex h-full flex-col rounded-[1.6rem] ${soldOut ? "opacity-60" : ""}`}
      >
        {/* back plate */}
        <div aria-hidden className="store-card-plate absolute inset-0 rounded-[1.6rem]" />

        {/* art: value in chrome floating over the 3D table, suit and chips around it */}
        <div className="relative h-44" style={{ transformStyle: "preserve-3d" }}>
          <div aria-hidden className="absolute inset-0 overflow-hidden rounded-t-[1.6rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/hero/bg-3d-m.webp" alt="" loading="lazy" draggable={false} className="size-full object-cover object-[50%_35%] opacity-60" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgb(4_10_5/0.1),rgb(4_10_5/0.85)_78%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[var(--color-surface)] to-transparent" />
          </div>
          <span aria-hidden className="store-suit absolute left-5 top-4 font-display text-5xl" style={{ transform: "translateZ(35px)" }}>{KIND_SUIT[item.kind]}</span>
          <span aria-hidden className="store-chip absolute bottom-6 right-6 size-10 rounded-full" style={{ transform: "translateZ(45px) rotateX(55deg)" }} />
          <div className="absolute inset-0 grid place-items-center" style={{ transform: "translateZ(70px)" }}>
            <span className="chrome font-display text-6xl leading-none drop-shadow-[0_10px_22px_rgb(0_0_0/0.85)] sm:text-7xl">{headline(item.name)}</span>
          </div>
          {item.stock != null && (
            <span className="chip absolute right-3 top-3 !py-0.5 text-[0.7rem]" style={{ transform: "translateZ(40px)" }}>{soldOut ? "Sold out" : `${item.stock} left`}</span>
          )}
        </div>

        <div className="relative flex flex-1 flex-col p-5" style={{ transform: "translateZ(30px)" }}>
          <p className="font-head text-xs font-semibold uppercase tracking-[0.18em] text-neon">{KIND_LABEL[item.kind]}</p>
          <h3 className="mt-1 font-head text-xl font-bold leading-tight">{item.name}</h3>
          {item.description && <p className="mt-2 text-sm text-muted">{item.description}</p>}
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <span className="flex items-center gap-1.5 font-mono text-2xl font-bold text-gold" style={{ transform: "translateZ(20px)" }}>
              <Coins className="size-5" />
              {item.price.toLocaleString("en-US")}
              <span className="text-xs font-semibold text-dim">pts</span>
            </span>
            {action}
          </div>
        </div>

        {/* glare follows the pointer */}
        {!reduce && <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-[1.6rem]" style={{ background: glare, transform: "translateZ(80px)" }} />}
      </motion.div>
    </motion.div>
  );
}

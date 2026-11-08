"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { DISCORD_URL, KICK_URL, NAV, QZINO_CODE, X_URL } from "@/lib/constants";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { NavActions } from "./NavActions";

export interface TopBarViewer { name: string; avatar: string; points: number; level: number }

/** LIVE / OFFLINE pill from the Kick status. */
function LiveBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 font-pixel text-[0.62rem] uppercase tracking-[0.14em] sm:inline-flex ${
        live ? "border-danger/60 bg-danger/15 text-danger" : "border-line bg-surface-2 text-dim"
      }`}
    >
      <span className={`size-1.5 rounded-full ${live ? "animate-pulse bg-danger shadow-[0_0_8px_var(--color-danger)]" : "bg-dim"}`} />
      {live ? "Live" : "Offline"}
    </span>
  );
}

const EASE = [0.76, 0, 0.24, 1] as const;

/** The green pill that glides to the active desktop link. */
function Pill() {
  return <motion.span layoutId="nav-pill" aria-hidden className="absolute inset-0 rounded-full bg-neon shadow-[0_3px_0_var(--color-neon-deep)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />;
}

function StreamMenu({ item, active }: { item: (typeof NAV)[number]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 font-head text-[0.82rem] font-bold uppercase tracking-[0.12em] transition-colors ${
          active ? "text-neon-ink" : open ? "text-text" : "text-muted hover:text-text"
        }`}
      >
        {active && <Pill />}
        <span className="relative flex items-center gap-1">{item.label} <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} /></span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="absolute left-1/2 top-full w-64 -translate-x-1/2 pt-3"
          >
            <div className="panel p-2 shadow-[0_24px_60px_-10px_rgb(0_0_0/0.8)]">
              {item.children!.map((c) => (
                <Link key={c.href} href={c.href} onClick={() => setOpen(false)} className="group block rounded-xl px-3 py-2.5 transition hover:bg-neon">
                  <span className="block font-head text-sm font-bold uppercase tracking-wider text-text group-hover:text-neon-ink">{c.label}</span>
                  <span className="block text-xs text-dim group-hover:text-neon-ink/70">{c.hint}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar({ viewer, live }: { viewer: TopBarViewer | null; live: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // a new page closes the menu
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) { setSeen(pathname); setOpen(false); }

  // menu open: the page behind stops scrolling, Escape closes
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { root.style.overflow = ""; window.removeEventListener("keydown", esc); };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div
        className={`mx-auto flex h-[calc(var(--nav-h)-0.75rem)] max-w-6xl items-center gap-3 rounded-[1.4rem] border px-3 transition-all duration-300 sm:px-4 ${
          scrolled ? "border-line-hot bg-bg/85 shadow-[0_18px_50px_-18px_rgb(0_0_0/0.9)] backdrop-blur-xl" : "border-line bg-surface/70 backdrop-blur-md"
        }`}
      >
        <Link href="/" className="group flex items-center gap-2.5" aria-label="RAVONEVERSLEEPS home">
          <span className="relative block size-10 overflow-hidden rounded-full ring-2 ring-neon/40 transition group-hover:ring-neon group-hover:shadow-[0_0_22px_rgb(141_255_74/0.55)]">
            <Image src="/media/ravo-avatar.webp" alt="" fill sizes="40px" className="object-cover transition duration-500 group-hover:scale-110" />
          </span>
          <span className="font-display text-[1.6rem] leading-none tracking-wide max-[359px]:hidden">
            <span className="chrome">RAVO</span>
          </span>
          <LiveBadge live={live} />
        </Link>

        <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((n) =>
            n.children ? (
              <StreamMenu key={n.href} item={n} active={n.children.some((c) => isActive(c.href))} />
            ) : (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`relative whitespace-nowrap rounded-full px-4 py-2 font-head text-[0.82rem] font-bold uppercase tracking-[0.12em] transition-colors ${
                  isActive(n.href) ? "text-neon-ink" : "text-muted hover:text-text"
                }`}
              >
                {isActive(n.href) && <Pill />}
                <span className="relative">{n.label}</span>
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <NavActions viewer={viewer} />
          <button
            type="button"
            className={`relative grid size-10 place-items-center rounded-xl border transition-colors lg:hidden ${open ? "border-neon bg-neon text-neon-ink" : "border-line-hot text-text"}`}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <span aria-hidden className={`absolute h-[2px] w-5 rounded-full bg-current transition-transform duration-300 ${open ? "rotate-45" : "-translate-y-[4px]"}`} />
            <span aria-hidden className={`absolute h-[2px] rounded-full bg-current transition-all duration-300 ${open ? "w-5 -rotate-45" : "w-3.5 translate-x-[3px] translate-y-[4px]"}`} />
          </button>
        </div>
      </div>

    </header>
    <MobileMenu open={open} isActive={isActive} onClose={() => setOpen(false)} />
    </>
  );
}

const SOCIALS = [
  { href: KICK_URL, label: "Kick", icon: "kick" as const },
  { href: X_URL, label: "X", icon: "x" as const },
  { href: DISCORD_URL, label: "Discord", icon: "discord" as const },
];

/**
 * Phones: a full-screen menu that drops in like a curtain (clip-path), with
 * big numbered links rising one after another, then the socials and the code.
 */
function MobileMenu({ open, isActive, onClose }: { open: boolean; isActive: (href: string) => boolean; onClose: () => void }) {
  // every page as one numbered list, grouped like the desktop menu
  const groups = [
    { label: "", links: NAV.filter((n) => !n.children).map((n) => ({ href: n.href, label: n.label, hint: "" })) },
    ...NAV.filter((n) => n.children).map((n) => ({ label: n.label, links: n.children! })),
  ];
  let i = 0;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id="mobile-menu"
          data-lenis-prevent
          className="fixed inset-0 z-40 overflow-y-auto bg-bg px-5 pb-10 pt-[calc(var(--nav-h)+1.25rem)] lg:hidden"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div aria-hidden className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_85%_5%,rgb(141_255_74/0.18),transparent_55%),radial-gradient(ellipse_at_5%_95%,rgb(255_215_106/0.10),transparent_55%)]" />
          <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.07] [background-image:repeating-linear-gradient(0deg,#fff_0_1px,transparent_1px_4px)]" />

          <nav aria-label="Mobile" className="relative mx-auto max-w-xl">
            {groups.map((g) => (
              <div key={g.label || "main"} className="mb-5">
                {g.label && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-1 font-pixel text-[0.68rem] uppercase tracking-[0.25em] text-neon">{g.label}</motion.p>
                )}
                <ul>
                  {g.links.map((l) => {
                    const n = ++i;
                    const active = isActive(l.href);
                    return (
                      <li key={l.href + l.label} className="overflow-hidden border-b border-line">
                        <motion.div initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ delay: 0.18 + n * 0.045, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
                          <Link href={l.href} onClick={onClose} aria-current={active ? "page" : undefined}
                            className={`group flex items-center gap-4 py-3.5 ${active ? "text-neon" : "text-text"}`}>
                            <span className="w-7 shrink-0 font-mono text-xs text-dim">{String(n).padStart(2, "0")}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-display text-[clamp(1.7rem,8vw,2.6rem)] leading-none">{l.label}</span>
                              {l.hint && <span className="mt-1 block text-xs text-dim">{l.hint}</span>}
                            </span>
                            <ArrowUpRight className={`size-5 shrink-0 transition-transform duration-300 group-active:translate-x-1 ${active ? "text-neon" : "text-dim"}`} />
                          </Link>
                        </motion.div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }} className="mt-8 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-line-hot bg-surface/70 py-3 text-xs font-bold uppercase tracking-widest text-muted transition active:border-neon active:text-neon">
                    <SocialIcon name={s.icon} className="size-5" /> {s.label}
                  </a>
                ))}
              </div>
              <p className="text-center font-mono text-xs uppercase tracking-[0.25em] text-dim">Qzino code <span className="text-neon">{QZINO_CODE}</span></p>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

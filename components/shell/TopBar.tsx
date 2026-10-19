"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Menu, X } from "lucide-react";
import { NAV } from "@/lib/constants";
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
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 font-head text-[0.82rem] font-bold uppercase tracking-[0.12em] transition ${
          active || open ? "bg-neon text-neon-ink shadow-[0_3px_0_var(--color-neon-deep)]" : "text-muted hover:text-text"
        }`}
      >
        {item.label} <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
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
                className={`whitespace-nowrap rounded-full px-4 py-2 font-head text-[0.82rem] font-bold uppercase tracking-[0.12em] transition ${
                  isActive(n.href) ? "bg-neon text-neon-ink shadow-[0_3px_0_var(--color-neon-deep)]" : "text-muted hover:text-text"
                }`}
              >
                {n.label}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <NavActions viewer={viewer} />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-line-hot text-text lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="panel mx-auto mt-2 max-w-6xl p-3 lg:hidden"
            aria-label="Mobile"
          >
            {/* same groups as the desktop menu */}
            <div className="space-y-3">
              {[{ label: "", children: NAV.filter((n) => !n.children).map((n) => ({ href: n.href, label: n.label })) }, ...NAV.filter((n) => n.children)].map((n) => {
                const links = n.children!;
                return (
                  <div key={n.label || "main"}>
                    {n.label && <p className="px-2 pb-1 font-pixel text-[0.68rem] uppercase tracking-[0.22em] text-neon">{n.label}</p>}
                    <div className="grid grid-cols-2 gap-1">
                      {links.map((c) => (
                        <Link
                          key={c.href + c.label}
                          href={c.href}
                          onClick={() => setOpen(false)}
                          className={`block rounded-xl px-4 py-3 font-head text-sm font-bold uppercase tracking-widest ${
                            isActive(c.href) ? "bg-neon text-neon-ink" : "text-muted hover:bg-surface-2"
                          }`}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

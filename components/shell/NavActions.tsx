"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronDown, Crown, Gift, LogOut, Radio, ShoppingBag, Target, Trophy, User } from "lucide-react";
import { PromoSteps } from "@/components/promo/PromoSteps";

// Navbar actions: gift (how to claim the Qzino code), bell (site events and
// the viewer's own updates; unread = not opened yet on this browser) and the
// account menu.

export interface NavViewer { name: string; avatar: string; points: number; level: number }
interface Note { id: string; kind: "live" | "event" | "personal"; title: string; body: string; href: string; at: string }

const SEEN_KEY = "ravo.seenNotes";
const GIFT_KEY = "ravo.giftSeen";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function Pop({ open, children, width = "w-[min(92vw,22rem)]" }: { open: boolean; children: ReactNode; width?: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.16 }}
          className={`fixed right-3 top-[calc(var(--nav-h)+0.25rem)] z-[60] sm:absolute sm:right-0 sm:top-full sm:mt-3 ${width}`}
        >
          <div className="panel max-h-[75vh] overflow-y-auto p-3 shadow-[0_24px_60px_-10px_rgb(0_0_0/0.85)]">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const iconBtn = "relative grid size-10 place-items-center rounded-xl border border-line-hot bg-bg/50 text-text transition hover:border-neon hover:text-neon";

function GiftButton() {
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  useEffect(() => {
    // read after hydration (the server can't know what this browser has seen)
    const t = setTimeout(() => { try { setFresh(!localStorage.getItem(GIFT_KEY)); } catch { /* storage blocked */ } }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" className={iconBtn} aria-label="Claim your Qzino bonus" aria-expanded={open}
        onClick={() => { setOpen((v) => !v); setFresh(false); try { localStorage.setItem(GIFT_KEY, "1"); } catch { /* ignore */ } }}>
        <Gift className="size-5" />
        {fresh && <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-pulse rounded-full bg-gold shadow-[0_0_8px_var(--color-gold)]" />}
      </button>
      <Pop open={open} width="w-[min(92vw,24rem)]">
        <p className="px-1 pb-3 font-display text-2xl"><span className="chrome">Claim your</span> <span className="neon-text">$50</span></p>
        <PromoSteps compact />
      </Pop>
    </div>
  );
}

function timeAgo(at: string): string {
  const t = new Date(at.replace(" ", "T") + "Z").getTime();
  const m = Math.round((Date.now() - t) / 60000);
  if (!Number.isFinite(m) || m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return `${Math.round(m / 1440)}d`;
}

function BellButton() {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);

  useEffect(() => {
    let stop = false;
    const t0 = setTimeout(() => { try { setSeen(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { /* ignore */ } }, 0);
    const load = () => fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()).then((d: { notes?: Note[] }) => { if (!stop) setNotes(d.notes ?? []); }).catch(() => {});
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 90_000);
    return () => { stop = true; clearTimeout(t0); clearInterval(t); };
  }, []);

  const unread = (notes ?? []).filter((n) => !seen.includes(n.id)).length;
  const markSeen = () => {
    const ids = (notes ?? []).map((n) => n.id);
    setSeen(ids);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" className={iconBtn} aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`} aria-expanded={open}
        onClick={() => { setOpen((v) => !v); markSeen(); }}>
        <Bell className={`size-5 ${unread ? "origin-top animate-[bell_1.8s_ease-in-out_infinite]" : ""}`} />
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-danger px-1 font-mono text-[10px] font-bold text-white shadow-[0_0_10px_var(--color-danger)]">{unread}</span>}
      </button>
      <Pop open={open}>
        <p className="px-1 pb-2 font-head text-sm font-bold uppercase tracking-[0.18em] text-muted">Notifications</p>
        {notes == null ? (
          <p className="p-3 text-sm text-dim">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="p-3 text-sm text-dim">All quiet. Ravo is probably asleep… just kidding, he never sleeps.</p>
        ) : (
          <ul className="space-y-1">
            {notes.map((n) => (
              <li key={n.id}>
                <Link href={n.href} onClick={close} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-surface-2">
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${n.kind === "live" ? "bg-danger/15 text-danger" : n.kind === "personal" ? "bg-gold/15 text-gold" : "bg-neon/10 text-neon"}`}>
                    {n.kind === "live" ? <Radio className="size-4" /> : n.kind === "personal" ? <ShoppingBag className="size-4" /> : <Trophy className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold leading-snug">{n.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-dim">{timeAgo(n.at)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 block text-xs leading-snug text-muted">{n.body}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Pop>
    </div>
  );
}

function UserMenu({ viewer }: { viewer: NavViewer }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line-hot bg-bg/60 py-1 pl-1 pr-2.5 transition hover:border-neon">
        {viewer.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.avatar} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-surface-3 font-head text-sm font-bold text-neon">{viewer.name.slice(0, 1).toUpperCase()}</span>
        )}
        <span className="hidden max-w-[8rem] truncate font-head text-sm font-bold sm:inline">{viewer.name}</span>
        <ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      <Pop open={open} width="w-64">
        <div className="rounded-xl bg-bg-2 p-3">
          <span className="block truncate font-head font-bold">{viewer.name}</span>
        </div>
        <nav className="mt-2 space-y-0.5 text-sm">
          {[
            { href: "/account", label: "My account", icon: User },
            { href: "/challenges", label: "Challenges", icon: Target },
            { href: "/vip-transfer", label: "VIP Transfer", icon: Crown },
          ].map((l) => (
            <Link key={l.href} href={l.href} onClick={close} className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted transition hover:bg-surface-2 hover:text-text">
              <l.icon className="size-4" /> {l.label}
            </Link>
          ))}
          <button type="button" onClick={async () => { await fetch("/api/auth/user/logout", { method: "POST" }).catch(() => {}); window.location.reload(); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-muted transition hover:bg-danger/10 hover:text-danger">
            <LogOut className="size-4" /> Sign out
          </button>
        </nav>
      </Pop>
    </div>
  );
}

export function NavActions({ viewer }: { viewer: NavViewer | null }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <GiftButton />
      <BellButton />
      {viewer ? <UserMenu viewer={viewer} /> : <Link href="/account" className="btn btn-neon btn-sm">Log in</Link>}
    </div>
  );
}

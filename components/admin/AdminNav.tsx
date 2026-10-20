"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crosshair, Crown, Flag, Gamepad2, Gauge, MessagesSquare, Radio, ScrollText, Swords, Target, Trophy, Users } from "lucide-react";

const GROUPS = [
  { title: "", links: [{ href: "/admin", label: "Dashboard", icon: Gauge }] },
  {
    title: "Players",
    links: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/vip", label: "VIP Transfer", icon: Crown },
    ],
  },
  {
    title: "Rewards",
    links: [
      { href: "/admin/leaderboard", label: "Leaderboard prizes", icon: Trophy },
      { href: "/admin/challenges", label: "Challenges", icon: Target },
      { href: "/admin/milestones", label: "Milestones", icon: Flag },
    ],
  },
  {
    title: "Stream",
    links: [
      { href: "/admin/tournaments", label: "Tournament", icon: Swords },
      { href: "/admin/hunts", label: "Bonus hunts", icon: Crosshair },
      { href: "/admin/stream", label: "Stream & schedule", icon: Radio },
      { href: "/admin/slots", label: "Slot catalogue", icon: Gamepad2 },
    ],
  },
  { title: "System", links: [{ href: "/admin/discord", label: "Discord", icon: MessagesSquare }, { href: "/admin/audit", label: "Audit log", icon: ScrollText }] },
];

/** Items waiting for the admin on that page. */
function Badge({ n }: { n: number }) {
  return <span className="min-w-5 rounded-full bg-gold px-1.5 text-center font-mono text-[11px] font-bold leading-5 text-bg" aria-label={`${n} waiting`}>{n > 99 ? "99+" : n}</span>;
}

export function AdminNav({ counts = {} }: { counts?: Record<string, number> }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <nav aria-label="Admin">
      {/* phones: one scrollable row */}
      <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
        {GROUPS.flatMap((g) => g.links).map((l) => (
          <Link key={l.href} href={l.href} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isActive(l.href) ? "bg-neon/10 text-neon" : "text-muted"}`}>
            <l.icon className="size-4" /> {l.label}
            {counts[l.href] ? <Badge n={counts[l.href]} /> : null}
          </Link>
        ))}
      </div>
      {/* desktop: grouped sidebar */}
      <div className="hidden space-y-5 lg:block">
        {GROUPS.map((g) => (
          <div key={g.title || "main"}>
            {g.title && <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-dim">{g.title}</p>}
            <div className="space-y-0.5">
              {g.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive(l.href) ? "bg-neon/10 text-neon" : "text-muted hover:bg-white/[0.04] hover:text-text"
                  }`}
                >
                  <l.icon className="size-4 shrink-0" />
                  <span className="flex-1">{l.label}</span>
                  {counts[l.href] ? <Badge n={counts[l.href]} /> : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

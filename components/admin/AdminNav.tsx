"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Crosshair, Crown, Flag, Gamepad2, Gauge, Radio, ScrollText, ShoppingBag, Swords, Target, Ticket, Users } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/vip", label: "VIP Transfer", icon: Crown },
  { href: "/admin/milestones", label: "Milestones", icon: Flag },
  { href: "/admin/store", label: "Store", icon: ShoppingBag },
  { href: "/admin/users", label: "Users & points", icon: Users },
  { href: "/admin/ranks", label: "Ranks", icon: Award },
  { href: "/admin/raffles", label: "Raffles", icon: Ticket },
  { href: "/admin/hunts", label: "Bonus hunts", icon: Crosshair },
  { href: "/admin/tournaments", label: "Tournament", icon: Swords },
  { href: "/admin/challenges", label: "Challenges", icon: Target },
  { href: "/admin/slots", label: "Slot catalogue", icon: Gamepad2 },
  { href: "/admin/stream", label: "Stream", icon: Radio },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 font-head text-sm font-semibold transition ${
              active ? "bg-neon/10 text-neon" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            <l.icon className="size-4" />
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

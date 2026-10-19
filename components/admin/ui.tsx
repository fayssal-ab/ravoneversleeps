import Link from "next/link";
import type { ReactNode } from "react";

export function AdminTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 border-b border-line pb-5">
      <h1 className="font-head text-2xl font-bold tracking-tight text-text">{title}</h1>
      {children && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

/** Page tabs (links, so every tab has its own URL). */
export function Tabs({ items, current }: { items: { key: string; label: string; href: string; count?: number; hot?: boolean }[]; current: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            t.key === current ? "border-neon text-text" : "border-transparent text-muted hover:text-text"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${t.hot ? "bg-gold text-bg" : "bg-surface-3 text-muted"}`}>{t.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`admin-card p-5 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold text-text">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-dim">{hint}</span>}
    </label>
  );
}

/** "YYYY-MM-DD HH:MM:SS" (UTC) → value for <input type="datetime-local">. */
export const toLocalInput = (s: string) => s.replace(" ", "T").slice(0, 16);

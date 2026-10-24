import type { ReactNode } from "react";
import { discordErrorText } from "@/lib/discordBot";

// Shared bits of Admin → Server (Discord-style, see .dc* in globals.css).

export type Query = Record<string, string | undefined>;

/** /admin/server URL with these params (empty ones dropped). */
export function serverHref(params: Query): string {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return qs ? `/admin/server?${qs}` : "/admin/server";
}

/** Discord's role color, or its grey for "no color". */
export const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, "0")}` : "#99aab5");
export const colorInput = (c: number) => `#${(c || 0x99aab5).toString(16).padStart(6, "0")}`;

/** Load something from Discord, keeping the error to show instead of crashing the page. */
export async function settle<T>(p: Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await p, error: null };
  } catch (e) {
    const t = discordErrorText(e);
    const hint = /50001|Missing Access/.test(t) ? "Turn on \"Server Members Intent\" in the Discord Developer Portal → Bot, then reload."
      : /50013|Missing Permissions/.test(t) ? "The bot is missing a permission for this. Give its role Administrator, and drag it to the top in Server Settings → Roles."
      : "";
    return { data: null, error: hint ? `${hint} (${t})` : t };
  }
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-[4px] border border-[#da373c]/60 bg-[#da373c]/15 px-3 py-2 text-sm text-[#ffb3b5]">{children}</p>;
}

export function OkBox({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-[4px] border border-[#23a55a]/60 bg-[#23a55a]/15 px-3 py-2 text-sm text-[#a6f0c3]">{children}</p>;
}

export function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`border-t dc-divider pt-5 first:border-t-0 first:pt-0 ${className}`}>
      <h3 className="dc-h mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function Avatar({ src, size = 32 }: { src: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full" style={{ width: size, height: size }} />;
}

export function Dot({ color, size = 12 }: { color: number; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ background: hex(color), width: size, height: size }} />;
}

/** Hidden "back" field so an action returns to the same view. */
export const Back = ({ to }: { to: string }) => <input type="hidden" name="back" value={to} />;

/** One permission / option row with a Discord switch. */
export function SwitchRow({ name, label, desc, checked, disabled }: { name: string; label: string; desc?: string; checked: boolean; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 border-b dc-divider py-3.5 last:border-b-0 ${disabled ? "" : "cursor-pointer"}`}>
      <span>
        <span className="block font-medium text-[#f2f3f5]">{label}</span>
        {desc && <span className="mt-0.5 block text-sm text-[#949ba4]">{desc}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={checked} disabled={disabled} className="dc-switch mt-0.5" />
    </label>
  );
}

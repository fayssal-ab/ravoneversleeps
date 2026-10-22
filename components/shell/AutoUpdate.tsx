"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps open pages current without Ctrl+R.

/** Someone typing or in a dialog: a reload would lose what they entered. */
function busy(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) || !!document.querySelector("dialog[open]");
}

/** Reloads the page once a new deploy is live (checked every `every` ms and when the tab comes back). */
export function AutoUpdate({ every = 60_000 }: { every?: number }) {
  useEffect(() => {
    let first: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let stopped = false;
    const check = async () => {
      if (running) return;
      running = true;
      clearTimeout(timer);
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { v } = (await res.json()) as { v: string };
        if (first == null) first = v;
        else if (v !== first && !busy()) { location.reload(); return; }
      } catch {
        // offline or mid-deploy: try again next time
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(check, every);
    };
    const onVisible = () => { if (!document.hidden) void check(); };
    void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [every]);
  return null;
}

/** Re-renders the page's server data every `every` ms while the tab is visible. */
export function LiveRefresh({ every }: { every: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) router.refresh(); }, every);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}

import Image from "next/image";
import type { ReactNode } from "react";
import { ERROR_TEXT } from "@/lib/errors";
import { QZINO_URL } from "@/lib/constants";
import { QzinoLogo } from "./QzinoLogo";

/** Page title block: a banner on the chrome-claw wallpaper with a slow
 *  light sweep, pixel eyebrow, chrome metal title, optional blurb and a small
 *  "with Qzino" pill so every page shows the partner. */
export function PageHeader({ eyebrow, title, accent, children }: { eyebrow: string; title: string; accent?: string; children?: ReactNode }) {
  return (
    <header className="page-banner relative mx-auto mb-10 max-w-5xl overflow-hidden rounded-[2rem] px-5 pb-10 pt-10 text-center sm:px-10 sm:pt-12">
      <div aria-hidden className="page-banner-bg">
        <Image src="/media/claws-bg.webp" alt="" fill sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover object-center" />
      </div>
      <div aria-hidden className="page-banner-sweep" />
      <p className="eyebrow relative">{eyebrow}</p>
      <h1 className="relative mt-4 font-display text-5xl leading-[0.95] sm:text-7xl">
        <span className="chrome">{title}</span>
        {accent && <> <span className="neon-text">{accent}</span></>}
      </h1>
      {children && <div className="relative mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{children}</div>}
      <div className="relative mt-7 flex justify-center">
        <span className="partner-pill">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.25em] text-dim">With</span>
          <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Qzino"><QzinoLogo className="h-4 w-auto" /></a>
        </span>
      </div>
    </header>
  );
}

/** Empty state with the sleeping pug. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="panel scanlines relative overflow-hidden px-6 py-14 text-center">
      <div className="relative mx-auto h-40 w-36">
        <div className="absolute inset-4 rounded-full bg-neon/20 blur-2xl" />
        <Image src="/media/ravo-mascot.webp" alt="" fill sizes="144px" className="animate-dance object-contain" />
      </div>
      <p className="mt-6 font-display text-3xl"><span className="chrome">{title}</span></p>
      {children && <div className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/** ?ok= / ?error= banner after a server action redirect. */
export function Flash({ ok, error, detail, okText }: { ok?: string; error?: string; detail?: string; okText?: string }) {
  if (!ok && !error) return null;
  if (error) {
    return (
      <div role="alert" className="mb-6 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
        {ERROR_TEXT[error] ?? ERROR_TEXT.unexpected}
        {detail && <span className="ml-2 opacity-70">({detail})</span>}
      </div>
    );
  }
  return (
    <div role="status" className="mb-6 rounded-xl border border-neon/50 bg-neon/10 px-4 py-3 text-sm text-neon">
      {okText ?? "Saved."}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, accent, right }: { eyebrow: string; title: string; accent?: string; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl leading-none sm:text-5xl">
          <span className="chrome">{title}</span>
          {accent && <> <span className="neon-text">{accent}</span></>}
        </h2>
      </div>
      {right}
    </div>
  );
}

import { ArrowRight } from "lucide-react";
import { CopyCode } from "@/components/ui/CopyCode";
import { FlushLogo } from "@/components/ui/FlushLogo";
import { Reveal } from "@/components/ui/motion";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { FLUSH_URL, QZINO_CODE, QZINO_URL } from "@/lib/constants";
import { PartnerOrbit } from "./PartnerOrbit";

// Two partners, one pug: Flush on the left, Qzino on the right, Ravo in the
// middle with both logos circling him. Keep Flush first and Qzino second.
export function Partners() {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
      <Reveal>
        <div className="mb-10 text-center">
          <p className="inline-flex items-center gap-3 font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">
            <span className="partner-count">02</span> Official partners
          </p>
          <h2 className="mt-3 font-display text-5xl leading-[0.9] sm:text-6xl">
            <span className="chrome">Flush</span> <span className="neon-text">×</span> <span className="chrome">Qzino</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">Two partner sites, one pug. Pick where you play with Ravo.</p>
        </div>
      </Reveal>

      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Reveal className="h-full">
          <article className="brand-card flush-card partner-card relative flex h-full min-h-80 flex-col overflow-hidden rounded-[1.7rem] p-6 backdrop-blur-md">
            <span aria-hidden className="partner-card-num">01</span>
            <div className="relative z-10 flex items-center justify-between">
              <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Flush" className="logo-float">
                <FlushLogo className="h-10 w-auto" />
              </a>
              <span className="rounded-full border border-neon/25 bg-neon/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon">Partner</span>
            </div>
            <div className="relative z-10 mt-8 space-y-3">
              <p className="font-head text-2xl font-bold text-text">Casino &amp; sportsbook</p>
              <p className="text-sm text-muted">Explore Flush directly. Availability and terms depend on your location.</p>
            </div>
            <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-6">
              <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon btn-sm">Visit Flush <ArrowRight className="size-4" /></a>
            </div>
          </article>
        </Reveal>

        <PartnerOrbit className="mx-auto -my-4 lg:my-0" />

        <Reveal className="h-full">
          <article className="brand-card qzino-card partner-card relative flex h-full min-h-80 flex-col overflow-hidden rounded-[1.7rem] p-6 backdrop-blur-md">
            <span aria-hidden className="partner-card-num">02</span>
            <div className="relative z-10 flex items-center justify-between">
              <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Qzino" className="logo-float logo-float-b">
                <QzinoLogo className="h-10 w-auto" />
              </a>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/25 bg-neon/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon">
                <span className="size-1.5 animate-pulse rounded-full bg-neon" /> Live
              </span>
            </div>
            <div className="relative z-10 mt-8 flex items-end gap-3">
              <p className="qzino-amount font-mono text-5xl font-bold text-neon">$50</p>
              <p className="pb-1.5 text-xs uppercase tracking-[0.2em] text-dim">Welcome</p>
            </div>
            <p className="relative z-10 mt-2 text-sm text-muted">Use code <span className="font-mono text-text">{QZINO_CODE}</span> and jump straight into the next bonus drop.</p>
            <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-6">
              <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon btn-sm">Play on Qzino <ArrowRight className="size-4" /></a>
              <CopyCode code={QZINO_CODE} />
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

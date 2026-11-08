import { ArrowRight } from "lucide-react";
import { CopyCode } from "@/components/ui/CopyCode";
import { Reveal } from "@/components/ui/motion";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { QZINO_CODE, QZINO_URL } from "@/lib/constants";
import { PartnerOrbit } from "./PartnerOrbit";

// The partner, one pug: the 3D Qzino coin next to the Qzino card.
export function Partners() {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
      <Reveal>
        <div className="mb-10 text-center">
          <p className="inline-flex items-center gap-3 font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">
            <span className="partner-count">01</span> Official partner
          </p>
          <h2 className="mt-3 font-display text-5xl leading-[0.9] sm:text-6xl">
            <span className="chrome">Play on</span> <span className="neon-text">Qzino</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">One partner, one pug. Sign up with code {QZINO_CODE} and play with Ravo.</p>
        </div>
      </Reveal>

      <div className="mx-auto grid max-w-4xl items-center gap-6 lg:grid-cols-[auto_1fr]">
        <PartnerOrbit className="mx-auto -my-4 lg:my-0" />

        <Reveal className="h-full">
          <article className="brand-card qzino-card partner-card relative flex h-full min-h-80 flex-col overflow-hidden rounded-[1.7rem] p-6 backdrop-blur-md">
            <span aria-hidden className="partner-card-num">01</span>
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

import { ArrowRight } from "lucide-react";
import { CopyCode } from "@/components/ui/CopyCode";
import { FlushLogo } from "@/components/ui/FlushLogo";
import { Stagger } from "@/components/ui/motion";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { FLUSH_URL, QZINO_CODE, QZINO_URL } from "@/lib/constants";

// Keep Flush first and Qzino second; show only active partner sites.
export function Partners() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
      <div className="mb-8 text-center">
        <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Partners</p>
        <h2 className="mt-3 font-display text-5xl leading-[0.9] sm:text-6xl"><span className="chrome">Play with Ravo</span></h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">Play on Flush or Qzino with Ravo.</p>
      </div>

      <Stagger className="grid gap-4 md:grid-cols-2">
        {[
        <div key="flush" className="flush-card relative flex h-full min-h-72 flex-col overflow-hidden rounded-[1.7rem] p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Flush">
              <FlushLogo className="h-9 w-auto" />
            </a>
            <span className="rounded-full bg-white/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text">Live</span>
          </div>
          <p className="mt-6 font-head text-xl font-bold text-text">Casino &amp; sportsbook</p>
          <p className="text-sm text-muted">Explore Flush directly. Availability and terms depend on your location.</p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-ghost btn-sm">Visit Flush <ArrowRight className="size-4" /></a>
          </div>
        </div>,
        <div key="qzino" className="flex h-full min-h-72 flex-col rounded-3xl border border-neon/30 bg-surface/80 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Qzino">
              <QzinoLogo className="h-8 w-auto" />
            </a>
            <span className="rounded-full bg-neon/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon">Live</span>
          </div>
          <p className="mt-6 font-mono text-4xl font-bold text-neon">$50</p>
          <p className="text-sm text-muted">Welcome bonus with code <span className="font-mono text-text">{QZINO_CODE}</span></p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon btn-sm">Play <ArrowRight className="size-4" /></a>
            <CopyCode code={QZINO_CODE} />
          </div>
        </div>,
        ]}
      </Stagger>
    </section>
  );
}

import { ArrowRight, Plus } from "lucide-react";
import { CopyCode } from "@/components/ui/CopyCode";
import { Stagger } from "@/components/ui/motion";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { FLUSH_URL, QZINO_CODE, QZINO_URL } from "@/lib/constants";

/** Empty partner spot shown as "Soon" until another partner joins. */
const OPEN_SLOTS = 1;

// Home partners row: Qzino and Flush live, plus an open "Soon" spot.
export function Partners() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
      <div className="mb-8 text-center">
        <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Partners</p>
        <h2 className="mt-3 font-display text-5xl leading-[0.9] sm:text-6xl"><span className="chrome">Play with Ravo</span></h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">More partner sites are joining soon.</p>
      </div>

      <Stagger className="grid gap-4 md:grid-cols-3">
        {[
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

        <div key="flush" className="flex h-full min-h-72 flex-col rounded-3xl border border-white/15 bg-surface/80 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Flush">
              <span className="font-display text-3xl font-bold tracking-tight text-text">FLUSH</span>
            </a>
            <span className="rounded-full bg-white/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text">Live</span>
          </div>
          <p className="mt-6 font-head text-xl font-bold text-text">Casino &amp; sportsbook</p>
          <p className="text-sm text-muted">Explore Flush directly. Availability and terms depend on your location.</p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <a href={FLUSH_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-ghost btn-sm">Visit Flush <ArrowRight className="size-4" /></a>
          </div>
        </div>,

        ...Array.from({ length: OPEN_SLOTS }, (_, i) => (
          <div key={i} className="flex h-full min-h-40 flex-col items-center justify-center md:min-h-72 rounded-3xl border border-dashed border-white/15 bg-black/40 p-6 text-center backdrop-blur-md">
            <span className="grid size-12 place-items-center rounded-2xl border border-white/10 text-dim"><Plus className="size-5" /></span>
            <p className="mt-5 font-head text-xs font-bold uppercase tracking-[0.25em] text-muted">New partner</p>
            <p className="mt-2 font-display text-5xl leading-none"><span className="chrome">Soon</span></p>
          </div>
        )),
        ]}
      </Stagger>
    </section>
  );
}

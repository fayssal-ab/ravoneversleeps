import { ArrowRight, BadgeCheck } from "lucide-react";
import { CopyCode } from "@/components/ui/CopyCode";
import { Reveal } from "@/components/ui/motion";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { QZINO_CODE, QZINO_PERKS, QZINO_URL } from "@/lib/constants";
import { PartnerOrbit } from "./PartnerOrbit";

// The partner showcase: one wide glowing card, the offer on the left (logo,
// $50 welcome, VIP perks, play + copy code) and the 3D Qzino coin on the
// right inside its chrome rings. Stacks with the coin first on phones.
export function Partners() {
  return (
    <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
      <Reveal>
        <article className="brand-card glow-card partner-showcase relative overflow-hidden rounded-[2rem] backdrop-blur-md">
          <div aria-hidden className="partner-showcase-bg" />
          <div className="relative z-10 grid items-center gap-2 lg:grid-cols-[1.15fr_1fr]">
            <div className="order-2 p-6 sm:p-10 lg:order-1 lg:py-12 lg:pl-12 lg:pr-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neon/30 bg-neon/10 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon">
                  <BadgeCheck className="size-3.5" /> Official partner
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line-hot bg-black/40 px-3 py-1 font-head text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
                  <span className="size-1.5 animate-pulse rounded-full bg-neon" /> Live offer
                </span>
              </div>

              <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" aria-label="Qzino" className="logo-float mt-7 hidden lg:inline-block">
                <QzinoLogo className="h-12 w-auto sm:h-14" />
              </a>

              <h2 className="mt-6 font-display text-5xl leading-[0.9] sm:text-6xl lg:mt-5">
                <span className="chrome">Play with</span> <span className="neon-text">Ravo</span>
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:text-base">
                Sign up on Qzino with code <span className="font-mono font-bold text-text">{QZINO_CODE}</span>, grab the welcome bonus and count for every challenge and giveaway on stream.
              </p>

              {/* perks */}
              <ul className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">
                {QZINO_PERKS.map((p, i) => (
                  <li key={p.label} className={`partner-perk rounded-2xl border px-2 py-3 text-center sm:px-3 sm:py-4 ${i === 0 ? "border-neon/40 bg-neon/10" : "border-line-hot bg-black/40"}`}>
                    <p className={`font-mono text-2xl font-bold sm:text-4xl ${i === 0 ? "qzino-amount text-neon" : "text-text"}`}>{p.value}</p>
                    <p className="mt-1 text-[0.6rem] font-semibold uppercase leading-tight tracking-[0.14em] text-dim sm:text-[0.68rem]">{p.label}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon">Play on Qzino <ArrowRight className="size-4" /></a>
                <CopyCode code={QZINO_CODE} />
              </div>
              <p className="mt-4 text-[0.7rem] text-dim">18+ · availability and terms depend on your location · play responsibly.</p>
            </div>

            <div className="order-1 flex justify-center pt-8 lg:order-2 lg:pt-0">
              <PartnerOrbit className="partner-showcase-orbit" />
            </div>
          </div>
        </article>
      </Reveal>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Timer } from "lucide-react";
import { ClipStrip } from "@/components/home/ClipStrip";
import { Hero } from "@/components/home/Hero";
import { Podium3D } from "@/components/home/Podium3D";
import { BonusCard } from "@/components/promo/BonusCard";
import { PromoSteps } from "@/components/promo/PromoSteps";
import { StreamBox } from "@/components/stream/StreamBox";
import { SectionTitle } from "@/components/ui/bits";
import { CopyCode } from "@/components/ui/CopyCode";
import { Reveal, Stagger } from "@/components/ui/motion";
import { PugVideo } from "@/components/ui/PugVideo";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getClips } from "@/lib/clips";
import { DISCORD_URL, KICK_URL, QZINO_CODE, QZINO_PERKS, QZINO_URL, X_URL } from "@/lib/constants";
import { getBoard } from "@/lib/leaderboard";
import { getTopPrizes, prizeView } from "@/lib/leaderboardPrizes";
import { formatMoney } from "@/lib/money";
import { getLiveStatus } from "@/lib/stream";
import { VIP_BENEFITS } from "@/lib/vipBenefits";

export const dynamic = "force-dynamic";

function daysLeft(end: string): number {
  return Math.max(0, Math.ceil((new Date(end.replace(" ", "T") + "Z").getTime() - Date.now()) / 86_400_000));
}

export default async function HomePage() {
  const [board, topPrizes, live, clips] = await Promise.all([
    getBoard(undefined, 3).catch(() => null),
    getTopPrizes().catch(() => null),
    getLiveStatus(),
    getClips("date").catch(() => []),
  ]);
  const period = board?.period ?? null;
  const pv = board ? prizeView(board, period?.state === "ended" ? null : topPrizes) : null;
  const top = board?.rows ?? [];
  const left = period ? daysLeft(period.state === "upcoming" ? period.starts_at : period.ends_at) : 0;
  const [cash, ...extra] = (pv?.pool || (period ? formatMoney(period.prize_pool, { cents: false }) : "Soon")).split(" + ");

  return (
    <div className="relative">
      <Hero code={QZINO_CODE} qzinoUrl={QZINO_URL} pool={pv?.pool || (period ? formatMoney(period.prize_pool, { cents: false }) : null)} />

      {/* clips right under RAVO */}
      <ClipStrip clips={clips} />

      {/* board + Qzino on the chrome-claw wallpaper */}
      <div className="claws-band mt-8 py-12">
        <div aria-hidden className="claws-band-bg">
          <Image src="/media/claws-bg.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
        </div>

      {/* leaderboard */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">This month</p>
              <h2 className="mt-3 font-display text-6xl leading-[0.9] sm:text-7xl"><span className="chrome">The board</span></h2>
              <p className="mt-5 font-mono text-5xl font-bold text-gold sm:text-6xl">{cash}</p>
              {extra.length > 0 && <p className="font-head text-lg font-bold text-gold/90">+ {extra.join(" + ")}</p>}
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Timer className="size-4 text-neon" />
                {period ? (period.state === "ended" ? "Final results" : `${left} day${left === 1 ? "" : "s"} ${period.state === "upcoming" ? "to start" : "left"}`) : "First month coming"}
              </p>
              <Link href="/leaderboard" className="btn btn-neon mt-6">Open the leaderboard <ArrowRight className="size-4" /></Link>
            </div>
            <Podium3D
              entries={[0, 1, 2].map((i) => {
                const r = top[i];
                return {
                  name: r ? r.name : null,
                  score: r ? `${Number(r.wagered).toLocaleString("en-US", { maximumFractionDigits: 2 })} pts` : null,
                  prize: pv?.byPlace[i + 1] ?? null,
                };
              })}
            />
          </div>
        </Reveal>
      </section>

      {/* Qzino */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative rounded-3xl border border-white/[0.08] bg-surface/80 p-6 backdrop-blur-md sm:p-10">
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="inline-block" aria-label="Qzino">
                  <QzinoLogo className="h-9 w-auto sm:h-11" />
                </a>
                <h2 className="mt-3 font-head text-2xl font-bold leading-snug sm:text-3xl">
                  Play under code <span className="font-mono text-neon">{QZINO_CODE}</span> for the monthly leaderboard, challenges and a <span className="text-neon">$50 welcome bonus</span>.
                </h2>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {QZINO_PERKS.map((p) => (
                    <div key={p.label} className="rounded-2xl border border-white/[0.06] bg-bg px-3 py-3 text-center">
                      <p className="font-mono text-lg font-bold text-neon">{p.value}</p>
                      <p className="text-[0.68rem] uppercase tracking-widest text-dim">{p.label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon">Play on Qzino <ArrowRight className="size-4" /></a>
                  <CopyCode code={QZINO_CODE} />
                </div>
              </div>
              <BonusCard href={QZINO_URL} code={QZINO_CODE} />
            </div>
          </div>
        </Reveal>
      </section>

      </div>

      {/* how to claim the code */}
      <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="mb-6 text-center font-head text-xs font-bold uppercase tracking-[0.25em] text-muted">How to claim {QZINO_CODE}</p>
          <PromoSteps />
        </Reveal>
      </section>

      {/* stream */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal><StreamBox live={live} /></Reveal>
      </section>

      {/* VIP transfer teaser */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Qzino VIP Transfer" title="Already VIP?" accent="Bring it over." right={<Link href="/vip-transfer" className="btn btn-ghost btn-sm">VIP Transfer <ArrowRight className="size-4" /></Link>} />
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {VIP_BENEFITS.slice(0, 4).map((b) => (
            <div key={b.title} className="h-full rounded-2xl border border-white/[0.06] bg-surface p-5">
              <p className="font-head text-lg font-bold">{b.title}</p>
              {b.value && <p className="font-mono text-xl font-bold text-neon">{b.value}</p>}
              <p className="mt-1 text-sm text-muted">{b.body}</p>
            </div>
          ))}
        </Stagger>
      </section>

      {/* Ravo's film */}
      <section className="relative mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-[0_40px_80px_rgb(0_0_0/0.6)]">
            <PugVideo className="aspect-video w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(4_6_5/0.85),transparent_55%)]" />
            <div className="absolute inset-y-0 left-0 flex max-w-md flex-col justify-end gap-3 p-5 sm:justify-center sm:p-10">
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Ravo never sleeps</p>
              <p className="font-display text-4xl leading-[0.9] sm:text-6xl"><span className="chrome">$5,000+ in giveaways</span></p>
              <Link href="/leaderboard" className="btn btn-neon btn-sm hidden w-fit sm:inline-flex">See the prizes <ArrowRight className="size-4" /></Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* follow */}
      <section className="mx-auto mt-20 max-w-6xl px-4 text-center sm:px-6">
        <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-muted">Follow Ravo</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {[
            { href: KICK_URL, label: "Kick", icon: "kick" as const },
            { href: X_URL, label: "X", icon: "x" as const },
            { href: DISCORD_URL, label: "Discord", icon: "discord" as const },
          ].map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-surface px-5 py-3 transition hover:-translate-y-1 hover:border-neon/50">
              <span className="grid size-9 place-items-center rounded-xl bg-neon/10 text-neon transition group-hover:bg-neon group-hover:text-neon-ink"><SocialIcon name={s.icon} className="size-5" /></span>
              <span className="font-head text-sm font-bold uppercase tracking-widest">{s.label}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

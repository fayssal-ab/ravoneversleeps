import Image from "next/image";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import Link from "next/link";
import { ArrowRight, Coins, Gift, Timer } from "lucide-react";
import { FloatingDecor } from "@/components/decor/FloatingDecor";
import { Hero } from "@/components/home/Hero";
import { PromoSteps } from "@/components/promo/PromoSteps";
import { StreamBox } from "@/components/stream/StreamBox";
import { Ticker } from "@/components/home/Ticker";
import { Paw } from "@/components/decor/shapes";
import { ItemCard } from "@/components/store/ItemCard";
import { SectionTitle } from "@/components/ui/bits";
import { CopyCode } from "@/components/ui/CopyCode";
import { Reveal, SpotlightCard, Stagger } from "@/components/ui/motion";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getRanks } from "@/lib/account";
import { DISCORD_URL, KICK_URL, QZINO_CODE, QZINO_PERKS, QZINO_URL, X_URL } from "@/lib/constants";
import { getBoard } from "@/lib/leaderboard";
import { VIP_BENEFITS } from "@/lib/vipBenefits";
import { formatMoney } from "@/lib/money";
import { listStoreItems } from "@/lib/store";
import { getLiveStatus } from "@/lib/stream";

export const dynamic = "force-dynamic";

const MEDAL = ["var(--color-gold)", "var(--color-silver)", "var(--color-bronze)"];

function daysLeft(end: string): number {
  return Math.max(0, Math.ceil((new Date(end.replace(" ", "T") + "Z").getTime() - Date.now()) / 86_400_000));
}

export default async function HomePage() {
  const [board, items, ranks, , live] = await Promise.all([
    getBoard(undefined, 3).catch(() => null),
    listStoreItems().catch(() => []),
    getRanks(),
    Promise.resolve(null),
    getLiveStatus(),
  ]);
  const period = board?.period ?? null;
  const top = board?.rows ?? [];
  const rankName = new Map(ranks.map((r) => [r.level, r.name]));
  const left = period ? daysLeft(period.state === "upcoming" ? period.starts_at : period.ends_at) : 0;

  return (
    <div className="relative">
      <FloatingDecor />
      <Hero code={QZINO_CODE} qzinoUrl={QZINO_URL} pool={period ? formatMoney(period.prize_pool, { cents: false }) : null} />

      {/* Qzino card */}
      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <SpotlightCard tilt={false} className="panel neon-frame is-on relative overflow-hidden p-6 sm:p-10">
            <Paw className="pointer-events-none absolute -bottom-10 -left-8 size-44 -rotate-12 text-neon/[0.06]" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="inline-block transition hover:scale-105" aria-label="Qzino">
                  <QzinoLogo className="h-10 w-auto drop-shadow-[0_0_18px_rgb(141_255_74/0.35)] sm:h-12" />
                </a>
                <h2 className="mt-3 font-head text-2xl font-bold leading-snug sm:text-3xl">
                  Play under code <span className="neon-text font-mono">{QZINO_CODE}</span> for exclusive leaderboards, VIP transfers,
                  raffles and a <span className="text-neon">$50 welcome bonus</span>.
                </h2>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {QZINO_PERKS.map((p) => (
                    <div key={p.label} className="rounded-2xl border border-line bg-bg/60 px-3 py-3 text-center">
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
              <div className="relative mx-auto w-full max-w-xs">
                <div className="absolute inset-6 rounded-3xl bg-neon/25 blur-3xl" />
                {/* bonus card: only the confirmed offer ($50 with the code) */}
                <a
                  href={QZINO_URL}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={`Claim a $50 bonus on Qzino with code ${QZINO_CODE}`}
                  className="relative block aspect-[4/5] -rotate-3 overflow-hidden rounded-3xl border border-line-hot shadow-2xl transition duration-500 hover:rotate-0 hover:scale-[1.03]"
                >
                  <Image src="/media/hero/bg.webp" alt="" fill sizes="320px" className="object-cover object-[30%_50%] opacity-60" />
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(4_10_5/0.2),rgb(4_10_5/0.85)_75%)]" />
                  <div className="relative flex size-full flex-col items-center justify-between p-6 text-center">
                    <QzinoLogo className="h-7 w-auto" />
                    <div>
                      <p className="font-pixel text-xs uppercase tracking-[0.3em] text-neon">Welcome bonus</p>
                      <p className="chrome mt-1 font-display text-8xl leading-none drop-shadow-[0_8px_24px_rgb(0_0_0/0.8)]">$50</p>
                    </div>
                    <div>
                      <p className="text-[0.65rem] uppercase tracking-[0.25em] text-muted">Promo code</p>
                      <p className="mt-1 rounded-xl border border-neon/50 bg-bg/70 px-4 py-2 font-mono text-2xl font-bold tracking-[0.2em] text-neon">{QZINO_CODE}</p>
                      <p className="mt-3 text-[0.65rem] text-dim">18+ · terms apply on Qzino</p>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* how to claim the code */}
      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="eyebrow mb-6 text-center">How to claim {QZINO_CODE}</p>
          <PromoSteps />
        </Reveal>
      </section>

      {/* leaderboard band */}
      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.6rem] border border-neon/40 bg-[linear-gradient(135deg,#1f5c12_0%,#0f2f0a_55%,#0a1f08_100%)] p-6 shadow-[0_6px_0_#0a1f08,0_30px_80px_-30px_rgb(141_255_74/0.5)] sm:p-8">
            <Image src="/media/chrome-spikes.webp" alt="" fill sizes="100vw" className="pointer-events-none object-cover opacity-15 mix-blend-screen" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="eyebrow !text-neon-bright">Monthly leaderboard</p>
                <p className="mt-2 font-mono text-5xl font-bold text-gold drop-shadow-[0_0_20px_rgb(255_215_106/0.35)] sm:text-6xl">
                  {period ? formatMoney(period.prize_pool) : "Soon"}
                </p>
                <p className="mt-2 flex items-center gap-2 font-head text-lg font-bold">
                  <Timer className="size-5 text-neon" />
                  {period ? (period.state === "ended" ? "Final results" : `${left} day${left === 1 ? "" : "s"} ${period.state === "upcoming" ? "to start" : "left"}`) : "First period coming"}
                </p>
                <Link href="/leaderboard" className="btn btn-neon mt-6">View leaderboard <ArrowRight className="size-4" /></Link>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => {
                  const r = top[i];
                  return (
                    <div key={i} className="rounded-2xl border border-white/10 bg-black/35 p-4 text-center backdrop-blur transition hover:-translate-y-1">
                      <div className="relative mx-auto size-20 rounded-full border-2 bg-black sm:size-24" style={{ borderColor: MEDAL[i], boxShadow: `0 0 22px -4px ${MEDAL[i]}` }}>
                        <Image src={`/media/podium/${i + 1}.webp`} alt={["King", "Prince", "Aristocrat"][i]} fill sizes="96px" className="rounded-full object-cover brightness-125" />
                        <span className="absolute -bottom-2 left-1/2 z-10 grid size-6 -translate-x-1/2 place-items-center rounded-full font-mono text-xs font-bold text-bg" style={{ background: MEDAL[i] }}>{i + 1}</span>
                      </div>
                      <p className="mt-4 truncate font-head text-sm font-bold">{r ? r.name : "Open seat"}</p>
                      <p className="font-mono text-xs text-text/60">{board?.scoreKind === "points" ? `${Number(r?.wagered ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} pts` : r ? formatMoney(r.wagered) : "$0.00"}</p>
                      {board?.prizes[i] && (
                        <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-bold text-bg" style={{ background: MEDAL[i] }}>
                          {formatMoney(board.prizes[i].amount)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* stream */}
      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <Reveal><StreamBox live={live} /></Reveal>
      </section>

      <div className="mt-24 overflow-hidden py-4">
        <Ticker items={[`Code ${QZINO_CODE}`, "$50 bonus on Qzino", "Monthly leaderboard", "VIP Transfer", "Points store", "Ravo never sleeps"]} />
      </div>

      {/* VIP transfer teaser */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <SectionTitle eyebrow="Qzino VIP Transfer" title="Already VIP?" accent="Bring it over." right={<Link href="/vip-transfer" className="btn btn-ghost btn-sm">VIP Transfer <ArrowRight className="size-4" /></Link>} />
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {VIP_BENEFITS.slice(0, 4).map((b) => (
            <div key={b.title} className="panel h-full p-5">
              <p className="font-head text-lg font-bold">{b.title}</p>
              {b.value && <p className="font-mono text-xl font-bold text-neon">{b.value}</p>}
              <p className="mt-1 text-sm text-muted">{b.body}</p>
            </div>
          ))}
        </Stagger>
        <div className="mt-6 flex justify-center">
          <Link href="/vip-transfer#apply" className="btn btn-neon">Apply for VIP Transfer <ArrowRight className="size-4" /></Link>
        </div>
      </section>

      {/* store preview */}
      {items.length > 0 && (
        <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
          <SectionTitle eyebrow="Points store" title="Rank up." accent="Cash in." right={<Link href="/store" className="btn btn-ghost btn-sm">Open the store <ArrowRight className="size-4" /></Link>} />
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {items.slice(0, 4).map((it) => (
              <ItemCard key={it.id} item={{ ...it, rank_name: rankName.get(it.min_rank) ?? `Rank ${it.min_rank}` }} locked={false} />
            ))}
          </Stagger>
        </section>
      )}

      {/* earn points banner */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[1.6rem] bg-[linear-gradient(120deg,#c3ff8f_0%,#8dff4a_50%,#6be22c_100%)] p-7 text-neon-ink shadow-[0_6px_0_var(--color-neon-deep),0_30px_80px_-20px_rgb(141_255_74/0.55)] sm:p-10">
            <Paw className="pointer-events-none absolute -right-6 -top-8 size-40 rotate-12 text-neon-ink/10" />
            <Paw className="pointer-events-none absolute bottom-[-2.5rem] right-40 size-28 -rotate-12 text-neon-ink/10" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="font-pixel text-xs uppercase tracking-[0.22em] text-neon-ink/70">Earn points</p>
                <p className="mt-2 max-w-xl font-head text-2xl font-bold leading-snug sm:text-3xl">Watch the stream and grind on Qzino to stack points, then spend them on rewards.</p>
              </div>
              <Link href="/store" className="btn shrink-0 bg-neon-ink text-neon [--edge:#000] hover:bg-black">
                <Gift className="size-4" /> Browse rewards
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* follow */}
      <section className="mx-auto mt-24 max-w-6xl px-4 text-center sm:px-6">
        <h2 className="font-display text-5xl"><span className="chrome">Follow</span> <span className="neon-text">Ravo</span></h2>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {[
            { href: KICK_URL, label: "Kick", icon: "kick" as const },
            { href: X_URL, label: "X", icon: "x" as const },
            { href: DISCORD_URL, label: "Discord", icon: "discord" as const },
          ].map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="panel group flex w-32 flex-col items-center gap-3 py-6 transition hover:-translate-y-1.5 hover:border-neon hover:shadow-[0_18px_40px_-14px_rgb(141_255_74/0.5)]">
              <span className="grid size-12 place-items-center rounded-2xl bg-neon/10 text-neon transition group-hover:bg-neon group-hover:text-neon-ink">
                <SocialIcon name={s.icon} className="size-6" />
              </span>
              <span className="font-head text-sm font-bold uppercase tracking-widest">{s.label}</span>
            </a>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-dim"><Coins className="size-4" /> &ldquo;I never sleep&rdquo;: Ravo, on Kick</p>
      </section>
    </div>
  );
}

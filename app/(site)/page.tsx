import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gift, Tv } from "lucide-react";
import { ClipStrip } from "@/components/home/ClipStrip";
import { Hero } from "@/components/home/Hero";
import { Partners } from "@/components/home/Partners";
import { Podium3D } from "@/components/home/Podium3D";
import { PromoSteps } from "@/components/promo/PromoSteps";
import { StreamBox } from "@/components/stream/StreamBox";
import { Reveal } from "@/components/ui/motion";
import { PugVideo } from "@/components/ui/PugVideo";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getClips } from "@/lib/clips";
import { DISCORD_URL, KICK_URL, QZINO_CODE, X_URL } from "@/lib/constants";
import { getQhubBoard, QHUB_POOL, QHUB_RAVO_URL, QHUB_SEATS } from "@/lib/qhub";
import { getLiveStatus } from "@/lib/stream";
import { isHolidaySeason, nextNewYear } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [live, clips, board] = await Promise.all([getLiveStatus(), getClips("date").catch(() => []), getQhubBoard().catch(() => null)]);
  const podium = [1, 2, 3].map((rank) => {
    const r = board?.rows.find((x) => x.rank === rank);
    return { name: r?.name ?? null, score: r ? `${r.points.toLocaleString("en-US")} pts` : null, prize: r?.prize != null ? `$${r.prize.toLocaleString("en-US")}` : null };
  });

  return (
    <div className="relative">
      <Hero newYear={isHolidaySeason() ? nextNewYear() : null} />

      {/* the partner right under RAVO, on the chrome-claw wallpaper */}
      <div className="claws-band -mt-6 pb-16 pt-2">
        <div aria-hidden className="claws-band-bg">
          <Image src="/media/claws-bg.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
        </div>
        <Partners />
      </div>

      {/* clips */}
      <ClipStrip clips={clips} />

      {/* leaderboard: QHub Open Leaderboard, top 3 live */}
      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div className="panel-soft p-6 sm:p-8">
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">QHub Open Leaderboard</p>
              <h2 className="mt-3 font-display text-6xl leading-[0.9] sm:text-7xl"><span className="chrome">The board</span></h2>
              <p className="mt-5 font-mono text-5xl font-bold leading-none text-gold sm:text-6xl">${QHUB_POOL.toLocaleString("en-US")}</p>
              <p className="mt-3 text-sm text-muted">
                {QHUB_SEATS} paid seats{board ? `, ${Math.max(QHUB_SEATS - board.total, 0)} still open` : ""}. Watch Ravo on QHub, earn Points, take a seat, and spend your Points in the store.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/leaderboard" className="btn btn-neon">See the board <ArrowRight className="size-4" /></Link>
                <a href={QHUB_RAVO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><Tv className="size-4" /> Watch on QHub</a>
                <Link href="/store" className="btn btn-ghost"><Gift className="size-4" /> Store</Link>
              </div>
            </div>
            <Podium3D entries={podium} />
          </div>
        </Reveal>
      </section>

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

      {/* Ravo's film */}
      <section className="relative mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-black shadow-[0_40px_80px_rgb(0_0_0/0.6)]">
            <PugVideo className="aspect-video w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 hidden bg-[linear-gradient(90deg,rgb(4_6_5/0.85),transparent_55%)] sm:block" />
            {/* phones: text under the film; wider: over its dark left side */}
            <div className="flex flex-col gap-3 p-5 sm:absolute sm:inset-y-0 sm:left-0 sm:max-w-md sm:justify-center sm:p-10">
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Ravo never sleeps</p>
              <p className="font-display text-4xl leading-[0.9] sm:text-6xl"><span className="chrome">$5,000+ in giveaways</span></p>
              <Link href="/challenges" className="btn btn-neon btn-sm w-fit">See the challenges <ArrowRight className="size-4" /></Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* follow: closing card with the three socials */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="page-banner relative overflow-hidden rounded-[2rem] px-5 py-12 text-center sm:px-10 sm:py-16">
            <div aria-hidden className="page-banner-bg">
              <Image src="/media/claws-bg.webp" alt="" fill sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover object-center" />
            </div>
            <div aria-hidden className="page-banner-sweep" />
            <Image src="/media/ravo-avatar.webp" alt="" width={84} height={84} className="relative mx-auto rounded-full ring-2 ring-neon/50 shadow-[0_0_40px_rgb(141_255_74/0.35)]" />
            <p className="relative mt-5 font-head text-xs font-bold uppercase tracking-[0.3em] text-neon">Join the pack</p>
            <h2 className="relative mt-3 font-display text-5xl leading-[0.9] sm:text-6xl"><span className="chrome">Never miss</span> <span className="neon-text">a stream</span></h2>
            <p className="relative mx-auto mt-4 max-w-md text-sm text-muted">
              {live.followers > 0 ? `${live.followers.toLocaleString("en-US")} followers on Kick. ` : ""}Giveaways, tournaments and big wins, live.
            </p>
            <div className="relative mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { href: KICK_URL, label: "Kick", sub: "Watch live", icon: "kick" as const },
                { href: X_URL, label: "X", sub: "Clips & news", icon: "x" as const },
                { href: DISCORD_URL, label: "Discord", sub: "Giveaways & chat", icon: "discord" as const },
              ].map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-black/50 p-4 text-left backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-neon/50">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-neon/10 text-neon transition duration-300 group-hover:bg-neon group-hover:text-neon-ink"><SocialIcon name={s.icon} className="size-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-head text-base font-bold uppercase tracking-widest text-text">{s.label}</span>
                    <span className="block text-xs text-muted">{s.sub}</span>
                  </span>
                  <ArrowRight className="size-4 text-dim transition duration-300 group-hover:translate-x-1 group-hover:text-neon" />
                </a>
              ))}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

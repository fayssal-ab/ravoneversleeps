import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Timer } from "lucide-react";
import { ClipStrip } from "@/components/home/ClipStrip";
import { Hero } from "@/components/home/Hero";
import { Podium3D } from "@/components/home/Podium3D";
import { PromoSteps } from "@/components/promo/PromoSteps";
import { StreamBox } from "@/components/stream/StreamBox";
import { SectionTitle } from "@/components/ui/bits";
import { Reveal, Stagger } from "@/components/ui/motion";
import { PugVideo } from "@/components/ui/PugVideo";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getClips } from "@/lib/clips";
import { DISCORD_URL, KICK_URL, QZINO_CODE, X_URL } from "@/lib/constants";
import { getLiveStatus } from "@/lib/stream";
import { VIP_BENEFITS } from "@/lib/vipBenefits";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [live, clips] = await Promise.all([getLiveStatus(), getClips("date").catch(() => [])]);

  return (
    <div className="relative">
      <Hero />

      {/* clips right under RAVO */}
      <ClipStrip clips={clips} />

      {/* leaderboard (paused: the new one is on its way) on the chrome-claw wallpaper */}
      <div className="claws-band mt-8 py-12">
        <div aria-hidden className="claws-band-bg">
          <Image src="/media/claws-bg.webp" alt="" fill sizes="100vw" className="object-cover object-center" />
        </div>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Leaderboard</p>
              <h2 className="mt-3 font-display text-6xl leading-[0.9] sm:text-7xl"><span className="chrome">The board</span></h2>
              <p className="mt-5 font-display text-6xl leading-none text-gold sm:text-7xl">Soon</p>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                <Timer className="size-4 text-neon" />
                A new leaderboard is on the way. Watch Discord for the start.
              </p>
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon mt-6">Join the Discord <ArrowRight className="size-4" /></a>
            </div>
            <Podium3D entries={[0, 1, 2].map(() => ({ name: null, score: null, prize: null }))} />
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
        <SectionTitle eyebrow="VIP Transfer" title="Already VIP?" accent="Bring it over." right={<Link href="/vip-transfer" className="btn btn-ghost btn-sm">VIP Transfer <ArrowRight className="size-4" /></Link>} />
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

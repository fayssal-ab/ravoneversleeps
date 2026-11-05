import Image from "next/image";
import Link from "next/link";
import { GooWave, Paw } from "@/components/decor/shapes";
import { DISCORD_URL, KICK_URL, NAV_FLAT, X_URL } from "@/lib/constants";
import { SocialIcon } from "@/components/ui/SocialIcon";

// Slime band: the drip edge from the logo letters, a neon rim behind it, the
// chrome spike art glowing through, and the pug peeking over the top with its
// paws on the edge.
export function Footer() {
  const socials = [
    { href: KICK_URL, label: "Kick", icon: "kick" as const },
    { href: X_URL, label: "X", icon: "x" as const },
    { href: DISCORD_URL, label: "Discord", icon: "discord" as const },
  ];

  return (
    <footer className="relative mt-28 text-text">
      {/* peeking pug: rises out of the slime, body hidden behind it */}
      <div className="pointer-events-none absolute -top-[5rem] left-[8%] z-0 h-[9rem] w-40 overflow-hidden sm:left-[12%] sm:-top-[5.75rem] sm:h-[11rem] sm:w-48" aria-hidden>
        <Image src="/media/ravo-mascot.webp" alt="" width={760} height={834} sizes="192px" className="animate-peek absolute inset-x-0 top-3 h-auto w-full" />
      </div>
      {/* paws gripping the slime, right side */}
      <div className="pointer-events-none absolute top-4 right-[14%] z-20 hidden gap-4 sm:flex" aria-hidden>
        <Paw className="size-14 -rotate-[8deg] text-[#2a1d16] drop-shadow-[0_3px_0_#110b08]" />
        <Paw className="size-14 rotate-[10deg] text-[#2a1d16] drop-shadow-[0_3px_0_#110b08]" />
      </div>

      {/* drip edge: neon rim + body */}
      <div className="relative z-10 -mb-px h-20 sm:h-28">
        <GooWave className="absolute inset-0 size-full -translate-y-[4px] text-neon/80" />
        <GooWave className="absolute inset-0 size-full text-[#0a2208]" />
      </div>

      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#0a2208_0%,#071a06_45%,#040d03_100%)]">
        <Image src="/media/chrome-spikes.webp" alt="" fill sizes="100vw" className="pointer-events-none object-cover opacity-[0.13] mix-blend-screen" />
        <div className="pointer-events-none absolute -left-20 top-10 size-80 rounded-full bg-neon/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-8 lg:flex-row">
            <Link href="/" className="flex shrink-0 items-center gap-3">
              <Image src="/media/ravo-avatar.webp" alt="" width={52} height={52} className="rounded-full ring-2 ring-neon/50" />
              <span className="whitespace-nowrap font-display text-[clamp(1.6rem,8.5vw,2.25rem)] leading-none">
                <span className="chrome">RAVO</span><span className="neon-text">NEVERSLEEPS</span>
              </span>
            </Link>
            <nav className="flex min-w-0 flex-wrap justify-center gap-x-6" aria-label="Footer">
              {NAV_FLAT.map((n) => (
                <Link key={n.href} href={n.href} className="inline-block py-2 font-head text-sm font-bold uppercase tracking-[0.14em] text-text/80 transition hover:text-neon">{n.label}</Link>
              ))}
            </nav>
            <div className="flex gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="grid size-11 place-items-center rounded-full border border-neon/30 bg-black/40 text-text transition hover:-translate-y-0.5 hover:border-neon hover:bg-neon hover:text-neon-ink">
                  <SocialIcon name={s.icon} className="size-5" />
                </a>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-neon/15 pt-6 text-xs text-text/55 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} RAVONEVERSLEEPS. Not a casino, no deposits taken. <Link href="/privacy" className="underline hover:text-neon">Privacy</Link></p>
            <p className="flex items-center gap-2">
              <span className="rounded border border-danger/60 px-1.5 py-0.5 font-bold text-danger">18+</span>
              Play responsibly. If it stops being fun, stop gambling.
              <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-neon">BeGambleAware</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

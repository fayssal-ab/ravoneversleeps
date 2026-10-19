import type { Metadata } from "next";
import { ArrowUpRight, Check, Crown, Target } from "lucide-react";
import Link from "next/link";
import { EmptyState, Flash, PageHeader } from "@/components/ui/bits";
import { getViewer } from "@/lib/account";
import { myChallengeClaims, type ClaimInfo } from "@/lib/verification";
import { claimChallengeAction } from "../actions";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { DISCORD_URL, QZINO_CODE, QZINO_URL } from "@/lib/constants";
import { listChallenges, type Challenge } from "@/lib/challenges";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Challenges" };
export const dynamic = "force-dynamic";

const multi = (v: string) => `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}x`;

function ChallengeCard({ c, signedIn, claim }: { c: Challenge; signedIn: boolean; claim?: ClaimInfo }) {
  const open = c.status === "open";
  return (
    <article className={`panel group flex h-full flex-col overflow-hidden ${open ? "hover:border-line-hot" : ""}`}>
      {/* slot art with the target stamped on it */}
      <div className="relative h-44 overflow-hidden border-b border-line bg-black">
        {c.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.image_url} alt="" loading="lazy" draggable={false} className={`size-full object-cover transition duration-700 group-hover:scale-105 ${open ? "" : "opacity-40 grayscale"}`} />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(ellipse_at_50%_40%,#123d0c,#040605_70%)] font-display text-3xl text-muted">{c.slot_name}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <span className="absolute bottom-3 left-4 flex items-center gap-1.5 rounded-xl border border-neon/50 bg-bg/85 px-3 py-1.5 font-mono text-lg font-bold text-neon backdrop-blur">
          <Target className="size-4" /> {multi(c.target_multi)}
        </span>
        <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 font-head text-[0.7rem] font-bold uppercase tracking-widest ${open ? "bg-neon text-neon-ink" : c.status === "won" ? "bg-gold text-bg" : "bg-surface-3 text-muted"}`}>
          {open ? "Open" : c.status === "won" ? "Won" : "Closed"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="truncate font-head text-xl font-bold">{c.slot_name}</h3>
        {c.provider && <p className="text-xs uppercase tracking-widest text-dim">{c.provider}</p>}
        <p className="mt-3 text-base">
          First to hit <span className="font-mono font-bold text-neon">{multi(c.target_multi)}</span> wins{" "}
          <span className="font-mono font-bold text-gold">{formatMoney(c.reward, { cents: Number(c.reward) % 1 !== 0 })}</span>
        </p>
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-head text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-dim">Requirements</p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted">
            {Number(c.min_bet) > 0 && <li className="flex items-center gap-2"><Check className="size-3.5 text-neon" /> {formatMoney(c.min_bet)} minimum bet</li>}
            <li className="flex items-center gap-2"><Check className="size-3.5 text-neon" /> Played on Qzino with code {QZINO_CODE}</li>
            <li className="flex items-center gap-2"><Check className="size-3.5 text-neon" /> Proof with bet and win visible</li>
          </ul>
        </div>
        <div className="mt-auto pt-5">
          {c.status === "won" ? (
            <p className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-sm">
              <Crown className="size-4 shrink-0 text-gold" />
              <span className="min-w-0 truncate">Won by <span className="font-bold text-gold">{c.winner}</span>{c.winner_multi && <> · {multi(c.winner_multi)}</>}</span>
            </p>
          ) : open ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-ghost btn-sm">Play on Qzino <ArrowUpRight className="size-4" /></a>
              {claim ? (
                claim.ticket_url
                  ? <a href={claim.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-discord btn-sm"><SocialIcon name="discord" className="size-4" /> Your ticket</a>
                  : <span className="chip border-gold/60 text-gold">Claim sent</span>
              ) : signedIn ? (
                <form action={claimChallengeAction}>
                  <input type="hidden" name="challenge" value={c.id} />
                  <button className="btn btn-neon btn-sm">I hit it · Claim</button>
                </form>
              ) : (
                <Link href="/account" className="btn btn-neon btn-sm">Sign in to claim</Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-dim">This challenge is closed.</p>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [list, viewer] = await Promise.all([listChallenges().catch(() => null), getViewer()]);
  const claims = viewer ? await myChallengeClaims(viewer.id).catch(() => new Map<number, ClaimInfo>()) : new Map<number, ClaimInfo>();
  const open = list?.filter((c) => c.status === "open") ?? [];
  const done = list?.filter((c) => c.status !== "open") ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="Slot challenges" title="Hit the" accent="target">
        Pick a challenge, land the multiplier first and the reward is yours. Every win is checked by the team.
      </PageHeader>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Claim sent! A private Discord ticket is open: post your proof there." />

      {list == null ? (
        <EmptyState title="Challenges offline">Temporarily unavailable. Try again in a minute.</EmptyState>
      ) : (
        <>
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl sm:text-4xl"><span className="chrome">Open</span> <span className="neon-text">challenges</span></h2>
            <p className="font-mono text-sm text-muted"><span className="text-2xl font-bold text-neon">{String(open.length).padStart(2, "0")}</span> available</p>
          </div>
          {open.length === 0 ? (
            <EmptyState title="No open challenge right now">New challenges drop on stream and on Discord. Check back soon.</EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{open.map((c) => <ChallengeCard key={c.id} c={c} signedIn={!!viewer} claim={claims.get(c.id)} />)}</div>
          )}

          {/* how it works */}
          <section className="mt-16">
            <h2 className="mb-6 text-center font-display text-4xl"><span className="chrome">How to</span> <span className="neon-text">win</span></h2>
            <ol className="grid gap-4 md:grid-cols-3">
              {[
                { t: "Play the slot", b: `On Qzino with code ${QZINO_CODE}, at the minimum bet or higher.` },
                { t: "Hit the multiplier", b: "Take a screenshot or a clip the moment it lands, with the bet and the win visible." },
                { t: "Claim it", b: "Hit “Claim” on the challenge: a private Discord ticket opens for you. Post your proof there; the first verified hit wins." },
              ].map((s, i) => (
                <li key={s.t} className="panel relative p-6 pt-8">
                  <span className="absolute -top-4 left-6 grid size-9 place-items-center rounded-full bg-neon font-mono font-bold text-neon-ink">{i + 1}</span>
                  <h3 className="font-head text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted">{s.b}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-center">
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost"><SocialIcon name="discord" className="size-4" /> Send proof on Discord</a>
            </div>
            <p className="mt-4 text-center text-xs text-dim">18+ only. One win per person per challenge; abuse or edited proof disqualifies. Play responsibly.</p>
          </section>

          {done.length > 0 && (
            <section className="mt-16">
              <h2 className="mb-6 font-display text-3xl"><span className="chrome">Past</span> <span className="neon-text">challenges</span></h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{done.slice(0, 12).map((c) => <ChallengeCard key={c.id} c={c} signedIn={!!viewer} claim={claims.get(c.id)} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

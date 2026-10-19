import type { Metadata } from "next";
import { QzinoLogo } from "@/components/ui/QzinoLogo";
import Image from "next/image";
import Link from "next/link";
import { Check, Clock, Lock, ShieldAlert } from "lucide-react";
import { SignInButtons } from "@/components/account/SignInPanel";
import { EmptyState, Flash, PageHeader } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Reveal, Stagger } from "@/components/ui/motion";
import { getViewer } from "@/lib/account";
import { QZINO_CODE, QZINO_URL } from "@/lib/constants";
import { claimsFor, listMilestones, monthlyProgress } from "@/lib/milestones";
import { d, formatMoney } from "@/lib/money";
import { tierFor } from "@/lib/ranks";
import { enabledProviders } from "@/lib/userAuth";
import { claimMilestoneAction } from "../actions";

export const metadata: Metadata = { title: "Points milestones", description: "Monthly cash rewards for your points on Ravo's leaderboard." };
export const dynamic = "force-dynamic";

// tint each milestone like the rank tier at the same position on the ladder
const tint = (i: number, n: number) => tierFor(Math.round(((i + 1) / Math.max(n, 1)) * 40)).color;

export default async function MilestonesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [viewer, milestones] = await Promise.all([getViewer(), listMilestones().catch(() => null)]);
  const progress = await monthlyProgress(viewer?.qzino_username ?? "").catch(() => null);
  const wagered = progress?.points ?? "0";
  const claims = viewer && progress ? await claimsFor(viewer.id, progress.month) : new Map<number, "pending" | "paid" | "rejected">();
  const monthName = progress ? new Date(`${progress.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const pts = (v: string) => `${d(v).toNumber().toLocaleString("en-US", { maximumFractionDigits: 2 })} pts`;
  const next = (milestones ?? []).find((m) => d(wagered).lt(d(m.min_wager)));
  const prevMin = next ? (milestones ?? []).filter((m) => d(m.min_wager).lt(d(next.min_wager))).at(-1)?.min_wager ?? "0" : null;
  const pct = next && prevMin != null ? Math.min(1, d(wagered).minus(prevMin).div(d(next.min_wager).minus(prevMin)).toNumber()) : 1;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="Monthly cash rewards" title="Points" accent="milestones">
        Your points on this month&apos;s leaderboard (Qzino, code <span className="font-mono font-bold text-neon">{QZINO_CODE}</span>) count. Hit a milestone, claim the cash. Progress starts over with each new monthly leaderboard.
      </PageHeader>

      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Claimed! The team checks it and pays out shortly." />

      {/* progress / sign-in */}
      <Reveal>
        {viewer ? (
          <div className="panel neon-frame is-on mb-6 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-head text-xs font-semibold uppercase tracking-[0.18em] text-muted">{monthName ? `Your points in ${monthName}` : "No leaderboard running right now"}</p>
                <p className="font-mono text-4xl font-bold text-neon">{pts(wagered)}</p>
                <p className="mt-1 text-sm text-muted">
                  {viewer.qzino_username ? <>Tracking Qzino user <span className="font-mono text-text">{viewer.qzino_username}</span></> : <>Add your Qzino username on your <Link href="/account" className="text-neon underline">account</Link> to start tracking.</>}
                </p>
              </div>
              {next && <p className="text-right text-sm text-muted">Next: <span className="font-head font-bold text-text">{next.name}</span><br /><span className="font-mono text-neon">{pts(d(next.min_wager).minus(wagered).toFixed(2))}</span> to go</p>}
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full border border-line bg-bg">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-neon-deep),var(--color-neon),var(--color-neon-bright))] shadow-[0_0_14px_rgb(141_255_74/0.5)] transition-[width] duration-1000" style={{ width: `${Math.max(2, pct * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div className="panel mb-6 flex flex-col items-center justify-between gap-5 p-6 text-center sm:flex-row sm:text-left">
            <p className="font-head text-lg font-bold">Log in to track your progress and claim</p>
            <SignInButtons providers={enabledProviders()} next="/milestones" />
          </div>
        )}
      </Reveal>

      <p className="mx-auto mb-8 flex max-w-fit items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm text-muted">
        <span className="rounded-full bg-gold px-2 py-0.5 font-head text-[0.65rem] font-bold uppercase text-bg">Notice</span>
        Any abuse (multi-accounting, self-matching) disqualifies you from milestones.
      </p>

      {milestones == null ? (
        <EmptyState title="Milestones offline">Temporarily unavailable. Try again in a minute.</EmptyState>
      ) : milestones.length === 0 ? (
        <EmptyState title="Milestones coming">The first milestones are being set up.</EmptyState>
      ) : (
        <>
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_9rem] px-6 pb-2 font-head text-xs font-semibold uppercase tracking-[0.15em] text-dim sm:grid">
            <span>Milestone</span><span className="text-right">Points</span><span className="text-right">Reward</span><span className="text-right">Status</span>
          </div>
          <Stagger className="space-y-2.5" step={0.04}>
            {milestones.map((m, i) => {
              const reached = d(wagered).gte(d(m.min_wager));
              const claim = claims.get(m.id);
              const color = tint(i, milestones.length);
              return (
                <div key={m.id} className={`panel grid grid-cols-2 items-center gap-3 px-5 py-4 transition hover:border-line-hot sm:grid-cols-[1.2fr_1fr_1fr_9rem] sm:px-6 ${reached && !claim ? "neon-frame is-on" : ""}`}>
                  <p className="flex items-center gap-3 font-head text-lg font-bold" style={{ color }}>
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-xl border bg-black" style={{ borderColor: color }}>
                      <Image src={i === milestones.length - 1 ? "/media/store/vault.webp" : "/media/store/cash.webp"} alt="" fill sizes="44px" className={`object-cover ${reached ? "" : "opacity-60 grayscale"}`} />
                    </span>
                    {m.name}
                  </p>
                  <p className="text-right font-mono font-bold">{pts(m.min_wager)}</p>
                  <p className="sm:text-right"><span className="rounded-full bg-neon px-3 py-1 font-mono text-sm font-bold text-neon-ink">{formatMoney(m.reward)} cash</span></p>
                  <div className="flex justify-end">
                    {!viewer ? (
                      <span className="chip text-dim"><Lock className="size-3.5" /> Log in</span>
                    ) : claim === "paid" ? (
                      <span className="chip border-neon text-neon"><Check className="size-3.5" /> Paid</span>
                    ) : claim === "pending" ? (
                      <span className="chip border-gold/60 text-gold"><Clock className="size-3.5" /> Pending</span>
                    ) : claim === "rejected" ? (
                      <span className="chip border-danger/60 text-danger"><ShieldAlert className="size-3.5" /> Rejected</span>
                    ) : reached && progress ? (
                      <form action={claimMilestoneAction}>
                        <input type="hidden" name="milestone" value={m.id} />
                        <ConfirmButton className="btn btn-neon btn-sm" title={`Claim ${m.name}?`} confirmLabel="Claim" body={<>The team checks your points for <span className="font-mono text-text">{viewer.qzino_username}</span> and sends <span className="font-mono text-neon">{formatMoney(m.reward)}</span>. Your Qzino username is locked after your first claim.</>}>
                          Claim
                        </ConfirmButton>
                      </form>
                    ) : (
                      <span className="chip text-dim"><Lock className="size-3.5" /> Locked</span>
                    )}
                  </div>
                </div>
              );
            })}
          </Stagger>
        </>
      )}

      {/* how to participate */}
      <section className="mt-20">
        <h2 className="text-center font-display text-5xl"><span className="chrome">How to</span> <span className="neon-text">participate</span></h2>
        <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            { t: `Join under code ${QZINO_CODE}`, b: "Sign up on Qzino with the code so your points count toward the milestones.", a: <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon btn-sm">Play on <QzinoLogo className="h-4 w-auto brightness-0" /></a> },
            { t: "Connect your account", b: "Log in here and add your Qzino username on your account page so we can match your points.", a: <Link href="/account" className="btn btn-ghost btn-sm">Open account</Link> },
            { t: "Play and come back", b: "Points update with the leaderboard, 3 times a day. Come back when you hit a milestone and claim it.", a: null },
          ].map((s, i) => (
            <div key={s.t} className="panel relative h-full p-6 pt-8">
              <span className="absolute -top-4 left-6 grid size-9 place-items-center rounded-full bg-neon font-mono font-bold text-neon-ink shadow-[0_3px_0_var(--color-neon-deep)]">{i + 1}</span>
              <h3 className="font-head text-xl font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.b}</p>
              {s.a && <div className="mt-5">{s.a}</div>}
            </div>
          ))}
        </Stagger>
      </section>
    </div>
  );
}

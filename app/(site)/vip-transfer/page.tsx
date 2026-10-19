import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Cake, CalendarCheck, Clock, Coins, Crown, Disc3, Gift, Headset, ShieldCheck, Timer, XCircle } from "lucide-react";
import { SignInButtons } from "@/components/account/SignInPanel";
import { Flash } from "@/components/ui/bits";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getViewer } from "@/lib/account";
import { QZINO_URL } from "@/lib/constants";
import { myVipApplication, WAGER_LABEL, WAGER_RANGES } from "@/lib/vip";
import { VIP_BENEFITS, VIP_SOURCE, type BenefitIcon } from "@/lib/vipBenefits";
import { enabledProviders } from "@/lib/userAuth";
import { applyVipAction } from "../actions";

export const metadata: Metadata = { title: "VIP Transfer", description: "Already VIP on another casino? Apply to transfer your VIP status to Qzino." };
export const dynamic = "force-dynamic";

const ICON: Record<BenefitIcon, typeof Coins> = { cashback: Coins, rakeback: Timer, manager: Headset, gift: Gift, crown: Crown, calendar: CalendarCheck, cake: Cake, wheel: Disc3 };

export default async function VipTransferPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const app = viewer ? await myVipApplication(viewer.id).catch(() => null) : null;
  const canApply = viewer && (!app || app.status !== "pending");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Application sent! Your private Discord ticket is open: post your VIP proof there (link in the Apply section)." />
      {/* hero */}
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-line-hot px-6 py-16 text-center sm:px-12 sm:py-24">
        <Image src="/media/hero/bg.webp" alt="" fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="-z-10 object-cover opacity-50" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgb(4_10_5/0.35),rgb(4_10_5/0.92)_70%)]" />
        <p className="eyebrow">Qzino VIP Transfer</p>
        <h1 className="mt-4 font-display text-6xl leading-[0.9] sm:text-8xl"><span className="chrome">VIP</span> <span className="neon-text">Transfer</span></h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-text/85 sm:text-lg">
          Already VIP on another casino? Bring your status to Qzino and start at an equivalent VIP level, without climbing from zero.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#apply" className="btn btn-neon px-7 py-4 text-base">Apply for VIP Transfer <ArrowRight className="size-5" /></a>
          <a href="#benefits" className="btn btn-ghost">See the VIP benefits</a>
        </div>
        <p className="mt-6 text-xs text-muted">Subject to approval and Qzino&apos;s VIP rules. 18+ only.</p>
      </section>

      {/* benefits */}
      <section id="benefits" className="mt-20 scroll-mt-28">
        <p className="eyebrow text-center">What you get</p>
        <h2 className="mt-3 text-center font-display text-4xl sm:text-5xl"><span className="chrome">VIP</span> <span className="neon-text">benefits</span></h2>
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {VIP_BENEFITS.map((b) => {
            const Icon = ICON[b.icon];
            return (
              <li key={b.title} className="reveal panel flex flex-col p-4 transition hover:border-line-hot sm:p-5">
                <span className="grid size-10 place-items-center rounded-xl border border-neon/30 bg-neon/10 text-neon sm:size-11"><Icon className="size-5" /></span>
                <h3 className="mt-3 font-head text-base font-bold leading-tight sm:mt-4 sm:text-lg">{b.title}</h3>
                {b.value && <p className="font-mono text-xl font-bold text-neon sm:text-2xl">{b.value}</p>}
                <p className="mt-1 text-xs text-muted sm:text-sm">{b.body}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-xs text-dim">
          As published on <a href={VIP_SOURCE} target="_blank" rel="noopener noreferrer" className="underline hover:text-neon">Qzino&apos;s VIP club page</a>. Rates are &ldquo;up to&rdquo; and depend on your VIP level; Qzino&apos;s VIP conditions apply.
        </p>
      </section>

      {/* how it works */}
      <section className="mt-20">
        <h2 className="text-center font-display text-4xl sm:text-5xl"><span className="chrome">How it</span> <span className="neon-text">works</span></h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { t: "Apply here", b: "Tell us your Qzino username, the casino where you're VIP and your level there. Takes a minute." },
            { t: "Show your status", b: "A private Discord ticket opens. Post a screenshot of your VIP level there. Never share passwords or codes." },
            { t: "Review", b: "Ravo's team checks it with Qzino's VIP team and answers in your ticket." },
            { t: "Trial period", b: "Approved? You start at a matching VIP level on Qzino for a trial period. Meet the conditions to keep it." },
          ].map((s, i) => (
            <li key={s.t} className="panel relative p-6 pt-8">
              <span className="absolute -top-4 left-6 grid size-9 place-items-center rounded-full bg-neon font-mono font-bold text-neon-ink">{i + 1}</span>
              <h3 className="font-head text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* application */}
      <section id="apply" className="mx-auto mt-20 max-w-2xl scroll-mt-28">
        <h2 className="text-center font-display text-4xl sm:text-5xl"><span className="chrome">Apply</span> <span className="neon-text">now</span></h2>
        <div className="panel mt-8 p-6 sm:p-8">
          {!viewer ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="font-head text-lg font-bold">Sign in with Discord to apply</p>
              <p className="text-sm text-muted">Your application is reviewed in a private Discord ticket that only you and the team can see.</p>
              <SignInButtons providers={enabledProviders()} next="/vip-transfer#apply" />
            </div>
          ) : (
            <>
              {app && (
                <div className={`mb-6 rounded-xl border p-4 text-sm ${app.status === "approved" ? "border-neon/50 bg-neon/10" : app.status === "rejected" ? "border-danger/50 bg-danger/10" : "border-gold/50 bg-gold/10"}`}>
                  <p className={`flex items-center gap-1.5 font-bold ${app.status === "approved" ? "text-neon" : app.status === "rejected" ? "text-danger" : "text-gold"}`}>
                    {app.status === "approved" ? <BadgeCheck className="size-4" /> : app.status === "rejected" ? <XCircle className="size-4" /> : <Clock className="size-4" />}
                    {app.status === "approved" ? "Approved" : app.status === "rejected" ? "Not approved" : "Under review"} · {app.casino} ({app.vip_level})
                  </p>
                  {app.admin_note && <p className="mt-1 text-muted">{app.admin_note}</p>}
                  {app.ticket_url && <a href={app.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-discord btn-sm mt-3"><SocialIcon name="discord" className="size-4" /> Open your ticket</a>}
                </div>
              )}
              {canApply && (
                <form action={applyVipAction} className="space-y-4">
                  <label className="block"><span className="label">Qzino username</span>
                    <input name="qzino" required maxLength={64} pattern="[\w.\-]+" defaultValue={viewer.qzino_username} placeholder="your Qzino username" className="field font-mono" />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block"><span className="label">Casino where you&apos;re VIP</span>
                      <input name="casino" required maxLength={80} placeholder="e.g. Stake" className="field" />
                    </label>
                    <label className="block"><span className="label">Your VIP level there</span>
                      <input name="vip_level" required maxLength={80} placeholder="e.g. Platinum III" className="field" />
                    </label>
                  </div>
                  <label className="block"><span className="label">Monthly wager (approx.)</span>
                    <select name="monthly_wager" required defaultValue="" className="field">
                      <option value="" disabled>Choose a range</option>
                      {WAGER_RANGES.map((r) => <option key={r} value={r}>{WAGER_LABEL[r]}</option>)}
                    </select>
                  </label>
                  <label className="block"><span className="label">Anything else? (optional)</span>
                    <textarea name="note" maxLength={500} rows={3} className="field" placeholder="Anything that helps the review" />
                  </label>
                  <p className="flex gap-2 rounded-xl border border-line bg-bg-2 p-3 text-xs text-muted">
                    <ShieldCheck className="size-4 shrink-0 text-neon" />
                    We never ask for passwords, login codes or ID documents. Your proof screenshot goes only into your private Discord ticket, and your application is never shown publicly.
                  </p>
                  <button className="btn btn-neon w-full sm:w-auto">Send application</button>
                </form>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          No Qzino account yet? <a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="text-neon underline">Sign up with code RAVO50</a> first.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="mb-6 text-center font-display text-4xl"><span className="chrome">FAQ</span></h2>
        <div className="space-y-3">
          {[
            { q: "What is the VIP Transfer?", a: "Qzino lets VIP players from other platforms skip the early ranks and start at an equivalent VIP level, for a trial period." },
            { q: "What if I don't meet the trial conditions?", a: "You go back to the rank your Qzino activity would normally give you. Nothing else is lost." },
            { q: "Who decides?", a: "Ravo's team reviews your application and passes it to Qzino's VIP team; Qzino makes the final decision and sets the trial conditions." },
            { q: "How can I become VIP without a transfer?", a: "By playing: Qzino gives VIP status from Rank 30 of its rank system." },
          ].map((f) => (
            <details key={f.q} className="panel group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-head font-bold">{f.q}<span className="text-neon transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

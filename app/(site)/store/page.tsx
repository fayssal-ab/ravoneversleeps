import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Camera, ExternalLink, Gift, MessageSquare, Tv } from "lucide-react";
import { RedeemForm } from "@/components/store/RedeemForm";
import { Store3D } from "@/components/store/Store3D";
import { StoreCard } from "@/components/store/StoreCard";
import { EmptyState, Flash } from "@/components/ui/bits";
import { Reveal } from "@/components/ui/motion";
import { getViewer } from "@/lib/account";
import { QHUB_LEADERBOARD_URL, QHUB_RAVO_URL } from "@/lib/qhub";
import { listRedemptions, listStoreItems, type Redemption } from "@/lib/store";
import { qzinoStatusOf } from "@/lib/verification";

export const metadata: Metadata = { title: "Store", description: "Spend the QHub Points you earn watching Ravo: Qzino tips, bonus buys, blackjack hands and keno on stream." };
export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Tv, t: "Watch on QHub", b: "Watch Ravo inside QHub while signed in. Verified watch time and tasks give you QHub Points." },
  { icon: Camera, t: "Redeem with proof", b: "Pick a reward, enter your QHub username and add a screenshot of your Points balance." },
  { icon: MessageSquare, t: "Discord ticket", b: "Your private ticket opens with the proof attached. The team checks it and takes the Points on QHub." },
  { icon: Gift, t: "Get paid", b: "The reward goes to your verified Qzino account, or Ravo plays it live on stream." },
];

const STATUS: Record<Redemption["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting", cls: "bg-gold/15 text-gold" },
  fulfilled: { label: "Paid", cls: "bg-neon/15 text-neon" },
  rejected: { label: "Not accepted", cls: "bg-danger/15 text-danger" },
};

export default async function StorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [items, viewer] = await Promise.all([listStoreItems().catch(() => null), getViewer()]);
  const [mine, qz] = viewer
    ? await Promise.all([listRedemptions({ accountId: viewer.id, limit: 10 }).catch(() => []), qzinoStatusOf(viewer.id).catch(() => null)])
    : [[], null];
  const hasDiscord = !!viewer?.identities.some((i) => i.provider === "discord");
  const ready = !!viewer && hasDiscord && qz?.status === "verified";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText={sp.ok === "redeemed" ? "Request sent: your ticket is open on Discord with the proof." : undefined} />

      {/* hero: the 3D points coin */}
      <section className="store-hero relative mb-14 overflow-hidden rounded-[2rem] border border-line">
        <div className="grid items-center lg:grid-cols-[1fr_1.1fr]">
          <div className="relative z-10 px-6 pb-2 pt-10 text-center sm:px-10 lg:py-16 lg:text-left">
            <p className="eyebrow">Ravo store</p>
            <h1 className="mt-4 font-display text-6xl leading-[0.9] sm:text-7xl">
              <span className="chrome">Spend your</span> <span className="neon-text">Points</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-muted lg:mx-0">
              Watch Ravo on QHub, stack QHub Points, cash them in for Qzino tips, bonus buys and hands played live on stream.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <a href={QHUB_RAVO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon"><Tv className="size-4" /> Earn on QHub</a>
              <Link href="/leaderboard" className="btn btn-ghost">QHub leaderboard</Link>
            </div>
          </div>
          <Store3D className="h-[22rem] sm:h-[28rem] lg:h-[32rem]" />
        </div>
      </section>

      {/* what's missing before you can redeem */}
      {!ready && (
        <Reveal className="mb-10">
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3 text-sm">
              <BadgeCheck className="size-6 shrink-0 text-gold" />
              <p className="text-muted">
                {!viewer ? "Sign in with Discord to redeem: every request opens a private Discord ticket."
                  : !hasDiscord ? "Link your Discord on the account page: requests are handled in a private Discord ticket."
                  : "Get your Qzino username verified first: that's where your reward is sent."}
              </p>
            </div>
            <Link href="/account" className="btn btn-neon btn-sm">{viewer ? "Go to my account" : "Sign in"}</Link>
          </div>
        </Reveal>
      )}

      {/* rewards */}
      {items == null ? (
        <EmptyState title="Store offline">The store can&apos;t load right now. Try again in a minute.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState title="Restocking">New rewards are on the way.</EmptyState>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => {
            const soldOut = it.stock != null && it.stock <= 0;
            return (
              <StoreCard key={it.id} index={i} item={it} action={
                soldOut ? <span className="text-sm text-dim">Sold out</span>
                  : ready ? <RedeemForm id={it.id} name={it.name} price={it.price} />
                  : <Link href="/account" className="btn btn-ghost btn-sm">{viewer ? "Unlock" : "Sign in"}</Link>
              } />
            );
          })}
        </div>
      )}

      {/* my requests */}
      {mine.length > 0 && (
        <section className="mt-14">
          <p className="eyebrow mb-4">My requests</p>
          <ul className="space-y-2">
            {mine.map((r) => (
              <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{r.item_name}</span>
                  <span className="ml-2 font-mono text-gold">{r.price.toLocaleString("en-US")} pts</span>
                  <span className="ml-2 text-xs text-dim">{r.created_at.slice(0, 16)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                  {r.ticket_url && r.status === "pending" && <a href={r.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-discord btn-sm">Ticket <ExternalLink className="size-3.5" /></a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* how it works */}
      <section className="mt-16">
        <p className="eyebrow mb-6 text-center">How it works</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.t}>
              <div className="panel h-full p-5">
                <span className="grid size-10 place-items-center rounded-xl bg-neon/15 text-neon"><s.icon className="size-5" /></span>
                <p className="mt-4 font-head text-xs font-bold uppercase tracking-[0.2em] text-dim">Step {i + 1}</p>
                <p className="mt-1 font-head text-lg font-bold">{s.t}</p>
                <p className="mt-2 text-sm text-muted">{s.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-dim">
          QHub Points are counted by QHub (<a href={QHUB_LEADERBOARD_URL} target="_blank" rel="noopener noreferrer" className="underline">q-hub.tv</a>). Redeemed Points are taken from your QHub balance by the team. 18+ only, play responsibly.
        </p>
      </section>
    </div>
  );
}

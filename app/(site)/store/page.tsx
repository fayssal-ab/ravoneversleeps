import type { Metadata } from "next";
import Link from "next/link";
import { Coins } from "lucide-react";
import { SignInButtons } from "@/components/account/SignInPanel";
import { ItemCard } from "@/components/store/ItemCard";
import { EmptyState, Flash, PageHeader } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Stagger } from "@/components/ui/motion";
import { getRanks, getViewer } from "@/lib/account";
import { listRedemptions, listStoreItems } from "@/lib/store";
import { enabledProviders } from "@/lib/userAuth";
import { redeemAction } from "../actions";

export const metadata: Metadata = { title: "Store", description: "Spend your points on Qzino tips and bonus buy splits from Ravo." };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "text-gold", fulfilled: "text-neon", rejected: "text-danger" };

export default async function StorePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [viewer, ranks, items] = await Promise.all([getViewer(), getRanks(), listStoreItems().catch(() => null)]);
  const rankName = new Map(ranks.map((r) => [r.level, r.name]));
  const mine = viewer ? await listRedemptions({ accountId: viewer.id, limit: 10 }).catch(() => []) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <PageHeader eyebrow="Points store" title="Spend" accent="your points">
        A few real rewards from Ravo. Redeem them with your points; every request is checked by the team before it&apos;s sent.
      </PageHeader>

      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Redeemed! The team will process it shortly. Track it below." />

      <div className="mb-12">
        {viewer ? (
          <div className="panel flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="font-head text-xs font-semibold uppercase tracking-[0.18em] text-muted">Your balance</p>
              <p className="flex items-center gap-2 font-mono text-4xl font-bold text-neon"><Coins className="size-7" />{viewer.points.toLocaleString("en-US")}<span className="text-base text-muted">points</span></p>
            </div>
            <p className="text-sm text-muted">
              {viewer.qzino_username ? <>Tips go to Qzino user <span className="font-mono text-text">{viewer.qzino_username}</span></> : <>Set your Qzino username on your <Link href="/account" className="text-neon underline">account</Link> before redeeming a tip.</>}
            </p>
          </div>
        ) : (
          <div className="panel flex flex-col items-center justify-between gap-5 p-6 text-center sm:flex-row sm:text-left">
            <div>
              <p className="font-head text-xl font-bold">Sign in to see your points</p>
              <p className="mt-1 text-sm text-muted">Your balance and your requests show up here.</p>
            </div>
            <SignInButtons providers={enabledProviders()} next="/store" />
          </div>
        )}
      </div>

      {items == null ? (
        <EmptyState title="Store offline">The store is temporarily unavailable. Try again in a minute.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState title="Store restocking">New rewards land here soon.</EmptyState>
      ) : (
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" step={0.05}>
          {items.map((it) => {
            const locked = viewer ? viewer.level < it.min_rank : false;
            const soldOut = it.stock != null && it.stock <= 0;
            const short = viewer ? viewer.points < it.price : false;
            return (
              <ItemCard
                key={it.id}
                item={{ ...it, rank_name: rankName.get(it.min_rank) ?? `Rank ${it.min_rank}` }}
                locked={locked}
                action={
                  viewer ? (
                    <form action={redeemAction}>
                      <input type="hidden" name="item" value={it.id} />
                      <ConfirmButton
                        className="btn btn-neon btn-sm"
                        disabled={locked || soldOut || short}
                        title="Redeem?"
                        confirmLabel={`Spend ${it.price.toLocaleString("en-US")}`}
                        body={<><span className="font-bold text-text">{it.name}</span> for <span className="font-mono text-neon">{it.price.toLocaleString("en-US")}</span> points. Make sure your Qzino username is set on your <Link href="/account" className="text-neon underline">account</Link> so we know where to send it.</>}
                      >
                        {soldOut ? "Sold out" : locked ? "Locked" : short ? "Not enough points" : "Redeem"}
                      </ConfirmButton>
                    </form>
                  ) : null
                }
              />
            );
          })}
        </Stagger>
      )}

      {viewer && mine.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow mb-4">Your redemptions</p>
          <div className="panel divide-y divide-line">
            {mine.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-head font-bold">{r.item_name}</p>
                  <p className="text-xs text-dim">{r.created_at} UTC{r.admin_note && <> · {r.admin_note}</>}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-mono text-sm text-muted"><Coins className="size-4" />{r.price.toLocaleString("en-US")}</span>
                  <span className={`font-head text-xs font-bold uppercase tracking-widest ${STATUS[r.status]}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* how it works */}
      <section className="mt-16">
        <h2 className="mb-6 text-center font-display text-4xl"><span className="chrome">How it</span> <span className="neon-text">works</span></h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            { t: "Get points", b: "Points are added to your account by Ravo and the team (giveaways, events, community activity). Your balance is shown above once you sign in." },
            { t: "Redeem", b: "Pick a reward and confirm. The points are taken right away and your request appears under “Your redemptions” as pending." },
            { t: "Get paid", b: "The team checks every request by hand. Tips are sent to your Qzino username; bonus buy splits are played on stream. A rejected request gets its points refunded." },
          ].map((s, i) => (
            <li key={s.t} className="panel relative p-6 pt-8">
              <span className="absolute -top-4 left-6 grid size-9 place-items-center rounded-full bg-neon font-mono font-bold text-neon-ink">{i + 1}</span>
              <h3 className="font-head text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.b}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-center text-xs text-dim">18+ only. One account per person; abuse or duplicate accounts get requests rejected. Play responsibly.</p>
      </section>
    </div>
  );
}

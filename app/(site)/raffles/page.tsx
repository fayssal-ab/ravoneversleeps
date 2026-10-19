import type { Metadata } from "next";
import { Coins, Crown, Lock, Ticket, Users } from "lucide-react";
import { SignInButtons } from "@/components/account/SignInPanel";
import { VerifyDraw } from "@/components/raffles/VerifyDraw";
import { EmptyState, Flash, PageHeader } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Countdown, Reveal, SpotlightCard } from "@/components/ui/motion";
import { RankBadge } from "@/components/ui/RankBadge";
import { getViewer } from "@/lib/account";
import { listRaffles } from "@/lib/raffles";
import { enabledProviders } from "@/lib/userAuth";
import { buyTicketsAction } from "../actions";

export const metadata: Metadata = { title: "Raffles", description: "Use your points for raffle tickets, drawn with a provably fair draw." };
export const dynamic = "force-dynamic";

export default async function RafflesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const raffles = await listRaffles(viewer?.id ?? null).catch(() => null);
  const open = (raffles ?? []).filter((r) => r.status === "open");
  const past = (raffles ?? []).filter((r) => r.status !== "open");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <PageHeader eyebrow="Provably fair" title="Raffles">
        Trade points for tickets. Every draw is committed before it opens and can be re-checked by anyone after.
      </PageHeader>

      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Tickets bought. Good luck!" />

      {!viewer && (
        <div className="panel mb-10 flex flex-col items-center justify-between gap-5 p-6 text-center sm:flex-row sm:text-left">
          <p className="font-head text-lg font-bold">Sign in to buy tickets</p>
          <SignInButtons providers={enabledProviders()} next="/raffles" />
        </div>
      )}

      {raffles == null ? (
        <EmptyState title="Raffles offline">Raffles are temporarily unavailable.</EmptyState>
      ) : open.length === 0 ? (
        <EmptyState title="No raffle running">Stack your points. The next raffle drops on stream.</EmptyState>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {open.map((r, i) => {
            const ended = r.ended;
            const left = r.max_tickets - r.my_tickets;
            const locked = viewer ? viewer.level < r.min_rank : false;
            return (
              <Reveal key={r.id} delay={i * 0.06}>
                <SpotlightCard className="panel neon-frame is-on h-full overflow-hidden p-6" tilt={false}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="eyebrow">{ended ? "Drawing soon" : "Open"}</p>
                      <h2 className="mt-2 font-head text-2xl font-bold leading-tight">{r.title}</h2>
                      <p className="mt-1 font-display text-3xl"><span className="neon-text">{r.prize}</span></p>
                    </div>
                    <span className="grid size-14 shrink-0 animate-float place-items-center rounded-2xl border border-line-hot bg-neon/10 text-neon"><Ticket className="size-7" /></span>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-line bg-bg-2 p-3">
                      <p className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-neon"><Coins className="size-4" />{r.cost.toLocaleString("en-US")}</p>
                      <p className="text-[0.7rem] uppercase tracking-widest text-dim">per ticket</p>
                    </div>
                    <div className="rounded-xl border border-line bg-bg-2 p-3">
                      <p className="font-mono text-lg font-bold">{r.total_tickets.toLocaleString("en-US")}</p>
                      <p className="flex items-center justify-center gap-1 text-[0.7rem] uppercase tracking-widest text-dim"><Users className="size-3" />{r.entrants} in</p>
                    </div>
                    <div className="rounded-xl border border-line bg-bg-2 p-3">
                      <p className="font-mono text-lg font-bold">{r.winners}</p>
                      <p className="text-[0.7rem] uppercase tracking-widest text-dim">winner{r.winners > 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {!ended && <Countdown to={r.ends_at} size="sm" className="mt-5 justify-center" />}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      {r.min_rank > 1 && <><RankBadge level={r.min_rank} compact /> min rank</>}
                      {viewer && <span className="ml-1">· you hold <span className="font-mono text-text">{r.my_tickets}</span>/{r.max_tickets}</span>}
                    </div>
                    {viewer && !ended && (
                      locked ? (
                        <span className="btn btn-ghost btn-sm pointer-events-none"><Lock className="size-4" /> Rank {r.min_rank}</span>
                      ) : left > 0 ? (
                        <form action={buyTicketsAction} className="flex items-center gap-2">
                          <input type="hidden" name="raffle" value={r.id} />
                          <input name="count" type="number" min={1} max={left} defaultValue={1} className="field !w-20 !py-2 text-center font-mono" aria-label="Tickets" />
                          <ConfirmButton className="btn btn-neon btn-sm" title="Buy tickets?" confirmLabel="Buy" body={<>Tickets cost <span className="font-mono text-neon">{r.cost}</span> points each and can&apos;t be refunded unless the raffle is cancelled.</>}>
                            Buy
                          </ConfirmButton>
                        </form>
                      ) : (
                        <span className="chip text-neon">Max tickets</span>
                      )
                    )}
                  </div>
                  <p className="mt-4 break-all font-mono text-[0.65rem] text-dim">seed hash {r.server_seed_hash}</p>
                </SpotlightCard>
              </Reveal>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <section className="mt-20">
          <p className="eyebrow mb-5">Past draws</p>
          <div className="space-y-4">
            {past.map((r) => (
              <details key={r.id} className="panel group p-5 open:border-line-hot">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-head text-lg font-bold">{r.title}</span>
                    <span className="ml-3 text-sm text-muted">{r.prize}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {r.status === "cancelled" ? (
                      <span className="chip text-danger">Cancelled · refunded</span>
                    ) : (
                      r.results.map((w) => (
                        <span key={w.place} className="chip text-gold"><Crown className="size-3.5" />{w.display_name}</span>
                      ))
                    )}
                  </span>
                </summary>
                {r.status === "drawn" && r.server_seed && r.entries_hash && r.tickets_snapshot && (
                  <div className="mt-4 space-y-1 border-t border-line pt-4 font-mono text-xs text-muted">
                    <p className="break-all">seed hash: {r.server_seed_hash}</p>
                    <p className="break-all">seed: {r.server_seed}</p>
                    <p className="break-all">entries hash: {r.entries_hash} ({r.tickets_snapshot.length} tickets)</p>
                    <p>winning tickets: {r.results.map((w) => `#${w.ticket_index}`).join(", ")}</p>
                    <VerifyDraw seed={r.server_seed} seedHash={r.server_seed_hash} entriesHash={r.entries_hash} tickets={r.tickets_snapshot} winners={r.results} />
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}

      <Reveal className="mt-16">
        <div className="panel p-6 text-sm leading-relaxed text-muted">
          <p className="eyebrow mb-3">How the draw works</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>When a raffle opens we publish <span className="font-mono text-text">SHA256(seed)</span>. The seed itself stays secret.</li>
            <li>At the draw the ticket list is frozen, one line per ticket, and hashed.</li>
            <li>Winning ticket = <span className="font-mono text-text">HMAC_SHA256(seed, entriesHash:nonce)</span>, first 13 hex → number mod tickets. A repeat winner is skipped.</li>
            <li>The seed and ticket list are published so anyone can redo the math.</li>
          </ol>
        </div>
      </Reveal>
    </div>
  );
}

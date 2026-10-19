import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import { HuntTable } from "@/components/hunts/HuntTable";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { CountUp, Reveal, Stagger } from "@/components/ui/motion";
import { getHunt, listHunts } from "@/lib/hunts";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Bonus hunts", description: "Ravo's bonus hunts live: every bonus, the start balance, the best multi and the result." };
export const dynamic = "force-dynamic";

const STATUS = { collecting: "Collecting", opening: "Opening", finished: "Finished" } as const;

export default async function BonusHuntsPage({ searchParams }: { searchParams: Promise<{ h?: string }> }) {
  const { h } = await searchParams;
  const [hunts, hunt] = await Promise.all([listHunts().catch(() => []), getHunt(h && /^\d+$/.test(h) ? Number(h) : undefined).catch(() => null)]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow={hunt && hunt.status !== "finished" ? "● Live hunt" : "Stream"} title="Bonus" accent="hunts" />

      {!hunt ? (
        <EmptyState title="No hunt yet">The next bonus hunt shows up here as soon as Ravo starts collecting.</EmptyState>
      ) : (
        <>
          {hunts.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {hunts.slice(0, 8).map((x) => (
                <Link key={x.id} href={`/bonus-hunts?h=${x.id}`} className={`chip transition hover:border-neon ${x.id === hunt.id ? "border-neon bg-neon text-neon-ink" : "text-muted"}`}>
                  {x.title} · {STATUS[x.status]}
                </Link>
              ))}
            </div>
          )}

          <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { l: "Starting balance", v: <CountUp value={Number(hunt.start_balance)} prefix="$" decimals={2} />, c: "text-text" },
              { l: "Winnings so far", v: <CountUp value={Number(hunt.stats.won)} prefix="$" decimals={2} />, c: "text-neon" },
              { l: "Bonuses opened", v: <>{hunt.stats.opened} / {hunt.stats.count}</>, c: "text-text" },
              { l: hunt.stats.req_multi != null ? "Break-even multi" : "Average multi", v: <>{(hunt.stats.req_multi ?? hunt.stats.avg_multi ?? 0).toFixed(2)}x</>, c: "text-gold" },
            ].map((s) => (
              <div key={s.l} className="panel px-5 py-4">
                <p className="font-head text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted">{s.l}</p>
                <p className={`mt-1 font-mono text-2xl font-bold sm:text-3xl ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </Stagger>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_18rem]">
            <Reveal><HuntTable bonuses={hunt.bonuses} /></Reveal>
            <Reveal delay={0.1}>
              <div className="space-y-4">
                <div className="panel neon-frame is-on p-5">
                  <p className="flex items-center gap-2 font-head text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"><Trophy className="size-4 text-gold" /> Biggest multi so far</p>
                  {hunt.stats.best ? (
                    <>
                      <p className="mt-2 font-head text-lg font-bold">{hunt.stats.best.slot}</p>
                      <p className="font-mono text-4xl font-bold text-neon">{hunt.stats.best.multi}x</p>
                      <p className="text-sm text-muted">{formatMoney(hunt.stats.best.win ?? "0")} win</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">Nothing opened yet.</p>
                  )}
                </div>
                <div className="panel p-5">
                  <p className="flex items-center gap-2 font-head text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted"><Flame className="size-4 text-danger" /> Hunt result</p>
                  {hunt.stats.complete ? (
                    <p className={`mt-2 font-mono text-3xl font-bold ${Number(hunt.stats.profit) >= 0 ? "text-neon" : "text-danger"}`}>
                      {Number(hunt.stats.profit) >= 0 ? "+" : "-"}{formatMoney(Math.abs(Number(hunt.stats.profit)))}
                    </p>
                  ) : (
                    <p className="mt-2 font-head text-xl font-bold text-muted">
                      {hunt.stats.count === 0 ? "Collecting bonuses…" : `${hunt.stats.count - hunt.stats.opened} bonus${hunt.stats.count - hunt.stats.opened === 1 ? "" : "es"} to open`}
                    </p>
                  )}
                  <p className="text-sm text-muted">Total bet {formatMoney(hunt.stats.total_bet)} · {STATUS[hunt.status].toLowerCase()}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </>
      )}
    </div>
  );
}

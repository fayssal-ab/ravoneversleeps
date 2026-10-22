import type { Metadata } from "next";
import { Crown } from "lucide-react";
import Link from "next/link";
import { BoardExplorer } from "@/components/leaderboard/Board";
import { LiveRefresh } from "@/components/shell/AutoUpdate";
import { PrizeCards } from "@/components/leaderboard/PrizeCards";
import { EmptyState } from "@/components/ui/bits";
import { CopyCode } from "@/components/ui/CopyCode";
import { Countdown, Reveal, Stagger } from "@/components/ui/motion";
import { QZINO_CODE, QZINO_URL } from "@/lib/constants";
import { getBoard } from "@/lib/leaderboard";
import { getTopPrizes, prizeView } from "@/lib/leaderboardPrizes";
import { QBOARDS_URL } from "@/lib/qboardsFeed";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Leaderboard", description: "Ravo's monthly Qzino leaderboard: live ranking, prizes and past months." };
export const dynamic = "force-dynamic";

const fmtDate = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthOf = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const RULES = [
  `Only wagers on Qzino made under code ${QZINO_CODE} count.`,
  "Your rank is your total wager during the period. On a tie, the wager recorded first ranks higher.",
  "Wagers are updated by the team during the period; the final board is checked before payouts.",
  "Wager abuse (self-matching, bonus abuse, multi-accounting) means disqualification.",
  "Prizes are paid after the period ends. Contact the team on Discord if something looks wrong.",
];

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ p?: string; e?: string }> }) {
  const { p, e } = await searchParams;
  // e = a Q-boards event (archived month); p = a legacy manual period
  const id = e && /^[a-f0-9]{24}$/.test(e) ? e : p && /^\d+$/.test(p) ? Number(p) : undefined;
  const archived = id != null;
  const board = await getBoard(id).catch(() => null);
  const period = board?.period ?? null;
  const rules = board?.source === "qboards" ? [
    "Rankings and prizes come from the official Q-boards leaderboard.",
    "Your rank follows the points awarded by Q-boards during the event.",
    "Scores and prizes sync every 8 hours (3 times a day). Check the official board for the latest results and payout rules.",
    ] : RULES;
  // the running month uses Ravo's prizes for the top 3; archived months show what Q-boards recorded
  const top = board && !archived ? await getTopPrizes().catch(() => null) : null;
  const pv = board ? prizeView(board, top) : { byPlace: {}, pool: "" };
  const rows = (board?.rows ?? []).map((r) => ({ ...r, score: Number(r.wagered), prize: pv.byPlace[r.rank] ?? null }));
  const prizes = pv.byPlace;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <LiveRefresh every={60_000} />
      {board == null ? (
        <EmptyState title="Leaderboard offline">The leaderboard is temporarily unavailable. Try again in a minute.</EmptyState>
      ) : !period ? (
        <>
          <header className="pb-10 pt-6 text-center">
            <h1 className="font-display text-6xl sm:text-8xl"><span className="chrome">Monthly</span> <span className="neon-text">leaderboard</span></h1>
          </header>
          <EmptyState
            title="No leaderboard yet"
            action={<a href={QZINO_URL} target="_blank" rel="noopener noreferrer sponsored" className="btn btn-neon">Join Qzino · code {QZINO_CODE}</a>}
          >
            The first period hasn&apos;t been announced. Get your Qzino account ready with code {QZINO_CODE} so you count from day one.
          </EmptyState>
        </>
      ) : (
        <>
          {/* prize headline */}
          <header className="pb-10 pt-4 text-center">
            {archived && (
              <Link href="/leaderboard" className="mb-4 inline-flex items-center gap-1 py-2 text-sm text-muted hover:text-neon">← Current leaderboard</Link>
            )}
            {!archived && period.state === "ended" && (
              <p className="mx-auto mb-5 max-w-md rounded-xl border border-line-hot bg-surface px-4 py-3 text-sm text-muted">
                This month&apos;s leaderboard has ended. The new one shows up here automatically as soon as it starts.
              </p>
            )}
            <p className="eyebrow mb-2">Qzino {board.scoreKind === "points" ? "points" : "wager"} leaderboard · prize pool</p>
            {(() => {
              const [cash, ...items] = (pv.pool || formatMoney(period.prize_pool)).split(" + ");
              return (
                <>
                  <p className="font-mono text-6xl font-bold text-gold drop-shadow-[0_0_30px_rgb(255_215_106/0.35)] sm:text-8xl">{cash}</p>
                  {items.length > 0 && <p className="mt-1 font-head text-xl font-bold text-gold/90 sm:text-3xl">+ {items.join(" + ")}</p>}
                </>
              );
            })()}
            <h1 className="mt-2 font-display text-3xl sm:text-4xl"><span className="chrome">{period.title}</span></h1>
            <p className="mt-2 text-sm text-muted">
              {period.state === "live" ? <span className="text-neon">● Live</span> : period.state === "upcoming" ? "Starts soon" : "Ended"} · {fmtDate(period.starts_at)} – {fmtDate(period.ends_at)} (UTC)
            </p>
            {board.source === "qboards" && board.syncedAt && (
              <p className="mt-3 text-xs text-muted">
                {archived ? "Final results · last sync" : "Updated every 8 hours · Last sync"} {new Date(board.syncedAt.replace(" ", "T") + "Z").toLocaleString("en-GB", { timeZone: "UTC" })} UTC
                {board.syncDelayed && " · Update delayed"}
                {" · "}<a href={QBOARDS_URL} target="_blank" rel="noopener noreferrer" className="inline-block py-2 underline">Official board</a>
              </p>
            )}
          </header>

          {rows.length ? (
            <PrizeCards rows={rows} prizes={prizes} scoreKind={board.scoreKind} />
          ) : (
            <EmptyState title="Nobody on the board yet" action={<CopyCode code={QZINO_CODE} />}>
              Scores show up here once they&apos;re counted. Sign up with the code and start climbing.
            </EmptyState>
          )}

          {/* timer */}
          <Reveal className="mt-12 flex flex-col items-center gap-3">
            <p className="font-head text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {period.state === "live" ? "Ends in" : period.state === "upcoming" ? "Starts in" : "Final results"}
            </p>
            {period.state !== "ended" && <Countdown to={period.state === "live" ? period.ends_at : period.starts_at} size="lg" />}
            <p className="text-sm text-muted">{fmtDate(period.starts_at)} — {fmtDate(period.ends_at)} (UTC)</p>
          </Reveal>

          {rows.length > 0 && (
            <div className="mt-12"><BoardExplorer rows={rows} rules={rules} scoreKind={board.scoreKind} /></div>
          )}
        </>
      )}

      {/* history */}
      {board && board.previous.length > 0 && (
        <section id="history" className="mt-20 scroll-mt-28">
          <h2 className="mb-6 font-display text-4xl"><span className="chrome">Leaderboard</span> <span className="neon-text">history</span></h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {board.previous.map((x) => (
              <div key={x.id} className="panel neon-frame flex h-full flex-col items-center p-6 text-center">
                <div className="grid size-16 place-items-center rounded-2xl border border-gold/50 bg-gold/10 text-gold"><Crown className="size-8" /></div>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.2em] text-dim">Winner</p>
                <p className="font-head font-bold">{x.winner ?? "No entries"}</p>
                <div className="my-4 h-px w-full bg-line" />
                <p className="font-head text-lg font-bold">{monthOf(x.starts_at)}</p>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-dim">Ended {fmtDate(x.ends_at)}</p>
                <p className="mt-3 text-[0.65rem] uppercase tracking-[0.2em] text-dim">Total prize pool</p>
                <p className="font-mono text-2xl font-bold text-gold">{formatMoney(x.prize_pool)}</p>
                <Link href={x.link ?? `/leaderboard?p=${x.id}`} className="btn btn-ghost btn-sm mt-4">View results</Link>
              </div>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

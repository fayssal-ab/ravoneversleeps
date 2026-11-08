import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Gift, Trophy, Tv, Users } from "lucide-react";
import { BoardExplorer } from "@/components/leaderboard/Board";
import { PrizeCards } from "@/components/leaderboard/PrizeCards";
import { LiveRefresh } from "@/components/shell/AutoUpdate";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { Countdown, Reveal } from "@/components/ui/motion";
import { getQhubBoard, QHUB_LEADERBOARD_URL, QHUB_POOL, QHUB_RAVO_URL, QHUB_SEAT_PRIZES, QHUB_SEATS } from "@/lib/qhub";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `QHub Open Leaderboard: watch Ravo on QHub, earn Points and take one of ${QHUB_SEATS} paid seats.`,
};
export const dynamic = "force-dynamic";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const RULES = [
  "Watch Ravo live inside QHub while signed in: verified watch time and completed QHub tasks become QHub Points.",
  "Your seat is your rank by Points. Each seat pays a fixed prize when the board closes.",
  "The board and the payouts are run by QHub. This page mirrors the official board and refreshes every few minutes.",
  "Points can also be spent in the Ravo store. Redeeming here does not change your seat on QHub.",
  "Abuse (multi-accounting, botting watch time) means disqualification on QHub.",
];

export default async function LeaderboardPage() {
  const board = await getQhubBoard();
  const rows = (board?.rows ?? []).map((r) => ({ rank: r.rank, name: r.name, score: r.points, prize: r.prize != null ? usd(r.prize) : null }));
  const prizes = Object.fromEntries([1, 2, 3].map((p) => [p, usd(QHUB_SEAT_PRIZES.find((t) => t.from === p)!.usd)]));
  const taken = Math.min(board?.total ?? 0, QHUB_SEATS);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <LiveRefresh every={120_000} />
      <PageHeader eyebrow="QHub Open Leaderboard" title={`${QHUB_SEATS} seats split`} accent={usd(QHUB_POOL)}>
        Watch Ravo on QHub, earn Points, take a seat. Every seat pays.
      </PageHeader>

      <div className="mb-10 flex flex-wrap justify-center gap-3">
        <a href={QHUB_RAVO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon"><Tv className="size-4" /> Watch Ravo on QHub</a>
        <Link href="/store" className="btn btn-ghost"><Gift className="size-4" /> Spend your Points</Link>
      </div>

      {/* stats */}
      <Reveal className="mb-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Trophy, label: "Prize pool", value: usd(QHUB_POOL) },
          { icon: Users, label: "Seats taken", value: `${taken} / ${QHUB_SEATS}` },
          { icon: Gift, label: "Highest seat", value: usd(QHUB_SEAT_PRIZES[0].usd) },
          { icon: ArrowRight, label: "Finish", value: board?.closesAt ? new Date(board.closesAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "No end date yet" },
        ].map((s) => (
          <div key={s.label} className="panel p-4 text-center sm:p-5">
            <s.icon className="mx-auto size-5 text-neon" />
            <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-dim">{s.label}</p>
            <p className="mt-1 font-mono text-lg font-bold text-text sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </Reveal>

      {board == null ? (
        <EmptyState title="Board offline" action={<a href={QHUB_LEADERBOARD_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon">Open the official board</a>}>
          We can&apos;t reach QHub right now. Try again in a minute, or check the board on QHub.
        </EmptyState>
      ) : (
        <>
          {rows.length ? (
            <PrizeCards rows={rows} prizes={prizes} scoreKind="points" />
          ) : (
            <EmptyState title="Every seat is open" action={<a href={QHUB_RAVO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon">Start watching</a>}>
              The first stream you watch on QHub puts you on the board.
            </EmptyState>
          )}

          {board.closesAt && (
            <Reveal className="mt-12 flex flex-col items-center gap-3">
              <p className="font-head text-xs font-semibold uppercase tracking-[0.2em] text-muted">Board closes in</p>
              <Countdown to={board.closesAt} size="lg" />
            </Reveal>
          )}

          <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
            {rows.length > 0 && <BoardExplorer rows={rows} rules={RULES} scoreKind="points" history={false} />}

            {/* what every seat pays */}
            <aside className="panel p-5 lg:sticky lg:top-28">
              <p className="eyebrow">What each seat pays</p>
              <ul className="mt-4 divide-y divide-line text-sm">
                {QHUB_SEAT_PRIZES.map((t) => (
                  <li key={t.from} className="flex items-center justify-between py-2">
                    <span className="text-muted">{t.from === t.to ? `Seat ${t.from}` : `Seats ${t.from}–${t.to}`}</span>
                    <span className="font-mono font-bold text-gold">{usd(t.usd)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-dim">
                {taken < QHUB_SEATS ? `${QHUB_SEATS - taken} seats still open. ` : ""}The prize belongs to the seat and is paid by QHub on the final standings.
              </p>
            </aside>
          </div>

          <p className="mt-10 text-center text-xs text-muted">
            {board.stale ? "QHub didn't answer: showing the last board we read · " : "Live from QHub · refreshed every 5 minutes · "}
            <a href={QHUB_LEADERBOARD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 py-2 underline">Official board <ExternalLink className="size-3" /></a>
          </p>
        </>
      )}
    </div>
  );
}

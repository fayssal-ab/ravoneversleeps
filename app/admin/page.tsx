import Link from "next/link";
import { ArrowRight, CheckCircle2, Crosshair, Crown, Gamepad2, MessagesSquare, Radio, Swords, Target, Trophy, Users } from "lucide-react";
import { AdminTitle } from "@/components/admin/ui";
import { getStats } from "@/lib/userAdmin";
import { openChallengeClaimCount, pendingVerifications } from "@/lib/verification";
import { listVipApplications } from "@/lib/vip";

const SECTIONS = [
  { href: "/admin/users", icon: Users, label: "Users", body: "Verify Qzino usernames, find a player, ban." },
  { href: "/admin/vip", icon: Crown, label: "VIP Transfer", body: "Approve or reject VIP applications." },
  { href: "/admin/leaderboard", icon: Trophy, label: "Leaderboard prizes", body: "Top-3 prizes shown on the board." },
  { href: "/admin/challenges", icon: Target, label: "Challenges", body: "Create slot challenges, pick winners." },
  { href: "/admin/tournaments", icon: Swords, label: "Tournament", body: "Run the knockout bracket live." },
  { href: "/admin/hunts", icon: Crosshair, label: "Bonus hunts", body: "Track bonuses and wins on stream." },
  { href: "/admin/stream", icon: Radio, label: "Stream & schedule", body: "Weekly schedule and live status." },
  { href: "/admin/slots", icon: Gamepad2, label: "Slot catalogue", body: "Sync and search slot games." },
  { href: "/admin/discord", icon: MessagesSquare, label: "Discord", body: "Bot setup for private tickets." },
];

export default async function AdminDashboard() {
  const [stats, toVerify, vip, chClaims] = await Promise.all([
    getStats(),
    pendingVerifications().catch(() => []), listVipApplications("pending").catch(() => []), openChallengeClaimCount().catch(() => 0),
  ]);
  const todo = [
    { n: toVerify.length, label: "Qzino username", verb: "to verify", href: "/admin/users?tab=verify" },
    { n: vip.length, label: "VIP application", verb: "to review", href: "/admin/vip" },
    { n: chClaims, label: "challenge claim", verb: "to check", href: "/admin/challenges" },
  ].filter((t) => t.n > 0);

  return (
    <>
      <AdminTitle title="Dashboard">
        {stats.live_period ? <>Live leaderboard: <span className="text-neon">{stats.live_period}</span> · {stats.board_players} players on the board · {stats.users.toLocaleString("en-US")} accounts.</> : <>No Q-boards leaderboard is live right now · {stats.users.toLocaleString("en-US")} accounts.</>}
      </AdminTitle>

      <section className="admin-card p-5">
        <h2 className="text-sm font-semibold text-text">To do</h2>
        {todo.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-neon"><CheckCircle2 className="size-5" /> All clear. Nothing is waiting for you.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {todo.map((t) => (
              <li key={t.label}>
                <Link href={t.href} className="group flex items-center gap-4 py-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-gold/15 font-mono text-lg font-bold text-gold">{t.n}</span>
                  <span className="flex-1 text-sm"><b className="text-text">{t.label}{t.n > 1 ? "s" : ""}</b> <span className="text-muted">{t.verb}</span></span>
                  <span className="btn btn-neon btn-sm">Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-text">Everything</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="admin-card group flex items-start gap-3 p-4 transition hover:border-neon/40">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-neon/10 text-neon"><s.icon className="size-4" /></span>
            <span>
              <span className="block text-sm font-semibold text-text group-hover:text-neon">{s.label}</span>
              <span className="mt-0.5 block text-xs text-muted">{s.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}

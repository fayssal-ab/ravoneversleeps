import Link from "next/link";
import { AdminTitle } from "@/components/admin/ui";
import { getStats } from "@/lib/userAdmin";
import { listClaims } from "@/lib/milestones";
import { openChallengeClaimCount, pendingVerifications } from "@/lib/verification";
import { listVipApplications } from "@/lib/vip";

export default async function AdminDashboard() {
  const [stats, claims, toVerify, vip, chClaims] = await Promise.all([
    getStats(), listClaims({ status: "pending", limit: 100 }),
    pendingVerifications().catch(() => []), listVipApplications("pending").catch(() => []), openChallengeClaimCount().catch(() => 0),
  ]);
  const tiles = [
    { label: "Accounts", value: stats.users.toLocaleString("en-US"), href: "/admin/users" },
    { label: "Qzino to verify", value: String(toVerify.length), href: "/admin/users", hot: toVerify.length > 0 },
    { label: "VIP applications", value: String(vip.length), href: "/admin/vip", hot: vip.length > 0 },
    { label: "Challenge claims", value: String(chClaims), href: "/admin/challenges", hot: chClaims > 0 },
    { label: "Milestone claims", value: String(claims.length), href: "/admin/milestones", hot: claims.length > 0 },
  ];
  return (
    <>
      <AdminTitle title="Dashboard">
        {stats.live_period ? <>Live leaderboard: <span className="text-neon">{stats.live_period}</span> · {stats.board_players} players on the board.</> : "No Q-boards leaderboard is live right now."}
      </AdminTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`admin-card block p-5 transition hover:border-white/15 ${t.hot ? "!border-gold/50" : ""}`}>
            <p className={`font-mono text-3xl font-bold ${t.hot ? "text-gold" : "text-text"}`}>{t.value}</p>
            <p className="mt-1 text-xs font-medium text-muted">{t.label}</p>
            {t.hot && <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-gold">Needs action →</p>}
          </Link>
        ))}
      </div>
    </>
  );
}

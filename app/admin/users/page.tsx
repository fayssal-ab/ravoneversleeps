import Link from "next/link";
import { BadgeCheck, Clock, ExternalLink, Search, ShieldOff, UserX } from "lucide-react";
import { AdminTitle, Card, Empty, Field, Tabs } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { RankBadge } from "@/components/ui/RankBadge";
import { getRanks } from "@/lib/account";
import { rankForXp } from "@/lib/ranks";
import { recentLedger, searchUsers, userCounts, type AdminUser, type UserFilter, type UserSort } from "@/lib/userAdmin";
import { pendingVerifications } from "@/lib/verification";
import { adjustPointsAction, bulkGrantAction, userFlagsAction, verifyQzinoAction } from "../actions";

type Tab = "verify" | "accounts" | "drop" | "history";
const SORTS: { key: UserSort; label: string }[] = [
  { key: "name", label: "A → Z" }, { key: "points", label: "Most points" }, { key: "newest", label: "Newest" }, { key: "login", label: "Last login" },
];
const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "verified", label: "Verified" }, { key: "pending", label: "Pending" }, { key: "unverified", label: "Not verified" }, { key: "banned", label: "Banned" },
];
const KIND_TONE: Record<string, string> = { grant: "text-neon", refund: "text-neon", deduct: "text-danger", redeem: "text-gold", raffle: "text-gold" };

function QzinoBadge({ u }: { u: Pick<AdminUser, "qzino_username" | "qzino_status"> }) {
  if (!u.qzino_username) return <span className="text-xs text-dim">no Qzino username</span>;
  const tone = { verified: "text-neon", pending: "text-gold", rejected: "text-danger", none: "text-dim" }[u.qzino_status];
  const Icon = u.qzino_status === "verified" ? BadgeCheck : u.qzino_status === "pending" ? Clock : u.qzino_status === "rejected" ? UserX : ShieldOff;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="font-mono text-text">{u.qzino_username}</span>
      <span className={`inline-flex items-center gap-1 ${tone}`}><Icon className="size-3.5" />{u.qzino_status === "none" ? "unverified" : u.qzino_status}</span>
    </span>
  );
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 64);
  const sort = (SORTS.some((s) => s.key === sp.sort) ? sp.sort : "name") as UserSort;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as UserFilter;
  const pending = await pendingVerifications().catch(() => []);
  const tab = (["verify", "accounts", "drop", "history"].includes(sp.tab ?? "") ? sp.tab : pending.length ? "verify" : "accounts") as Tab;
  const [users, ranks, counts, ledger] = await Promise.all([
    tab === "accounts" ? searchUsers(q, { sort, filter }) : Promise.resolve([]),
    getRanks(),
    userCounts().catch(() => null),
    tab === "history" ? recentLedger() : Promise.resolve([]),
  ]);
  const here = (over: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(q ? { q } : {}), sort, filter, ...over });
    return `/admin/users?${p}`;
  };
  const back = here({});

  return (
    <>
      <AdminTitle title="Users & points">
        Accounts are created by signing in with Discord or Kick. Granting points also adds XP; deducting only lowers the balance.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText={sp.ok === "bulk" ? "Points dropped." : "Saved."} />

      <Tabs
        current={tab}
        items={[
          { key: "verify", label: "Verification", href: "/admin/users?tab=verify", count: pending.length, hot: pending.length > 0 },
          { key: "accounts", label: "Accounts", href: "/admin/users?tab=accounts", count: counts?.all },
          { key: "drop", label: "Points drop", href: "/admin/users?tab=drop" },
          { key: "history", label: "Points history", href: "/admin/users?tab=history" },
        ]}
      />

      {tab === "verify" && (
        <Card title="Qzino usernames waiting for verification">
          <p className="mb-4 text-sm text-muted">Open the ticket, check the screenshot of the Qzino profile, then verify or reject. The decision is posted in the ticket and shown to the player.</p>
          {pending.length === 0 ? (
            <Empty>Nothing to verify right now.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>Player</th><th>Qzino username</th><th>Linked</th><th>Joined</th><th className="text-right">Decision</th></tr></thead>
                <tbody>
                  {pending.map((p) => (
                    <tr key={p.account_id}>
                      <td className="font-semibold">{p.display_name} <span className="text-xs text-dim">#{p.account_id}</span></td>
                      <td className="font-mono text-neon">{p.qzino_username}</td>
                      <td className="text-xs text-muted">{[p.discord && `Discord: ${p.discord}`, p.kick && `Kick: ${p.kick}`].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="whitespace-nowrap text-xs text-dim">{p.joined.slice(0, 10)}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {p.ticket_url
                            ? <a href={p.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="size-3.5" /> Ticket</a>
                            : <span className="self-center text-xs text-dim">no ticket</span>}
                          <form action={verifyQzinoAction}><input type="hidden" name="account" value={p.account_id} /><input type="hidden" name="decision" value="verify" /><button className="btn btn-neon btn-sm">Verify</button></form>
                          <form action={verifyQzinoAction}><input type="hidden" name="account" value={p.account_id} /><input type="hidden" name="decision" value="reject" /><button className="btn btn-ghost btn-sm !text-danger">Reject</button></form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "accounts" && (
        <Card>
          <form className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="tab" value="accounts" />
            <input type="hidden" name="filter" value={filter} />
            <label className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
              <input name="q" defaultValue={q} placeholder="Name, Discord/Kick or Qzino username" className="field !pl-9" />
            </label>
            <select name="sort" defaultValue={sort} className="field !w-auto" aria-label="Sort">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm">Search</button>
          </form>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Link key={f.key} href={here({ filter: f.key })} className={`admin-chip ${filter === f.key ? "is-on" : ""}`}>
                {f.label}{counts ? <span className="opacity-70"> {counts[f.key]}</span> : null}
              </Link>
            ))}
          </div>

          {users.length === 0 ? (
            <Empty>{q || filter !== "all" ? "No account matches." : "No accounts yet."}</Empty>
          ) : (
            <div className="mt-4 overflow-x-auto lg:overflow-visible">
              <table className="admin-table">
                <thead><tr><th>Player</th><th>Qzino</th><th className="text-right">Points</th><th>Rank</th><th>Last login</th><th /></tr></thead>
                <tbody>
                  {users.map((u) => {
                    const rank = rankForXp(ranks, u.xp);
                    return (
                      <tr key={u.id} className={u.banned ? "opacity-55" : ""}>
                        <td>
                          <p className="font-semibold">{u.display_name} {u.banned && <span className="ml-1 rounded bg-danger/15 px-1.5 text-[10px] font-bold uppercase text-danger">banned</span>}</p>
                          <p className="text-xs text-dim">{u.providers || "no identity"} · #{u.id}</p>
                        </td>
                        <td><QzinoBadge u={u} /></td>
                        <td className="text-right font-mono"><span className="text-neon">{u.points.toLocaleString("en-US")}</span><span className="block text-[11px] text-dim">{u.xp.toLocaleString("en-US")} XP</span></td>
                        <td><RankBadge level={rank.level} compact /></td>
                        <td className="whitespace-nowrap text-xs text-dim">{u.last_login_at ? u.last_login_at.slice(0, 16) : "—"}</td>
                        <td className="w-0">
                          <details className="admin-details">
                            <summary className="btn btn-ghost btn-sm">Manage</summary>
                            <div className="admin-pop">
                              <form action={adjustPointsAction} className="space-y-2">
                                <input type="hidden" name="id" value={u.id} />
                                <input type="hidden" name="back" value={back} />
                                <p className="label">Points</p>
                                <div className="flex gap-2">
                                  <input name="delta" type="number" required placeholder="+100 / -50" className="field !w-28 font-mono" />
                                  <input name="note" maxLength={255} placeholder="Reason" className="field" />
                                </div>
                                <button className="btn btn-neon btn-sm">Apply</button>
                              </form>
                              <form action={userFlagsAction} className="mt-4 space-y-2 border-t border-line pt-4">
                                <input type="hidden" name="id" value={u.id} />
                                <input type="hidden" name="back" value={back} />
                                <p className="label">Qzino username (saved by an admin = verified)</p>
                                <input name="qzino" defaultValue={u.qzino_username} maxLength={64} placeholder="Qzino username" className="field font-mono" />
                                <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="banned" defaultChecked={u.banned} /> Banned</label>
                                <button className="btn btn-ghost btn-sm">Save</button>
                              </form>
                            </div>
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "drop" && (
        <Card title="Points drop">
          <form action={bulkGrantAction} className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <Field label="Lines" hint="One player per line: name,points. The name can be a Qzino, Discord or Kick username.">
              <textarea name="csv" required rows={12} placeholder={"sleepyhead,250\nnightowl,100"} className="field font-mono text-sm" />
            </Field>
            <div className="space-y-4">
              <Field label="Reason (shown in their history)"><input name="note" maxLength={255} placeholder="Stream drop 19/10" className="field" /></Field>
              <button className="btn btn-neon w-full">Grant points</button>
              <p className="text-xs text-dim">Names that don&apos;t match an account are listed after the drop; the others are credited.</p>
            </div>
          </form>
        </Card>
      )}

      {tab === "history" && (
        <Card title="Points history (latest 150)">
          {ledger.length === 0 ? (
            <Empty>No points movements yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead><tr><th>When (UTC)</th><th>Player</th><th>Type</th><th>Note</th><th className="text-right">Points</th></tr></thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap text-xs text-dim">{l.created_at.slice(0, 16)}</td>
                      <td><Link href={`/admin/users?tab=accounts&q=${encodeURIComponent(l.display_name)}`} className="font-semibold hover:text-neon">{l.display_name}</Link></td>
                      <td className={`text-xs font-bold uppercase ${KIND_TONE[l.kind] ?? "text-muted"}`}>{l.kind}</td>
                      <td className="max-w-80 truncate text-sm text-muted">{l.note || "—"}</td>
                      <td className={`text-right font-mono font-bold ${l.delta >= 0 ? "text-neon" : "text-danger"}`}>{l.delta >= 0 ? "+" : ""}{l.delta.toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

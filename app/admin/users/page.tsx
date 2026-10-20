import Link from "next/link";
import { BadgeCheck, Clock, ExternalLink, Search, ShieldOff, UserX } from "lucide-react";
import { AdminTitle, Card, Empty, Tabs } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { searchUsers, userCounts, type AdminUser, type UserFilter, type UserSort } from "@/lib/userAdmin";
import { pendingVerifications } from "@/lib/verification";
import { userFlagsAction, verifyQzinoAction } from "../actions";

type Tab = "verify" | "accounts";
const SORTS: { key: UserSort; label: string }[] = [
  { key: "name", label: "A → Z" }, { key: "newest", label: "Newest" }, { key: "login", label: "Last login" },
];
const FILTERS: { key: UserFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "verified", label: "Verified" }, { key: "pending", label: "Pending" }, { key: "unverified", label: "Not verified" }, { key: "banned", label: "Banned" },
];

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
  const tab = (["verify", "accounts"].includes(sp.tab ?? "") ? sp.tab : pending.length ? "verify" : "accounts") as Tab;
  const [users, counts] = await Promise.all([
    tab === "accounts" ? searchUsers(q, { sort, filter }) : Promise.resolve([]),
    userCounts().catch(() => null),
  ]);
  const here = (over: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(q ? { q } : {}), sort, filter, ...over });
    return `/admin/users?${p}`;
  };
  const back = here({});

  return (
    <>
      <AdminTitle title="Users">
        Accounts are created by signing in with Discord (or Kick). Verify Qzino usernames here; a username saved by an admin counts as verified.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Saved." />

      <Tabs
        current={tab}
        items={[
          { key: "verify", label: "Verification", href: "/admin/users?tab=verify", count: pending.length, hot: pending.length > 0 },
          { key: "accounts", label: "Accounts", href: "/admin/users?tab=accounts", count: counts?.all },
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
                <thead><tr><th>Player</th><th>Qzino</th><th>Last login</th><th /></tr></thead>
                <tbody>
                  {users.map((u) => {
                    return (
                      <tr key={u.id} className={u.banned ? "opacity-55" : ""}>
                        <td>
                          <p className="font-semibold">{u.display_name} {u.banned && <span className="ml-1 rounded bg-danger/15 px-1.5 text-[10px] font-bold uppercase text-danger">banned</span>}</p>
                          <p className="text-xs text-dim">{u.providers || "no identity"} · #{u.id}</p>
                        </td>
                        <td><QzinoBadge u={u} /></td>
                        <td className="whitespace-nowrap text-xs text-dim">{u.last_login_at ? u.last_login_at.slice(0, 16) : "—"}</td>
                        <td className="w-0">
                          <details className="admin-details">
                            <summary className="btn btn-ghost btn-sm">Manage</summary>
                            <div className="admin-pop">
                              <form action={userFlagsAction} className="space-y-2">
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

    </>
  );
}

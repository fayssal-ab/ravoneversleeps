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
        Accounts are created by signing in with Discord; Kick is linked from the player&apos;s account page. Verify Qzino usernames here; a username saved by an admin counts as verified.
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
        <div className="space-y-4">
          <div className="admin-card p-5 text-sm text-muted">
            <p className="font-semibold text-text">How to verify</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Open the player&apos;s Discord ticket.</li>
              <li>Watch their screen recording: it must start on Qzino, logged in, on the profile with this exact username, then switch to the ticket and type <span className="font-mono text-neon">their code</span>, with no cut.</li>
              <li>Tick the three checks and press <span className="font-semibold text-neon">Verify</span>, or pick a reason and <span className="font-semibold text-danger">Reject</span>. The player sees the reason.</li>
            </ol>
            <p className="mt-2">Big leaderboard names and usernames claimed by several accounts are flagged: be extra careful there (ask for a voice call if unsure).</p>
          </div>
          {pending.length === 0 ? (
            <Empty>Nothing to verify right now.</Empty>
          ) : pending.map((p) => {
            const risky = (p.standing && p.standing.rank <= 10) || p.rivals.length > 0 || p.age_days < 1;
            return (
              <article key={p.account_id} className={`admin-card p-5 ${risky ? "!border-gold/50" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {p.avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.avatar} alt="" className="size-11 rounded-full" />
                      : <span className="grid size-11 place-items-center rounded-full bg-surface-3 font-bold">{p.display_name.slice(0, 1)}</span>}
                    <div>
                      <p className="font-semibold">{p.display_name} <span className="text-xs text-dim">#{p.account_id} · joined {p.age_days === 0 ? "today" : `${p.age_days} d ago`}</span></p>
                      <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                        <span className={`rounded-md px-2 py-0.5 ${p.discord ? "bg-discord/20 text-text" : "bg-danger/15 text-danger"}`}>Discord: {p.discord ?? "not linked"}</span>
                        <span className={`rounded-md px-2 py-0.5 ${p.kick ? "bg-neon/15 text-neon" : "bg-surface-3 text-dim"}`}>Kick: {p.kick ?? "not linked"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-dim">Claims Qzino username</p>
                    <p className="font-mono text-xl font-bold text-neon">{p.qzino_username}</p>
                    <p className="text-xs text-muted">Code: <span className="font-mono font-bold text-text">{p.code ?? "—"}</span></p>
                  </div>
                </div>

                {(p.standing || p.rivals.length > 0) && (
                  <div className="mt-4 space-y-1.5 text-sm">
                    {p.standing && (
                      <p className={`rounded-lg px-3 py-2 ${p.standing.rank <= 10 ? "bg-gold/10 text-gold" : "bg-surface-3 text-muted"}`}>
                        On the live board: <b>#{p.standing.rank}</b> with {Number(p.standing.score).toLocaleString("en-US")} pts{p.standing.rank <= 10 ? " · prize money at stake, check carefully" : ""}
                      </p>
                    )}
                    {p.rivals.map((r) => (
                      <p key={r.account_id} className="rounded-lg bg-danger/10 px-3 py-2 text-danger">
                        ⚠ Also claimed by <b>{r.display_name}</b> #{r.account_id} ({r.status}). Only one account can own it.
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid gap-3 border-t border-line pt-4 lg:grid-cols-[1fr_auto]">
                  <form action={verifyQzinoAction} className="space-y-2">
                    <input type="hidden" name="account" value={p.account_id} />
                    <input type="hidden" name="decision" value="verify" />
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                      <label className="flex items-center gap-2"><input type="checkbox" name="c_profile" required /> Profile shows <span className="font-mono text-neon">{p.qzino_username}</span>, logged in</label>
                      <label className="flex items-center gap-2"><input type="checkbox" name="c_code" required /> Code <span className="font-mono">{p.code}</span> typed in the ticket</label>
                      <label className="flex items-center gap-2"><input type="checkbox" name="c_cut" required /> One recording, no cut</label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.ticket_url
                        ? <a href={p.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="size-3.5" /> Open ticket</a>
                        : <span className="self-center text-xs text-dim">no ticket (Discord bot off?)</span>}
                      <button className="btn btn-neon btn-sm"><BadgeCheck className="size-4" /> Verify</button>
                    </div>
                  </form>
                  <form action={verifyQzinoAction} className="flex flex-wrap items-end gap-2 lg:justify-end">
                    <input type="hidden" name="account" value={p.account_id} />
                    <input type="hidden" name="decision" value="reject" />
                    <select name="reason" className="field !w-auto text-sm" aria-label="Reject reason" defaultValue="no_code">
                      <option value="no_code">Code not shown</option>
                      <option value="no_recording">Screenshot, not a recording</option>
                      <option value="not_owner">Not logged in as this username</option>
                      <option value="not_ravo">Not under code RAVO50</option>
                      <option value="other">Other</option>
                    </select>
                    <button className="btn btn-ghost btn-sm !text-danger"><UserX className="size-4" /> Reject</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
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

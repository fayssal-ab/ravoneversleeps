import { AdminTitle, Card, Field } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { RankBadge } from "@/components/ui/RankBadge";
import { getRanks } from "@/lib/account";
import { rankForXp } from "@/lib/ranks";
import { searchUsers } from "@/lib/userAdmin";
import { pendingVerifications } from "@/lib/verification";
import { adjustPointsAction, bulkGrantAction, userFlagsAction, verifyQzinoAction } from "../actions";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 64);
  const [users, ranks, pending] = await Promise.all([searchUsers(q), getRanks(), pendingVerifications().catch(() => [])]);

  return (
    <>
      <AdminTitle title="Users & points">
        Granting points also adds XP (rank). Deducting only lowers the balance. Viewers create accounts by signing in with Kick or Discord.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText={sp.ok === "bulk" ? "Points dropped." : "Saved."} />

      {pending.length > 0 && (
        <Card title={`Qzino usernames to verify (${pending.length})`} className="mb-6">
          <p className="mb-3 text-sm text-muted">Check the screenshot in the Discord ticket, then verify or reject. The decision is posted in the ticket.</p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.account_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg-2 px-4 py-2.5">
                <span className="text-sm"><span className="font-bold">{p.display_name}</span> · Qzino <span className="font-mono text-neon">{p.qzino_username}</span></span>
                <span className="flex items-center gap-2">
                  {p.ticket_url ? <a href={p.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Ticket</a> : <span className="text-xs text-dim">no ticket (no Discord)</span>}
                  <form action={verifyQzinoAction}><input type="hidden" name="account" value={p.account_id} /><input type="hidden" name="decision" value="verify" /><button className="btn btn-neon btn-sm">Verify</button></form>
                  <form action={verifyQzinoAction}><input type="hidden" name="account" value={p.account_id} /><input type="hidden" name="decision" value="reject" /><button className="btn btn-ghost btn-sm !text-danger">Reject</button></form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="Accounts">
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={q} placeholder="Search name, Kick/Discord or Qzino username" className="field" />
            <button className="btn btn-ghost btn-sm">Search</button>
          </form>
          {users.length === 0 ? (
            <p className="text-sm text-muted">{q ? "No match." : "No accounts yet."}</p>
          ) : (
            <ul className="space-y-3">
              {users.map((u) => {
                const rank = rankForXp(ranks, u.xp);
                return (
                  <li key={u.id} className={`rounded-xl border border-line bg-bg-2 p-4 ${u.banned ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <RankBadge level={rank.level} compact />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{u.display_name} {u.banned && <span className="text-xs text-danger">banned</span>}</p>
                        <p className="truncate text-xs text-dim">{u.providers || "no identity"} · #{u.id}</p>
                      </div>
                      <p className="text-right font-mono text-sm"><span className="text-neon">{u.points.toLocaleString("en-US")}</span> pts<br /><span className="text-xs text-dim">{u.xp.toLocaleString("en-US")} XP</span></p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <form action={adjustPointsAction} className="flex gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="q" value={q} />
                        <input name="delta" type="number" required placeholder="+100 / -50" className="field !w-28 !py-2 font-mono text-xs" />
                        <input name="note" maxLength={255} placeholder="reason" className="field !py-2 text-xs" />
                        <button className="btn btn-neon btn-sm">Apply</button>
                      </form>
                      <form action={userFlagsAction} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="q" value={q} />
                        <input name="qzino" defaultValue={u.qzino_username} maxLength={64} placeholder="Qzino username" className="field !py-2 font-mono text-xs" />
                        <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" name="banned" defaultChecked={u.banned} /> ban</label>
                        <button className="btn btn-ghost btn-sm">Save</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Points drop (bulk)">
          <form action={bulkGrantAction} className="space-y-4">
            <Field label="Lines" hint="name,points per line. The name can be a Qzino, Kick or Discord username.">
              <textarea name="csv" required rows={10} placeholder={"sleepyhead,250\nnightowl,100"} className="field font-mono text-xs" />
            </Field>
            <Field label="Reason"><input name="note" maxLength={255} placeholder="Stream drop 19/10" className="field" /></Field>
            <button className="btn btn-neon btn-sm">Grant</button>
          </form>
        </Card>
      </div>
    </>
  );
}

import { AdminTitle, Card } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { listClaims, listMilestones } from "@/lib/milestones";
import { formatMoney } from "@/lib/money";
import { resolveClaimAction, saveMilestonesAction } from "../actions";

export default async function AdminMilestones({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [milestones, pending, recent] = await Promise.all([listMilestones(), listClaims({ status: "pending" }), listClaims({ limit: 30 })]);
  const rows = [...milestones.map((m) => ({ ...m, id: String(m.id) })), ...Array.from({ length: 3 }, () => ({ id: "", name: "", min_wager: "", reward: "" }))];

  return (
    <>
      <AdminTitle title="Milestones">
        Milestones are monthly and use Q-boards points: a viewer&apos;s progress is their points in the leaderboard event running now (matched by Qzino username, synced 3 times a day). Each milestone can be claimed once per event month. Thresholds below are in points. Check the points on q-boards.com before paying.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} />

      <Card title={`Claims to pay (${pending.length})`} className={pending.length ? "!border-gold/40" : ""}>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing to pay.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((c) => (
              <li key={c.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="text-sm">
                  <p><span className="font-bold">{c.milestone_name}</span> · <span className="font-mono text-neon">{formatMoney(c.reward)}</span>{c.claim_month && <span className="text-dim"> · {c.claim_month}</span>}</p>
                  <p className="text-muted">{c.display_name} · Qzino <span className="font-mono text-text">{c.qzino_username}</span> · {Number(c.wagered).toLocaleString("en-US", { maximumFractionDigits: 2 })} pts · {c.created_at}</p>
                </div>
                <form action={resolveClaimAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="note" maxLength={255} placeholder="tx id / reason" className="field !w-52 !py-2 text-xs" />
                  <button name="status" value="paid" className="btn btn-neon btn-sm">Paid</button>
                  <button name="status" value="rejected" className="btn btn-ghost btn-sm !text-danger">Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Tiers" className="mt-6">
        <form action={saveMilestonesAction}>
          <div className="mb-2 grid grid-cols-[1fr_9rem_9rem] gap-3 text-xs uppercase tracking-widest text-dim"><span>Name</span><span>Points</span><span>Reward ($)</span></div>
          <div className="space-y-2">
            {rows.map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_9rem_9rem] gap-3">
                <input type="hidden" name={`id_${i}`} value={m.id} />
                <input name={`name_${i}`} defaultValue={m.name} maxLength={64} placeholder={m.id ? "" : "new tier"} className="field !py-1.5 text-sm" aria-label="Name" />
                <input name={`wager_${i}`} defaultValue={m.min_wager ? Number(m.min_wager).toString() : ""} className="field !py-1.5 font-mono text-sm" aria-label="Points" />
                <input name={`reward_${i}`} defaultValue={m.reward ? Number(m.reward).toString() : ""} className="field !py-1.5 font-mono text-sm" aria-label="Reward" />
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-dim">Clear all three fields of a row to delete that tier (its claims are deleted too).</p>
          <button className="btn btn-neon btn-sm mt-4">Save tiers</button>
        </form>
      </Card>

      <Card title="Recent claims" className="mt-6">
        <ul className="divide-y divide-line text-sm">
          {recent.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{c.display_name} · {c.milestone_name} · {formatMoney(c.reward)}</span>
              <span className="flex items-center gap-3 text-muted">
                {c.status}{c.admin_note && ` · ${c.admin_note}`}
                {c.status === "rejected" && (
                  <form action={resolveClaimAction}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="note" value="" />
                    <button name="status" value="delete" className="text-xs text-dim underline hover:text-neon">allow re-claim</button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

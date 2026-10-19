import { AdminTitle } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { listVipApplications, WAGER_LABEL } from "@/lib/vip";
import { decideVipAction } from "../actions";

const TONE = { pending: "text-gold", approved: "text-neon", rejected: "text-danger" } as const;

export default async function AdminVip({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const apps = await listVipApplications();
  return (
    <>
      <AdminTitle title="VIP Transfer">
        Applications from /vip-transfer. Check the proof in the Discord ticket, pass it to Qzino&apos;s VIP team, then approve or reject here (posted in the ticket).
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Saved." />
      {apps.length === 0 ? (
        <p className="text-sm text-dim">No applications yet.</p>
      ) : (
        <ul className="space-y-3">
          {apps.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <p className="font-head text-base font-bold">
                    #{a.id} · {a.display_name} · Qzino <span className="font-mono text-neon">{a.qzino_username}</span>{" "}
                    <span className={`text-xs font-bold uppercase ${TONE[a.status]}`}>{a.status}</span>
                  </p>
                  <p className="text-muted">
                    VIP <span className="text-text">{a.vip_level}</span> on <span className="text-text">{a.casino}</span> · wager {WAGER_LABEL[a.monthly_wager as keyof typeof WAGER_LABEL] ?? a.monthly_wager} · {a.created_at}
                  </p>
                  {a.note && <p className="mt-1 text-dim">&ldquo;{a.note}&rdquo;</p>}
                  {a.admin_note && <p className="mt-1 text-dim">Admin note: {a.admin_note}</p>}
                </div>
                {a.ticket_url ? <a href={a.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Ticket</a> : <span className="text-xs text-dim">no ticket</span>}
              </div>
              {a.status === "pending" && (
                <form action={decideVipAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <input name="note" maxLength={255} placeholder="Note to the player (optional)" className="field !w-72 !py-1.5 text-sm" />
                  <button name="decision" value="approve" className="btn btn-neon btn-sm">Approve</button>
                  <button name="decision" value="reject" className="btn btn-ghost btn-sm !text-danger">Reject</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

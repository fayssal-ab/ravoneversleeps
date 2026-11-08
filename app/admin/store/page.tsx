import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminTitle, Card } from "@/components/admin/ui";
import { ItemEditor } from "@/components/store/ItemEditor";
import { headline } from "@/lib/storeLabel";
import { Flash } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listRedemptions, listStoreItems } from "@/lib/store";
import { deleteItemAction, resolveRedemptionAction, saveItemAction } from "../actions";

const KIND_LABEL = { cash: "Qzino tip", bonus: "Bonus buy", game: "Played on stream", merch: "Merch", other: "Other" } as const;

export default async function AdminStore({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [items, pending, recent] = await Promise.all([
    listStoreItems({ includeInactive: true }),
    listRedemptions({ status: "pending", limit: 100 }),
    listRedemptions({ limit: 30 }),
  ]);
  const editing = sp.edit ? items.find((i) => String(i.id) === sp.edit) ?? null : null;

  return (
    <>
      <AdminTitle title="Store">
        Prices are in QHub Points. A request comes with a screenshot of the player&apos;s QHub Points in their Discord ticket: check it, take the Points on QHub, pay the reward, then mark it Paid. The ticket gets the answer and closes by itself.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} />

      <Card title={`Waiting requests (${pending.length})`} className={pending.length ? "!border-gold/40" : ""}>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="text-sm">
                  <p><span className="font-bold">{r.item_name}</span> · <span className="font-mono text-gold">{r.price.toLocaleString("en-US")}</span> pts <span className="text-xs text-dim">#{r.id}</span></p>
                  <p className="text-muted">
                    {r.display_name} · QHub: <span className="font-mono text-text">{r.qhub_username || "—"}</span> · Qzino: <span className="font-mono text-text">{r.qzino_username || "not set"}</span> · {r.created_at.slice(0, 16)}
                  </p>
                </div>
                <form action={resolveRedemptionAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  {r.ticket_url && <a href={r.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><ExternalLink className="size-3.5" /> Ticket</a>}
                  <input name="note" maxLength={255} placeholder="note (tx id, reason…)" className="field !w-56 !py-2 text-xs" />
                  <button name="status" value="fulfilled" className="btn btn-neon btn-sm">Paid</button>
                  <button name="status" value="rejected" className="btn btn-ghost btn-sm !text-danger">Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={editing ? `Edit: ${editing.name}` : "New reward"} className="mt-6">
        <ItemEditor key={editing?.id ?? "new"} item={editing} action={saveItemAction} />
      </Card>

      <div className="mt-6">
        <Card title={`Rewards (${items.filter((i) => i.active).length} visible)`}>
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${it.active ? "" : "opacity-50"}`}>
                <span>
                  <span className="mr-2 inline-grid min-w-12 place-items-center rounded-md bg-surface-3 px-1.5 py-0.5 font-display text-sm text-text">{it.label || headline(it.name)}</span>
                  <span className="font-bold">{it.name}</span>
                  <span className="ml-2 font-mono text-gold">{it.price.toLocaleString("en-US")}</span>
                  <span className="ml-2 text-xs text-dim">{KIND_LABEL[it.kind] ?? it.kind}</span>
                  {it.stock != null && <span className="ml-2 text-xs text-muted">stock {it.stock}</span>}
                  {!it.active && <span className="ml-2 text-xs text-muted">hidden</span>}
                </span>
                <span className="flex gap-2">
                  <Link href={`/admin/store?edit=${it.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                  <form action={deleteItemAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <ConfirmButton className="btn btn-ghost btn-sm !text-danger" danger title="Delete reward?" confirmLabel="Delete" body="Past requests keep their name and price.">Delete</ConfirmButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recent requests" className="mt-6">
        {recent.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{r.display_name} · {r.item_name} <span className="font-mono text-xs text-dim">{r.qhub_username}</span></span>
                <span className="text-muted">{r.status}{r.admin_note && ` · ${r.admin_note}`} · {r.created_at.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

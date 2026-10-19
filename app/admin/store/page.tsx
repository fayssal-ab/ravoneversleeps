import Link from "next/link";
import { AdminTitle, Card, Field } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { listRedemptions, listStoreItems } from "@/lib/store";
import { deleteItemAction, resolveRedemptionAction, saveItemAction } from "../actions";

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
      <AdminTitle title="Store">Items need a minimum rank. Redeeming takes the points right away; rejecting refunds them.</AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} />

      <Card title={`Pending redemptions (${pending.length})`} className={pending.length ? "!border-gold/40" : ""}>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Queue is empty.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pending.map((r) => (
              <li key={r.id} className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="text-sm">
                  <p><span className="font-bold">{r.item_name}</span> · <span className="font-mono text-neon">{r.price}</span> pts</p>
                  <p className="text-muted">{r.display_name} · Qzino: <span className="font-mono text-text">{r.qzino_username || "not set"}</span> · {r.created_at}</p>
                </div>
                <form action={resolveRedemptionAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" maxLength={255} placeholder="note (tx id, reason…)" className="field !w-56 !py-2 text-xs" />
                  <button name="status" value="fulfilled" className="btn btn-neon btn-sm">Paid</button>
                  <button name="status" value="rejected" className="btn btn-ghost btn-sm !text-danger">Reject + refund</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title={editing ? `Edit: ${editing.name}` : "New item"}>
          <form action={saveItemAction} className="space-y-4" key={editing?.id ?? "new"}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="Name"><input name="name" required maxLength={120} defaultValue={editing?.name} className="field" /></Field>
            <Field label="Description"><textarea name="description" rows={2} maxLength={500} defaultValue={editing?.description} className="field" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (points)"><input name="price" type="number" min={0} required defaultValue={editing?.price ?? 20} className="field font-mono" /></Field>
              <Field label="Min rank (1–40)"><input name="min_rank" type="number" min={1} max={40} required defaultValue={editing?.min_rank ?? 31} className="field font-mono" /></Field>
              <Field label="Stock" hint="Empty = unlimited"><input name="stock" type="number" min={0} defaultValue={editing?.stock ?? ""} className="field font-mono" /></Field>
              <Field label="Sort"><input name="sort" type="number" defaultValue={editing?.sort ?? 0} className="field font-mono" /></Field>
            </div>
            <Field label="Type">
              <select name="kind" defaultValue={editing?.kind ?? "cash"} className="field">
                <option value="cash">Cash / tip</option><option value="bonus">Bonus</option><option value="merch">Merch</option><option value="other">Other</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} className="accent-[var(--color-neon)]" /> Visible in the store</label>
            <div className="flex gap-2">
              <button className="btn btn-neon btn-sm">{editing ? "Save" : "Add item"}</button>
              {editing && <Link href="/admin/store" className="btn btn-ghost btn-sm">Cancel</Link>}
            </div>
          </form>
        </Card>

        <Card title={`Items (${items.length})`}>
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className={`flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm ${it.active ? "" : "opacity-50"}`}>
                <span>
                  <span className="mr-2 font-mono text-xs text-dim">R{it.min_rank}</span>
                  <span className="font-bold">{it.name}</span>
                  <span className="ml-2 font-mono text-neon">{it.price.toLocaleString("en-US")}</span>
                  {it.stock != null && <span className="ml-2 text-xs text-muted">stock {it.stock}</span>}
                  {!it.active && <span className="ml-2 text-xs text-muted">hidden</span>}
                </span>
                <span className="flex gap-2">
                  <Link href={`/admin/store?edit=${it.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                  <form action={deleteItemAction}>
                    <input type="hidden" name="id" value={it.id} />
                    <ConfirmButton className="btn btn-ghost btn-sm !text-danger" danger title="Delete item?" confirmLabel="Delete" body="Past redemptions keep their name and price.">Delete</ConfirmButton>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Recent redemptions" className="mt-6">
        <ul className="divide-y divide-line text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{r.display_name} · {r.item_name}</span>
              <span className="text-muted">{r.status}{r.admin_note && ` · ${r.admin_note}`} · {r.created_at}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

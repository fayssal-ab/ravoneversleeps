"use client";

import Link from "next/link";
import { Gift } from "lucide-react";
import { useState } from "react";
import { headline } from "@/lib/storeLabel";
import { StoreCard, type StoreItemView } from "./StoreCard";

const KINDS: { value: StoreItemView["kind"]; label: string }[] = [
  { value: "cash", label: "Qzino tip (♦)" },
  { value: "bonus", label: "Bonus buy (♠)" },
  { value: "game", label: "Played on stream (♣)" },
  { value: "merch", label: "Merch (♥)" },
  { value: "other", label: "Other (♠)" },
];

export interface EditorItem extends StoreItemView { active: boolean; sort: number }

// Admin → Store: the reward form with a live preview of the card exactly as
// the store shows it (art, big text, suit, price), updated as you type.
export function ItemEditor({ item, action }: { item: EditorItem | null; action: (form: FormData) => Promise<void> }) {
  const [v, setV] = useState({
    name: item?.name ?? "", description: item?.description ?? "", kind: item?.kind ?? "bonus",
    price: item?.price ?? 3000, stock: item?.stock == null ? "" : String(item.stock), label: item?.label ?? "",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((o) => ({ ...o, [k]: e.target.value }));
  const preview: StoreItemView = {
    id: 0, name: v.name || "$100 bonus buy", description: v.description, kind: v.kind as StoreItemView["kind"],
    price: Number(v.price) || 0, stock: v.stock === "" ? null : Number(v.stock), label: v.label,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={item?.id ?? ""} />
        <label className="block">
          <span className="label">Name</span>
          <input name="name" required maxLength={120} value={v.name} onChange={set("name")} placeholder="$100 bonus buy" className="field" />
        </label>
        <label className="block">
          <span className="label">Card text (big on the image)</span>
          <input name="label" maxLength={24} value={v.label} onChange={set("label")} placeholder={`empty = ${headline(v.name || "$100 bonus buy")}`} className="field" />
          <span className="mt-1 block text-xs text-dim">Leave empty: a $ amount in the name is used ($100 bonus buy → $100), or the word before “:” (Keno: $1 x15 → Keno).</span>
        </label>
        <label className="block">
          <span className="label">Description</span>
          <textarea name="description" rows={2} maxLength={500} value={v.description} onChange={set("description")} placeholder="Ravo opens a $100 bonus buy for you live on stream." className="field" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Price (QHub Points)</span>
            <input name="price" type="number" min={1} required value={v.price} onChange={set("price")} className="field font-mono" />
          </label>
          <label className="block">
            <span className="label">Stock (empty = unlimited)</span>
            <input name="stock" type="number" min={0} value={v.stock} onChange={set("stock")} className="field font-mono" />
          </label>
          <label className="block">
            <span className="label">Type</span>
            <select name="kind" value={v.kind} onChange={set("kind")} className="field">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Order (small = first)</span>
            <input name="sort" type="number" defaultValue={item?.sort ?? 0} className="field font-mono" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="active" defaultChecked={item?.active ?? true} className="accent-[var(--color-neon)]" /> Visible in the store</label>
        <div className="flex gap-2">
          <button className="btn btn-neon btn-sm">{item ? "Save" : "Add reward"}</button>
          {item && <Link href="/admin/store" className="btn btn-ghost btn-sm">Cancel</Link>}
        </div>
      </form>

      <div>
        <p className="label mb-2">Preview</p>
        <StoreCard still index={0} item={preview} action={<span className="btn btn-neon btn-sm pointer-events-none"><Gift className="size-4" /> Redeem</span>} />
      </div>
    </div>
  );
}

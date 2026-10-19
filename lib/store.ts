import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireVerifiedQzino } from "./verification";
import { getPool } from "./db";
import { applyPoints, getRanks } from "./account";
import { rankForXp } from "./ranks";
import { AppError, withTx } from "./tx";

export type ItemKind = "cash" | "bonus" | "merch" | "other";

export interface StoreItem {
  id: number;
  name: string;
  description: string;
  kind: ItemKind;
  price: number;
  min_rank: number;
  stock: number | null;
  active: boolean;
  sort: number;
}

const toItem = (r: RowDataPacket): StoreItem => ({
  id: Number(r.id), name: String(r.name), description: String(r.description), kind: r.kind as ItemKind,
  price: Number(r.price), min_rank: Number(r.min_rank), stock: r.stock == null ? null : Number(r.stock),
  active: Boolean(Number(r.active)), sort: Number(r.sort),
});

export async function listStoreItems(opts: { includeInactive?: boolean } = {}): Promise<StoreItem[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, name, description, kind, price, min_rank, stock, active, sort FROM store_items
      ${opts.includeInactive ? "" : "WHERE active = 1"} ORDER BY sort, min_rank, price, id`
  );
  return rows.map(toItem);
}

/** Buy one item: checks rank, stock and balance atomically. Returns the redemption id. */
export async function redeemItem(accountId: number, itemId: number): Promise<number> {
  await requireVerifiedQzino(accountId);
  const ranks = await getRanks();
  return withTx(async (conn) => {
    const [items] = await conn.query<RowDataPacket[]>(
      "SELECT id, name, description, kind, price, min_rank, stock, active, sort FROM store_items WHERE id = ? FOR UPDATE", [itemId]);
    if (!items[0]) throw new AppError("not_found");
    const item = toItem(items[0]);
    if (!item.active) throw new AppError("inactive");
    if (item.stock != null && item.stock <= 0) throw new AppError("out_of_stock");

    const [acc] = await conn.query<RowDataPacket[]>("SELECT xp, banned FROM user_accounts WHERE id = ? FOR UPDATE", [accountId]);
    if (!acc[0]) throw new AppError("not_signed_in");
    if (Number(acc[0].banned)) throw new AppError("banned");
    if (rankForXp(ranks, Number(acc[0].xp)).level < item.min_rank) throw new AppError("rank_too_low");

    const [res] = await conn.query<ResultSetHeader>(
      "INSERT INTO store_redemptions (account_id, item_id, item_name, price) VALUES (?, ?, ?, ?)",
      [accountId, item.id, item.name, item.price]
    );
    await applyPoints(conn, accountId, -item.price, "redeem", item.name, res.insertId);
    if (item.stock != null) await conn.query("UPDATE store_items SET stock = stock - 1 WHERE id = ?", [item.id]);
    return res.insertId;
  });
}

export interface Redemption {
  id: number;
  account_id: number;
  display_name: string;
  qzino_username: string;
  item_name: string;
  price: number;
  status: "pending" | "fulfilled" | "rejected";
  admin_note: string;
  created_at: string;
}

export async function listRedemptions(opts: { accountId?: number; status?: Redemption["status"]; limit?: number } = {}): Promise<Redemption[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.accountId != null) { where.push("r.account_id = ?"); args.push(opts.accountId); }
  if (opts.status) { where.push("r.status = ?"); args.push(opts.status); }
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT r.id, r.account_id, a.display_name, a.qzino_username, r.item_name, r.price, r.status, r.admin_note, r.created_at
       FROM store_redemptions r JOIN user_accounts a ON a.id = r.account_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.id DESC LIMIT ?`,
    [...args, opts.limit ?? 100]
  );
  return rows.map((r) => ({
    id: Number(r.id), account_id: Number(r.account_id), display_name: String(r.display_name), qzino_username: String(r.qzino_username),
    item_name: String(r.item_name), price: Number(r.price), status: r.status, admin_note: String(r.admin_note), created_at: String(r.created_at),
  }));
}

/** Admin: mark a pending redemption fulfilled, or reject it and refund the points. */
export async function resolveRedemption(id: number, status: "fulfilled" | "rejected", note: string): Promise<void> {
  await withTx(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT account_id, item_id, item_name, price, status FROM store_redemptions WHERE id = ? FOR UPDATE", [id]);
    const r = rows[0];
    if (!r) throw new AppError("not_found");
    if (r.status !== "pending") throw new AppError("invalid_input", "already resolved");
    await conn.query("UPDATE store_redemptions SET status = ?, admin_note = ? WHERE id = ?", [status, note, id]);
    if (status === "rejected") {
      await applyPoints(conn, Number(r.account_id), Number(r.price), "refund", `Refund: ${r.item_name}`, id);
      if (r.item_id != null) await conn.query("UPDATE store_items SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL", [r.item_id]);
    }
  });
}

export interface ItemInput { name: string; description: string; kind: ItemKind; price: number; min_rank: number; stock: number | null; active: boolean; sort: number }

export async function saveStoreItem(id: number | null, v: ItemInput): Promise<number> {
  const cols = [v.name, v.description, v.kind, v.price, v.min_rank, v.stock, v.active ? 1 : 0, v.sort];
  if (id == null) {
    const [res] = await getPool().query<ResultSetHeader>(
      "INSERT INTO store_items (name, description, kind, price, min_rank, stock, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", cols);
    return res.insertId;
  }
  const [res] = await getPool().query<ResultSetHeader>(
    "UPDATE store_items SET name = ?, description = ?, kind = ?, price = ?, min_rank = ?, stock = ?, active = ?, sort = ? WHERE id = ?", [...cols, id]);
  if (!res.affectedRows) throw new AppError("not_found");
  return id;
}

export async function deleteStoreItem(id: number): Promise<void> {
  await getPool().query("DELETE FROM store_items WHERE id = ?", [id]);
}

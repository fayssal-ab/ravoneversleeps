import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { discordErrorText, openTicket, ticketUrl, type TicketFile } from "./discordBot";
import { qhubStanding } from "./qhub";
import { registerTicket, scheduleClose } from "./tickets";
import { AppError, withTx } from "./tx";
import { requireVerifiedQzino } from "./verification";

// Rewards store paid in QHub Points. Points are earned and held on QHub
// (watching Ravo there), so the site never deducts anything: "Redeem" asks
// for the QHub username plus a screenshot of the QHub Points balance, records
// a pending redemption and opens a private Discord ticket with the proof
// attached. Staff check it, take the points on QHub, pay the reward, then
// mark it Paid (or Reject) in Admin → Store, which answers in the ticket.

export type ItemKind = "cash" | "bonus" | "game" | "merch" | "other";
export const ITEM_KINDS: ItemKind[] = ["cash", "bonus", "game", "merch", "other"];

export interface StoreItem {
  id: number; name: string; description: string; kind: ItemKind; price: number;
  stock: number | null; active: boolean; sort: number;
}

/** Starting items (editable in Admin → Store). Prices in QHub Points. */
const STARTER: Omit<StoreItem, "id" | "active">[] = [
  { name: "$5 Qzino tip", description: "$5 sent to your Qzino account.", kind: "cash", price: 3000, stock: null, sort: 1 },
  { name: "$10 Qzino tip", description: "$10 sent to your Qzino account.", kind: "cash", price: 6000, stock: null, sort: 2 },
  { name: "Keno: $1 x15", description: "Ravo plays 15 keno rounds at $1 for you live on stream.", kind: "game", price: 8000, stock: null, sort: 3 },
  { name: "$30 Qzino tip", description: "$30 sent to your Qzino account. Best value.", kind: "cash", price: 10000, stock: null, sort: 4 },
  { name: "$40 bonus buy", description: "Ravo opens a $40 bonus buy for you live on stream.", kind: "bonus", price: 15000, stock: null, sort: 5 },
  { name: "$50 blackjack hand", description: "Ravo plays a $50 blackjack hand for you live on stream.", kind: "game", price: 18000, stock: null, sort: 6 },
];
const SEED_KEY = "store_qhub_seeded";

let ready: Promise<void> | null = null;
/** Schema + starting items on first use (DDL: never inside a transaction). */
export function ensureStoreSchema(): Promise<void> {
  ready ??= (async () => {
    const pool = getPool();
    const has = async (table: string, col: string) => {
      const [r] = await pool.query<RowDataPacket[]>(
        "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, col]);
      return r[0] ? String(r[0].t) : null;
    };
    if (!(await has("store_redemptions", "qhub_username"))) await pool.query("ALTER TABLE store_redemptions ADD COLUMN qhub_username VARCHAR(64) NOT NULL DEFAULT ''");
    if (!(await has("store_redemptions", "ticket"))) await pool.query("ALTER TABLE store_redemptions ADD COLUMN ticket VARCHAR(32) NULL");
    if (!(await has("store_items", "kind"))?.includes("'game'")) {
      await pool.query("ALTER TABLE store_items MODIFY COLUMN kind ENUM('cash','bonus','game','merch','other') NOT NULL DEFAULT 'cash'");
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (
      k VARCHAR(64) PRIMARY KEY, v TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    // first run: the old site-points items go away (hidden, history kept) and the QHub ones come in
    const [seeded] = await pool.query<ResultSetHeader>("INSERT IGNORE INTO site_settings (k, v) VALUES (?, '1')", [SEED_KEY]);
    if (seeded.affectedRows) {
      await pool.query("UPDATE store_items SET active = 0 WHERE active = 1");
      for (const it of STARTER) {
        await pool.query("INSERT INTO store_items (name, description, kind, price, min_rank, stock, sort) VALUES (?, ?, ?, ?, 1, ?, ?)",
          [it.name, it.description, it.kind, it.price, it.stock, it.sort]);
      }
    }
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const toItem = (r: RowDataPacket): StoreItem => ({
  id: Number(r.id), name: String(r.name), description: String(r.description), kind: r.kind as ItemKind,
  price: Number(r.price), stock: r.stock == null ? null : Number(r.stock), active: Boolean(Number(r.active)), sort: Number(r.sort),
});

export async function listStoreItems(opts: { includeInactive?: boolean } = {}): Promise<StoreItem[]> {
  await ensureStoreSchema();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT id, name, description, kind, price, stock, active, sort FROM store_items
      ${opts.includeInactive ? "" : "WHERE active = 1"} ORDER BY active DESC, sort, price, id`);
  return rows.map(toItem);
}

/** Open redemptions a viewer may have at once (each one is a ticket for staff). */
const MAX_PENDING = 3;

/**
 * "Redeem": record the request and open the ticket with the proof attached.
 * Needs Discord (the ticket) and a verified Qzino username (where the reward
 * goes). Stock is held while the request is pending.
 */
export async function redeemItem(accountId: number, itemId: number, qhubUsername: string, proof: TicketFile[]): Promise<string | null> {
  await ensureStoreSchema();
  await requireVerifiedQzino(accountId);
  const pool = getPool();
  const [ids] = await pool.query<RowDataPacket[]>("SELECT provider_user_id FROM user_identities WHERE account_id = ? AND provider = 'discord' LIMIT 1", [accountId]);
  const discordId = ids[0] ? String(ids[0].provider_user_id) : null;
  if (!discordId) throw new AppError("discord_required");

  const { redemptionId, item } = await withTx(async (conn) => {
    const [acc] = await conn.query<RowDataPacket[]>("SELECT banned FROM user_accounts WHERE id = ? FOR UPDATE", [accountId]);
    if (!acc[0]) throw new AppError("not_signed_in");
    if (Number(acc[0].banned)) throw new AppError("banned");
    const [open] = await conn.query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM store_redemptions WHERE account_id = ? AND status = 'pending'", [accountId]);
    if (Number(open[0].n) >= MAX_PENDING) throw new AppError("too_many_pending");
    const [items] = await conn.query<RowDataPacket[]>("SELECT id, name, description, kind, price, stock, active, sort FROM store_items WHERE id = ? FOR UPDATE", [itemId]);
    if (!items[0]) throw new AppError("not_found");
    const item = toItem(items[0]);
    if (!item.active) throw new AppError("inactive");
    if (item.stock != null && item.stock <= 0) throw new AppError("out_of_stock");
    const [res] = await conn.query<ResultSetHeader>(
      "INSERT INTO store_redemptions (account_id, item_id, item_name, price, qhub_username) VALUES (?, ?, ?, ?, ?)",
      [accountId, item.id, item.name, item.price, qhubUsername]);
    if (item.stock != null) await conn.query("UPDATE store_items SET stock = stock - 1 WHERE id = ?", [item.id]);
    return { redemptionId: res.insertId, item };
  });

  const [acc] = await pool.query<RowDataPacket[]>(
    `SELECT a.display_name, a.qzino_username, (SELECT username FROM user_identities WHERE account_id = a.id AND provider = 'kick' LIMIT 1) AS kick
       FROM user_accounts a WHERE a.id = ?`, [accountId]);
  const r = acc[0] ?? {};
  const seat = await qhubStanding(qhubUsername).catch(() => null);
  let ticket;
  try {
    ticket = await openTicket({
      kind: "store", label: String(r.display_name ?? accountId),
      discordUserId: discordId,
      message: `**Store redemption**: proof of QHub Points sent from the site is attached below. A staff member will check it and send your reward.`,
      embed: {
        title: `${item.name} · ${item.price.toLocaleString("en-US")} QHub Points`,
        color: 0xffd76a,
        fields: [
          { name: "Player", value: String(r.display_name ?? "—"), inline: true },
          { name: "Discord", value: `<@${discordId}>`, inline: true },
          { name: "Kick", value: r.kick ? String(r.kick) : "not linked", inline: true },
          { name: "QHub username", value: `\`${qhubUsername}\``, inline: true },
          { name: "Qzino (verified)", value: `\`${String(r.qzino_username ?? "")}\``, inline: true },
          { name: "Cost", value: `**${item.price.toLocaleString("en-US")}** Points`, inline: true },
          { name: "QHub board", value: seat ? `seat #${seat.rank} · ${seat.points.toLocaleString("en-US")} Points` : "not found on the public board (name hidden or not ranked)", inline: false },
          { name: "Proof", value: proof.map((f) => f.name).join(", "), inline: false },
          { name: "Request", value: `#${redemptionId}`, inline: true },
        ],
        footer: "Staff: check the Points in the proof, take them on QHub, pay the reward, then mark it Paid in Admin → Store",
      },
      files: proof,
    });
  } catch (e) {
    console.error("store ticket failed", discordErrorText(e));
    await cancelRedemption(redemptionId);
    throw new AppError("ticket_failed", discordErrorText(e));
  }
  if (!ticket) {
    await cancelRedemption(redemptionId);
    throw new AppError("ticket_failed", "Discord bot not configured");
  }
  await pool.query("UPDATE store_redemptions SET ticket = ? WHERE id = ?", [ticket.channelId, redemptionId]);
  await registerTicket(ticket.channelId, "store").catch(() => {});
  return ticket.url;
}

/** No ticket could open: drop the request and give the stock back. */
async function cancelRedemption(id: number): Promise<void> {
  await withTx(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT item_id FROM store_redemptions WHERE id = ? AND status = 'pending' FOR UPDATE", [id]);
    if (!rows[0]) return;
    await conn.query("DELETE FROM store_redemptions WHERE id = ?", [id]);
    if (rows[0].item_id != null) await conn.query("UPDATE store_items SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL", [rows[0].item_id]);
  }).catch(() => {});
}

export interface Redemption {
  id: number; account_id: number; display_name: string; qzino_username: string; qhub_username: string;
  item_name: string; price: number; status: "pending" | "fulfilled" | "rejected"; admin_note: string;
  ticket_url: string | null; created_at: string;
}

export async function listRedemptions(opts: { accountId?: number; status?: Redemption["status"]; limit?: number } = {}): Promise<Redemption[]> {
  await ensureStoreSchema();
  const where: string[] = [];
  const args: unknown[] = [];
  if (opts.accountId != null) { where.push("r.account_id = ?"); args.push(opts.accountId); }
  if (opts.status) { where.push("r.status = ?"); args.push(opts.status); }
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT r.id, r.account_id, a.display_name, a.qzino_username, r.qhub_username, r.item_name, r.price, r.status, r.admin_note, r.ticket, r.created_at
       FROM store_redemptions r JOIN user_accounts a ON a.id = r.account_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.id DESC LIMIT ?`,
    [...args, opts.limit ?? 100]);
  return rows.map((r) => ({
    id: Number(r.id), account_id: Number(r.account_id), display_name: String(r.display_name), qzino_username: String(r.qzino_username),
    qhub_username: String(r.qhub_username ?? ""), item_name: String(r.item_name), price: Number(r.price), status: r.status,
    admin_note: String(r.admin_note), ticket_url: ticketUrl(r.ticket ?? null), created_at: String(r.created_at),
  }));
}

export async function pendingRedemptionCount(): Promise<number> {
  await ensureStoreSchema();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM store_redemptions WHERE status = 'pending'");
  return Number(rows[0].n);
}

/** Admin: paid, or rejected (stock goes back). Answers in the ticket and schedules it to close. */
export async function resolveRedemption(id: number, status: "fulfilled" | "rejected", note: string): Promise<void> {
  await ensureStoreSchema();
  const r = await withTx(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT item_id, item_name, status, ticket FROM store_redemptions WHERE id = ? FOR UPDATE", [id]);
    const r = rows[0];
    if (!r) throw new AppError("not_found");
    if (r.status !== "pending") throw new AppError("invalid_input", "already resolved");
    await conn.query("UPDATE store_redemptions SET status = ?, admin_note = ? WHERE id = ?", [status, note, id]);
    if (status === "rejected" && r.item_id != null) await conn.query("UPDATE store_items SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL", [r.item_id]);
    return r;
  });
  await scheduleClose(r.ticket ? String(r.ticket) : null, status === "fulfilled"
    ? `✅ **${r.item_name}** is paid. Enjoy!${note ? `\n> ${note}` : ""}`
    : `❌ This redemption was not accepted${note ? `: ${note}` : "."} Ask here if something is unclear.`, status === "fulfilled" ? "approved" : "rejected").catch(() => {});
}

export interface ItemInput { name: string; description: string; kind: ItemKind; price: number; stock: number | null; active: boolean; sort: number }

export async function saveStoreItem(id: number | null, v: ItemInput): Promise<number> {
  await ensureStoreSchema();
  const cols = [v.name, v.description, v.kind, v.price, v.stock, v.active ? 1 : 0, v.sort];
  if (id == null) {
    const [res] = await getPool().query<ResultSetHeader>(
      "INSERT INTO store_items (name, description, kind, price, min_rank, stock, active, sort) VALUES (?, ?, ?, ?, 1, ?, ?, ?)", cols);
    return res.insertId;
  }
  const [res] = await getPool().query<ResultSetHeader>(
    "UPDATE store_items SET name = ?, description = ?, kind = ?, price = ?, stock = ?, active = ?, sort = ? WHERE id = ?", [...cols, id]);
  if (!res.affectedRows) throw new AppError("not_found");
  return id;
}

export async function deleteStoreItem(id: number): Promise<void> {
  await getPool().query("DELETE FROM store_items WHERE id = ?", [id]);
}

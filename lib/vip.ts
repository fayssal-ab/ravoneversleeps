import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { openTicket, ticketUrl } from "./discordBot";
import { registerTicket, scheduleClose } from "./tickets";
import { AppError } from "./tx";

// VIP Transfer: viewers who are VIP on another casino apply here; Ravo's
// team reviews it with Qzino in a private Discord ticket (proof screenshots
// go there, never into this database) and approves or rejects it in
// Admin → VIP Transfer. Qzino has the final say on the transfer itself.

/** Monthly wager ranges offered in the form (no exact figures needed). */
export const WAGER_RANGES = ["under-10k", "10k-50k", "50k-250k", "250k-plus"] as const;
export const WAGER_LABEL: Record<(typeof WAGER_RANGES)[number], string> = {
  "under-10k": "Under $10k", "10k-50k": "$10k – $50k", "50k-250k": "$50k – $250k", "250k-plus": "$250k+",
};

export interface VipApplication {
  id: number; account_id: number; display_name?: string; qzino_username: string; casino: string; vip_level: string;
  monthly_wager: string; note: string; status: "pending" | "approved" | "rejected"; admin_note: string;
  ticket_url: string | null; created_at: string;
}

let ready: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ready ??= getPool().query(`CREATE TABLE IF NOT EXISTS vip_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    qzino_username VARCHAR(64) NOT NULL,
    casino VARCHAR(80) NOT NULL,
    vip_level VARCHAR(80) NOT NULL,
    monthly_wager VARCHAR(20) NOT NULL,
    note VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    admin_note VARCHAR(255) NOT NULL DEFAULT '',
    ticket VARCHAR(32) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_vip_status (status, created_at),
    INDEX idx_vip_account (account_id)
  ) ENGINE=InnoDB`).then(() => undefined, (e) => { ready = null; throw e; });
  return ready;
}

const toApp = (r: RowDataPacket): VipApplication => ({
  id: Number(r.id), account_id: Number(r.account_id), display_name: r.display_name != null ? String(r.display_name) : undefined,
  qzino_username: String(r.qzino_username), casino: String(r.casino), vip_level: String(r.vip_level), monthly_wager: String(r.monthly_wager),
  note: String(r.note), status: r.status, admin_note: String(r.admin_note), ticket_url: ticketUrl(r.ticket ?? null), created_at: String(r.created_at),
});

/** The viewer's latest application (any status). */
export async function myVipApplication(accountId: number): Promise<VipApplication | null> {
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>("SELECT * FROM vip_applications WHERE account_id = ? ORDER BY id DESC LIMIT 1", [accountId]);
  return rows[0] ? toApp(rows[0]) : null;
}

export async function applyVipTransfer(accountId: number, v: { qzino: string; casino: string; vip_level: string; monthly_wager: string; note: string }): Promise<number> {
  await ensureTable();
  const pool = getPool();
  const [open] = await pool.query<RowDataPacket[]>("SELECT id FROM vip_applications WHERE account_id = ? AND status = 'pending' LIMIT 1", [accountId]);
  if (open[0]) throw new AppError("vip_pending");
  const [ids] = await pool.query<RowDataPacket[]>(
    `SELECT a.display_name, (SELECT provider_user_id FROM user_identities WHERE account_id = a.id AND provider = 'discord' LIMIT 1) AS discord
       FROM user_accounts a WHERE a.id = ?`, [accountId]);
  if (!ids[0]) throw new AppError("not_signed_in");
  const [res] = await pool.query<ResultSetHeader>(
    "INSERT INTO vip_applications (account_id, qzino_username, casino, vip_level, monthly_wager, note) VALUES (?, ?, ?, ?, ?, ?)",
    [accountId, v.qzino, v.casino, v.vip_level, v.monthly_wager, v.note]);
  const discord = ids[0].discord ? String(ids[0].discord) : null;
  if (discord) {
    const ticket = await openTicket({
      name: `vip-${v.qzino}`,
      discordUserId: discord,
      message:
        `**VIP Transfer application #${res.insertId}**\n` +
        `Player: **${String(ids[0].display_name)}** · Qzino: **${v.qzino}**\n` +
        `Current casino: **${v.casino}** · VIP level there: **${v.vip_level}** · Monthly wager: **${WAGER_LABEL[v.monthly_wager as keyof typeof WAGER_LABEL] ?? v.monthly_wager}**\n` +
        (v.note ? `Note: ${v.note}\n` : "") +
        `\n📸 Please post a screenshot of your VIP level/profile on ${v.casino} here. ` +
        `**Never share passwords or login codes.** The team reviews it with Qzino and answers in this ticket.`,
    }).catch((e: Error) => { console.error("vip ticket failed", e.message); return null; });
    if (ticket) {
      await pool.query("UPDATE vip_applications SET ticket = ? WHERE id = ?", [ticket.channelId, res.insertId]);
      await registerTicket(ticket.channelId, "vip").catch(() => {});
    }
  }
  return res.insertId;
}

export async function listVipApplications(status?: VipApplication["status"]): Promise<VipApplication[]> {
  await ensureTable();
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT v.*, a.display_name FROM vip_applications v JOIN user_accounts a ON a.id = v.account_id
      ${status ? "WHERE v.status = ?" : ""} ORDER BY FIELD(v.status, 'pending', 'approved', 'rejected'), v.id DESC LIMIT 200`, status ? [status] : []);
  return rows.map(toApp);
}

export async function decideVipApplication(id: number, approved: boolean, note: string): Promise<void> {
  await ensureTable();
  const pool = getPool();
  const [res] = await pool.query<ResultSetHeader>(
    "UPDATE vip_applications SET status = ?, admin_note = ? WHERE id = ? AND status = 'pending'", [approved ? "approved" : "rejected", note, id]);
  if (!res.affectedRows) throw new AppError("invalid_input", "already decided");
  const [row] = await pool.query<RowDataPacket[]>("SELECT ticket FROM vip_applications WHERE id = ?", [id]);
  await scheduleClose(row[0]?.ticket ? String(row[0].ticket) : null, (approved
    ? "✅ Your VIP Transfer is **approved**. Qzino's VIP team will set up your trial period."
    : "❌ Your VIP Transfer application wasn't approved this time.") + (note ? `\nNote: ${note}` : ""));
}

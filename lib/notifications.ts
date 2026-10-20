import "server-only";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "./db";
import { getLiveStatus } from "./stream";
import { getQboardsBoard } from "./qboards";

// Bell feed: what's happening on the site right now (live stream, open
// tournament registration, running hunt, open challenges, live leaderboard) plus,
// for a signed-in viewer, updates on their own redemptions and claims.

export interface Note { id: string; kind: "live" | "event" | "personal"; title: string; body: string; href: string; at: string }

export async function getNotifications(accountId: number | null): Promise<Note[]> {
  const pool = getPool();
  const notes: Note[] = [];
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const safe = async <T,>(fn: () => Promise<T>, fallback: T) => { try { return await fn(); } catch { return fallback; } };

  const [live, ko, hunt, period] = await Promise.all([
    getLiveStatus(),
    safe(async () => (await pool.query<RowDataPacket[]>("SELECT id, title, status, max_players, COALESCE(opened_at, created_at) AS at FROM ko_tournaments WHERE status IN ('open','closed') ORDER BY id DESC LIMIT 1"))[0][0], undefined),
    safe(async () => (await pool.query<RowDataPacket[]>("SELECT id, title, status, created_at FROM bonus_hunts WHERE status <> 'finished' ORDER BY id DESC LIMIT 1"))[0][0], undefined),
    safe(async () => { const b = await getQboardsBoard(1); return b?.period?.state === "live" ? { ...b.period, id: b.eventId } : undefined; }, undefined),
  ]);
  const challenges = await safe(async () => (await pool.query<RowDataPacket[]>("SELECT id, slot_name, target_multi, reward, created_at FROM challenges WHERE status = 'open' ORDER BY id DESC LIMIT 2"))[0], [] as RowDataPacket[]);

  if (live.live) notes.push({ id: "live", kind: "live", title: "Ravo is live on Kick", body: live.title || "Come hang out in chat.", href: "/stream", at: now });
  if (ko) notes.push({
    id: `ko-${ko.id}-${ko.status}`, kind: "event",
    title: ko.status === "open" ? `Tournament open: ${ko.title}` : `Tournament running: ${ko.title}`,
    body: ko.status === "open" ? `Type !join in Kick chat to grab one of ${ko.max_players} seats.` : "Follow the 1v1 battles live.",
    href: "/tournaments", at: String(ko.at),
  });
  if (hunt) notes.push({ id: `hunt-${hunt.id}-${hunt.status}`, kind: "event", title: `Bonus hunt ${hunt.status === "opening" ? "opening now" : "collecting"}`, body: String(hunt.title), href: "/bonus-hunts", at: String(hunt.created_at) });
  if (period) notes.push({ id: `period-${period.id}`, kind: "event", title: period.title, body: `$${Number(period.prize_pool).toLocaleString("en-US")} on the line this month.`, href: "/leaderboard", at: String(period.starts_at) });
  for (const c of challenges) notes.push({ id: `challenge-${c.id}`, kind: "event", title: `Challenge: ${c.slot_name}`, body: `First to hit ${Number(c.target_multi).toLocaleString("en-US")}x wins $${Number(c.reward).toLocaleString("en-US")}.`, href: "/challenges", at: String(c.created_at) });

  if (accountId != null) {
    const [acc, vip] = await Promise.all([
      safe(async () => (await pool.query<RowDataPacket[]>("SELECT qzino_username, qzino_status FROM user_accounts WHERE id = ?", [accountId]))[0][0], undefined),
      safe(async () => (await pool.query<RowDataPacket[]>("SELECT id, casino, status, admin_note, updated_at FROM vip_applications WHERE account_id = ? ORDER BY id DESC LIMIT 1", [accountId]))[0][0], undefined),
    ]);
    if (acc?.qzino_username && (acc.qzino_status === "verified" || acc.qzino_status === "rejected" || acc.qzino_status === "pending")) notes.push({
      id: `qzino-${acc.qzino_status}`, kind: "personal",
      title: acc.qzino_status === "verified" ? "Qzino username verified" : acc.qzino_status === "rejected" ? "Qzino username not verified" : "Qzino username under review",
      body: acc.qzino_status === "verified" ? "Store, milestones and challenges are unlocked." : acc.qzino_status === "rejected" ? "Correct it on your account page." : "Check your Discord ticket.",
      href: "/account", at: now,
    });
    if (vip) notes.push({
      id: `vip-${vip.id}-${vip.status}`, kind: "personal",
      title: vip.status === "approved" ? "VIP Transfer approved" : vip.status === "rejected" ? "VIP Transfer not approved" : "VIP Transfer under review",
      body: vip.admin_note ? String(vip.admin_note) : String(vip.casino),
      href: "/vip-transfer", at: String(vip.updated_at),
    });
    const [claims] = await Promise.all([
      safe(async () => (await pool.query<RowDataPacket[]>("SELECT id, milestone_name, reward, status, admin_note, updated_at FROM milestone_claims WHERE account_id = ? ORDER BY updated_at DESC LIMIT 5", [accountId]))[0], [] as RowDataPacket[]),
    ]);
    for (const c of claims) notes.push({
      id: `claim-${c.id}-${c.status}`, kind: "personal",
      title: c.status === "paid" ? `Milestone paid: ${c.milestone_name}` : c.status === "rejected" ? `Milestone claim rejected: ${c.milestone_name}` : `Milestone claimed: ${c.milestone_name}`,
      body: c.admin_note ? String(c.admin_note) : `$${Number(c.reward).toLocaleString("en-US")} reward`,
      href: "/milestones", at: String(c.updated_at),
    });
  }
  return notes.sort((a, b) => (a.kind === "live" ? -1 : b.kind === "live" ? 1 : b.at.localeCompare(a.at))).slice(0, 12);
}

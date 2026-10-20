"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin";
import { addBonus, createHunt, deleteBonus, deleteHunt, finishHunt, moveBonus, reopenHunt, setBonusWin, updateHunt } from "@/lib/hunts";
import { syncCatalog, upgradeTypedSlots } from "@/lib/slots";
import { deleteClaim, resolveClaim, saveMilestones } from "@/lib/milestones";
import { addSlot, deleteSlot } from "@/lib/stream";
import { createChallenge, deleteChallenge, markChallengeWon, setChallengeStatus } from "@/lib/challenges";
import { decideVerification, REJECT_REASONS, type RejectReason } from "@/lib/verification";
import { discordSetup } from "@/lib/discordBot";
import { saveTopPrizes } from "@/lib/leaderboardPrizes";
import { decideVipApplication } from "@/lib/vip";
import { AppError, DECIMAL_20_8, parseForm, zId, zRequiredText, zText } from "@/lib/tx";
import { adminSetQzino, setBanned } from "@/lib/userAdmin";

// Admin Server Actions. adminAction re-checks the session, writes the audit
// log and redirects back with ?ok= / ?error=.

const checkbox = z.literal("on").optional().transform((v) => v === "on");


// ── users ──────────────────────────────────────────────────────────────
/** Back to the same Users tab/search/sort (only /admin/users URLs). */
function usersBack(form: FormData): string {
  const back = String(form.get("back") ?? "");
  return /^\/admin\/users(\?[\w=&%.+-]*)?$/.test(back) ? back : "/admin/users";
}

export async function userFlagsAction(form: FormData) {
  await adminAction({ path: usersBack(form), audit: "user.update" }, async () => {
    const v = parseForm(z.object({ id: zId, qzino: z.string().trim().max(64), banned: checkbox }), form);
    await adminSetQzino(v.id, v.qzino);
    await setBanned(v.id, v.banned);
    return v;
  });
}

// ── milestones ─────────────────────────────────────────────────────────
export async function saveMilestonesAction(form: FormData) {
  await adminAction({ path: "/admin/milestones", audit: "milestones.save", revalidate: ["/milestones", "/"] }, async () => {
    const rows: { id: number | null; name: string; min_wager: string; reward: string }[] = [];
    for (let i = 0; i < 50; i++) {
      const name = String(form.get(`name_${i}`) ?? "").trim();
      const wager = String(form.get(`wager_${i}`) ?? "").trim();
      const reward = String(form.get(`reward_${i}`) ?? "").trim();
      if (!name && !wager && !reward) continue;
      if (!name || name.length > 64 || !DECIMAL_20_8.test(wager) || !DECIMAL_20_8.test(reward)) throw new AppError("invalid_input", `row ${i + 1}`);
      const id = String(form.get(`id_${i}`) ?? "");
      rows.push({ id: /^\d+$/.test(id) ? Number(id) : null, name, min_wager: wager, reward });
    }
    if (new Set(rows.map((r) => Number(r.min_wager))).size !== rows.length) throw new AppError("invalid_input", "two milestones share the same wager");
    await saveMilestones(rows);
    return { count: rows.length };
  });
}

export async function resolveClaimAction(form: FormData) {
  await adminAction({ path: "/admin/milestones", audit: "milestones.claim", revalidate: ["/milestones"] }, async () => {
    const v = parseForm(z.object({ id: zId, status: z.enum(["paid", "rejected", "delete"]), note: zText(255) }), form);
    if (v.status === "delete") await deleteClaim(v.id);
    else await resolveClaim(v.id, v.status, v.note);
    return v;
  });
}

// ── bonus hunts ────────────────────────────────────────────────────────
const zMoneyStr = z.string().trim().regex(DECIMAL_20_8, "invalid_amount");

export async function createHuntAction(form: FormData) {
  await adminAction({ path: "/admin/hunts", audit: "hunt.create", revalidate: ["/bonus-hunts"] }, async () => {
    const v = parseForm(z.object({ title: zRequiredText(120), start_balance: zMoneyStr }), form);
    return { id: await createHunt(v.title, v.start_balance), ...v };
  });
}

export async function updateHuntAction(form: FormData) {
  const hid = String(form.get("id") ?? "");
  await adminAction({ path: `/admin/hunts?h=${encodeURIComponent(hid)}`, audit: "hunt.update", revalidate: ["/bonus-hunts"] }, async () => {
    const v = parseForm(z.object({ id: zId, title: zRequiredText(120), start_balance: zMoneyStr }), form);
    await updateHunt(v.id, v);
    return v;
  });
}

export async function huntStatusAction(form: FormData) {
  const hid = String(form.get("id") ?? "");
  await adminAction({ path: `/admin/hunts?h=${encodeURIComponent(hid)}`, audit: "hunt.status", revalidate: ["/bonus-hunts"] }, async () => {
    const v = parseForm(z.object({ id: zId, op: z.enum(["finish", "reopen", "delete"]) }), form);
    if (v.op === "finish") await finishHunt(v.id);
    else if (v.op === "reopen") await reopenHunt(v.id);
    else await deleteHunt(v.id);
    return v;
  });
}

export async function addBonusAction(form: FormData) {
  const hid = String(form.get("hunt") ?? "");
  await adminAction({ path: `/admin/hunts?h=${encodeURIComponent(hid)}`, audit: "hunt.bonus.add", revalidate: ["/bonus-hunts"] }, async () => {
    const v = parseForm(z.object({ hunt: zId, slot_id: zText(191), slot: zText(120), provider: zText(64), called_by: zText(64), bet: zMoneyStr }), form);
    return { hunt: v.hunt, slot: await addBonus(v.hunt, v), bet: v.bet };
  });
}

export async function bonusOpAction(form: FormData) {
  const hid = String(form.get("hunt") ?? "");
  await adminAction({ path: `/admin/hunts?h=${encodeURIComponent(hid)}`, audit: "hunt.bonus.update", revalidate: ["/bonus-hunts"] }, async () => {
    const v = parseForm(z.object({ hunt: zId, id: zId, op: z.enum(["win", "clear", "delete", "up", "down"]), win: z.union([z.literal(""), zMoneyStr]).optional() }), form);
    if (v.op === "delete") await deleteBonus(v.hunt, v.id);
    else if (v.op === "up" || v.op === "down") await moveBonus(v.hunt, v.id, v.op);
    else if (v.op === "clear") await setBonusWin(v.hunt, v.id, null);
    else {
      if (!v.win) throw new AppError("invalid_input", "enter the win");
      await setBonusWin(v.hunt, v.id, v.win);
    }
    return v;
  });
}

// ── slot catalogue ─────────────────────────────────────────────────────
export async function syncSlotsAction() {
  await adminAction({ path: "/admin/slots", audit: "slots.sync" }, async () => ({ ...(await syncCatalog()), upgraded: await upgradeTypedSlots() }));
}

// ── stream schedule ────────────────────────────────────────────────────
export async function addSlotAction(form: FormData) {
  await adminAction({ path: "/admin/stream", audit: "schedule.add", revalidate: ["/stream"] }, async () => {
    const v = parseForm(z.object({ weekday: z.coerce.number().int().min(0).max(6), start_time: z.string().regex(/^\d{2}:\d{2}$/, "invalid_time"), title: zText(120) }), form);
    await addSlot(v.weekday, v.start_time, v.title);
    return v;
  });
}

export async function deleteSlotAction(form: FormData) {
  await adminAction({ path: "/admin/stream", audit: "schedule.delete", revalidate: ["/stream"] }, async () => {
    const { id } = parseForm(z.object({ id: zId }), form);
    await deleteSlot(id);
    return { id };
  });
}

// ── challenges ─────────────────────────────────────────────────────────
const zMulti = z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, "invalid_multi");

export async function createChallengeAction(form: FormData) {
  await adminAction({ path: "/admin/challenges", audit: "challenge.create", revalidate: ["/challenges"] }, async () => {
    const v = parseForm(z.object({
      slot_id: zText(191), slot: zText(120), provider: zText(64), target_multi: zMulti, reward: zMoneyStr,
      min_bet: z.union([z.literal(""), zMoneyStr]).default(""),
    }), form);
    return { id: await createChallenge(v), slot: v.slot, target: v.target_multi, reward: v.reward };
  });
}

export async function challengeOpAction(form: FormData) {
  await adminAction({ path: "/admin/challenges", audit: "challenge.update", revalidate: ["/challenges"] }, async () => {
    const v = parseForm(z.object({
      id: zId, op: z.enum(["won", "close", "reopen", "delete"]),
      winner: zText(64).optional(), winner_multi: z.union([z.literal(""), zMulti]).optional(),
    }), form);
    if (v.op === "won") {
      if (!v.winner || !v.winner_multi) throw new AppError("invalid_input", "enter the winner and their multi");
      await markChallengeWon(v.id, v.winner, v.winner_multi);
    } else if (v.op === "delete") await deleteChallenge(v.id);
    else await setChallengeStatus(v.id, v.op === "close" ? "closed" : "open");
    return v;
  });
}

// ── Qzino username verification ────────────────────────────────────────
export async function verifyQzinoAction(form: FormData) {
  await adminAction({ path: "/admin/users?tab=verify", audit: "qzino.verify", revalidate: ["/account"] }, async () => {
    const v = parseForm(z.object({
      account: zId, decision: z.enum(["verify", "reject"]),
      reason: z.enum(Object.keys(REJECT_REASONS) as [RejectReason, ...RejectReason[]]).default("other"),
      // the admin confirms each point of the proof before verifying
      c_profile: checkbox, c_code: checkbox, c_cut: checkbox,
    }), form);
    if (v.decision === "verify" && !(v.c_profile && v.c_code && v.c_cut)) throw new AppError("invalid_input", "tick every check before verifying");
    await decideVerification(v.account, v.decision === "verify", v.reason);
    return v;
  });
}

// ── VIP transfer ───────────────────────────────────────────────────────
export async function decideVipAction(form: FormData) {
  await adminAction({ path: "/admin/vip", audit: "vip.decide", revalidate: ["/vip-transfer"] }, async () => {
    const v = parseForm(z.object({ id: zId, decision: z.enum(["approve", "reject"]), note: zText(255).default("") }), form);
    await decideVipApplication(v.id, v.decision === "approve", v.note);
    return v;
  });
}

// ── Discord ────────────────────────────────────────────────────────────
export async function discordSetupAction() {
  await adminAction({ path: "/admin/discord", audit: "discord.setup" }, async () => {
    try {
      const s = await discordSetup(true);
      return { guild: s.guildName, categoryCreated: s.categoryCreated, staffCreated: s.staffCreated };
    } catch (e) {
      throw new AppError("unexpected", e instanceof Error ? e.message : "discord error");
    }
  });
}

// ── leaderboard prizes ─────────────────────────────────────────────────
export async function saveTopPrizesAction(form: FormData) {
  await adminAction({ path: "/admin/leaderboard", audit: "leaderboard.prizes", revalidate: ["/leaderboard", "/"] }, async () => {
    const v = parseForm(z.object({ p1: zText(60), p2: zText(60), p3: zText(60) }), form);
    await saveTopPrizes([v.p1, v.p2, v.p3]);
    return v;
  });
}


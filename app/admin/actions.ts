"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin";
import { addBonus, createHunt, deleteBonus, deleteHunt, finishHunt, moveBonus, reopenHunt, setBonusWin, updateHunt } from "@/lib/hunts";
import { syncCatalog, upgradeTypedSlots } from "@/lib/slots";
import { addSlot, deleteSlot } from "@/lib/stream";
import { createChallenge, deleteChallenge, markChallengeWon, setChallengeStatus } from "@/lib/challenges";
import { decideVerification, REJECT_REASONS, retryQzinoTicket, type RejectReason } from "@/lib/verification";
import { discordErrorText, discordSetup, setInteractionsEndpoint } from "@/lib/discordBot";
import { SITE_URL } from "@/lib/constants";
import { saveTopPrizes } from "@/lib/leaderboardPrizes";
import { decideVipApplication } from "@/lib/vip";
import { AppError, DECIMAL_20_8, parseForm, zId, zRequiredText, zText } from "@/lib/tx";
import { adminSetUsernames, setBanned } from "@/lib/userAdmin";
import { deleteStoreItem, ITEM_KINDS, resolveRedemption, saveStoreItem, type ItemKind } from "@/lib/store";

// Admin Server Actions. adminAction re-checks the session, writes the audit
// log and redirects back with ?ok= / ?error=.

const checkbox = z.literal("on").optional().transform((v) => v === "on");


// ── store (QHub Points) ────────────────────────────────────────────────
export async function saveItemAction(form: FormData) {
  await adminAction({ path: "/admin/store", audit: "store.item.save", revalidate: ["/store"] }, async () => {
    const v = parseForm(z.object({
      id: z.union([z.literal(""), zId]).transform((x) => (x === "" ? null : x)),
      name: zRequiredText(120), description: zText(500), kind: z.enum(ITEM_KINDS as [ItemKind, ...ItemKind[]]),
      price: z.coerce.number().int().min(1).max(100_000_000),
      stock: z.union([z.literal(""), z.coerce.number().int().min(0).max(1_000_000)]).transform((x) => (x === "" ? null : x)),
      sort: z.coerce.number().int().min(-1000).max(1000), active: checkbox,
    }), form);
    return { id: await saveStoreItem(v.id, v), name: v.name };
  });
}

export async function deleteItemAction(form: FormData) {
  await adminAction({ path: "/admin/store", audit: "store.item.delete", revalidate: ["/store"] }, async () => {
    const { id } = parseForm(z.object({ id: zId }), form);
    await deleteStoreItem(id);
    return { id };
  });
}

export async function resolveRedemptionAction(form: FormData) {
  await adminAction({ path: "/admin/store", audit: "store.redemption.resolve", revalidate: ["/store"] }, async () => {
    const v = parseForm(z.object({ id: zId, status: z.enum(["fulfilled", "rejected"]), note: zText(255) }), form);
    await resolveRedemption(v.id, v.status, v.note);
    return v;
  });
}

// ── users ──────────────────────────────────────────────────────────────
/** Back to the same Users tab/search/sort (only /admin/users URLs). */
function usersBack(form: FormData): string {
  const back = String(form.get("back") ?? "");
  return /^\/admin\/users(\?[\w=&%.+-]*)?$/.test(back) ? back : "/admin/users";
}

export async function userFlagsAction(form: FormData) {
  await adminAction({ path: usersBack(form), audit: "user.update" }, async () => {
    const v = parseForm(z.object({
      id: zId, qzino: z.string().trim().max(64), banned: checkbox,
    }), form);
    await adminSetUsernames(v.id, v.qzino);
    await setBanned(v.id, v.banned);
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

export async function retryQzinoTicketAction(form: FormData) {
  await adminAction({ path: "/admin/users?tab=verify", audit: "qzino.ticket" }, async () => {
    const v = parseForm(z.object({ account: zId }), form);
    await retryQzinoTicket(v.account);
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
    let s;
    try {
      s = await discordSetup(true);
    } catch (e) {
      throw new AppError("unexpected", discordErrorText(e));
    }
    // ticket Claim / Delete buttons: Discord pings this URL before accepting it
    const endpoint = `${SITE_URL.replace(/\/$/, "")}/api/discord/interactions`;
    if (!endpoint.startsWith("https://")) throw new AppError("unexpected", `ticket buttons need the live https site (NEXT_PUBLIC_SITE_URL is ${SITE_URL})`);
    try {
      await setInteractionsEndpoint(endpoint);
    } catch (e) {
      throw new AppError("unexpected", `ticket buttons: Discord refused ${endpoint} (${discordErrorText(e)}). Deploy the latest version first, then run setup again.`);
    }
    return { guild: s.guildName, categoryCreated: s.categoryCreated, staffCreated: s.staffCreated, endpoint };
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

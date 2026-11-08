"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveQzinoUsername } from "@/lib/account";
import { claimChallenge, qzinoStatusOf, requestQzinoVerification, retryQzinoTicket } from "@/lib/verification";
import { applyVipTransfer, WAGER_RANGES } from "@/lib/vip";
import { redeemItem } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";
import { AppError, parseForm, zId } from "@/lib/tx";
import { currentAccountId } from "@/lib/userAuth";
import type { TicketFile } from "@/lib/discordBot";

// Viewer Server Actions. Each re-checks the session (actions are public POST
// endpoints) and reports back through ?ok= / ?error= on the page it came from.

async function run(path: string, ok: string, fn: (accountId: number) => Promise<unknown>): Promise<never> {
  let query: string;
  try {
    const accountId = await currentAccountId();
    if (accountId == null) throw new AppError("not_signed_in");
    const limit = await rateLimit(`viewer:${accountId}`, 30, 60);
    if (!limit.ok) throw new AppError("unexpected", "too many requests, slow down");
    await fn(accountId);
    query = `ok=${ok}`;
  } catch (err) {
    if (err instanceof AppError) query = `error=${err.code}${err.detail ? `&detail=${encodeURIComponent(err.detail)}` : ""}`;
    else {
      console.error("viewer action failed", err instanceof Error ? err.message : "unknown");
      query = "error=unexpected";
    }
  }
  revalidatePath("/", "layout");
  redirect(`${path}?${query}`);
}

export async function saveQzinoAction(form: FormData) {
  await run("/account", "saved", (id) => {
    const v = parseForm(z.object({ qzino: z.string().trim().max(64).regex(/^[\w.-]*$/, "letters, numbers, . _ - only") }), form);
    return (async () => {
      const changed = await saveQzinoUsername(id, v.qzino);
      const status = v.qzino ? (await qzinoStatusOf(id)).status : "none";
      // a new username (or another try after a rejection) goes to staff verification
      if (changed || status === "rejected") await requestQzinoVerification(id, v.qzino);
      // same username still waiting without a ticket: open it now
      else if (status === "pending") await retryQzinoTicket(id);
    })();
  });
}

const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];
const PROOF_MAX_BYTES = 4 * 1024 * 1024; // keep in sync with components/ui/ProofForm.tsx

/** Proof files from a ProofForm: 1–3 images / videos, 4 MB in total. */
async function readProof(form: FormData): Promise<TicketFile[]> {
  const files = form.getAll("proof").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new AppError("invalid_input", "add a screenshot or a recording");
  if (files.length > 3) throw new AppError("invalid_input", "3 files max");
  if (files.some((f) => !PROOF_TYPES.includes(f.type))) throw new AppError("invalid_input", "images (PNG, JPG, WEBP, GIF) or videos (MP4, WEBM, MOV) only");
  if (files.reduce((n, f) => n + f.size, 0) > PROOF_MAX_BYTES) throw new AppError("invalid_input", "4 MB max in total: send a longer recording in your ticket after");
  return Promise.all(files.map(async (f, i) => ({
    name: `proof-${i + 1}.${f.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"}`, type: f.type, data: await f.arrayBuffer(),
  })));
}

/**
 * "Verify my Qzino account" form: username + screenshot / short recording.
 * Saves the username and opens the ticket with the proof attached.
 */
export async function submitVerificationAction(form: FormData) {
  await run("/account", "verify_sent", async (id) => {
    const v = parseForm(z.object({ qzino: z.string().trim().min(1).max(64).regex(/^[\w.-]+$/, "letters, numbers, . _ - only") }), form);
    const proof = await readProof(form);
    const before = await qzinoStatusOf(id);
    // one open case at a time; a verified player only resubmits to change username
    if (before.status === "pending" && before.ticketUrl) throw new AppError("qzino_pending");
    const changed = await saveQzinoUsername(id, v.qzino);
    if (before.status === "verified" && !changed) throw new AppError("invalid_input", "this username is already verified");
    await requestQzinoVerification(id, v.qzino, proof);
  });
}

/** "Open my ticket": the pending verification's ticket failed or never opened. */
export async function openQzinoTicketAction() {
  await run("/account", "ticket", (id) => retryQzinoTicket(id));
}

/** "I hit it": the multi, the bet and a screenshot / clip of the win open the claim ticket. */
export async function claimChallengeAction(form: FormData) {
  await run("/challenges", "claimed", async (id) => {
    const v = parseForm(z.object({
      challenge: zId,
      multi: z.coerce.number().positive().max(1_000_000),
      bet: z.coerce.number().positive().max(1_000_000),
    }), form);
    await claimChallenge(id, v.challenge, { multi: v.multi, bet: v.bet }, await readProof(form));
  });
}

/** Store "Redeem": QHub username + screenshot of the QHub Points open the ticket. */
export async function redeemAction(form: FormData) {
  await run("/store", "redeemed", async (id) => {
    const v = parseForm(z.object({
      item: zId,
      qhub: z.string().trim().min(2).max(64).regex(/^[^<>@#:`]+$/, "no < > @ # : ` characters"),
    }), form);
    await redeemItem(id, v.item, v.qhub, await readProof(form));
  });
}

export async function applyVipAction(form: FormData) {
  await run("/vip-transfer", "applied", (id) => {
    const v = parseForm(z.object({
      qzino: z.string().trim().min(1).max(64).regex(/^[\w.-]+$/, "letters, numbers, . _ - only"),
      casino: z.string().trim().min(1).max(80),
      vip_level: z.string().trim().min(1).max(80),
      monthly_wager: z.enum(WAGER_RANGES),
      note: z.string().trim().max(500).default(""),
    }), form);
    return applyVipTransfer(id, v);
  });
}

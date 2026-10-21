"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { saveQzinoUsername } from "@/lib/account";
import { claimChallenge, qzinoStatusOf, requestQzinoVerification, retryQzinoTicket } from "@/lib/verification";
import { applyVipTransfer, WAGER_RANGES } from "@/lib/vip";
import { rateLimit } from "@/lib/ratelimit";
import { AppError, parseForm, zId } from "@/lib/tx";
import { currentAccountId } from "@/lib/userAuth";

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

/** "Open my ticket": the pending verification's ticket failed or never opened. */
export async function openQzinoTicketAction() {
  await run("/account", "ticket", (id) => retryQzinoTicket(id));
}


export async function claimChallengeAction(form: FormData) {
  await run("/challenges", "claimed", (id) => claimChallenge(id, parseForm(z.object({ challenge: zId }), form).challenge));
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


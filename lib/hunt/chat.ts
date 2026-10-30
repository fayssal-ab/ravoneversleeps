import "server-only";
import { getFeaturedKo } from "../knockout";
import { cleanSlotRequest, findSlotByName } from "../slots";
import { AppError } from "../tx";
import { huntAction } from "./store";

// `!call <slot>` from Kick chat: a Hunt player picks the slot they play
// against the monster (or the Endboss) in front of them.

export const CALL_RE = /^\s*!call(?:\s.*)?$/i;

export async function chatCall(kickUserId: string, content: string): Promise<{ outcome: string; slot?: string }> {
  const t = await getFeaturedKo();
  if (!t || t.mode !== "hunt" || (t.status !== "open" && t.status !== "closed")) return { outcome: "no_hunt" };
  const raw = cleanSlotRequest(content.replace(/^\s*!call/i, ""));
  if (!raw) return { outcome: "no_slot" };
  const found = await findSlotByName(raw);
  const name = found?.name ?? raw;
  try {
    await huntAction(t.id, { op: "call", kickUserId, call: { name, provider: found?.provider ?? "", image: found?.imageUrl || null } });
    return { outcome: "called", slot: name };
  } catch (e) {
    if (e instanceof AppError) return { outcome: e.code };
    throw e;
  }
}

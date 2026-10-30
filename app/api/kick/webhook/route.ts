import { json, jsonError } from "@/lib/http";
import { kickImageUrl, verifyKickWebhook } from "@/lib/kickApi";
import { CALL_RE, chatCall } from "@/lib/hunt/chat";
import { logChat } from "@/lib/kickChatLog";
import { ensureKoSchema, JOIN_RE, recordJoin } from "@/lib/knockout";
import { findSlotByName } from "@/lib/slots";
import { withTx } from "@/lib/tx";

// Kick event webhook (official API). Every chat message of Ravo's channel
// lands here; `!join` / `!join <slot>` registers the sender in the open
// tournament. Messages are logged so the dashboard can show the webhook is
// delivering and what happened to each !join.
export const dynamic = "force-dynamic";

interface ChatEvent { message_id?: string; content?: string; sender?: { user_id?: number; username?: string; profile_picture?: string } }

export async function POST(request: Request) {
  const body = await request.text();
  if (!(await verifyKickWebhook(request.headers, body).catch(() => false))) return jsonError("bad_signature", 401);
  if (request.headers.get("kick-event-type") !== "chat.message.sent") return json({ ok: true });
  let e: ChatEvent;
  try { e = JSON.parse(body); } catch { return jsonError("invalid_body", 400); }
  const username = e.sender?.username;
  if (!e.content || !username) return json({ ok: true });
  // Hunt: `!call <slot>` against the monster in front of the player
  if (CALL_RE.test(e.content) && e.sender?.user_id != null) {
    try {
      const r = await chatCall(String(e.sender.user_id), e.content);
      await logChat(username, e.content, r.outcome, r.slot ?? null).catch(() => {});
      return json({ ok: true, ...r });
    } catch (err) {
      console.error("kick webhook call failed", err instanceof Error ? err.message : "unknown");
      await logChat(username, e.content, "processing_failed").catch(() => {});
      return jsonError("processing_failed", 500);
    }
  }
  if (!JOIN_RE.test(e.content) || !e.message_id || e.sender?.user_id == null) {
    await logChat(username, e.content).catch(() => {});
    return json({ ok: true });
  }
  try {
    await ensureKoSchema();
    const slot = await findSlotByName(e.content.replace(/^\s*!join/i, ""));
    const result = await withTx((conn) => recordJoin(conn, {
      kickUserId: String(e.sender!.user_id), username, avatar: kickImageUrl(e.sender!.profile_picture), messageId: `kick:${e.message_id}`, slot,
    }));
    await logChat(username, e.content, result.outcome, result.slot ?? null).catch(() => {});
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("kick webhook join failed", err instanceof Error ? err.message : "unknown");
    await logChat(username, e.content, "processing_failed").catch(() => {});
    return jsonError("processing_failed", 500);
  }
}

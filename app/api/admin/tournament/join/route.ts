import { z } from "zod";
import { isAdminSession } from "@/lib/admin";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import { ensureKoSchema, JOIN_RE, recordJoin } from "@/lib/knockout";
import { CALL_RE, chatCall } from "@/lib/hunt/chat";
import { findSlotByName } from "@/lib/slots";
import { withTx } from "@/lib/tx";

// Relay for `!join` messages read from Kick's public chat socket by the admin
// tournament dashboard. Message ids are de-duplicated (no double reroll).
export const dynamic = "force-dynamic";

const Body = z.object({
  messageId: z.string().trim().min(1).max(191),
  userId: z.union([z.string().regex(/^\d{1,20}$/), z.number().int().nonnegative()]),
  username: z.string().trim().min(1).max(191),
  content: z.string().max(500),
});

export async function POST(request: Request) {
  if (!(await isAdminSession())) return jsonError("unauthorized", 401);
  if (!isSameOrigin(request)) return jsonError("bad_origin", 403);
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return jsonError("invalid_body", 400);
  }
  if (CALL_RE.test(body.content)) {
    try { return json({ ok: true, ...(await chatCall(String(body.userId), body.content)) }); }
    catch { return jsonError("processing_failed", 503); }
  }
  if (!JOIN_RE.test(body.content)) return json({ ok: true, outcome: "not_command" });
  try {
    await ensureKoSchema();
    const slot = await findSlotByName(body.content.replace(/^\s*!join/i, ""));
    const result = await withTx((conn) => recordJoin(conn, { kickUserId: String(body.userId), username: body.username, messageId: `kick:${body.messageId}`, slot }));
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("ko join relay failed", err instanceof Error ? err.message : "unknown");
    return jsonError("processing_failed", 503);
  }
}

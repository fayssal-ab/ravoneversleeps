import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isAdminSession } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { ERROR_TEXT } from "@/lib/errors";
import { isSameOrigin, json, jsonError } from "@/lib/http";
import {
  addPlayerManually, cancelRoll, closeRegistration, confirmRoll, createKo, disqualifyPlayer, ensureKoSchema, focusNext, makeTeams, openRegistration,
  playNext, recordBattleResult, resetKo, rollPlayers, startBattle, undoTeams,
} from "@/lib/knockout";
import { ensureChatSubscription } from "@/lib/kickApi";
import { findSlotByName } from "@/lib/slots";
import { AppError } from "@/lib/tx";

// Admin control endpoint for the knockout dashboard. Admin cookie + same
// origin on every call; every action is audited. Rule violations → 409.
export const dynamic = "force-dynamic";

const Id = z.number().int().positive().max(2_147_483_647);
const Money = z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/);
const Bonus = z.object({ cost: Money, payout: Money });
const Amount = z.union([z.null(), Money]);
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"), title: z.string().trim().min(1).max(120), prize: z.string().trim().max(120).default(""),
    size: z.union([z.literal(4), z.literal(8), z.literal(16), z.literal(32)]), duo: z.boolean().default(false), prizes: z.tuple([Amount, Amount, Amount]).optional(),
  }),
  z.object({ action: z.enum(["open", "close", "reset", "roll", "confirm", "cancel_roll", "start", "next", "make_teams", "undo_teams", "play"]), id: Id }),
  z.object({ action: z.literal("result"), id: Id, matchId: z.number().int().positive(), p1: Bonus, p2: Bonus, p1b: Bonus.optional(), p2b: Bonus.optional() }),
  z.object({ action: z.literal("disqualify"), id: Id, participantId: z.number().int().positive() }),
  z.object({ action: z.literal("add_player"), id: Id, username: z.string().trim().min(1).max(40), slot: z.string().trim().max(80).default("") }),
]);

export async function POST(request: Request) {
  if (!(await isAdminSession())) return jsonError("unauthorized", 401);
  if (!isSameOrigin(request)) return jsonError("bad_origin", 403);
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return jsonError("invalid_body", 400);
  }
  try {
    await ensureKoSchema();
    let result: unknown = null;
    switch (body.action) {
      case "create": result = { id: await createKo({ title: body.title, prize: body.prize, size: body.size, duo: body.duo, prizes: body.prizes }) }; break;
      case "open":
        await openRegistration(body.id);
        // official Kick webhook for !join (best effort; the dashboard socket is the fallback)
        result = { kickWebhook: await ensureChatSubscription().catch((e: Error) => `failed: ${e.message}`) };
        break;
      case "close": await closeRegistration(body.id); break;
      case "reset": await resetKo(body.id); break;
      case "roll": result = await rollPlayers(body.id); break;
      case "confirm": await confirmRoll(body.id); break;
      case "cancel_roll": await cancelRoll(body.id); break;
      case "start": result = { matchId: await startBattle(body.id) }; break;
      case "play": result = await playNext(body.id); break;
      case "next": result = { matchId: await focusNext(body.id) }; break;
      case "result": result = await recordBattleResult(body.id, body.matchId, body.p1, body.p2, body.p1b && body.p2b ? { p1b: body.p1b, p2b: body.p2b } : undefined); break;
      case "make_teams": result = await makeTeams(body.id); break;
      case "undo_teams": await undoTeams(body.id); break;
      case "disqualify": result = await disqualifyPlayer(body.id, body.participantId); break;
      case "add_player": result = await addPlayerManually(body.username, body.slot ? await findSlotByName(body.slot) : null); break;
    }
    await logAudit("admin", `ko.${body.action}`, "id" in body ? String(body.id) : "", { ...body, result });
    revalidatePath("/tournaments");
    return json({ ok: true, result });
  } catch (err) {
    if (err instanceof AppError) return json({ ok: false, error: err.code, detail: err.detail ?? null, message: ERROR_TEXT[err.code] ?? err.code }, 409);
    console.error("ko action failed", err instanceof Error ? err.message : "unknown");
    return json({ ok: false, error: "unexpected", message: ERROR_TEXT.unexpected }, 500);
  }
}

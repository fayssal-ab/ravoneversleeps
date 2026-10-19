import { isCronAuthorized, json, jsonError } from "@/lib/http";
import { cleanupTickets } from "@/lib/tickets";

// Daily: delete Discord tickets whose case was decided more than 3 days ago
// (a Discord category holds at most 50 channels).
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function handle(request: Request) {
  if (!isCronAuthorized(request)) return jsonError("unauthorized", 401);
  try {
    return json({ ok: true, ...(await cleanupTickets()) });
  } catch (err) {
    console.error("cron/discord failed", err instanceof Error ? err.message : "unknown");
    return jsonError("discord_cleanup_failed", 500);
  }
}

export const GET = handle;
export const POST = handle;

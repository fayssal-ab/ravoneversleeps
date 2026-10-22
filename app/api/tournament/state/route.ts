import { NextResponse } from "next/server";
import { fillKoAvatars, getFeaturedKo, getKoById, getKoState } from "@/lib/knockout";

// Public live state of the featured tournament (overlay, public page and
// admin dashboard poll this). Only public chat handles, Kick avatars and
// slot info.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const idParam = Number(new URL(request.url).searchParams.get("id"));
  try {
    const t = Number.isInteger(idParam) && idParam > 0 ? await getKoById(idParam) : await getFeaturedKo();
    // pictures Kick didn't send with the !join (best effort, never blocks the state)
    if (t && (t.status === "open" || t.status === "closed")) await fillKoAvatars(t.id).catch(() => {});
    const state = t && t.status !== "cancelled" ? await getKoState(t) : null;
    return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { discordChannelUrl } from "@/lib/discordBot";
import { jsonError } from "@/lib/http";

// Ticket links on the site point here; we find Ravo's server and send the
// visitor into the Discord channel (Discord itself decides who can see it).
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!/^\d{5,25}$/.test(channel)) return jsonError("not_found", 404);
  try {
    return NextResponse.redirect(await discordChannelUrl(channel), 302);
  } catch {
    return NextResponse.redirect("https://discord.com/channels/@me", 302);
  }
}

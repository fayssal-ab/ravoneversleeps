import { NextResponse } from "next/server";

// The deploy this server runs. Open pages poll it and reload themselves when
// it changes (components/shell/AutoUpdate.tsx), so a new deploy shows up
// without Ctrl+R, OBS browser sources included.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ v: process.env.RAVO_BUILD_ID ?? "dev" }, { headers: { "Cache-Control": "no-store" } });
}

import { KoOverlay } from "@/components/tournament/KoOverlay";
import { HuntDemo } from "@/components/tournament/hunt/HuntDemo";

export const dynamic = "force-dynamic";

/**
 * OBS browser source: landscape by default; `?wide` = the 1920×1080 layout,
 * `?mute` = finishers without sound, `?demo` = loop made-up K.O. fights,
 * `?hunt-demo` = a made-up Reaping · Hunt playing every animation.
 */
export default async function TournamentOverlay({ searchParams }: { searchParams: Promise<{ wide?: string; mute?: string; demo?: string; "hunt-demo"?: string }> }) {
  const { wide, mute, demo, "hunt-demo": huntDemo } = await searchParams;
  if (huntDemo != null) return <HuntDemo mute={mute != null} />;
  return <KoOverlay wide={wide != null} mute={mute != null} demo={demo != null} />;
}

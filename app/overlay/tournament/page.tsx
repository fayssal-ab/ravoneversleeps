import { KoOverlay } from "@/components/tournament/KoOverlay";

export const dynamic = "force-dynamic";

/**
 * OBS browser source: landscape by default; `?wide` = the 1920×1080 layout,
 * `?mute` = finishers without sound, `?demo` = loop made-up K.O. fights.
 */
export default async function TournamentOverlay({ searchParams }: { searchParams: Promise<{ wide?: string; mute?: string; demo?: string }> }) {
  const { wide, mute, demo } = await searchParams;
  return <KoOverlay wide={wide != null} mute={mute != null} demo={demo != null} />;
}

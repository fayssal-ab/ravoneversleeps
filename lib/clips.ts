import "server-only";
import { KICK_CHANNEL } from "./constants";

// Ravo's Kick clips from Kick's public channel endpoint (the one the Kick
// site uses). Cached 10 minutes; an empty list when Kick is unreachable.

export interface Clip {
  id: string; title: string; thumbnail: string; video: string; duration: number;
  views: number; createdAt: string; creator: string; url: string;
}

export type ClipSort = "date" | "view";

interface RawClip {
  id?: string; title?: string; thumbnail_url?: string; video_url?: string; clip_url?: string; duration?: number;
  views?: number; view_count?: number; created_at?: string; creator?: { username?: string }; privacy?: string;
}

const okUrl = (u: unknown) => typeof u === "string" && /^https:\/\/clips\.kick\.com\//.test(u);

export async function getClips(sort: ClipSort = "date"): Promise<Clip[]> {
  const q = sort === "view" ? "?sort=view&time=all" : "";
  const res = await fetch(`https://kick.com/api/v2/channels/${KICK_CHANNEL}/clips${q}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; ravoneversleeps-site)" },
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`kick_clips_${res.status}`);
  const data = (await res.json()) as { clips?: RawClip[] };
  return (data.clips ?? [])
    .filter((c) => c.id && /^clip_[A-Z0-9]+$/i.test(c.id) && c.privacy !== "private" && okUrl(c.thumbnail_url) && okUrl(c.video_url ?? c.clip_url))
    .map((c) => ({
      id: c.id!, title: String(c.title ?? "").trim().slice(0, 120) || "Untitled clip",
      thumbnail: c.thumbnail_url!, video: (c.video_url ?? c.clip_url)!, duration: Number(c.duration ?? 0),
      views: Number(c.views ?? c.view_count ?? 0), createdAt: String(c.created_at ?? ""),
      creator: String(c.creator?.username ?? ""), url: `https://kick.com/${KICK_CHANNEL}/clips/${c.id}`,
    }));
}

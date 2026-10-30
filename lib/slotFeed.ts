// Pure helpers for the slot feed, shared by lib/slots.ts and scripts/sync-slots.ts.

/** Lowercase, strip marks/symbols (®, ™, accents), collapse whitespace. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface Feed { generated?: string; image_base?: string; providers?: string[]; slots?: unknown[][] }
interface FeedRow { id: string; slug: string; name: string; provider: string; imageUrl: string | null; popularity: number | null; stakeOnly: boolean }

/** Feed rows: [position, name, providerIdx, slug, image, rtp, bonus_buy, only_on_stake, max_win, volatility, popularity]. */
export function parseFeed(feed: Feed): FeedRow[] {
  const base = typeof feed.image_base === "string" && /^https:\/\/[a-z0-9.-]+\//i.test(feed.image_base) ? feed.image_base : "https://mediumrare.imgix.net/";
  const providers = Array.isArray(feed.providers) ? feed.providers : [];
  const seen = new Set<string>();
  const out: FeedRow[] = [];
  for (const s of feed.slots ?? []) {
    if (!Array.isArray(s)) continue;
    const name = typeof s[1] === "string" ? s[1].trim().slice(0, 191) : "";
    const slug = typeof s[3] === "string" ? s[3].trim().slice(0, 150) : "";
    if (!name || !slug || seen.has(slug)) continue;
    seen.add(slug);
    const image = typeof s[4] === "string" && /^[a-z0-9]{16,128}$/i.test(s[4]) ? s[4] : null;
    out.push({
      id: `slot/${slug}`,
      slug,
      name,
      provider: typeof s[2] === "number" && typeof providers[s[2]] === "string" ? providers[s[2]].slice(0, 120) : "",
      imageUrl: image ? `${base}${image}?w=280&h=367&fit=min&auto=format` : null,
      popularity: typeof s[10] === "number" && Number.isFinite(s[10]) ? Math.trunc(s[10]) : null,
      stakeOnly: s[7] === 1 || s[7] === true,
    });
  }
  return out;
}


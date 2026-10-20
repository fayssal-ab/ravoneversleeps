import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

const PAGES: [string, MetadataRoute.Sitemap[number]["changeFrequency"], number][] = [
  ["/", "daily", 1], ["/leaderboard", "daily", 0.9], ["/challenges", "daily", 0.8], ["/vip-transfer", "monthly", 0.8],
  ["/tournaments", "daily", 0.7], ["/bonus-hunts", "daily", 0.6],
  ["/stream", "weekly", 0.6], ["/clips", "daily", 0.6], ["/milestones", "monthly", 0.4], ["/privacy", "yearly", 0.2],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.URL || SITE_URL).replace(/\/$/, "");
  return PAGES.map(([path, changeFrequency, priority]) => ({ url: `${base}${path}`, changeFrequency, priority }));
}

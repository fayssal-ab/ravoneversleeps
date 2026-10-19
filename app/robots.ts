import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

// Public pages are crawlable; admin, APIs, OBS overlays and sign-in aren't.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.URL || SITE_URL).replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/overlay/", "/login", "/account"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}

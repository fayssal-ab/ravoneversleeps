import type { NextConfig } from "next";

// Security headers. Everything is self-hosted except the Kick player embed and
// the Kick/Discord avatar hosts we actually load.
const csp = [
  "default-src 'self'",
  // Next injects small inline bootstrap scripts; 'unsafe-inline' is required
  // for the App Router runtime. No external script origins are allowed.
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://files.kick.com https://*.kick.com https://cdn.discordapp.com https://mediumrare.imgix.net",
  "font-src 'self' data:",
  "frame-src https://player.kick.com https://kick.com",
  // Kick clips stream (HLS) straight from Kick's CDN
  "connect-src 'self' https://clips.kick.com",
  "media-src 'self' blob: https://clips.kick.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { qualities: [75, 90] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

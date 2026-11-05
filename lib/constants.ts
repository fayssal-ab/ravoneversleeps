// Public brand config. NEXT_PUBLIC_* values are safe to ship to the browser.

export const SITE_NAME = "RAVONEVERSLEEPS";
export const SITE_SHORT = "RAVO";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const SITE_TAGLINE = "Ravo never sleeps: streams, clips, slot challenges, bonus hunts, tournaments and VIP transfers.";

export const QZINO_CODE = process.env.NEXT_PUBLIC_QZINO_CODE || "RAVO50";
export const QZINO_URL = process.env.NEXT_PUBLIC_QZINO_URL || "https://qzino-partners.com/trdj40jfb";
export const FLUSH_URL = "https://flush.com/";
/**
 * What playing on Qzino with the code gets you. Cashback/rakeback rates are
 * Qzino's published VIP rates (https://qzino.com/en/vip-club, "up to").
 */
export const QZINO_PERKS = [
  { value: "$50", label: "Bonus with the code" },
  { value: "40%", label: "VIP cashback up to" },
  { value: "15%", label: "VIP rakeback up to" },
] as const;

export const KICK_CHANNEL = process.env.NEXT_PUBLIC_KICK_CHANNEL || "ravoneversleeps";
export const KICK_URL = `https://kick.com/${KICK_CHANNEL}`;
export const DISCORD_URL = process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/GKjE3sUFz3";
export const X_URL = process.env.NEXT_PUBLIC_X_URL || "https://x.com/ravoneversleeps";

export interface NavItem { href: string; label: string; children?: { href: string; label: string; hint: string }[] }

export const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  {
    href: "/challenges",
    label: "Rewards",
    children: [
      { href: "/challenges", label: "Challenges", hint: "First to hit the multi wins" },
      { href: "/vip-transfer", label: "VIP Transfer", hint: "Bring your VIP status to Qzino" },
    ],
  },
  {
    href: "/stream",
    label: "Stream",
    children: [
      { href: "/stream", label: "Watch live", hint: "Kick stream & schedule" },
      { href: "/clips", label: "Clips", hint: "Best moments from Kick" },
      { href: "/bonus-hunts", label: "Bonus hunts", hint: "Live hunt tracker" },
      { href: "/tournaments", label: "Tournaments", hint: "1v1 and 2v2 slot battles" },
      { href: "/slot-picker", label: "Slot picker", hint: "Spin for a random slot" },
    ],
  },
];

/** Flat list (footer). */
export const NAV_FLAT = [
  { href: "/", label: "Home" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/challenges", label: "Challenges" },
  { href: "/vip-transfer", label: "VIP Transfer" },
  { href: "/stream", label: "Stream" },
  { href: "/clips", label: "Clips" },
  { href: "/bonus-hunts", label: "Bonus hunts" },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/slot-picker", label: "Slot picker" },
];

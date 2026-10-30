// Boss tiers of "The Reaping" (shared by the server rules in lib/reaping.ts
// and the wheel / boss cards in the browser, so no node imports here).

export type BossTier = "minion" | "brute" | "warlord" | "overlord";

export const TIERS: { key: BossTier; label: string; min: number; max: number; weight: number; color: string }[] = [
  { key: "minion", label: "Minion", min: 20, max: 75, weight: 45, color: "#8dff4a" },
  { key: "brute", label: "Brute", min: 76, max: 150, weight: 30, color: "#ffd76a" },
  { key: "warlord", label: "Warlord", min: 151, max: 300, weight: 18, color: "#ff8a3d" },
  { key: "overlord", label: "Overlord", min: 301, max: 500, weight: 7, color: "#b06bff" },
];

export const tierOf = (key: string | null | undefined) => TIERS.find((t) => t.key === key) ?? TIERS[0];

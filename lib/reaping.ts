import { randomInt } from "node:crypto";
import { TIERS, type BossTier } from "./reapingTiers";

export { TIERS, type BossTier };

// "The Reaping": knockout mode where computer bosses ambush battles. Pure
// helpers (tiers, wheel, names); the bracket rules live in lib/knockout.ts.
//
// - before each stage the server rolls whether a boss rises (boss_chance %,
//   the final at least 60 %, 100 % with the "final boss" option or when no
//   boss rose earlier: every Reaping gets at least one);
// - a boss ambushes one random battle of the stage. The weighted wheel sets
//   its target multiplier (×2 in duo, a team's two bonuses count);
// - nobody reaches the target → the boss advances and both sides are
//   "reaped"; otherwise the higher multiplier wins as usual;
// - a boss in the bracket keeps its target: the next opponent has to reach it.
//   Two bosses meeting: the stronger target advances.

/** Minimum boss chance in the final, in %. */
export const FINAL_CHANCE = 60;

export const BOSS_NAMES = [
  "The Hollow Priest", "Mother Rot", "Grave Banker", "The Ninth Hand", "Saint Nothing", "Bonecaller",
  "The Pale Croupier", "Widow of Reels", "Old Sleepless", "The Last Spin", "Ashen Dealer", "The Quiet Debt",
];

const LINES = [
  "The Cult demands a sacrifice.", "Your luck ends here.", "Beat {T}x or be reaped.",
  "Nobody sleeps tonight.", "The reels are hungry.", "Pay the toll: {T}x.",
];

/** Wheel spin: weighted tier, then a whole multiplier inside it (×2 in duo). */
export function spinWheel(duo: boolean, rand: (max: number) => number = randomInt): { tier: BossTier; target: number } {
  const total = TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rand(total);
  const tier = TIERS.find((t) => (r -= t.weight) < 0) ?? TIERS[0];
  const base = tier.min + rand(tier.max - tier.min + 1);
  return { tier: tier.key, target: duo ? base * 2 : base };
}

/** A name not used yet in this tournament (falls back to a numbered one). */
export function bossName(used: string[], rand: (max: number) => number = randomInt): string {
  const free = BOSS_NAMES.filter((n) => !used.includes(n));
  return free.length ? free[rand(free.length)] : `Nameless ${used.length + 1}`;
}

export function bossLine(target: number, rand: (max: number) => number = randomInt): string {
  return LINES[rand(LINES.length)].replace("{T}", String(target));
}

/** Chance (%) that a boss rises before a stage. */
export function stageChance(o: { chance: number; isFinal: boolean; finalBoss: boolean; bossesSoFar: number }): number {
  if (!o.isFinal) return o.chance;
  if (o.finalBoss || o.bossesSoFar === 0) return 100;
  return Math.max(o.chance, FINAL_CHANCE);
}

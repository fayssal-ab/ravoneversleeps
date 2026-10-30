// Rules of "The Reaping · Hunt" (pure engine, no database):
//   node --import tsx --test tests/hunt-engine.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomInt } from "node:crypto";
import {
  arenaFight, bossFight, createHunt, fight, judge, revealFate, spawnAll, spawnNext, summonEndboss,
  type HuntConfig, type HuntState, type Monster,
} from "../lib/hunt/engine";

const cfg = (o: Partial<HuntConfig> = {}): HuntConfig => ({ title: "T", prize: 300, duo: false, waves: 1, chance: 50, fall: "half", ...o });
const mon = (o: Partial<Monster>): Monster => ({ tier: "Minion", name: "Nibbles the Grave Rat", price: 100, abOn: false, curse: null, revived: false, prebuy: false, secret: false, bounty: 1, ...o });
const seq = (...vals: number[]) => { let i = 0; return (n: number) => (i < vals.length ? vals[i++] : 0) % n; };
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `p${i}`, pids: [i + 1] }));
/** monster for fight i forced by hand (tests don't depend on the spawn roll) */
const force = (s: HuntState, i: number, m: Partial<Monster>) => { s.fights[i].monster = mon(m); };

test("judge: plain, duo ×2, abilities and clutches", () => {
  assert.equal(judge(200, 150, mon({}), false, seq()).out, "p");
  assert.equal(judge(150, 150, mon({}), false, seq()).out, "p"); // tie goes to the player
  assert.equal(judge(250, 150, mon({}), true, seq()).out, "b"); // duo: 150 ×2 = 300
  // Gnaw: −15% → 170 vs 175
  assert.equal(judge(200, 175, mon({ abOn: true }), false, seq()).out, "b");
  // Snuff Out: won less than the buy → out whatever the monster rolled
  assert.equal(judge(90, 0, mon({ name: "Candle Acolyte", abOn: true }), false, seq()).out, "b");
  // Prank swaps both wins
  assert.equal(judge(500, 100, mon({ name: "Lantern Imp", abOn: true }), false, seq()).out, "b");
  // House Edge: within 25% → the monster takes it
  const house = mon({ tier: "Warlord", name: "The Pale Croupier", abOn: true, price: 500 });
  assert.equal(judge(1000, 800, house, false, seq()).out, "b");
  assert.equal(judge(1000, 700, house, false, seq()).out, "p");
  // Raise the Dead: a player win first makes him buy again
  assert.equal(judge(1000, 10, mon({ tier: "Warlord", name: "Bonecaller", abOn: true }), false, seq()).out, "revive");
  // Half Asleep (boon): a loss becomes a free second try, once
  assert.equal(judge(10, 100, mon({ tier: "Fodder", name: "Sleepy Zombie", abOn: true }), false, seq()).out, "prebuy");
  assert.equal(judge(10, 100, mon({ tier: "Fodder", name: "Sleepy Zombie", abOn: true, prebuy: true }), false, seq()).out, "b");
  // Lucky Coin: a loss can still be saved by the server's coin flip
  assert.equal(judge(10, 100, mon({ tier: "Fodder", name: "Lost Soul", abOn: true }), false, seq(0)).out, "p");
  assert.equal(judge(10, 100, mon({ tier: "Fodder", name: "Lost Soul", abOn: true }), false, seq(999_999)).out, "b");
  // the Seraph can't be beaten
  assert.equal(judge(1e9, 0, mon({ secret: true, price: Infinity }), false, seq()).out, "b");
});

test("hunt → arena → spared: prize × the best bounty", () => {
  const s = createHunt(cfg(), players(4), seq());
  for (let i = 0; i < 4; i++) force(s, i, { tier: i === 0 ? "Warlord" : "Minion", name: i === 0 ? "The Hollow Priest" : "Nibbles the Grave Rat", bounty: i === 0 ? 3 : 1 });
  const winner = s.fights[0].eid;
  fight(s, 0, 900, 100, seq());
  fight(s, 1, 900, 100, seq());
  fight(s, 2, 10, 900, seq()); // reaped
  fight(s, 3, 900, 100, seq());
  assert.equal(s.reaped, 1);
  assert.equal(s.ents[winner].bounty, 3);
  assert.equal(s.phase, "arena");
  // 3 survivors: one free pass (the best win among the fewest passes)
  const r1 = s.arena!.rounds[0];
  assert.equal(r1.ms.length, 1);
  assert.notEqual(r1.bye, null);
  const m = r1.ms[0];
  arenaFight(s, 0, m.a === winner ? 500 : 100, m.a === winner ? 100 : 500, seq());
  const r2 = s.arena!.rounds[1];
  arenaFight(s, 0, r2.ms[0].a === winner ? 500 : 100, r2.ms[0].a === winner ? 100 : 500, seq());
  assert.equal(s.phase, "reckon");
  assert.equal(s.reckon!.champ, winner);
  revealFate(s, seq(99)); // 99 ≥ 50 % → spared
  assert.equal(s.reckon!.fate, "spared");
  assert.equal(s.result!.type, "champion");
  assert.equal(s.result!.payout, 900); // $300 × 3
});

test("reckoning: Endboss slain = Legend, Endboss wins = 50 % or nothing, total wipe", () => {
  const one = (fall: "half" | "nothing") => {
    const s = createHunt(cfg({ fall, chance: 100 }), players(2), seq());
    force(s, 0, {}); force(s, 1, {});
    fight(s, 0, 900, 100, seq());
    fight(s, 1, 10, 900, seq());
    assert.equal(s.phase, "reckon"); // one left: the Arena is skipped
    revealFate(s, seq(0));
    summonEndboss(s, seq());
    s.reckon!.boss = mon({ tier: "Endboss", name: "The Reaper King", price: 3000, bounty: 10 }); // ability off for the test
    return s;
  };
  const legend = one("half");
  bossFight(legend, 9000, 1000, seq());
  assert.equal(legend.result!.type, "legend");
  assert.equal(legend.result!.payout, 3000); // $300 × 10
  const fell = one("half");
  bossFight(fell, 100, 9000, seq());
  assert.equal(fell.result!.type, "fallen");
  assert.equal(fell.result!.payout, 150);
  const nothing = one("nothing");
  bossFight(nothing, 100, 9000, seq());
  assert.equal(nothing.result!.payout, 0);

  const wipe = createHunt(cfg(), players(2), seq());
  force(wipe, 0, {}); force(wipe, 1, {});
  fight(wipe, 0, 1, 900, seq());
  fight(wipe, 1, 1, 900, seq());
  assert.equal(wipe.result!.type, "wipe");
  assert.equal(wipe.result!.payout, 0);
});

test("waves, rematch, revive and the host's secret switch", () => {
  const s = createHunt(cfg({ waves: 2 }), players(2), seq());
  force(s, 0, {}); force(s, 1, {});
  fight(s, 0, 900, 100, seq());
  fight(s, 1, 900, 100, seq());
  assert.equal(s.phase, "hunt");
  assert.equal(s.wave, 2);
  assert.equal(s.fights.every((f) => !f.monster), true);
  // Flutter: within 15% → both buy again, nothing decided
  force(s, 0, { name: "Crypt Moth", abOn: true });
  assert.equal(fight(s, 0, 1000, 950, seq()).out, "rematch");
  assert.equal(s.fights[0].done, false);
  // Raise the Dead: beaten once, rises, the player's first win is kept
  force(s, 1, { tier: "Warlord", name: "Bonecaller", abOn: true });
  assert.equal(fight(s, 1, 800, 100, seq()).out, "revive");
  assert.equal(fight(s, 1, 0, 700, seq()).out, "p"); // 800 kept vs 700

  const t = createHunt(cfg(), players(2), seq());
  t.secretNext = true;
  spawnNext(t, seq());
  assert.equal(t.fights[0].monster!.secret, true);
  assert.equal(t.secretNext, false);
});

test("random full runs always end with a valid result", () => {
  const rand = (n: number) => randomInt(n);
  for (let run = 0; run < 200; run++) {
    const duo = run % 2 === 1;
    const s = createHunt(cfg({ duo, waves: (1 + (run % 3)) as 1 | 2 | 3, chance: 50 }), players(8), rand);
    for (let guard = 0; guard < 500 && s.phase !== "done"; guard++) {
      if (s.phase === "hunt") {
        if (s.fights.some((f) => !f.monster)) spawnAll(s, rand);
        const i = s.fights.findIndex((f) => !f.done);
        fight(s, i, rand(5000), rand(5000), rand);
      } else if (s.phase === "arena") {
        const r = s.arena!.rounds.at(-1)!;
        arenaFight(s, r.ms.findIndex((m) => !m.done), rand(5000), rand(5000), rand);
      } else if (!s.reckon!.fate) revealFate(s, rand);
      else if (!s.reckon!.boss) summonEndboss(s, rand);
      else bossFight(s, rand(9000), rand(9000), rand);
    }
    assert.equal(s.phase, "done", `run ${run} stuck in ${s.phase}`);
    const r = s.result!;
    assert.ok(["wipe", "champion", "legend", "fallen", "judged"].includes(r.type));
    if (r.type === "champion" || r.type === "legend") assert.equal(r.payout, 300 * s.ents[r.champ!].bounty);
    if (r.type === "fallen") assert.equal(r.payout, 150);
    if (r.type === "wipe") assert.equal(r.payout, 0);
    assert.ok(s.bought > 0);
  }
});

// E2E for "The Reaping" (boss mode) against a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/knockout-reaping.test.ts
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  addPlayerManually, createKo, disqualifyPlayer, ensureKoSchema, getKoArchive, getKoById, getKoState, openRegistration, playNext,
  recordBattleResult, respinBoss, rollBoss, startBattle,
} from "../../lib/knockout";
import { getPool } from "../../lib/db";
import { spinWheel, stageChance, TIERS } from "../../lib/reaping";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());
const slot = (n: string) => ({ id: `r-${n}`, name: `Slot ${n}`, provider: "Test", imageUrl: "" });
const state = async (id: number) => getKoState((await getKoById(id))!);
const b = (cost: string, payout: string) => ({ cost, payout });
const setTarget = (bossId: number, target: number) => getPool().query("UPDATE ko_participants SET boss_target = ? WHERE id = ?", [target, bossId]);

before(async () => {
  await ensureKoSchema();
  // bosses draw their slot from the catalogue's most played with art
  const values = Array.from({ length: 20 }, (_, i) => [`rp-${i}`, `rp-${i}`, `Boss slot ${i}`, `boss slot ${i}`, "Test", "https://files.kick.com/x.webp", i]);
  await getPool().query("INSERT IGNORE INTO slot_catalog (id, slug, name, name_norm, provider, image_url, popularity) VALUES ?", [values]);
});

async function fresh(size: 4 | 8, opts: { chance: number; finalBoss?: boolean; duo?: boolean }, players: number) {
  await getPool().query("UPDATE ko_tournaments SET status = 'cancelled' WHERE status IN ('open','closed')");
  const id = await createKo({ title: "Reaping test", prize: "", size, duo: opts.duo, prizes: ["100", null, null], reaping: { chance: opts.chance, finalBoss: opts.finalBoss ?? true, rollover: true } });
  await openRegistration(id);
  for (let i = 0; i < players; i++) await addPlayerManually(`r${id}p${i}`, slot(`${id}-${i}`));
  return id;
}

test("wheel: tiers, weights and duo doubling", () => {
  // the weighted roll walks the tiers in order
  const at = (r: number) => spinWheel(false, (max) => (max === 100 ? r : 0));
  assert.equal(at(0).tier, "minion");
  assert.equal(at(44).tier, "minion");
  assert.equal(at(45).tier, "brute");
  assert.equal(at(75).tier, "warlord");
  assert.equal(at(93).tier, "overlord");
  for (let i = 0; i < 500; i++) {
    const s = spinWheel(false);
    const tier = TIERS.find((x) => x.key === s.tier)!;
    assert.ok(s.target >= tier.min && s.target <= tier.max);
    const d = spinWheel(true);
    assert.ok(d.target >= 40 && d.target <= 1000 && d.target % 2 === 0);
  }
  assert.equal(stageChance({ chance: 40, isFinal: false, finalBoss: true, bossesSoFar: 0 }), 40);
  assert.equal(stageChance({ chance: 40, isFinal: true, finalBoss: false, bossesSoFar: 1 }), 60);
  assert.equal(stageChance({ chance: 80, isFinal: true, finalBoss: false, bossesSoFar: 1 }), 80);
  assert.equal(stageChance({ chance: 10, isFinal: true, finalBoss: false, bossesSoFar: 0 }), 100);
  assert.equal(stageChance({ chance: 10, isFinal: true, finalBoss: true, bossesSoFar: 3 }), 100);
});

test("reaping: ambush, reaped, boss advances, beaten in the final", async () => {
  const id = await fresh(4, { chance: 100 }, 4);
  // first press: registration closes, the round-1 boss rises, nothing starts yet
  const first = await playNext(id);
  assert.equal(first.matchId, null);
  assert.ok(first.boss?.spawned && first.boss.bossId && first.boss.matchId);
  assert.equal((await getKoById(id))!.status, "closed");
  await assert.rejects(openRegistration(id), /ko_full|bracket_started/);
  let s = await state(id);
  assert.equal(s.bosses.length, 1);
  assert.equal(s.participants.length, 4); // bosses aren't players
  assert.equal(s.registered, 4);
  const boss = s.bosses[0];
  const ambushed = s.matches.find((m) => m.id === first.boss!.matchId)!;
  assert.equal(ambushed.boss?.id, boss.id);
  assert.equal(ambushed.round, 1);

  // re-spin changes the target, then lock it to 50x for the test
  await respinBoss(id);
  await setTarget(boss.id, 50);
  // a boss can't be disqualified
  await assert.rejects(disqualifyPlayer(id, boss.id), /invalid_input/);

  // play round 1 until the ambushed battle is live
  for (let guard = 0; guard < 2; guard++) {
    await playNext(id);
    s = await state(id);
    if (s.live!.id === ambushed.id) break;
    // the other battle: normal rules
    await recordBattleResult(id, s.live!.id, b("100", "300"), b("100", "100"));
  }
  s = await state(id);
  assert.equal(s.live!.id, ambushed.id);
  // nobody reaches 50x: the boss advances, both sides reaped (even a tie)
  const r = await recordBattleResult(id, ambushed.id, b("100", "4000"), b("100", "4000"));
  assert.equal(r.reaped, true);
  assert.equal(r.winnerId, boss.id);
  s = await state(id);
  const done = s.matches.find((m) => m.id === ambushed.id)!;
  assert.equal(done.winner_id, boss.id);
  assert.ok([done.p1!, done.p2!].every((p) => p.reaped && p.state === "eliminated"));
  assert.equal(s.reaped, 2);

  // round 1 isn't over yet if the ambush came first: finish it
  if (s.matches.some((m) => m.round === 1 && m.status === "ready")) {
    await playNext(id);
    s = await state(id);
    await recordBattleResult(id, s.live!.id, b("100", "300"), b("100", "100"));
  }

  // final: the boss is already in it, so no second boss can ambush
  const roll2 = await rollBoss(id);
  assert.equal(roll2.round, 2);
  assert.equal(roll2.spawned, false);
  await playNext(id);
  s = await state(id);
  const fin = s.live!;
  const bossSide = fin.p1?.is_boss ? 1 : 2;
  assert.equal(bossSide === 1 ? fin.p1_multi : fin.p2_multi, "50.00"); // a boss side shows its target
  // only the player side plays; 49x isn't enough… but first the API rejects a missing player bonus
  await assert.rejects(recordBattleResult(id, fin.id, undefined, undefined), /invalid_input/);
  const player = bossSide === 1 ? { p2: b("100", "5000") } : { p1: b("100", "5000") };
  const res = await recordBattleResult(id, fin.id, player.p1, player.p2);
  assert.equal(res.reaped, false); // 50x reached exactly: the boss is beaten
  const t = (await getKoById(id))!;
  assert.equal(t.status, "finished");
  s = await state(id);
  assert.equal(s.champion?.is_boss, false);
  assert.equal(s.bosses[0].state, "eliminated");
});

test("reaping: the Cult wins, a boss in the bracket reaps its opponent", async () => {
  const id = await fresh(4, { chance: 100 }, 4);
  const first = await playNext(id);
  const bossId = first.boss!.bossId!;
  await setTarget(bossId, 500);
  let s = await state(id);
  // play round 1: the ambushed battle falls short of 500x
  while (s.matches.some((m) => m.round === 1 && (m.status === "ready" || m.status === "empty"))) {
    await playNext(id);
    s = await state(id);
    await recordBattleResult(id, s.live!.id, b("100", "1000"), b("100", "2000"));
    s = await state(id);
  }
  assert.equal(s.matches.find((m) => m.id === first.boss!.matchId)!.winner_id, bossId);
  await playNext(id); // final: boss already in it, no roll spawns, battle starts
  s = await state(id);
  const fin = s.live!;
  const bossSide = fin.p1?.is_boss ? 1 : 2;
  const res = await recordBattleResult(id, fin.id, bossSide === 1 ? undefined : b("100", "49900"), bossSide === 1 ? b("100", "49900") : undefined);
  assert.equal(res.reaped, true);
  assert.equal(res.champion, true);
  s = await state(id);
  assert.equal(s.champion?.id, bossId);
  assert.equal(s.champion?.is_boss, true);
  const archived = (await getKoArchive(1))[0];
  assert.equal(archived.champion_is_boss, true);
});

test("reaping: no boss before the final still guarantees one; two bosses meeting resolve on their own", async () => {
  // 0 % chance: round 1 has no boss, the final gets one anyway (none so far)
  const id = await fresh(4, { chance: 0, finalBoss: false }, 4);
  const first = await playNext(id);
  assert.equal(first.boss, undefined); // rolled, nothing rose, the battle started
  let s = await state(id);
  assert.equal(s.bossRolls.length, 1);
  assert.equal(s.bossRolls[0].spawned, false);
  await recordBattleResult(id, s.live!.id, b("100", "300"), b("100", "100"));
  await playNext(id);
  s = await state(id);
  await recordBattleResult(id, s.live!.id, b("100", "300"), b("100", "100"));
  const fin = await playNext(id);
  assert.ok(fin.boss?.spawned);
  assert.equal(fin.boss!.chance, 100);

  // bosses meeting: forced through the bracket rows (8 seats, two ambushes)
  const id2 = await fresh(8, { chance: 100 }, 8);
  await playNext(id2);
  s = await state(id2);
  const boss1 = s.bosses[0];
  await setTarget(boss1.id, 500);
  // play round 1; give the battle next to the ambushed one a boss too, by hand
  const amb = s.matches.find((m) => m.boss?.id === boss1.id)!;
  const sibling = s.matches.find((m) => m.round === 1 && m.match_index === (amb.match_index ^ 1))!;
  const [ins] = await getPool().query<import("mysql2").ResultSetHeader>(
    "INSERT INTO ko_participants (tournament_id, kick_user_id, username, avatar, slot_id, slot_name, slot_provider, slot_image, state, is_boss, boss_target, boss_tier, boss_line) VALUES (?, 'boss:x', 'Twin', '', 'rp-1', 'Boss slot 1', 'Test', '', 'in_knockout', 1, 300, 'warlord', 'x')",
    [id2]);
  await getPool().query("UPDATE ko_matches SET boss_id = ? WHERE id = ?", [ins.insertId, sibling.id]);
  while (s.matches.some((m) => m.round === 1 && (m.status === "ready" || m.status === "empty"))) {
    await playNext(id2);
    s = await state(id2);
    await recordBattleResult(id2, s.live!.id, b("100", "100"), b("100", "200"));
    s = await state(id2);
  }
  // both bosses advanced into the same semi: the 500x one goes through without a battle
  const semi = s.matches.find((m) => m.round === 2 && m.match_index === amb.match_index >> 1)!;
  assert.equal(semi.status, "done");
  assert.equal(semi.winner_id, boss1.id);
});

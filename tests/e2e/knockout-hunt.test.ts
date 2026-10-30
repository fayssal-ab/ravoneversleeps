// E2E for "The Reaping · Hunt" against a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/knockout-hunt.test.ts
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { after, test } from "node:test";
import { addPlayerManually, createKo, getKoById, getKoState, openRegistration, playNext } from "../../lib/knockout";
import { huntAction } from "../../lib/hunt/store";
import { getPool } from "../../lib/db";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());
const slot = (n: string) => ({ id: `h-${n}`, name: `Slot ${n}`, provider: "Test", imageUrl: "" });
const money = () => String(randomInt(500000) / 100);

async function play(id: number) {
  for (let guard = 0; guard < 600; guard++) {
    const s = (await getKoState((await getKoById(id))!)).hunt!;
    if (s.phase === "done") return s;
    if (s.phase === "hunt") {
      if (s.fights.some((f) => !f.monster)) { await huntAction(id, { op: "spawn" }); continue; }
      await huntAction(id, { op: "fight", index: s.fights.findIndex((f) => !f.done), p: Number(money()), b: Number(money()) });
    } else if (s.phase === "arena") {
      const r = s.arena!.rounds.at(-1)!;
      await huntAction(id, { op: "arena", index: r.ms.findIndex((m) => !m.done), a: Number(money()), b: Number(money()) });
    } else if (!s.reckon!.fate) await huntAction(id, { op: "fate" });
    else if (!s.reckon!.boss) await huntAction(id, { op: "endboss" });
    else await huntAction(id, { op: "boss", p: Number(money()), b: Number(money()) });
  }
  throw new Error("hunt never finished");
}

for (const duo of [false, true]) {
  test(`hunt ${duo ? "duo" : "solo"}: !join field, start, full game, settled tournament`, async () => {
    await getPool().query("UPDATE ko_tournaments SET status = 'cancelled' WHERE status IN ('open','closed')");
    const id = await createKo({ title: "Hunt test", prize: "", size: 4, duo, prizes: ["300", null, null], hunt: { waves: 2, chance: 100, fall: "half" } });
    let st = await getKoState((await getKoById(id))!);
    assert.deepEqual(st.huntSetup, { waves: 2, chance: 100, fall: "half" });
    assert.equal(st.hunt, null);
    await assert.rejects(huntAction(id, { op: "spawn" }), /hunt_not_started/);
    await assert.rejects(playNext(id), /hunt_mode/);
    await openRegistration(id);
    for (let i = 0; i < (duo ? 8 : 4); i++) await addPlayerManually(`h${id}p${i}`, slot(`${id}-${i}`));
    await huntAction(id, { op: "start" });
    await assert.rejects(huntAction(id, { op: "start" }), /hunt_started/);
    await assert.rejects(openRegistration(id), /bracket_started|ko_full/);
    st = await getKoState((await getKoById(id))!);
    assert.equal(st.hunt!.ents.length, 4);
    if (duo) assert.ok(st.hunt!.ents.every((e) => e.pids.length === 2 && e.name.includes(" & ")));
    // the host's test switch never reaches the public state
    const r = await huntAction(id, { op: "secret", on: true });
    assert.equal(r.secretNext, true);
    assert.equal((await getKoState((await getKoById(id))!)).hunt!.secretNext, false);
    await huntAction(id, { op: "secret", on: false });
    const end = await play(id);
    const t = (await getKoById(id))!;
    assert.equal(t.status, "finished");
    const res = end.result!;
    if (res.type === "champion" || res.type === "legend") {
      assert.equal(Number(t.champion_id), end.ents[res.champ!].pids[0]);
      assert.equal(res.payout, 300 * end.ents[res.champ!].bounty);
    } else assert.equal(t.champion_id, null);
    await assert.rejects(huntAction(id, { op: "spawn" }), /ko_finished/);
  });
}

test("hunt: plain !join, a second !join changes nothing, !call from chat", async () => {
  const { recordJoin } = await import("../../lib/knockout");
  const { withTx } = await import("../../lib/tx");
  await getPool().query("UPDATE ko_tournaments SET status = 'cancelled' WHERE status IN ('open','closed')");
  const id = await createKo({ title: "Hunt chat", prize: "", size: 4, prizes: ["100", null, null], hunt: { waves: 1, chance: 0, fall: "nothing", weights: { Fodder: 100, Minion: 0, Brute: 0, Warlord: 0, Overlord: 0 } } });
  await openRegistration(id);
  const join = (u: string, msg: string, text = "!join Gates of Olympus") =>
    withTx((c) => recordJoin(c, { kickUserId: `k-${id}-${u}`, username: u, messageId: `${id}-${msg}`, slot: text.includes("Gates") ? slot("named") : null }));
  assert.equal((await join("a", "1")).outcome, "registered");
  assert.equal((await join("a", "2")).outcome, "already_joined");
  for (const u of ["b", "c", "d"]) await join(u, `j-${u}`, "!join");
  await huntAction(id, { op: "start" });
  let s = (await getKoState((await getKoById(id))!)).hunt!;
  assert.ok(s.cfg.weights);
  await assert.rejects(huntAction(id, { op: "call", kickUserId: `k-${id}-a`, call: { name: "Mental", provider: "Nolimit", image: null } }), /hunt_no_monster/);
  await huntAction(id, { op: "spawn_all" });
  s = (await getKoState((await getKoById(id))!)).hunt!;
  assert.ok(s.fights.every((f) => f.monster!.tier === "Fodder" || f.monster!.secret));
  await huntAction(id, { op: "call", kickUserId: `k-${id}-a`, call: { name: "Mental", provider: "Nolimit", image: null } });
  await assert.rejects(huntAction(id, { op: "call", kickUserId: "k-stranger", call: { name: "Mental", provider: "", image: null } }), /hunt_not_player/);
  s = (await getKoState((await getKoById(id))!)).hunt!;
  const called = s.fights.find((f) => f.call)!;
  assert.equal(called.call!.name, "Mental");
  assert.equal(called.call!.by, "a");
});

// E2E for the monthly leaderboard archive against a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/qboards-archive.test.ts
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { getPool } from "../../lib/db";
import { getQboardsBoard } from "../../lib/qboards";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());

const day = 86_400_000;
const snap = (id: string, start: number, end: number, top: string) => ({
  eventId: id, title: "Never Sleeps", startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
  prizePool: "200", usePoints: true, rows: [{ rank: 1, username: top, score: "1000", prize: "77" }],
});
const put = (s: ReturnType<typeof snap>) =>
  getPool().query("INSERT INTO qboards_snapshots (event_id, snapshot, synced_at) VALUES (?, ?, UTC_TIMESTAMP())", [s.eventId, JSON.stringify(s)]);

test("live month is current, finished months are the archive, ended month stays until the next starts", async () => {
  const now = Date.now();
  await getPool().query("DELETE FROM qboards_snapshots");
  await put(snap("a".repeat(24), now - 60 * day, now - 30 * day, "oldchamp"));
  await put(snap("b".repeat(24), now - 30 * day, now - day, "lastchamp"));
  // month just ended, next one not started yet → shows the ended one, archive = the older one
  let board = (await getQboardsBoard(100))!;
  assert.equal(board.eventId, "b".repeat(24));
  assert.equal(board.period!.state, "ended");
  assert.deepEqual(board.previous.map((p) => p.link), [`/leaderboard?e=${"a".repeat(24)}`]);
  // the new month starts → it becomes current, both finished months are archived (newest first)
  await put(snap("c".repeat(24), now - day / 2, now + 29 * day, "leader"));
  board = (await getQboardsBoard(100))!;
  assert.equal(board.eventId, "c".repeat(24));
  assert.equal(board.period!.state, "live");
  assert.deepEqual(board.previous.map((p) => p.link), [`/leaderboard?e=${"b".repeat(24)}`, `/leaderboard?e=${"a".repeat(24)}`]);
  assert.equal(board.previous[0].winner, "lastchamp"); // full username
  // an archived month opens by id
  board = (await getQboardsBoard(100, "a".repeat(24)))!;
  assert.equal(board.eventId, "a".repeat(24));
  assert.equal(board.rows[0].prize, "77");
  await getPool().query("DELETE FROM qboards_snapshots");
});

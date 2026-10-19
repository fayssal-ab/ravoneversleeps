// E2E for monthly milestones on Q-boards points against a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/milestones-monthly.test.ts
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { ResultSetHeader } from "mysql2/promise";
import { claimMilestone, claimsFor, monthlyProgress } from "../../lib/milestones";
import { getPool } from "../../lib/db";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());

const day = 86_400_000;
const snapshot = (id: string, start: number, end: number, rows: [string, string][]) => ({
  eventId: id, title: "Never Sleeps", startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(),
  prizePool: "200", usePoints: true, rows: rows.map(([username, score], i) => ({ rank: i + 1, username, score, prize: null })),
});

test("progress = points in the running event; one claim per milestone per event month", async () => {
  const pool = getPool();
  const now = Date.now();
  const tag = `m${now}`;
  await pool.query("DELETE FROM qboards_snapshots");
  const [acc] = await pool.query<ResultSetHeader>("INSERT INTO user_accounts (display_name, qzino_username, qzino_status) VALUES (?, ?, 'verified')", [tag, tag.toUpperCase()]);
  const accountId = acc.insertId;
  const [ms] = await pool.query<ResultSetHeader>("INSERT INTO milestones (name, min_wager, reward) VALUES (?, ?, 10)", [tag, 1000 + (now % 100000)]);
  const milestoneId = ms.insertId;
  const put = (s: ReturnType<typeof snapshot>) =>
    pool.query("REPLACE INTO qboards_snapshots (event_id, snapshot, synced_at) VALUES (?, ?, UTC_TIMESTAMP())", [s.eventId, JSON.stringify(s)]);

  // no event running → no progress, no claim
  assert.equal(await monthlyProgress(tag), null);
  await assert.rejects(claimMilestone(accountId, milestoneId), /no_live_board/);

  // last month's points don't count, this month's do (username match is case-insensitive)
  await put(snapshot("a".repeat(24), now - 80 * day, now - 50 * day, [[tag, "999999"]]));
  // started more than a month ago → its month differs from the next event's
  const live = snapshot("b".repeat(24), now - 35 * day, now + 20 * day, [["someone", "5000"], [tag, "500"]]);
  await put(live);
  const progress = (await monthlyProgress(tag))!;
  assert.equal(progress.points, "500");
  assert.equal(progress.month, live.startsAt.slice(0, 7));
  await assert.rejects(claimMilestone(accountId, milestoneId), /not_reached/);

  live.rows[1].score = "200000";
  await put(live);
  await claimMilestone(accountId, milestoneId);
  await assert.rejects(claimMilestone(accountId, milestoneId), /already_claimed/);
  assert.equal((await claimsFor(accountId, progress.month)).get(milestoneId), "pending");

  // the next month's event starts → the milestone can be claimed again
  await put(snapshot("b".repeat(24), now - 35 * day, now - 1000, [[tag, "200000"]]));
  await put(snapshot("c".repeat(24), now - 500, now + 30 * day, [[tag, "300000"]]));
  const p2 = (await monthlyProgress(tag))!;
  assert.notEqual(p2.month, progress.month);
  assert.equal(p2.points, "300000");
  assert.equal((await claimsFor(accountId, p2.month)).size, 0);
  await claimMilestone(accountId, milestoneId);
  assert.equal((await claimsFor(accountId, p2.month)).get(milestoneId), "pending");
  await pool.query("DELETE FROM qboards_snapshots");
});

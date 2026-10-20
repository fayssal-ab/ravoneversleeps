// E2E for Qzino verification + challenge claims (+ the Discord bot calls,
// against a fake Discord) on a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/verification.test.ts
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { ResultSetHeader } from "mysql2/promise";
import { getPool } from "../../lib/db";
import { createChallenge, markChallengeWon } from "../../lib/challenges";
import { cleanupTickets } from "../../lib/tickets";
import { claimChallenge, decideVerification, myChallengeClaims, pendingVerifications, qzinoStatusOf, requestQzinoVerification, requireVerifiedQzino } from "../../lib/verification";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());

// fake Discord: record every call, hand out channel ids
const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://discord.com/api/")) return realFetch(input, init);
  const path = url.replace("https://discord.com/api/v10", "");
  calls.push({ method: init?.method ?? "GET", path, body: init?.body ? JSON.parse(String(init.body)) : null });
  if (path === "/users/@me") return Response.json({ id: "444", username: "bot" });
  if (path === "/guilds/111") return Response.json({ id: "111", name: "Ravo" });
  if (path === "/guilds/111/roles" && (init?.method ?? "GET") === "GET") return Response.json([{ id: "333", name: "Staff" }]);
  if (path === "/guilds/111/channels" && (init?.method ?? "GET") === "GET") return Response.json([{ id: "222", name: "Tickets", type: 4 }]);
  return Response.json(path.endsWith("/channels") ? { id: String(900000 + calls.length) } : {});
}) as typeof fetch;

test("username → pending + ticket → verified unlocks claims; one claim per challenge with its own ticket", async () => {
  Object.assign(process.env, { DISCORD_BOT_TOKEN: "t", DISCORD_GUILD_ID: "111", DISCORD_TICKET_CATEGORY_ID: "222", DISCORD_STAFF_ROLE_ID: "333", DISCORD_CLIENT_ID: "444" });
  const pool = getPool();
  const tag = `v${Date.now()}`;
  const [acc] = await pool.query<ResultSetHeader>("INSERT INTO user_accounts (display_name, qzino_username) VALUES (?, ?)", [tag, tag]);
  const id = acc.insertId;
  await pool.query("INSERT INTO user_identities (provider, provider_user_id, account_id, username, avatar) VALUES ('discord', ?, ?, ?, '')", [`d${tag}`.slice(0, 20), id, tag]);

  await requestQzinoVerification(id, tag);
  let st = await qzinoStatusOf(id);
  assert.equal(st.status, "pending");
  assert.match(st.ticketUrl ?? "", /^\/api\/discord\/ticket\/9000\d+$/);
  const create = calls.find((c) => c.path === "/guilds/111/channels" && c.method === "POST")!;
  assert.equal(create.body!.parent_id, "222");
  const ow = create.body!.permission_overwrites as { id: string; allow?: string; deny?: string }[];
  assert.ok(ow.some((o) => o.id === "111" && o.deny), "@everyone denied");
  assert.ok(ow.some((o) => o.id === `d${tag}`.slice(0, 20) && o.allow), "viewer allowed");
  assert.ok(ow.some((o) => o.id === "333" && o.allow), "staff allowed");
  assert.ok(ow.some((o) => o.id === "444" && o.allow), "bot allowed");
  assert.ok(pendingVerifications().then((l) => l.some((p) => p.account_id === id)));
  await assert.rejects(requireVerifiedQzino(id), /qzino_pending/);

  const challenge = await createChallenge({ slot_id: "", slot: "Test Slot", provider: "Test", target_multi: "1000", reward: "50", min_bet: "0.40" });
  await assert.rejects(claimChallenge(id, challenge), /qzino_pending/);

  await decideVerification(id, true);
  st = await qzinoStatusOf(id);
  assert.equal(st.status, "verified");
  assert.ok(calls.some((c) => c.method === "POST" && /\/channels\/9000\d+\/messages/.test(c.path) && String(c.body?.content).includes("verified")));

  const url = await claimChallenge(id, challenge);
  assert.match(url ?? "", /^\/api\/discord\/ticket\/\d+$/);
  await assert.rejects(claimChallenge(id, challenge), /already_claimed/);
  assert.ok((await myChallengeClaims(id)).get(challenge)?.ticket_url);

  // the verification ticket is scheduled to close; the cleanup deletes it once due
  const verifyTicket = st.ticketUrl!.split("/").pop()!;
  const [due] = await pool.query<import("mysql2/promise").RowDataPacket[]>("SELECT close_after FROM discord_tickets WHERE channel_id = ?", [verifyTicket]);
  assert.ok(due[0]?.close_after, "close scheduled after the decision");
  await pool.query("UPDATE discord_tickets SET close_after = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE channel_id = ?", [verifyTicket]);
  const res = await cleanupTickets();
  assert.ok(res.closed >= 1);
  assert.ok(calls.some((c) => c.method === "DELETE" && c.path === `/channels/${verifyTicket}`));

  // winning a challenge is announced in every claim ticket
  await markChallengeWon(challenge, "someone", "1234");
  assert.ok(calls.some((c) => c.method === "POST" && String(c.body?.content).includes("won by **someone**")));

  // no Discord linked → can't claim (the claim lives in a Discord ticket)
  const other = await createChallenge({ slot_id: "", slot: "Other Slot", provider: "Test", target_multi: "500", reward: "20", min_bet: "" });
  const [acc2] = await pool.query<ResultSetHeader>("INSERT INTO user_accounts (display_name, qzino_username, qzino_status) VALUES (?, ?, 'verified')", [`${tag}b`, `${tag}b`]);
  await assert.rejects(claimChallenge(acc2.insertId, other), /discord_required/);
});

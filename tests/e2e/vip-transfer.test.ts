// E2E for VIP Transfer applications (fake Discord API) on a throwaway database:
//   DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test tests/e2e/vip-transfer.test.ts
import assert from "node:assert/strict";
import { after, test } from "node:test";
import type { ResultSetHeader } from "mysql2/promise";
import { getPool } from "../../lib/db";
import { applyVipTransfer, decideVipApplication, listVipApplications, myVipApplication } from "../../lib/vip";

if (process.env.DB_NAME !== "ravo_test") throw new Error("refusing to run outside ravo_test");
after(() => getPool().end());

const posted: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://discord.com/api/")) return realFetch(input, init);
  const path = url.replace("https://discord.com/api/v10", "");
  if (path === "/users/@me") return Response.json({ id: "444", username: "bot" });
  if (path === "/guilds/111") return Response.json({ id: "111", name: "Ravo" });
  if (path === "/guilds/111/roles" && !init?.method) return Response.json([{ id: "333", name: "Staff" }]);
  if (path === "/guilds/111/channels" && !init?.method) return Response.json([{ id: "222", name: "Tickets", type: 4 }]);
  if (init?.body) posted.push(String(JSON.parse(String(init.body)).content ?? ""));
  return Response.json(url.endsWith("/channels") ? { id: "777000" } : {});
}) as typeof fetch;

test("apply → ticket with the details; one pending application; decision posted", async () => {
  Object.assign(process.env, { DISCORD_BOT_TOKEN: "t", DISCORD_GUILD_ID: "111", DISCORD_CLIENT_ID: "444" });
  const pool = getPool();
  const tag = `vip${Date.now()}`;
  const [acc] = await pool.query<ResultSetHeader>("INSERT INTO user_accounts (display_name) VALUES (?)", [tag]);
  await pool.query("INSERT INTO user_identities (provider, provider_user_id, account_id, username, avatar) VALUES ('discord', ?, ?, ?, '')", [tag.slice(0, 20), acc.insertId, tag]);
  const form = { qzino: tag, casino: "Stake", vip_level: "Platinum III", monthly_wager: "50k-250k", note: "" };
  const id = await applyVipTransfer(acc.insertId, form);
  const app = (await myVipApplication(acc.insertId))!;
  assert.equal(app.status, "pending");
  assert.equal(app.ticket_url, "/api/discord/ticket/777000");
  assert.ok(posted.some((m) => m.includes("Platinum III") && m.includes("Stake") && m.includes("$50k – $250k") && m.includes("Never share passwords")));
  await assert.rejects(applyVipTransfer(acc.insertId, form), /vip_pending/);
  assert.ok((await listVipApplications("pending")).some((a) => a.id === id));
  await decideVipApplication(id, true, "welcome");
  assert.equal((await myVipApplication(acc.insertId))!.status, "approved");
  assert.ok(posted.some((m) => m.includes("approved") && m.includes("welcome")));
  await assert.rejects(decideVipApplication(id, false, ""), /invalid_input/);
});

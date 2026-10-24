"use server";

import { z } from "zod";
import { adminAction } from "@/lib/admin";
import { discordErrorText } from "@/lib/discordBot";
import {
  ALL_PERMISSIONS, banMember, clearMessages, createChannel, createInvite, createRole, deleteRole, disconnectVoice, editChannel,
  editRole, kickMember, moveRole, removeChannel, renameGuild, revokeInvite, setMemberRoles, setNickname, setVoice,
  timeoutMember, unbanMember, type RoleFields,
} from "@/lib/discordServer";
import { AppError, parseForm, zRequiredText, zText } from "@/lib/tx";

// Admin → Server (owner only): every change goes through the bot.

const checkbox = z.literal("on").optional().transform((v) => v === "on");
const zSnowflake = z.string().regex(/^\d{5,25}$/, "invalid_id");

/** Back to the same tab / selection (only /admin/server URLs). */
function back(form: FormData): string {
  const b = String(form.get("back") ?? "");
  return /^\/admin\/server(\?[\w=&%.+-]*)?$/.test(b) ? b : "/admin/server";
}

/** Discord's refusal as a readable admin message. */
async function discord<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw new AppError("discord", discordErrorText(e));
  }
}

const run = (form: FormData, audit: string, fn: () => Promise<unknown>, path = back(form), more?: (r: unknown) => string) =>
  adminAction({ path, audit, owner: true, more }, fn);

// ── server ─────────────────────────────────────────────────────────────
export async function renameGuildAction(form: FormData) {
  await run(form, "server.rename", async () => {
    const v = parseForm(z.object({ name: zRequiredText(100).refine((s) => s.length >= 2, "too_short") }), form);
    await discord(() => renameGuild(v.name));
    return v;
  });
}

// ── roles ──────────────────────────────────────────────────────────────
function roleFields(form: FormData): RoleFields {
  const v = parseForm(z.object({
    name: zRequiredText(100), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color"), hoist: checkbox, mentionable: checkbox,
  }), form);
  let permissions = 0n;
  for (const p of ALL_PERMISSIONS) if (form.get(`perm_${p.key}`) === "on") permissions |= 1n << BigInt(p.bit);
  return { name: v.name, color: parseInt(v.color.slice(1), 16), hoist: v.hoist, mentionable: v.mentionable, permissions };
}

export async function createRoleAction(form: FormData) {
  await run(form, "server.role.create", async () => {
    const f = roleFields(form);
    const role = await discord(() => createRole(f));
    return { id: role.id, name: f.name, permissions: f.permissions.toString() };
  }, "/admin/server?tab=roles", (r) => `role=${(r as { id: string }).id}`);
}

export async function saveRoleAction(form: FormData) {
  await run(form, "server.role.edit", async () => {
    const { role } = parseForm(z.object({ role: zSnowflake }), form);
    const f = roleFields(form);
    await discord(() => editRole(role, f));
    return { role, name: f.name, permissions: f.permissions.toString() };
  });
}

export async function deleteRoleAction(form: FormData) {
  await run(form, "server.role.delete", async () => {
    const v = parseForm(z.object({ role: zSnowflake, name: zText(100) }), form);
    await discord(() => deleteRole(v.role));
    return v;
  }, "/admin/server?tab=roles");
}

export async function moveRoleAction(form: FormData) {
  await run(form, "server.role.move", async () => {
    const v = parseForm(z.object({ role: zSnowflake, dir: z.enum(["up", "down"]) }), form);
    await discord(() => moveRole(v.role, v.dir));
    return v;
  });
}

// ── members ────────────────────────────────────────────────────────────
const MEMBER_OPS = ["nick", "timeout", "untimeout", "mute", "unmute", "deafen", "undeafen", "disconnect", "roles", "clearroles", "kick", "ban", "unban"] as const;

export async function memberAction(form: FormData) {
  const op = String(form.get("op") ?? "");
  // kicked / banned: they're gone from the member list
  const path = op === "kick" || op === "ban" ? "/admin/server?tab=members" : op === "unban" ? "/admin/server?tab=bans" : back(form);
  await run(form, `server.member.${MEMBER_OPS.includes(op as (typeof MEMBER_OPS)[number]) ? op : "update"}`, async () => {
    const v = parseForm(z.object({
      user: zSnowflake, name: zText(100), op: z.enum(MEMBER_OPS),
      nick: zText(32).default(""), minutes: z.coerce.number().int().min(1).max(40320).default(60),
      days: z.coerce.number().int().min(0).max(7).default(0),
    }), form);
    await discord(async () => {
      switch (v.op) {
        case "nick": return setNickname(v.user, v.nick);
        case "timeout": return timeoutMember(v.user, v.minutes);
        case "untimeout": return timeoutMember(v.user, 0);
        case "mute": case "unmute": return setVoice(v.user, { mute: v.op === "mute" });
        case "deafen": case "undeafen": return setVoice(v.user, { deaf: v.op === "deafen" });
        case "disconnect": return disconnectVoice(v.user);
        case "roles": return setMemberRoles(v.user, form.getAll("roles").map(String).filter((id) => /^\d{5,25}$/.test(id)));
        case "clearroles": return setMemberRoles(v.user, []);
        case "kick": return kickMember(v.user);
        case "ban": return banMember(v.user, v.days);
        case "unban": return unbanMember(v.user);
      }
    });
    return { user: v.user, name: v.name, op: v.op, ...(v.op === "nick" ? { nick: v.nick } : v.op === "timeout" ? { minutes: v.minutes } : v.op === "ban" ? { days: v.days } : {}) };
  }, path);
}

// ── channels ───────────────────────────────────────────────────────────
/** Discord channel names: lowercase-with-dashes for text, free for voice / categories. */
const channelName = (name: string, type: number) =>
  type === 0 || type === 5 ? name.toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}\p{Emoji}_-]/gu, "").slice(0, 100) : name.slice(0, 100);

export async function createChannelAction(form: FormData) {
  await run(form, "server.channel.create", async () => {
    const v = parseForm(z.object({ name: zRequiredText(100), type: z.enum(["0", "2", "4"]).transform(Number), parent: z.union([z.literal(""), zSnowflake]).default("") }), form);
    const name = channelName(v.name, v.type);
    if (!name) throw new AppError("invalid_input", "channel name");
    await discord(() => createChannel(name, v.type as 0 | 2 | 4, v.parent || null));
    return { ...v, name };
  });
}

export async function editChannelAction(form: FormData) {
  await run(form, "server.channel.edit", async () => {
    const v = parseForm(z.object({ channel: zSnowflake, type: z.coerce.number().int(), name: zRequiredText(100), topic: zText(1024).optional() }), form);
    const name = channelName(v.name, v.type);
    if (!name) throw new AppError("invalid_input", "channel name");
    await discord(() => editChannel(v.channel, { name, ...(v.topic != null ? { topic: v.topic } : {}) }));
    return { channel: v.channel, name };
  });
}

export async function deleteChannelAction(form: FormData) {
  await run(form, "server.channel.delete", async () => {
    const v = parseForm(z.object({ channel: zSnowflake, name: zText(100) }), form);
    await discord(() => removeChannel(v.channel));
    return v;
  }, "/admin/server?tab=channels");
}

export async function clearChannelAction(form: FormData) {
  await run(form, "server.channel.clear", async () => {
    const v = parseForm(z.object({ channel: zSnowflake, name: zText(100), count: z.coerce.number().int().min(1).max(100) }), form);
    return { ...v, deleted: await discord(() => clearMessages(v.channel, v.count)) };
  }, back(form), (r) => `deleted=${(r as { deleted: number }).deleted}`);
}

// ── invites ────────────────────────────────────────────────────────────
export async function createInviteAction(form: FormData) {
  await run(form, "server.invite", async () => {
    const v = parseForm(z.object({
      channel: z.union([z.literal(""), zSnowflake]).default(""),
      days: z.coerce.number().int().min(0).max(7).default(7), uses: z.coerce.number().int().min(0).max(100).default(0),
    }), form);
    return { url: await discord(() => createInvite({ channelId: v.channel || undefined, days: v.days, maxUses: v.uses })) };
  }, "/admin/server?tab=invites", (r) => `invite=${encodeURIComponent((r as { url: string }).url)}`);
}

export async function revokeInviteAction(form: FormData) {
  await run(form, "server.invite.revoke", async () => {
    const v = parseForm(z.object({ code: z.string().regex(/^[\w-]{2,32}$/, "invalid_code") }), form);
    await discord(() => revokeInvite(v.code));
    return v;
  }, "/admin/server?tab=invites");
}

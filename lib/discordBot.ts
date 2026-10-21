import "server-only";

// Discord bot (REST only, no gateway): joins viewers to Ravo's server and
// opens private ticket channels (viewer + staff + bot) for Qzino username
// checks, challenge proofs and VIP Transfer applications.
//
// Only DISCORD_BOT_TOKEN is required. The bot sets itself up:
//   - server: the one it's in (DISCORD_GUILD_ID only if it's in several)
//   - "Staff" role and private "Tickets" category: found by name or created
//     (DISCORD_STAFF_ROLE_ID / DISCORD_TICKET_CATEGORY_ID to use others)
// Everything is a no-op without the token.

const API = "https://discord.com/api/v10";

// permission bits
const VIEW = 1n << 10n, SEND = 1n << 11n, EMBED = 1n << 14n, ATTACH = 1n << 15n, HISTORY = 1n << 16n, MANAGE_CHANNELS = 1n << 4n;
const MEMBER = VIEW | SEND | EMBED | ATTACH | HISTORY;

export const discordBotEnabled = () => Boolean(process.env.DISCORD_BOT_TOKEN);

/** message stays "discord_<status>" (callers match on it); detail is Discord's reason. */
export class DiscordError extends Error {
  constructor(public status: number, public detail: string) { super(`discord_${status}`); }
}
/** "discord_403 Missing Permissions (50013)" for logs and admin messages. */
export const discordErrorText = (e: unknown) =>
  e instanceof DiscordError ? `${e.message} ${e.detail}`.trim() : e instanceof Error ? e.message : "unknown";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("discord_bot_not_configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string; code?: number } | null;
    throw new DiscordError(res.status, body?.message ? `${body.message}${body.code ? ` (${body.code})` : ""}` : "");
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export interface DiscordSetup {
  botId: string; botName: string;
  guildId: string; guildName: string;
  categoryId: string; categoryCreated: boolean;
  staffRoleId: string; staffCreated: boolean;
}

let setup: Promise<DiscordSetup> | null = null;

/**
 * Finds (or creates) everything the tickets need. Cached per instance;
 * `fresh` re-checks (admin "Run setup").
 */
export function discordSetup(fresh = false): Promise<DiscordSetup> {
  if (!setup || fresh) {
    setup = (async (): Promise<DiscordSetup> => {
      const me = await api<{ id: string; username: string }>("/users/@me");
      // server
      let guildId = process.env.DISCORD_GUILD_ID || "";
      let guildName = "";
      if (!guildId) {
        const guilds = await api<{ id: string; name: string }[]>("/users/@me/guilds");
        if (guilds.length === 0) throw new Error("bot_not_in_server");
        if (guilds.length > 1) throw new Error("bot_in_several_servers");
        guildId = guilds[0].id; guildName = guilds[0].name;
      } else {
        guildName = (await api<{ name: string }>(`/guilds/${guildId}`)).name;
      }
      // Staff role
      const roles = await api<{ id: string; name: string }[]>(`/guilds/${guildId}/roles`);
      let staff = roles.find((r) => r.id === process.env.DISCORD_STAFF_ROLE_ID) ?? roles.find((r) => r.name.toLowerCase() === "staff");
      let staffCreated = false;
      if (!staff) {
        staff = await api<{ id: string; name: string }>(`/guilds/${guildId}/roles`, {
          method: "POST", body: JSON.stringify({ name: "Staff", color: 0x8dff4a, hoist: false, mentionable: false }),
        });
        staffCreated = true;
      }
      // private Tickets category (@everyone hidden; staff and the bot see it)
      const channels = await api<{ id: string; name: string; type: number }[]>(`/guilds/${guildId}/channels`);
      let category = channels.find((c) => c.id === process.env.DISCORD_TICKET_CATEGORY_ID)
        ?? channels.find((c) => c.type === 4 && c.name.toLowerCase() === "tickets");
      let categoryCreated = false;
      if (!category) {
        category = await api<{ id: string; name: string; type: number }>(`/guilds/${guildId}/channels`, {
          method: "POST",
          body: JSON.stringify({
            name: "Tickets", type: 4,
            permission_overwrites: [
              { id: guildId, type: 0, deny: VIEW.toString() },
              { id: staff.id, type: 0, allow: MEMBER.toString() },
              { id: me.id, type: 1, allow: (MEMBER | MANAGE_CHANNELS).toString() },
            ],
          }),
        });
        categoryCreated = true;
      }
      return { botId: me.id, botName: me.username, guildId, guildName, categoryId: category.id, categoryCreated, staffRoleId: staff.id, staffCreated };
    })().catch((e) => { setup = null; throw e; });
  }
  return setup;
}

/** Add a viewer to the server with their OAuth token (scope guilds.join). Best effort. */
export async function joinGuild(discordUserId: string, accessToken: string): Promise<void> {
  if (!discordBotEnabled()) return;
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/members/${discordUserId}`, { method: "PUT", body: JSON.stringify({ access_token: accessToken }) });
}

export interface Ticket { channelId: string; url: string }

/** Channel names: lowercase, a-z0-9 and dashes, 90 chars max. */
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "ticket";

/**
 * Private channel only the viewer, staff and the bot can see, with a first
 * message pinging both. Returns null when the bot isn't configured.
 */
export async function openTicket(opts: { name: string; discordUserId: string; message: string }): Promise<Ticket | null> {
  if (!discordBotEnabled()) return null;
  const s = await discordSetup();
  const channel = await api<{ id: string }>(`/guilds/${s.guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: slug(opts.name), type: 0, parent_id: s.categoryId,
      permission_overwrites: [
        { id: s.guildId, type: 0, deny: VIEW.toString() }, // @everyone
        { id: opts.discordUserId, type: 1, allow: MEMBER.toString() },
        { id: s.staffRoleId, type: 0, allow: MEMBER.toString() },
        { id: s.botId, type: 1, allow: (MEMBER | MANAGE_CHANNELS).toString() },
      ],
    }),
  });
  await api(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `<@${opts.discordUserId}> <@&${s.staffRoleId}>\n${opts.message}`,
      allowed_mentions: { users: [opts.discordUserId], roles: [s.staffRoleId] },
    }),
  });
  return { channelId: channel.id, url: ticketUrl(channel.id)! };
}

/** Post in an existing ticket (e.g. the admin's decision). Best effort. */
export async function postInTicket(channelId: string, message: string): Promise<void> {
  if (!discordBotEnabled()) return;
  await api(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }) });
}

/** Delete a ticket channel (closing it). */
export async function deleteChannel(channelId: string): Promise<void> {
  if (!discordBotEnabled()) return;
  await api(`/channels/${channelId}`, { method: "DELETE" });
}

/**
 * Link to a ticket. Goes through /api/discord/ticket/<id>, which finds the
 * server and redirects into Discord (so no server id is needed here).
 */
export const ticketUrl = (channelId: string | null) => (channelId && /^\d{5,25}$/.test(channelId) ? `/api/discord/ticket/${channelId}` : null);

/** Real Discord URL of a ticket channel. */
export async function discordChannelUrl(channelId: string): Promise<string> {
  const s = await discordSetup();
  return `https://discord.com/channels/${s.guildId}/${channelId}`;
}

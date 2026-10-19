import "server-only";

// Discord bot (REST only, no gateway): joins viewers to Ravo's server and
// opens private ticket channels (viewer + staff) for Qzino username checks
// and challenge proofs. Configured by env; everything is a no-op when unset.
//   DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_TICKET_CATEGORY_ID,
//   DISCORD_STAFF_ROLE_ID, DISCORD_CLIENT_ID (= the bot's user id)

const API = "https://discord.com/api/v10";

// permission bits
const VIEW = 1n << 10n, SEND = 1n << 11n, EMBED = 1n << 14n, ATTACH = 1n << 15n, HISTORY = 1n << 16n, MANAGE_CHANNELS = 1n << 4n;
const MEMBER = (VIEW | SEND | EMBED | ATTACH | HISTORY).toString();

function cfg() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;
  if (!token || !guild) return null;
  return {
    token, guild,
    category: process.env.DISCORD_TICKET_CATEGORY_ID || null,
    staff: process.env.DISCORD_STAFF_ROLE_ID || null,
    botId: process.env.DISCORD_CLIENT_ID || null,
  };
}

export const discordBotEnabled = () => cfg() != null;

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = cfg();
  if (!c) throw new Error("discord_bot_not_configured");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${c.token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`discord_${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Add a viewer to the server with their OAuth token (scope guilds.join). Best effort. */
export async function joinGuild(discordUserId: string, accessToken: string): Promise<void> {
  const c = cfg();
  if (!c) return;
  await api(`/guilds/${c.guild}/members/${discordUserId}`, { method: "PUT", body: JSON.stringify({ access_token: accessToken }) });
}

export interface Ticket { channelId: string; url: string }

/** Channel names: lowercase, a-z0-9 and dashes, 90 chars max. */
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "ticket";

/**
 * Private channel only the viewer, staff and the bot can see, with a first
 * message pinging both. Returns null when the bot isn't configured.
 */
export async function openTicket(opts: { name: string; discordUserId: string; message: string }): Promise<Ticket | null> {
  const c = cfg();
  if (!c) return null;
  const overwrites: { id: string; type: 0 | 1; allow?: string; deny?: string }[] = [
    { id: c.guild, type: 0, deny: VIEW.toString() }, // @everyone
    { id: opts.discordUserId, type: 1, allow: MEMBER },
  ];
  if (c.staff) overwrites.push({ id: c.staff, type: 0, allow: MEMBER });
  if (c.botId) overwrites.push({ id: c.botId, type: 1, allow: (BigInt(MEMBER) | MANAGE_CHANNELS).toString() });
  const channel = await api<{ id: string }>(`/guilds/${c.guild}/channels`, {
    method: "POST",
    body: JSON.stringify({ name: slug(opts.name), type: 0, parent_id: c.category, permission_overwrites: overwrites }),
  });
  await api(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `<@${opts.discordUserId}>${c.staff ? ` <@&${c.staff}>` : ""}\n${opts.message}`,
      allowed_mentions: { users: [opts.discordUserId], roles: c.staff ? [c.staff] : [] },
    }),
  });
  return { channelId: channel.id, url: `https://discord.com/channels/${c.guild}/${channel.id}` };
}

/** Post in an existing ticket (e.g. the admin's decision). Best effort. */
export async function postInTicket(channelId: string, message: string): Promise<void> {
  if (!cfg()) return;
  await api(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }) });
}

export const ticketUrl = (channelId: string | null) => {
  const guild = process.env.DISCORD_GUILD_ID;
  return channelId && guild ? `https://discord.com/channels/${guild}/${channelId}` : null;
};

/** Delete a ticket channel (closing it). Best effort. */
export async function deleteChannel(channelId: string): Promise<void> {
  if (!cfg()) return;
  await api(`/channels/${channelId}`, { method: "DELETE" });
}

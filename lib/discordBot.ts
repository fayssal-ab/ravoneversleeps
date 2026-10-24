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
    cache: "no-store", signal: init.signal ?? AbortSignal.timeout(8000),
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

/** Channel names: lowercase, a-z0-9 and dashes, 80 chars max. */
const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "ticket";

/**
 * The status rides at the front of the channel name and changes with every
 * step: "🟡-verify-yuuukine" → "🔵-…" (claimed) → "✅-…" / "❌-…" / "🔒-…".
 */
export const TICKET_STATUS = { open: "🟡", claimed: "🔵", approved: "✅", rejected: "❌", closed: "🔒" } as const;
export type TicketStatus = keyof typeof TICKET_STATUS;
const STATUS_PREFIX = new RegExp(`^(${Object.values(TICKET_STATUS).join("|")})-`, "u");
export type TicketKind = "verify" | "challenge" | "vip";

/** Buttons under a ticket's first message (handled by /api/discord/interactions). */
export function ticketButtons(claimedBy?: string) {
  return [{
    type: 1,
    components: [
      claimedBy
        ? { type: 2, style: 2, label: `Claimed by ${claimedBy}`.slice(0, 80), custom_id: "ticket:claimed", disabled: true, emoji: { name: "🔵" } }
        : { type: 2, style: 1, label: "Claim", custom_id: "ticket:claim", emoji: { name: "🙋" } },
      { type: 2, style: 4, label: "Delete ticket", custom_id: "ticket:delete", emoji: { name: "🗑️" } },
    ],
  }];
}

/**
 * Private channel only the viewer, staff and the bot can see, named
 * "🟡-<kind>-<player>", with a first message pinging both and the
 * Claim / Delete buttons. Returns null when the bot isn't configured.
 */
export interface TicketFile { name: string; type: string; data: ArrayBuffer }
export interface TicketEmbed { title: string; color?: number; fields: { name: string; value: string; inline?: boolean }[]; footer?: string }

export async function openTicket(opts: {
  kind: TicketKind; label: string; discordUserId: string; message: string;
  /** a data card shown under the message */
  embed?: TicketEmbed;
  /** proof uploaded on the site, attached to the first message */
  files?: TicketFile[];
}): Promise<Ticket | null> {
  if (!discordBotEnabled()) return null;
  const s = await discordSetup();
  const channel = await api<{ id: string }>(`/guilds/${s.guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: `${TICKET_STATUS.open}-${opts.kind}-${slug(opts.label)}`, type: 0, parent_id: s.categoryId,
      permission_overwrites: [
        { id: s.guildId, type: 0, deny: VIEW.toString() }, // @everyone
        { id: opts.discordUserId, type: 1, allow: MEMBER.toString() },
        { id: s.staffRoleId, type: 0, allow: MEMBER.toString() },
        { id: s.botId, type: 1, allow: (MEMBER | MANAGE_CHANNELS).toString() },
      ],
    }),
  });
  const payload = {
    content: `<@${opts.discordUserId}> <@&${s.staffRoleId}>\n${opts.message}`,
    allowed_mentions: { users: [opts.discordUserId], roles: [s.staffRoleId] },
    components: ticketButtons(),
    embeds: opts.embed ? [{
      title: opts.embed.title, color: opts.embed.color ?? 0x8dff4a,
      fields: opts.embed.fields.map((f) => ({ ...f, value: f.value.slice(0, 1024) || "—" })),
      footer: opts.embed.footer ? { text: opts.embed.footer } : undefined,
    }] : undefined,
  };
  try {
    if (opts.files?.length) await postWithFiles(channel.id, payload, opts.files);
    else await api(`/channels/${channel.id}/messages`, { method: "POST", body: JSON.stringify(payload) });
  } catch (e) {
    // no half-made ticket: an empty channel would block a retry
    await deleteChannel(channel.id).catch(() => {});
    throw e;
  }
  return { channelId: channel.id, url: ticketUrl(channel.id)! };
}

/** Message with attachments (multipart: payload_json + files[n]). */
async function postWithFiles(channelId: string, payload: object, files: TicketFile[]): Promise<void> {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ ...payload, attachments: files.map((f, id) => ({ id, filename: f.name })) }));
  files.forEach((f, id) => form.append(`files[${id}]`, new Blob([f.data], { type: f.type }), f.name));
  const res = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST", body: form, headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    cache: "no-store", signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string; code?: number } | null;
    throw new DiscordError(res.status, body?.message ? `${body.message}${body.code ? ` (${body.code})` : ""}` : "");
  }
}

/**
 * Swap the status emoji at the front of the ticket's name. Best effort:
 * Discord allows 2 renames per channel per 10 minutes, so a rename can be
 * skipped (the message in the ticket still says what happened).
 */
export async function renameTicket(channelId: string, status: TicketStatus): Promise<void> {
  if (!discordBotEnabled()) return;
  try {
    const ch = await api<{ name: string }>(`/channels/${channelId}`);
    const base = ch.name.replace(STATUS_PREFIX, "");
    const name = `${TICKET_STATUS[status]}-${base}`.slice(0, 100);
    if (name !== ch.name) await api(`/channels/${channelId}`, { method: "PATCH", body: JSON.stringify({ name }), signal: AbortSignal.timeout(2500) });
  } catch (e) {
    console.error("ticket rename skipped", discordErrorText(e));
  }
}

/** The app's public key, to check that interaction requests come from Discord. */
let publicKey: Promise<string> | null = null;
export function appPublicKey(): Promise<string> {
  publicKey ??= api<{ verify_key: string }>("/applications/@me").then((a) => a.verify_key).catch((e) => { publicKey = null; throw e; });
  return publicKey;
}

/** Point the app's Interactions Endpoint URL at the site (Discord pings it first). */
export async function setInteractionsEndpoint(url: string): Promise<void> {
  await api("/applications/@me", { method: "PATCH", body: JSON.stringify({ interactions_endpoint_url: url }), signal: AbortSignal.timeout(15000) });
}

export async function interactionsEndpoint(): Promise<string | null> {
  return (await api<{ interactions_endpoint_url?: string | null }>("/applications/@me")).interactions_endpoint_url ?? null;
}

/** Post in an existing ticket (e.g. the admin's decision). Best effort. */
export async function postInTicket(channelId: string, message: string): Promise<void> {
  if (!discordBotEnabled()) return;
  await api(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } }) });
}

/** True only when Discord says the channel doesn't exist (404); errors count as "still there". */
export async function channelGone(channelId: string): Promise<boolean> {
  if (!discordBotEnabled()) return false;
  try {
    await api(`/channels/${channelId}`);
    return false;
  } catch (e) {
    return e instanceof DiscordError && e.status === 404;
  }
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

// ── server management (Admin → Server, owner only) ─────────────────────
// The bot can only touch members and roles below its own highest role,
// and never the server owner; Discord refuses the rest (403 / 50013).

const ADMINISTRATOR = 1n << 3n, KICK = 1n << 1n, BAN = 1n << 2n, REACT = 1n << 6n, EXTERNAL_EMOJI = 1n << 18n,
  CONNECT = 1n << 20n, SPEAK = 1n << 21n, MUTE = 1n << 22n, DEAFEN = 1n << 23n, MOVE = 1n << 24n,
  MANAGE_MESSAGES = 1n << 13n, MANAGE_NICKNAMES = 1n << 27n, TIMEOUT = 1n << 40n;
const CHAT = MEMBER | REACT | EXTERNAL_EMOJI | CONNECT | SPEAK;

/** What a new role may do. "admin" = Discord's Administrator (everything). */
export const ROLE_PRESETS = {
  cosmetic: { label: "Name & color only", bits: 0n },
  member: { label: "Member (chat & voice)", bits: CHAT },
  mod: { label: "Moderator (kick, ban, timeout, delete messages)", bits: CHAT | KICK | BAN | MANAGE_MESSAGES | MANAGE_NICKNAMES | TIMEOUT | MUTE | DEAFEN | MOVE },
  admin: { label: "Admin (everything)", bits: ADMINISTRATOR },
} as const;
export type RolePreset = keyof typeof ROLE_PRESETS;

export interface GuildRole {
  id: string; name: string; color: number; position: number;
  admin: boolean; managed: boolean;
  /** a bot's own role, or at/above the bot's top role: the bot can't give, remove or delete it */
  locked: boolean;
}
export interface GuildMember {
  id: string; username: string; nick: string | null; avatar: string;
  roles: string[]; joined_at: string; bot: boolean; owner: boolean;
}

type RawRole = { id: string; name: string; color: number; position: number; permissions: string; managed: boolean };
type RawMember = {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null; roles: string[]; joined_at: string;
};

const reason = (why: string) => ({ "X-Audit-Log-Reason": encodeURIComponent(`RAVO admin: ${why}`) });
const snowflake = (id: string) => {
  if (!/^\d{5,25}$/.test(id)) throw new Error("bad_discord_id");
  return id;
};

/** Roles, highest first, without @everyone. */
export async function guildRoles(): Promise<GuildRole[]> {
  const s = await discordSetup();
  const [roles, me] = await Promise.all([
    api<RawRole[]>(`/guilds/${s.guildId}/roles`),
    api<RawMember>(`/guilds/${s.guildId}/members/${s.botId}`),
  ]);
  const pos = new Map(roles.map((r) => [r.id, r.position]));
  const top = Math.max(0, ...me.roles.map((id) => pos.get(id) ?? 0));
  return roles
    .filter((r) => r.id !== s.guildId)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed,
      admin: (BigInt(r.permissions) & ADMINISTRATOR) !== 0n,
      locked: r.managed || r.position >= top,
    }));
}

/**
 * Members whose username / nickname starts with `query`, or the first 100
 * when empty. Needs "Server Members Intent" on in the Developer Portal → Bot.
 */
export async function guildMembers(query: string): Promise<GuildMember[]> {
  const s = await discordSetup();
  const q = query.trim();
  const [raw, guild] = await Promise.all([
    q ? api<RawMember[]>(`/guilds/${s.guildId}/members/search?query=${encodeURIComponent(q)}&limit=50`)
      : api<RawMember[]>(`/guilds/${s.guildId}/members?limit=100`),
    api<{ owner_id: string }>(`/guilds/${s.guildId}`),
  ]);
  return raw.map((m) => ({
    id: m.user.id,
    username: m.user.username,
    nick: m.nick ?? m.user.global_name ?? null,
    avatar: m.user.avatar
      ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(m.user.id) >> 22n) % 6n)}.png`,
    roles: m.roles, joined_at: m.joined_at, bot: Boolean(m.user.bot), owner: m.user.id === guild.owner_id,
  }));
}

export async function giveRole(userId: string, roleId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/members/${snowflake(userId)}/roles/${snowflake(roleId)}`, { method: "PUT", headers: reason("give role") });
}

export async function takeRole(userId: string, roleId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/members/${snowflake(userId)}/roles/${snowflake(roleId)}`, { method: "DELETE", headers: reason("remove role") });
}

export async function kickMember(userId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/members/${snowflake(userId)}`, { method: "DELETE", headers: reason("kick") });
}

/** Ban (they can't rejoin until unbanned); keeps their messages. */
export async function banMember(userId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/bans/${snowflake(userId)}`, { method: "PUT", body: JSON.stringify({ delete_message_seconds: 0 }), headers: reason("ban") });
}

export async function unbanMember(userId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/bans/${snowflake(userId)}`, { method: "DELETE", headers: reason("unban") });
}

export async function guildBans(): Promise<{ id: string; username: string; reason: string | null }[]> {
  const s = await discordSetup();
  const bans = await api<{ user: { id: string; username: string }; reason: string | null }[]>(`/guilds/${s.guildId}/bans?limit=100`);
  return bans.map((b) => ({ id: b.user.id, username: b.user.username, reason: b.reason }));
}

export async function createRole(name: string, color: number, preset: RolePreset): Promise<{ id: string; name: string }> {
  const s = await discordSetup();
  return api<{ id: string; name: string }>(`/guilds/${s.guildId}/roles`, {
    method: "POST", headers: reason("create role"),
    body: JSON.stringify({ name, color, permissions: ROLE_PRESETS[preset].bits.toString(), hoist: preset === "admin" || preset === "mod", mentionable: false }),
  });
}

export async function deleteRole(roleId: string): Promise<void> {
  const s = await discordSetup();
  await api(`/guilds/${s.guildId}/roles/${snowflake(roleId)}`, { method: "DELETE", headers: reason("delete role") });
}

/**
 * Invite link to the server (7 days, unlimited uses). A bot can't pull
 * someone in by itself: they open the link, or sign in with Discord on the
 * site (that joins them automatically).
 */
export async function createInvite(): Promise<string> {
  const s = await discordSetup();
  const [guild, channels] = await Promise.all([
    api<{ system_channel_id: string | null; rules_channel_id: string | null }>(`/guilds/${s.guildId}`),
    api<{ id: string; type: number; position: number; parent_id: string | null }[]>(`/guilds/${s.guildId}/channels`),
  ]);
  const text = channels.filter((c) => c.type === 0 && c.parent_id !== s.categoryId).sort((a, b) => a.position - b.position);
  const channelId = guild.system_channel_id ?? guild.rules_channel_id ?? text[0]?.id;
  if (!channelId) throw new Error("no_text_channel");
  const inv = await api<{ code: string }>(`/channels/${channelId}/invites`, {
    method: "POST", headers: reason("invite"), body: JSON.stringify({ max_age: 7 * 24 * 3600, max_uses: 0, unique: true }),
  });
  return `https://discord.gg/${inv.code}`;
}

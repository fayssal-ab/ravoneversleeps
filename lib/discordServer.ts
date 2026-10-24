import "server-only";
import { api, discordSetup } from "./discordBot";

// Ravo's Discord server, managed through the bot (Admin → Server, owner
// only). The bot can only touch members and roles below its own top role,
// never the server owner, and can only grant permissions it has itself;
// Discord refuses the rest (403 / 50013).

export interface Permission { key: string; bit: number; name: string; desc: string }

/** Every Discord permission, grouped like Server Settings → Roles. */
export const PERMISSIONS: { group: string; items: Permission[] }[] = [
  { group: "General", items: [
    { key: "VIEW_CHANNEL", bit: 10, name: "View Channels", desc: "See channels by default (not private ones)." },
    { key: "MANAGE_CHANNELS", bit: 4, name: "Manage Channels", desc: "Create, edit and delete channels." },
    { key: "MANAGE_ROLES", bit: 28, name: "Manage Roles", desc: "Create roles and edit or delete roles below their highest role." },
    { key: "CREATE_EXPRESSIONS", bit: 43, name: "Create Expressions", desc: "Add custom emoji, stickers and sounds." },
    { key: "MANAGE_GUILD_EXPRESSIONS", bit: 30, name: "Manage Expressions", desc: "Edit or remove custom emoji, stickers and sounds." },
    { key: "VIEW_AUDIT_LOG", bit: 7, name: "View Audit Log", desc: "See who changed what in the server." },
    { key: "VIEW_GUILD_INSIGHTS", bit: 19, name: "View Server Insights", desc: "See server analytics." },
    { key: "MANAGE_WEBHOOKS", bit: 29, name: "Manage Webhooks", desc: "Create, edit and delete webhooks." },
    { key: "MANAGE_GUILD", bit: 5, name: "Manage Server", desc: "Change the server's name, region, invites and integrations." },
  ] },
  { group: "Membership", items: [
    { key: "CREATE_INSTANT_INVITE", bit: 0, name: "Create Invite", desc: "Invite new people to the server." },
    { key: "CHANGE_NICKNAME", bit: 26, name: "Change Nickname", desc: "Change their own nickname." },
    { key: "MANAGE_NICKNAMES", bit: 27, name: "Manage Nicknames", desc: "Change other members' nicknames." },
    { key: "KICK_MEMBERS", bit: 1, name: "Kick Members", desc: "Remove members from the server." },
    { key: "BAN_MEMBERS", bit: 2, name: "Ban Members", desc: "Ban members and delete their message history." },
    { key: "MODERATE_MEMBERS", bit: 40, name: "Timeout Members", desc: "Stop members from chatting, reacting or speaking for a while." },
  ] },
  { group: "Text channels", items: [
    { key: "SEND_MESSAGES", bit: 11, name: "Send Messages", desc: "Send messages in text channels." },
    { key: "SEND_MESSAGES_IN_THREADS", bit: 38, name: "Send Messages in Threads", desc: "Reply in threads." },
    { key: "CREATE_PUBLIC_THREADS", bit: 35, name: "Create Public Threads", desc: "Start threads everyone in the channel can see." },
    { key: "CREATE_PRIVATE_THREADS", bit: 36, name: "Create Private Threads", desc: "Start invite-only threads." },
    { key: "EMBED_LINKS", bit: 14, name: "Embed Links", desc: "Links they post show a preview." },
    { key: "ATTACH_FILES", bit: 15, name: "Attach Files", desc: "Upload files and images." },
    { key: "ADD_REACTIONS", bit: 6, name: "Add Reactions", desc: "Add new emoji reactions to messages." },
    { key: "USE_EXTERNAL_EMOJIS", bit: 18, name: "Use External Emoji", desc: "Use emoji from other servers." },
    { key: "USE_EXTERNAL_STICKERS", bit: 37, name: "Use External Stickers", desc: "Use stickers from other servers." },
    { key: "MENTION_EVERYONE", bit: 17, name: "Mention @everyone, @here and All Roles", desc: "Ping everyone in a channel." },
    { key: "MANAGE_MESSAGES", bit: 13, name: "Manage Messages", desc: "Delete and pin other members' messages." },
    { key: "MANAGE_THREADS", bit: 34, name: "Manage Threads", desc: "Rename, delete, close threads and slow mode." },
    { key: "READ_MESSAGE_HISTORY", bit: 16, name: "Read Message History", desc: "Read messages sent before they joined." },
    { key: "SEND_TTS_MESSAGES", bit: 12, name: "Send Text-to-Speech Messages", desc: "Send /tts messages." },
    { key: "SEND_VOICE_MESSAGES", bit: 46, name: "Send Voice Messages", desc: "Send voice messages." },
    { key: "SEND_POLLS", bit: 49, name: "Create Polls", desc: "Start polls." },
    { key: "USE_APPLICATION_COMMANDS", bit: 31, name: "Use Application Commands", desc: "Use slash commands and bot apps." },
  ] },
  { group: "Voice channels", items: [
    { key: "CONNECT", bit: 20, name: "Connect", desc: "Join voice channels." },
    { key: "SPEAK", bit: 21, name: "Speak", desc: "Talk in voice channels." },
    { key: "STREAM", bit: 9, name: "Video", desc: "Share their screen or camera." },
    { key: "USE_SOUNDBOARD", bit: 42, name: "Use Soundboard", desc: "Play soundboard sounds." },
    { key: "USE_EXTERNAL_SOUNDS", bit: 45, name: "Use External Sounds", desc: "Play sounds from other servers." },
    { key: "USE_VAD", bit: 25, name: "Use Voice Activity", desc: "Talk without push-to-talk." },
    { key: "PRIORITY_SPEAKER", bit: 8, name: "Priority Speaker", desc: "Be heard more easily." },
    { key: "MUTE_MEMBERS", bit: 22, name: "Mute Members", desc: "Mute others in voice." },
    { key: "DEAFEN_MEMBERS", bit: 23, name: "Deafen Members", desc: "Deafen others in voice." },
    { key: "MOVE_MEMBERS", bit: 24, name: "Move Members", desc: "Move or disconnect members in voice." },
  ] },
  { group: "Events", items: [
    { key: "CREATE_EVENTS", bit: 44, name: "Create Events", desc: "Create server events." },
    { key: "MANAGE_EVENTS", bit: 33, name: "Manage Events", desc: "Edit and cancel events." },
  ] },
  { group: "Advanced", items: [
    { key: "ADMINISTRATOR", bit: 3, name: "Administrator", desc: "Every permission and bypasses every channel rule. Dangerous." },
  ] },
];
export const ALL_PERMISSIONS = PERMISSIONS.flatMap((g) => g.items);
const ADMINISTRATOR = 1n << 3n;

export interface GuildInfo { id: string; name: string; icon: string | null; members: number; online: number; ownerId: string; botName: string }
export interface GuildRole {
  id: string; name: string; color: number; position: number; permissions: string;
  hoist: boolean; mentionable: boolean; managed: boolean; admin: boolean;
  /** a bot's own role, or at/above the bot's top role: the bot can't give, edit or delete it */
  locked: boolean;
}
export interface GuildMember {
  id: string; username: string; nick: string | null; globalName: string | null; avatar: string;
  roles: string[]; joined_at: string; bot: boolean; owner: boolean;
  timeoutUntil: string | null; mute: boolean; deaf: boolean;
}
export interface GuildChannel { id: string; name: string; type: number; position: number; parent: string | null; topic: string | null }
export interface GuildInvite { code: string; channel: string; inviter: string | null; uses: number; maxUses: number; expires: string | null }

type RawRole = { id: string; name: string; color: number; position: number; permissions: string; managed: boolean; hoist: boolean; mentionable: boolean };
type RawMember = {
  user: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null; roles: string[]; joined_at: string;
  communication_disabled_until?: string | null; mute?: boolean; deaf?: boolean;
};

/** Shows in Discord's own audit log. */
const reason = (why: string) => ({ "X-Audit-Log-Reason": encodeURIComponent(`RAVO admin: ${why}`) });
export const isSnowflake = (id: string) => /^\d{5,25}$/.test(id);
const sf = (id: string) => {
  if (!isSnowflake(id)) throw new Error("bad_discord_id");
  return id;
};
const guild = async () => (await discordSetup()).guildId;

const avatarUrl = (u: RawMember["user"]) => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
  : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;

function toMember(m: RawMember, ownerId: string): GuildMember {
  const until = m.communication_disabled_until && Date.parse(m.communication_disabled_until) > Date.now() ? m.communication_disabled_until : null;
  return {
    id: m.user.id, username: m.user.username, nick: m.nick ?? null, globalName: m.user.global_name ?? null, avatar: avatarUrl(m.user),
    roles: m.roles, joined_at: m.joined_at, bot: Boolean(m.user.bot), owner: m.user.id === ownerId,
    timeoutUntil: until, mute: Boolean(m.mute), deaf: Boolean(m.deaf),
  };
}

// ── server ─────────────────────────────────────────────────────────────
export async function guildInfo(): Promise<GuildInfo> {
  const s = await discordSetup();
  const g = await api<{ id: string; name: string; icon: string | null; owner_id: string; approximate_member_count?: number; approximate_presence_count?: number }>(
    `/guilds/${s.guildId}?with_counts=true`);
  return {
    id: g.id, name: g.name, ownerId: g.owner_id, botName: s.botName,
    icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    members: g.approximate_member_count ?? 0, online: g.approximate_presence_count ?? 0,
  };
}

export async function renameGuild(name: string): Promise<void> {
  await api(`/guilds/${await guild()}`, { method: "PATCH", headers: reason("rename server"), body: JSON.stringify({ name }) });
}

// ── roles ──────────────────────────────────────────────────────────────
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
      id: r.id, name: r.name, color: r.color, position: r.position, permissions: r.permissions,
      hoist: r.hoist, mentionable: r.mentionable, managed: r.managed,
      admin: (BigInt(r.permissions) & ADMINISTRATOR) !== 0n,
      locked: r.managed || r.position >= top,
    }));
}

export interface RoleFields { name: string; color: number; hoist: boolean; mentionable: boolean; permissions: bigint }

export async function createRole(f: RoleFields): Promise<{ id: string }> {
  return api<{ id: string }>(`/guilds/${await guild()}/roles`, {
    method: "POST", headers: reason("create role"),
    body: JSON.stringify({ name: f.name, color: f.color, hoist: f.hoist, mentionable: f.mentionable, permissions: f.permissions.toString() }),
  });
}

export async function editRole(roleId: string, f: RoleFields): Promise<void> {
  await api(`/guilds/${await guild()}/roles/${sf(roleId)}`, {
    method: "PATCH", headers: reason("edit role"),
    body: JSON.stringify({ name: f.name, color: f.color, hoist: f.hoist, mentionable: f.mentionable, permissions: f.permissions.toString() }),
  });
}

export async function deleteRole(roleId: string): Promise<void> {
  await api(`/guilds/${await guild()}/roles/${sf(roleId)}`, { method: "DELETE", headers: reason("delete role") });
}

/** Swap a role with its neighbour above / below (both must be under the bot). */
export async function moveRole(roleId: string, dir: "up" | "down"): Promise<void> {
  const roles = await guildRoles();
  const i = roles.findIndex((r) => r.id === roleId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= roles.length || roles[i].locked || roles[j].locked) throw new Error("role_cant_move");
  await api(`/guilds/${await guild()}/roles`, {
    method: "PATCH", headers: reason("move role"),
    body: JSON.stringify([{ id: roles[i].id, position: roles[j].position }, { id: roles[j].id, position: roles[i].position }]),
  });
}

// ── members ────────────────────────────────────────────────────────────
/**
 * Members whose username / nickname starts with `query`, or the first 100
 * when empty. Needs "Server Members Intent" on in the Developer Portal → Bot.
 */
export async function guildMembers(query: string): Promise<GuildMember[]> {
  const g = await guild();
  const q = query.trim();
  const [raw, info] = await Promise.all([
    q ? api<RawMember[]>(`/guilds/${g}/members/search?query=${encodeURIComponent(q)}&limit=100`)
      : api<RawMember[]>(`/guilds/${g}/members?limit=100`),
    api<{ owner_id: string }>(`/guilds/${g}`),
  ]);
  return raw.map((m) => toMember(m, info.owner_id)).sort((a, b) => (a.nick ?? a.globalName ?? a.username).localeCompare(b.nick ?? b.globalName ?? b.username));
}

export async function guildMember(userId: string): Promise<GuildMember> {
  const g = await guild();
  const [m, info] = await Promise.all([api<RawMember>(`/guilds/${g}/members/${sf(userId)}`), api<{ owner_id: string }>(`/guilds/${g}`)]);
  return toMember(m, info.owner_id);
}

async function patchMember(userId: string, body: object, why: string): Promise<void> {
  await api(`/guilds/${await guild()}/members/${sf(userId)}`, { method: "PATCH", headers: reason(why), body: JSON.stringify(body) });
}

export const setNickname = (userId: string, nick: string) => patchMember(userId, { nick: nick || null }, "nickname");
/** Timeout for `minutes` (Discord max 28 days), or 0 to lift it. */
export const timeoutMember = (userId: string, minutes: number) =>
  patchMember(userId, { communication_disabled_until: minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null }, minutes > 0 ? "timeout" : "remove timeout");
/** Server mute / deafen (only while they're in a voice channel). */
export const setVoice = (userId: string, v: { mute?: boolean; deaf?: boolean }) => patchMember(userId, v, "voice");
export const disconnectVoice = (userId: string) => patchMember(userId, { channel_id: null }, "disconnect from voice");
/** Replace the member's roles. Roles the bot can't manage are kept as they are. */
export async function setMemberRoles(userId: string, wanted: string[]): Promise<void> {
  const [m, roles] = await Promise.all([guildMember(userId), guildRoles()]);
  const manageable = new Set(roles.filter((r) => !r.locked).map((r) => r.id));
  const next = [...m.roles.filter((id) => !manageable.has(id)), ...wanted.filter((id) => manageable.has(id))];
  await patchMember(userId, { roles: [...new Set(next)] }, "set roles");
}

export async function kickMember(userId: string): Promise<void> {
  await api(`/guilds/${await guild()}/members/${sf(userId)}`, { method: "DELETE", headers: reason("kick") });
}

/** Ban; `deleteDays` also deletes their messages from the last 0–7 days. */
export async function banMember(userId: string, deleteDays = 0): Promise<void> {
  await api(`/guilds/${await guild()}/bans/${sf(userId)}`, {
    method: "PUT", headers: reason("ban"), body: JSON.stringify({ delete_message_seconds: Math.min(7, Math.max(0, deleteDays)) * 86400 }),
  });
}

export async function unbanMember(userId: string): Promise<void> {
  await api(`/guilds/${await guild()}/bans/${sf(userId)}`, { method: "DELETE", headers: reason("unban") });
}

export async function guildBans(): Promise<{ id: string; username: string; avatar: string; reason: string | null }[]> {
  const bans = await api<{ user: RawMember["user"]; reason: string | null }[]>(`/guilds/${await guild()}/bans?limit=1000`);
  return bans.map((b) => ({ id: b.user.id, username: b.user.username, avatar: avatarUrl(b.user), reason: b.reason }));
}

// ── channels ───────────────────────────────────────────────────────────
export const CHANNEL_TYPES = { 0: "Text", 2: "Voice", 4: "Category", 5: "Announcement", 13: "Stage", 15: "Forum" } as Record<number, string>;

export async function guildChannels(): Promise<GuildChannel[]> {
  const raw = await api<{ id: string; name: string; type: number; position: number; parent_id: string | null; topic?: string | null }[]>(`/guilds/${await guild()}/channels`);
  return raw.map((c) => ({ id: c.id, name: c.name, type: c.type, position: c.position, parent: c.parent_id, topic: c.topic ?? null }));
}

export async function createChannel(name: string, type: 0 | 2 | 4, parent: string | null): Promise<void> {
  await api(`/guilds/${await guild()}/channels`, {
    method: "POST", headers: reason("create channel"),
    body: JSON.stringify({ name, type, parent_id: type === 4 ? null : parent }),
  });
}

export async function editChannel(channelId: string, v: { name: string; topic?: string }): Promise<void> {
  await api(`/channels/${sf(channelId)}`, { method: "PATCH", headers: reason("edit channel"), body: JSON.stringify(v) });
}

export async function removeChannel(channelId: string): Promise<void> {
  await api(`/channels/${sf(channelId)}`, { method: "DELETE", headers: reason("delete channel") });
}

/**
 * Delete the last `count` messages (≤ 100) of a channel. Discord only bulk
 * deletes messages younger than 14 days; older ones are left. Returns how many went.
 */
export async function clearMessages(channelId: string, count: number): Promise<number> {
  const msgs = await api<{ id: string; timestamp: string }[]>(`/channels/${sf(channelId)}/messages?limit=${Math.min(100, Math.max(1, count))}`);
  const fresh = msgs.filter((m) => Date.now() - Date.parse(m.timestamp) < 13.9 * 86400_000).map((m) => m.id);
  if (fresh.length === 1) await api(`/channels/${channelId}/messages/${fresh[0]}`, { method: "DELETE", headers: reason("clear messages") });
  else if (fresh.length > 1) await api(`/channels/${channelId}/messages/bulk-delete`, { method: "POST", headers: reason("clear messages"), body: JSON.stringify({ messages: fresh }) });
  return fresh.length;
}

// ── invites ────────────────────────────────────────────────────────────
export async function guildInvites(): Promise<GuildInvite[]> {
  const raw = await api<{ code: string; channel?: { name: string }; inviter?: { username: string }; uses?: number; max_uses?: number; expires_at?: string | null }[]>(
    `/guilds/${await guild()}/invites`);
  return raw.map((i) => ({ code: i.code, channel: i.channel?.name ?? "", inviter: i.inviter?.username ?? null, uses: i.uses ?? 0, maxUses: i.max_uses ?? 0, expires: i.expires_at ?? null }));
}

/**
 * Invite link to the server. A bot can't pull someone in by itself: they open
 * the link, or sign in with Discord on the site (that joins them automatically).
 */
export async function createInvite(opts: { channelId?: string; days: number; maxUses: number }): Promise<string> {
  const s = await discordSetup();
  let channelId = opts.channelId;
  if (!channelId) {
    const [g, channels] = await Promise.all([api<{ system_channel_id: string | null; rules_channel_id: string | null }>(`/guilds/${s.guildId}`), guildChannels()]);
    channelId = g.system_channel_id ?? g.rules_channel_id
      ?? channels.filter((c) => c.type === 0 && c.parent !== s.categoryId).sort((a, b) => a.position - b.position)[0]?.id;
  }
  if (!channelId) throw new Error("no_text_channel");
  const inv = await api<{ code: string }>(`/channels/${sf(channelId)}/invites`, {
    method: "POST", headers: reason("invite"), body: JSON.stringify({ max_age: opts.days * 86400, max_uses: opts.maxUses, unique: true }),
  });
  return `https://discord.gg/${inv.code}`;
}

export async function revokeInvite(code: string): Promise<void> {
  if (!/^[\w-]{2,32}$/.test(code)) throw new Error("bad_invite");
  await api(`/invites/${code}`, { method: "DELETE", headers: reason("revoke invite") });
}

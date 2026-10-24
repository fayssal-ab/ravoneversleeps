import Link from "next/link";
import { Search, ShieldCheck, X } from "lucide-react";
import { AdminTitle, Card, Empty, Field } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { requireOwner } from "@/lib/admin";
import {
  discordBotEnabled, discordErrorText, discordSetup, guildBans, guildMembers, guildRoles, ROLE_PRESETS,
  type GuildMember, type GuildRole,
} from "@/lib/discordBot";
import { createInviteAction, createRoleAction, deleteRoleAction, memberModAction, memberRoleAction } from "../actions";

// Owner only (yuuukine): manage Ravo's Discord server through the bot.

const OK_TEXT: Record<string, string> = {
  "server.role.member": "Roles updated.",
  "server.member": "Done.",
  "server.role.create": "Role created.",
  "server.role.delete": "Role deleted.",
  "server.invite": "Invite link created.",
};

const hex = (c: number) => (c ? `#${c.toString(16).padStart(6, "0")}` : "#99aab5");

/** Why the bot can't read something, in plain words. */
function why(e: unknown): string {
  const t = discordErrorText(e);
  if (/50001|Missing Access/.test(t)) return `Turn on "Server Members Intent" in the Discord Developer Portal → Bot, then reload. (${t})`;
  return t;
}

async function settle<T>(p: Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await p, error: null };
  } catch (e) {
    return { data: null, error: why(e) };
  }
}

function RoleChip({ role, member, back }: { role: GuildRole; member: GuildMember; back: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-3/50 py-0.5 pl-2 pr-1 text-xs">
      <span className="size-2 rounded-full" style={{ background: hex(role.color) }} />
      {role.name}
      {!role.locked && (
        <form action={memberRoleAction} className="contents">
          <input type="hidden" name="user" value={member.id} />
          <input type="hidden" name="role" value={role.id} />
          <input type="hidden" name="name" value={`${member.username} − ${role.name}`} />
          <input type="hidden" name="op" value="take" />
          <input type="hidden" name="back" value={back} />
          <button className="rounded-full p-0.5 text-dim hover:bg-danger/20 hover:text-danger" aria-label={`Remove ${role.name}`} title="Remove role">
            <X className="size-3" />
          </button>
        </form>
      )}
    </span>
  );
}

export default async function AdminServer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireOwner();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const back = q ? `/admin/server?q=${encodeURIComponent(q)}` : "/admin/server";

  if (!discordBotEnabled()) {
    return (
      <>
        <AdminTitle title="Server" />
        <Empty>The bot isn&apos;t set up. Add DISCORD_BOT_TOKEN, then check <Link href="/admin/discord" className="text-neon underline">Discord</Link>.</Empty>
      </>
    );
  }

  const [setup, roles, members, bans] = await Promise.all([
    settle(discordSetup()), settle(guildRoles()), settle(guildMembers(q)), settle(guildBans()),
  ]);
  const roleById = new Map((roles.data ?? []).map((r) => [r.id, r]));
  const givable = (roles.data ?? []).filter((r) => !r.locked);
  const invite = sp.invite && /^https:\/\/discord\.gg\/[\w-]+$/.test(sp.invite) ? sp.invite : null;

  return (
    <>
      <AdminTitle title="Server">
        Ravo&apos;s Discord server{setup.data ? <> (<b>{setup.data.guildName}</b>)</> : null}: give and remove roles, create and delete roles,
        kick, ban and invite. Only you see this page. The bot can only manage roles below its own top role: drag the bot&apos;s role to
        the top in Server Settings → Roles to manage everything.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText={sp.ok ? OK_TEXT[sp.ok] : undefined} />
      {setup.error && <p className="mb-6 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{setup.error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Invite people">
          <p className="text-sm text-muted">
            A bot can&apos;t pull someone into the server by itself. Send them a link (7 days, unlimited uses); anyone who signs in
            with Discord on the site joins automatically.
          </p>
          {invite && (
            <p className="mt-3 rounded-xl border border-neon/40 bg-neon/10 p-3 font-mono text-sm text-neon">
              <a href={invite} target="_blank" rel="noreferrer" className="break-all underline">{invite}</a>
            </p>
          )}
          <form action={createInviteAction} className="mt-4">
            <button className="btn btn-neon btn-sm">Create invite link</button>
          </form>
        </Card>

        <Card title="New role">
          <form action={createRoleAction} className="space-y-3">
            <input type="hidden" name="back" value={back} />
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Name"><input name="name" required maxLength={100} placeholder="Admin" className="field" /></Field>
              <Field label="Color"><input name="color" type="color" defaultValue="#8dff4a" className="field !h-[42px] !w-16 !p-1" /></Field>
            </div>
            <Field label="Can do" hint="Admin = Discord's Administrator: everything, including managing the server.">
              <select name="preset" defaultValue="member" className="field">
                {Object.entries(ROLE_PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </select>
            </Field>
            <button className="btn btn-neon btn-sm">Create role</button>
          </form>
        </Card>
      </div>

      <Card title={`Roles${roles.data ? ` (${roles.data.length})` : ""}`} className="mt-6">
        {roles.error ? <p className="text-sm text-danger">{roles.error}</p> : roles.data!.length === 0 ? <Empty>No roles yet.</Empty> : (
          <ul className="divide-y divide-white/5">
            {roles.data!.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <span className="size-3 shrink-0 rounded-full" style={{ background: hex(r.color) }} />
                <span className="flex-1 text-sm font-medium">
                  {r.name}
                  {r.admin && <span className="ml-2 inline-flex items-center gap-1 rounded bg-neon/15 px-1.5 text-[10px] font-bold uppercase text-neon"><ShieldCheck className="size-3" /> admin</span>}
                  {r.managed && <span className="ml-2 rounded bg-surface-3 px-1.5 text-[10px] font-bold uppercase text-dim">bot</span>}
                  {r.locked && !r.managed && <span className="ml-2 text-xs text-dim">above the bot</span>}
                </span>
                {!r.locked && (
                  <form action={deleteRoleAction}>
                    <input type="hidden" name="role" value={r.id} />
                    <input type="hidden" name="name" value={r.name} />
                    <input type="hidden" name="back" value={back} />
                    <ConfirmButton title="Delete role?" body={<>Delete <b>{r.name}</b>? Everyone loses it. This can&apos;t be undone.</>} confirmLabel="Delete" danger className="btn btn-ghost btn-sm">
                      Delete
                    </ConfirmButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Members" className="mt-6">
        <form className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
            <input name="q" defaultValue={q} placeholder="Username or nickname (starts with)" className="field !pl-9" />
          </label>
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
        {members.error ? <p className="mt-4 text-sm text-danger">{members.error}</p> : members.data!.length === 0 ? (
          <div className="mt-4"><Empty>{q ? "No member matches." : "No members."}</Empty></div>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {!q && members.data!.length === 100 && <li className="pb-2 text-xs text-dim">First 100 members: search to find someone else.</li>}
            {members.data!.map((m) => {
              const has = new Set(m.roles);
              const canGive = givable.filter((r) => !has.has(r.id));
              const sorted = m.roles.map((id) => roleById.get(id)).filter((r): r is GuildRole => r != null).sort((a, b) => b.position - a.position);
              return (
                <li key={m.id} className="flex flex-wrap items-start gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.avatar} alt="" width={36} height={36} className="size-9 shrink-0 rounded-full" referrerPolicy="no-referrer" />
                  <div className="min-w-48 flex-1">
                    <p className="text-sm font-semibold">
                      {m.nick ?? m.username} <span className="font-normal text-dim">@{m.username}</span>
                      {m.owner && <span className="ml-2 rounded bg-gold/20 px-1.5 text-[10px] font-bold uppercase text-gold">server owner</span>}
                      {m.bot && <span className="ml-2 rounded bg-surface-3 px-1.5 text-[10px] font-bold uppercase text-dim">bot</span>}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {sorted.length ? sorted.map((r) => <RoleChip key={r.id} role={r} member={m} back={back} />) : <span className="text-xs text-dim">No roles</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canGive.length > 0 && (
                      <form action={memberRoleAction} className="flex items-center gap-2">
                        <input type="hidden" name="user" value={m.id} />
                        <input type="hidden" name="name" value={m.username} />
                        <input type="hidden" name="op" value="give" />
                        <input type="hidden" name="back" value={back} />
                        <select name="role" className="field !w-auto !py-1.5 text-sm" aria-label={`Role for ${m.username}`}>
                          {canGive.map((r) => <option key={r.id} value={r.id}>{r.name}{r.admin ? " (admin)" : ""}</option>)}
                        </select>
                        <button className="btn btn-neon btn-sm">Give</button>
                      </form>
                    )}
                    {!m.owner && !m.bot && (["kick", "ban"] as const).map((op) => (
                      <form key={op} action={memberModAction}>
                        <input type="hidden" name="user" value={m.id} />
                        <input type="hidden" name="name" value={m.username} />
                        <input type="hidden" name="op" value={op} />
                        <input type="hidden" name="back" value={back} />
                        <ConfirmButton
                          title={op === "kick" ? "Kick?" : "Ban?"}
                          body={op === "kick"
                            ? <>Remove <b>@{m.username}</b> from the server? They can rejoin with an invite.</>
                            : <>Ban <b>@{m.username}</b>? They can&apos;t rejoin until you unban them below.</>}
                          confirmLabel={op === "kick" ? "Kick" : "Ban"}
                          danger
                          className="btn btn-ghost btn-sm !text-danger"
                        >
                          {op === "kick" ? "Kick" : "Ban"}
                        </ConfirmButton>
                      </form>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title={`Banned${bans.data ? ` (${bans.data.length})` : ""}`} className="mt-6">
        {bans.error ? <p className="text-sm text-danger">{bans.error}</p> : bans.data!.length === 0 ? <p className="text-sm text-muted">Nobody is banned.</p> : (
          <ul className="divide-y divide-white/5">
            {bans.data!.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm">@{b.username} {b.reason && <span className="text-xs text-dim">· {b.reason}</span>}</span>
                <form action={memberModAction}>
                  <input type="hidden" name="user" value={b.id} />
                  <input type="hidden" name="name" value={b.username} />
                  <input type="hidden" name="op" value="unban" />
                  <input type="hidden" name="back" value={back} />
                  <button className="btn btn-ghost btn-sm">Unban</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

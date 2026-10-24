import Link from "next/link";
import { Search } from "lucide-react";
import { memberAction } from "@/app/admin/server/actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import type { GuildMember, GuildRole } from "@/lib/discordServer";
import { Avatar, Back, Dot, ErrorBox, Section, serverHref } from "./ui";

const TIMEOUTS = [
  { m: 1, label: "60 seconds" }, { m: 5, label: "5 minutes" }, { m: 10, label: "10 minutes" },
  { m: 60, label: "1 hour" }, { m: 1440, label: "1 day" }, { m: 10080, label: "1 week" }, { m: 40320, label: "28 days" },
];

const shown = (m: GuildMember) => m.nick ?? m.globalName ?? m.username;

export function Members({ members, roles, q, selected, memberError }: {
  members: GuildMember[] | null; roles: GuildRole[]; q: string; selected: GuildMember | null; memberError: string | null;
}) {
  const byId = new Map(roles.map((r) => [r.id, r]));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0">
        <form className="mb-3 flex gap-2">
          <input type="hidden" name="tab" value="members" />
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[#949ba4]" />
            <input name="q" defaultValue={q} placeholder="Search members (username starts with…)" className="dc-input !pl-8" />
          </label>
          <button className="dc-btn dc-btn-grey">Search</button>
        </form>
        {members == null ? null : members.length === 0 ? (
          <p className="dc-sub py-6 text-center">{q ? "No member matches." : "No members."}</p>
        ) : (
          <>
            <h3 className="dc-h mb-1.5">{q ? `Results — ${members.length}` : `Members — ${members.length}${members.length === 100 ? " (first 100, search for others)" : ""}`}</h3>
            <ul className="space-y-0.5">
              {members.map((m) => {
                const top = m.roles.map((id) => byId.get(id)).filter((r): r is GuildRole => r != null).sort((a, b) => b.position - a.position);
                const color = top.find((r) => r.color)?.color;
                return (
                  <li key={m.id}>
                    <Link href={serverHref({ tab: "members", q, m: m.id })} className={`dc-row flex items-center gap-3 px-2 py-1.5 ${selected?.id === m.id ? "is-on" : ""}`}>
                      <Avatar src={m.avatar} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium" style={{ color: color ? `#${color.toString(16).padStart(6, "0")}` : "#f2f3f5" }}>
                          {shown(m)}
                          {m.bot && <span className="dc-badge ml-1.5 bg-[#5865f2] text-white">app</span>}
                          {m.owner && <span className="ml-1.5" title="Server owner">👑</span>}
                        </span>
                        <span className="block truncate text-xs text-[#949ba4]">{m.username}{top.length ? ` · ${top.length} role${top.length > 1 ? "s" : ""}` : ""}</span>
                      </span>
                      {m.timeoutUntil && <span className="dc-badge bg-[#f0b232]/20 text-[#f0b232]">timeout</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="min-w-0">
        {memberError ? <ErrorBox>{memberError}</ErrorBox>
          : selected ? <MemberPanel m={selected} roles={roles} back={serverHref({ tab: "members", q, m: selected.id })} />
          : <p className="dc-sub py-10 text-center">Pick a member to manage them.</p>}
      </div>
    </div>
  );
}

function Hidden({ m, op, back }: { m: GuildMember; op: string; back: string }) {
  return (
    <>
      <input type="hidden" name="user" value={m.id} />
      <input type="hidden" name="name" value={m.username} />
      <input type="hidden" name="op" value={op} />
      <Back to={back} />
    </>
  );
}

function MemberPanel({ m, roles, back }: { m: GuildMember; roles: GuildRole[]; back: string }) {
  const has = new Set(m.roles);
  const untouchable = m.owner;
  return (
    <div className="dc-card overflow-hidden">
      <div className="h-16 bg-[#5865f2]/60" />
      <div className="px-4 pb-4">
        <div className="-mt-9 flex items-end gap-3">
          <span className="rounded-full border-[6px] border-[#2b2d31]"><Avatar src={m.avatar} size={72} /></span>
          <div className="pb-1">
            <p className="text-lg font-semibold leading-tight text-[#f2f3f5]">{shown(m)} {m.owner && <span title="Server owner">👑</span>}</p>
            <p className="text-sm text-[#b5bac1]">{m.username}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[#949ba4]">
          Member since {m.joined_at.slice(0, 10)} · ID {m.id}
          {m.timeoutUntil && <> · <span className="text-[#f0b232]">timed out until {m.timeoutUntil.slice(0, 16).replace("T", " ")} UTC</span></>}
          {m.mute && <> · server muted</>}{m.deaf && <> · server deafened</>}
        </p>
        {untouchable && <p className="mt-3 rounded-[4px] bg-[#f0b232]/15 px-3 py-2 text-sm text-[#f0b232]">This is the server owner: Discord doesn&apos;t let anyone change them.</p>}

        <div className="mt-5 space-y-5">
          <Section title="Nickname">
            <form action={memberAction} className="flex gap-2">
              <Hidden m={m} op="nick" back={back} />
              <input name="nick" defaultValue={m.nick ?? ""} maxLength={32} placeholder={m.globalName ?? m.username} className="dc-input" disabled={untouchable} />
              <button className="dc-btn" disabled={untouchable}>Save</button>
            </form>
            <p className="mt-1 text-xs text-[#949ba4]">Empty = reset to their own name.</p>
          </Section>

          <Section title="Roles">
            <form action={memberAction}>
              <Hidden m={m} op="roles" back={back} />
              <div className="grid gap-1 sm:grid-cols-2">
                {roles.map((r) => (
                  <label key={r.id} className={`dc-row flex items-center gap-2 px-2 py-1.5 ${r.locked ? "opacity-50" : "cursor-pointer"}`} title={r.locked ? "The bot can't give or remove this role" : undefined}>
                    <input type="checkbox" name="roles" value={r.id} defaultChecked={has.has(r.id)} disabled={r.locked} className="size-4 accent-[#5865f2]" />
                    <Dot color={r.color} size={10} />
                    <span className="truncate text-sm">{r.name}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="dc-btn dc-btn-green">Save roles</button>
              </div>
            </form>
            <form action={memberAction} className="mt-2">
              <Hidden m={m} op="clearroles" back={back} />
              <ConfirmButton title="Remove all roles?" body={<>Take every role the bot can manage from <b>{m.username}</b>.</>} confirmLabel="Remove all" danger className="dc-btn dc-btn-grey dc-btn-sm">
                Remove all roles
              </ConfirmButton>
            </form>
          </Section>

          <Section title="Timeout">
            <div className="flex flex-wrap gap-2">
              <form action={memberAction} className="flex gap-2">
                <Hidden m={m} op="timeout" back={back} />
                <select name="minutes" defaultValue="60" className="dc-input !w-auto" disabled={untouchable}>
                  {TIMEOUTS.map((t) => <option key={t.m} value={t.m}>{t.label}</option>)}
                </select>
                <button className="dc-btn dc-btn-grey" disabled={untouchable}>Timeout</button>
              </form>
              {m.timeoutUntil && (
                <form action={memberAction}>
                  <Hidden m={m} op="untimeout" back={back} />
                  <button className="dc-btn">Remove timeout</button>
                </form>
              )}
            </div>
            <p className="mt-1 text-xs text-[#949ba4]">They can&apos;t chat, react or talk in voice until it ends.</p>
          </Section>

          <Section title="Voice">
            <div className="flex flex-wrap gap-2">
              {([["mute", "unmute", m.mute, "Server mute", "Unmute"], ["deafen", "undeafen", m.deaf, "Server deafen", "Undeafen"]] as const).map(([on, off, active, a, b]) => (
                <form key={on} action={memberAction}>
                  <Hidden m={m} op={active ? off : on} back={back} />
                  <button className={`dc-btn ${active ? "" : "dc-btn-grey"}`} disabled={untouchable}>{active ? b : a}</button>
                </form>
              ))}
              <form action={memberAction}>
                <Hidden m={m} op="disconnect" back={back} />
                <button className="dc-btn dc-btn-grey" disabled={untouchable}>Disconnect</button>
              </form>
            </div>
            <p className="mt-1 text-xs text-[#949ba4]">Only works while they&apos;re in a voice channel.</p>
          </Section>

          {!untouchable && (
            <Section title="Danger zone">
              <div className="flex flex-wrap items-center gap-2">
                <form action={memberAction}>
                  <Hidden m={m} op="kick" back={back} />
                  <ConfirmButton title={`Kick ${m.username}?`} body="They're removed from the server and can rejoin with an invite." confirmLabel="Kick" danger className="dc-btn dc-btn-red">
                    Kick
                  </ConfirmButton>
                </form>
                <form action={memberAction} className="flex gap-2">
                  <Hidden m={m} op="ban" back={back} />
                  <select name="days" defaultValue="0" className="dc-input !w-auto" aria-label="Delete their messages">
                    <option value="0">Keep messages</option>
                    <option value="1">Delete last 24h</option>
                    <option value="7">Delete last 7 days</option>
                  </select>
                  <ConfirmButton title={`Ban ${m.username}?`} body="They're removed and can't rejoin until you unban them (Bans tab)." confirmLabel="Ban" danger className="dc-btn dc-btn-red">
                    Ban
                  </ConfirmButton>
                </form>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

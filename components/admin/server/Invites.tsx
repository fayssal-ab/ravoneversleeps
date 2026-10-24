import { createInviteAction, memberAction, revokeInviteAction } from "@/app/admin/server/actions";
import type { GuildChannel, GuildInvite } from "@/lib/discordServer";
import { Avatar, Back, ErrorBox, OkBox, Section, serverHref } from "./ui";

export function Invites({ invites, invitesError, channels, created }: {
  invites: GuildInvite[] | null; invitesError: string | null; channels: GuildChannel[]; created: string | null;
}) {
  const text = channels.filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position);
  return (
    <div className="space-y-6">
      <Section title="Create invite">
        <p className="mb-3 text-sm text-[#b5bac1]">
          A bot can&apos;t add someone to the server by itself: send them a link. Anyone who signs in with Discord on the site joins automatically.
        </p>
        {created && (
          <div className="mb-3"><OkBox>New invite: <a href={created} target="_blank" rel="noreferrer" className="font-mono font-semibold underline">{created}</a></OkBox></div>
        )}
        <form action={createInviteAction} className="flex flex-wrap items-end gap-2">
          <Back to={serverHref({ tab: "invites" })} />
          <label>
            <span className="dc-h mb-1.5 block">Channel</span>
            <select name="channel" defaultValue="" className="dc-input !w-auto">
              <option value="">Default (welcome channel)</option>
              {text.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="dc-h mb-1.5 block">Expire after</span>
            <select name="days" defaultValue="7" className="dc-input !w-auto">
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="0">Never</option>
            </select>
          </label>
          <label>
            <span className="dc-h mb-1.5 block">Max uses</span>
            <select name="uses" defaultValue="0" className="dc-input !w-auto">
              {[0, 1, 5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n === 0 ? "No limit" : `${n} use${n > 1 ? "s" : ""}`}</option>)}
            </select>
          </label>
          <button className="dc-btn">Create link</button>
        </form>
      </Section>

      <Section title={`Active invites${invites ? ` — ${invites.length}` : ""}`}>
        {invitesError ? <ErrorBox>{invitesError}</ErrorBox> : !invites?.length ? <p className="dc-sub">No active invites.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="dc-h text-left"><th className="py-2 pr-3">Code</th><th className="pr-3">Channel</th><th className="pr-3">Inviter</th><th className="pr-3">Uses</th><th className="pr-3">Expires</th><th /></tr></thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.code} className="border-t dc-divider">
                    <td className="py-2 pr-3 font-mono text-[#f2f3f5]">{i.code}</td>
                    <td className="pr-3">#{i.channel}</td>
                    <td className="pr-3">{i.inviter ?? "—"}</td>
                    <td className="pr-3">{i.uses}{i.maxUses ? ` / ${i.maxUses}` : ""}</td>
                    <td className="whitespace-nowrap pr-3">{i.expires ? i.expires.slice(0, 16).replace("T", " ") : "Never"}</td>
                    <td className="text-right">
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="code" value={i.code} />
                        <Back to={serverHref({ tab: "invites" })} />
                        <button className="dc-btn dc-btn-red dc-btn-sm">Revoke</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

export function Bans({ bans }: { bans: { id: string; username: string; avatar: string; reason: string | null }[] }) {
  return (
    <Section title={`Bans — ${bans.length}`}>
      {bans.length === 0 ? <p className="dc-sub">Nobody is banned.</p> : (
        <ul className="space-y-0.5">
          {bans.map((b) => (
            <li key={b.id} className="dc-row flex items-center gap-3 px-2 py-2">
              <Avatar src={b.avatar} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[#f2f3f5]">{b.username}</span>
                <span className="block truncate text-xs text-[#949ba4]">{b.reason ?? "No reason given"}</span>
              </span>
              <form action={memberAction}>
                <input type="hidden" name="user" value={b.id} />
                <input type="hidden" name="name" value={b.username} />
                <input type="hidden" name="op" value="unban" />
                <Back to={serverHref({ tab: "bans" })} />
                <button className="dc-btn dc-btn-grey dc-btn-sm">Revoke ban</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

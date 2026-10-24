import Link from "next/link";
import { Ban, Hash, LayoutGrid, Link2, ShieldCheck, Users } from "lucide-react";
import { Channels } from "@/components/admin/server/Channels";
import { Bans, Invites } from "@/components/admin/server/Invites";
import { Members } from "@/components/admin/server/Members";
import { Overview } from "@/components/admin/server/Overview";
import { Roles } from "@/components/admin/server/Roles";
import { ErrorBox, OkBox, serverHref, settle } from "@/components/admin/server/ui";
import { ERROR_TEXT } from "@/lib/errors";
import { requireOwner } from "@/lib/admin";
import { discordBotEnabled } from "@/lib/discordBot";
import { guildBans, guildChannels, guildInfo, guildInvites, guildMember, guildMembers, guildRoles, isSnowflake, type GuildInfo } from "@/lib/discordServer";

// Owner only (yuuukine): Ravo's Discord server, laid out like Discord's
// own Server Settings. Every change goes through the bot.

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "roles", label: "Roles", icon: ShieldCheck },
  { key: "members", label: "Members", icon: Users },
  { key: "channels", label: "Channels", icon: Hash },
  { key: "invites", label: "Invites", icon: Link2 },
  { key: "bans", label: "Bans", icon: Ban },
] as const;
type Tab = (typeof TABS)[number]["key"];

const OK_TEXT: Record<string, string> = {
  "server.rename": "Server renamed.",
  "server.role.create": "Role created.",
  "server.role.edit": "Role saved.",
  "server.role.delete": "Role deleted.",
  "server.role.move": "Role moved.",
  "server.member.nick": "Nickname changed.",
  "server.member.timeout": "Member timed out.",
  "server.member.untimeout": "Timeout removed.",
  "server.member.mute": "Server muted.",
  "server.member.unmute": "Unmuted.",
  "server.member.deafen": "Server deafened.",
  "server.member.undeafen": "Undeafened.",
  "server.member.disconnect": "Disconnected from voice.",
  "server.member.roles": "Roles saved.",
  "server.member.clearroles": "All roles removed.",
  "server.member.kick": "Member kicked.",
  "server.member.ban": "Member banned.",
  "server.member.unban": "Ban revoked.",
  "server.channel.create": "Channel created.",
  "server.channel.edit": "Channel saved.",
  "server.channel.delete": "Channel deleted.",
  "server.invite": "Invite created.",
  "server.invite.revoke": "Invite revoked.",
};

export default async function AdminServer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireOwner();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const q = (sp.q ?? "").slice(0, 100);

  if (!discordBotEnabled()) {
    return <div className="dc p-6"><ErrorBox>The bot isn&apos;t set up: add DISCORD_BOT_TOKEN, then check <Link href="/admin/discord" className="underline">Discord</Link>.</ErrorBox></div>;
  }

  const info = await settle(guildInfo());
  const okText = sp.ok === "server.channel.clear" ? `Deleted ${Number(sp.deleted) || 0} message${Number(sp.deleted) === 1 ? "" : "s"}.` : sp.ok ? OK_TEXT[sp.ok] ?? "Done." : null;

  return (
    <div className="dc grid min-h-[70vh] md:grid-cols-[13.5rem_1fr]">
      <aside className="dc-side p-3 md:py-5">
        <p className="dc-h truncate px-2.5 pb-2">{info.data?.name ?? "Server"}</p>
        <nav className="flex gap-0.5 overflow-x-auto md:flex-col" aria-label="Server settings">
          {TABS.map((t) => (
            <Link key={t.key} href={serverHref({ tab: t.key === "overview" ? undefined : t.key })} aria-current={tab === t.key ? "page" : undefined} className={`dc-tab ${tab === t.key ? "is-on" : ""}`}>
              <t.icon className="size-4 shrink-0" /> {t.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 hidden px-2.5 text-xs leading-relaxed text-[#949ba4] md:block">Only you see this page. Changes show in Discord&apos;s audit log as &ldquo;RAVO admin&rdquo;.</p>
      </aside>

      <main className="min-w-0 p-4 sm:p-6">
        {(okText || sp.error) && (
          <div className="mb-5">
            {sp.error
              ? <ErrorBox>{ERROR_TEXT[sp.error] ?? ERROR_TEXT.unexpected}{sp.detail && <span className="opacity-80"> {sp.detail}</span>}</ErrorBox>
              : <OkBox>{okText}</OkBox>}
          </div>
        )}
        {info.error ? <ErrorBox>{info.error}</ErrorBox> : <TabBody tab={tab} sp={sp} q={q} info={info.data!} />}
      </main>
    </div>
  );
}

async function TabBody({ tab, sp, q, info }: { tab: Tab; sp: Record<string, string | undefined>; q: string; info: GuildInfo }) {
  switch (tab) {
    case "overview":
      return <Overview info={info} />;
    case "roles": {
      const roles = await settle(guildRoles());
      return roles.error ? <ErrorBox>{roles.error}</ErrorBox> : <Roles roles={roles.data!} selected={sp.role} />;
    }
    case "members": {
      const m = sp.m && isSnowflake(sp.m) ? sp.m : null;
      const [members, roles, selected] = await Promise.all([settle(guildMembers(q)), settle(guildRoles()), m ? settle(guildMember(m)) : null]);
      if (roles.error) return <ErrorBox>{roles.error}</ErrorBox>;
      return (
        <>
          {members.error && <div className="mb-4"><ErrorBox>{members.error}</ErrorBox></div>}
          <Members members={members.data} roles={roles.data!} q={q} selected={selected?.data ?? null} memberError={selected?.error ?? null} />
        </>
      );
    }
    case "channels": {
      const channels = await settle(guildChannels());
      return channels.error ? <ErrorBox>{channels.error}</ErrorBox> : <Channels channels={channels.data!} selected={sp.c} />;
    }
    case "invites": {
      const [invites, channels] = await Promise.all([settle(guildInvites()), settle(guildChannels())]);
      const created = sp.invite && /^https:\/\/discord\.gg\/[\w-]+$/.test(sp.invite) ? sp.invite : null;
      return <Invites invites={invites.data} invitesError={invites.error} channels={channels.data ?? []} created={created} />;
    }
    case "bans": {
      const bans = await settle(guildBans());
      return bans.error ? <ErrorBox>{bans.error}</ErrorBox> : <Bans bans={bans.data!} />;
    }
  }
}

import Link from "next/link";
import { Ban, Hash, Link2, ShieldCheck, Users } from "lucide-react";
import { renameGuildAction } from "@/app/admin/server/actions";
import type { GuildInfo } from "@/lib/discordServer";
import { Back, Section, serverHref } from "./ui";

export function Overview({ info }: { info: GuildInfo }) {
  const tiles = [
    { tab: "roles", label: "Roles", text: "Create roles and pick every permission", icon: ShieldCheck },
    { tab: "members", label: "Members", text: "Roles, nickname, timeout, voice, kick, ban", icon: Users },
    { tab: "channels", label: "Channels", text: "Create, rename, clear messages, delete", icon: Hash },
    { tab: "invites", label: "Invites", text: "Create and revoke invite links", icon: Link2 },
    { tab: "bans", label: "Bans", text: "See who's banned and unban", icon: Ban },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {info.icon
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={info.icon} alt="" width={80} height={80} className="size-20 rounded-full" />
          : <span className="grid size-20 place-items-center rounded-full bg-[#5865f2] text-2xl font-semibold text-white">{info.name.slice(0, 2)}</span>}
        <div>
          <h2 className="dc-title">{info.name}</h2>
          <p className="dc-sub mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#23a55a]" /> {info.online.toLocaleString("en")} online</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#80848e]" /> {info.members.toLocaleString("en")} members</span>
            <span>Bot: {info.botName}</span>
          </p>
        </div>
      </div>

      <Section title="Server name">
        <form action={renameGuildAction} className="flex max-w-md gap-2">
          <Back to={serverHref({})} />
          <input name="name" defaultValue={info.name} required minLength={2} maxLength={100} className="dc-input" />
          <button className="dc-btn">Save</button>
        </form>
      </Section>

      <Section title="Manage">
        <div className="grid gap-2 sm:grid-cols-2">
          {tiles.map((t) => (
            <Link key={t.tab} href={serverHref({ tab: t.tab })} className="dc-card flex items-center gap-3 p-3 transition hover:bg-[#35373c]">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#1e1f22] text-[#dbdee1]"><t.icon className="size-5" /></span>
              <span>
                <span className="block font-semibold text-[#f2f3f5]">{t.label}</span>
                <span className="block text-sm text-[#949ba4]">{t.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="So the bot can do everything">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#b5bac1]">
          <li>Server Settings → Roles: give the bot&apos;s role <b>Administrator</b> and drag it to the <b>top</b>. It can only manage roles and members below it.</li>
          <li>Discord Developer Portal → your app → Bot: turn on <b>Server Members Intent</b>, so the member list loads.</li>
          <li>Nobody, not even the bot, can kick, ban or change the server owner.</li>
        </ol>
      </Section>
    </div>
  );
}

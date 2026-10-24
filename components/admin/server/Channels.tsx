import Link from "next/link";
import { ChevronDown, Hash, Megaphone, MessagesSquare, Mic2, Plus, Volume2 } from "lucide-react";
import { clearChannelAction, createChannelAction, createInviteAction, deleteChannelAction, editChannelAction } from "@/app/admin/server/actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { CHANNEL_TYPES, type GuildChannel } from "@/lib/discordServer";
import { Back, Section, serverHref } from "./ui";

const ICON = { 0: Hash, 2: Volume2, 5: Megaphone, 13: Mic2, 15: MessagesSquare } as Record<number, typeof Hash>;
const TEXTY = new Set([0, 5]);

export function Channels({ channels, selected }: { channels: GuildChannel[]; selected?: string }) {
  const byPos = (a: GuildChannel, b: GuildChannel) => (a.type === 2) === (b.type === 2) ? a.position - b.position : a.type === 2 ? 1 : -1;
  const categories = channels.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
  const loose = channels.filter((c) => c.type !== 4 && !c.parent).sort(byPos);
  const groups = [{ cat: null as GuildChannel | null, items: loose }, ...categories.map((cat) => ({ cat, items: channels.filter((c) => c.parent === cat.id).sort(byPos) }))];
  const channel = selected && selected !== "new" ? channels.find((c) => c.id === selected) ?? null : null;
  const isNew = selected === "new";
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="dc-h">Channels — {channels.filter((c) => c.type !== 4).length}</h3>
          <Link href={serverHref({ tab: "channels", c: "new" })} className="dc-btn dc-btn-sm"><Plus className="size-3.5" /> Create</Link>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {groups.map(({ cat, items }) => (cat || items.length) ? (
            <div key={cat?.id ?? "none"}>
              {cat && (
                <Link href={serverHref({ tab: "channels", c: cat.id })} className={`dc-h flex items-center gap-1 rounded px-1 py-1 hover:text-[#dbdee1] ${cat.id === selected ? "text-white" : ""}`}>
                  <ChevronDown className="size-3" /> {cat.name}
                </Link>
              )}
              <ul className="space-y-0.5">
                {items.map((c) => {
                  const Icon = ICON[c.type] ?? Hash;
                  return (
                    <li key={c.id}>
                      <Link href={serverHref({ tab: "channels", c: c.id })} className={`dc-row flex items-center gap-1.5 px-2 py-1.5 text-[#949ba4] ${c.id === selected ? "is-on !text-white" : "hover:text-[#dbdee1]"}`}>
                        <Icon className="size-4 shrink-0" /> <span className="truncate font-medium">{c.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null)}
        </div>
      </div>

      <div className="min-w-0">
        {isNew ? <NewChannel categories={categories} />
          : channel ? <ChannelEditor c={channel} key={channel.id} />
          : <p className="dc-sub py-10 text-center">Pick a channel to edit it, or create a new one.</p>}
      </div>
    </div>
  );
}

function NewChannel({ categories }: { categories: GuildChannel[] }) {
  return (
    <form action={createChannelAction} className="max-w-lg space-y-5">
      <Back to={serverHref({ tab: "channels" })} />
      <h2 className="dc-title">Create channel</h2>
      <fieldset>
        <legend className="dc-h mb-2">Channel type</legend>
        <div className="space-y-2">
          {([[0, Hash, "Text", "Send messages, images, GIFs, emoji, opinions and puns"], [2, Volume2, "Voice", "Hang out together with voice, video and screen share"], [4, ChevronDown, "Category", "A folder that groups channels"]] as const).map(([t, Icon, label, desc]) => (
            <label key={t} className="dc-card flex cursor-pointer items-center gap-3 px-3 py-2.5 has-[:checked]:bg-[#404249]">
              <Icon className="size-5 shrink-0 text-[#b5bac1]" />
              <span className="flex-1"><span className="block font-medium text-[#f2f3f5]">{label}</span><span className="block text-xs text-[#949ba4]">{desc}</span></span>
              <input type="radio" name="type" value={t} defaultChecked={t === 0} className="size-4 accent-[#5865f2]" />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="dc-h mb-2 block">Channel name</span>
        <input name="name" required maxLength={100} placeholder="new-channel" className="dc-input" />
      </label>
      <label className="block">
        <span className="dc-h mb-2 block">Category</span>
        <select name="parent" className="dc-input" defaultValue="">
          <option value="">No category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <button className="dc-btn">Create channel</button>
    </form>
  );
}

function ChannelEditor({ c }: { c: GuildChannel }) {
  const here = serverHref({ tab: "channels", c: c.id });
  const kind = CHANNEL_TYPES[c.type] ?? "Channel";
  return (
    <div className="space-y-6">
      <h2 className="dc-title">{TEXTY.has(c.type) ? "#" : ""}{c.name} <span className="dc-sub">· {kind}</span></h2>

      <Section title="Overview">
        <form action={editChannelAction} className="max-w-lg space-y-3">
          <input type="hidden" name="channel" value={c.id} />
          <input type="hidden" name="type" value={c.type} />
          <Back to={here} />
          <label className="block">
            <span className="dc-h mb-2 block">{c.type === 4 ? "Category name" : "Channel name"}</span>
            <input name="name" defaultValue={c.name} required maxLength={100} className="dc-input" />
          </label>
          {TEXTY.has(c.type) && (
            <label className="block">
              <span className="dc-h mb-2 block">Channel topic</span>
              <textarea name="topic" defaultValue={c.topic ?? ""} maxLength={1024} rows={3} placeholder="Let everyone know how to use this channel!" className="dc-input" />
            </label>
          )}
          <button className="dc-btn dc-btn-green">Save changes</button>
        </form>
      </Section>

      {TEXTY.has(c.type) && (
        <Section title="Clear messages">
          <form action={clearChannelAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="channel" value={c.id} />
            <input type="hidden" name="name" value={c.name} />
            <Back to={here} />
            <select name="count" defaultValue="50" className="dc-input !w-auto" aria-label="How many messages">
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>Last {n} messages</option>)}
            </select>
            <ConfirmButton title="Clear messages?" body={<>Delete the latest messages in <b>#{c.name}</b>. Discord only lets bots delete messages younger than 14 days.</>} confirmLabel="Delete" danger className="dc-btn dc-btn-red">
              Clear
            </ConfirmButton>
          </form>
        </Section>
      )}

      {c.type !== 4 && (
        <Section title="Invite">
          <form action={createInviteAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="channel" value={c.id} />
            <input type="hidden" name="days" value="7" />
            <input type="hidden" name="uses" value="0" />
            <button className="dc-btn dc-btn-grey">Create an invite to this channel (7 days)</button>
          </form>
        </Section>
      )}

      <Section title="Delete">
        <form action={deleteChannelAction}>
          <input type="hidden" name="channel" value={c.id} />
          <input type="hidden" name="name" value={c.name} />
          <Back to={here} />
          <ConfirmButton title={`Delete ${kind.toLowerCase()}?`} body={<>Delete <b>{c.name}</b>{c.type === 4 ? " (its channels stay, without a category)" : " and all its messages"}? This can&apos;t be undone.</>} confirmLabel="Delete" danger className="dc-btn dc-btn-red">
            Delete {kind.toLowerCase()}
          </ConfirmButton>
        </form>
      </Section>
    </div>
  );
}

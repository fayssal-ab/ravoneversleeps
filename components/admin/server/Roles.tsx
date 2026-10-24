import Link from "next/link";
import { ChevronDown, ChevronUp, Lock, Plus } from "lucide-react";
import { createRoleAction, deleteRoleAction, moveRoleAction, saveRoleAction } from "@/app/admin/server/actions";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PERMISSIONS, type GuildRole } from "@/lib/discordServer";
import { Back, colorInput, Dot, Section, serverHref, SwitchRow } from "./ui";

/** A new role starts like Discord's default: chat and voice, nothing more. */
const DEFAULT_NEW = new Set(["VIEW_CHANNEL", "CREATE_INSTANT_INVITE", "CHANGE_NICKNAME", "SEND_MESSAGES", "SEND_MESSAGES_IN_THREADS",
  "CREATE_PUBLIC_THREADS", "CREATE_PRIVATE_THREADS", "EMBED_LINKS", "ATTACH_FILES", "ADD_REACTIONS", "USE_EXTERNAL_EMOJIS",
  "USE_EXTERNAL_STICKERS", "READ_MESSAGE_HISTORY", "SEND_VOICE_MESSAGES", "SEND_POLLS", "USE_APPLICATION_COMMANDS",
  "CONNECT", "SPEAK", "STREAM", "USE_SOUNDBOARD", "USE_EXTERNAL_SOUNDS", "USE_VAD", "CREATE_EVENTS"]);

export function Roles({ roles, selected }: { roles: GuildRole[]; selected?: string }) {
  const role = selected && selected !== "new" ? roles.find((r) => r.id === selected) ?? null : null;
  const isNew = selected === "new";
  const here = serverHref({ tab: "roles", role: selected });
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="dc-h">Roles — {roles.length}</h3>
          <Link href={serverHref({ tab: "roles", role: "new" })} className="dc-btn dc-btn-sm"><Plus className="size-3.5" /> Create</Link>
        </div>
        <ul className="space-y-0.5">
          {roles.map((r, i) => (
            <li key={r.id} className={`dc-row flex items-center gap-1 pr-1 ${r.id === selected ? "is-on" : ""}`}>
              <Link href={serverHref({ tab: "roles", role: r.id })} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
                <Dot color={r.color} />
                <span className="truncate font-medium" style={{ color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : undefined }}>{r.name}</span>
                {r.locked && <Lock className="size-3 shrink-0 text-[#949ba4]" aria-label="Locked" />}
              </Link>
              {!r.locked && (
                <span className="flex shrink-0">
                  {(["up", "down"] as const).map((dir) => {
                    const other = roles[dir === "up" ? i - 1 : i + 1];
                    const can = other && !other.locked;
                    return (
                      <form key={dir} action={moveRoleAction}>
                        <input type="hidden" name="role" value={r.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <Back to={here} />
                        <button disabled={!can} className="rounded p-0.5 text-[#949ba4] hover:text-white disabled:opacity-25" aria-label={`Move ${r.name} ${dir}`}>
                          {dir === "up" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </form>
                    );
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#949ba4]">Higher roles win. <Lock className="inline size-3" /> = a bot role or above the bot: it can&apos;t change those.</p>
      </div>

      <div className="min-w-0">
        {!role && !isNew ? (
          <p className="dc-sub py-10 text-center">Pick a role to edit it, or create a new one.</p>
        ) : (
          <RoleEditor role={role} key={role?.id ?? "new"} />
        )}
      </div>
    </div>
  );
}

function RoleEditor({ role }: { role: GuildRole | null }) {
  const locked = role?.locked ?? false;
  const bits = role ? BigInt(role.permissions) : 0n;
  const has = (key: string, bit: number) => (role ? (bits & (1n << BigInt(bit))) !== 0n : DEFAULT_NEW.has(key));
  const here = serverHref({ tab: "roles", role: role?.id ?? "new" });
  return (
    <div>
      <form action={role ? saveRoleAction : createRoleAction} className="space-y-6">
        {role && <input type="hidden" name="role" value={role.id} />}
        <Back to={here} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="dc-title">{role ? `Edit role — ${role.name}` : "Create role"}</h2>
          {!locked && <button className="dc-btn dc-btn-green">{role ? "Save changes" : "Create role"}</button>}
        </div>
        {locked && <p className="rounded-[4px] bg-[#f0b232]/15 px-3 py-2 text-sm text-[#f0b232]">{role?.managed ? "This role belongs to a bot: Discord manages it." : "This role is at or above the bot's role. Drag the bot's role above it in Discord to edit it here."}</p>}

        <Section title="Display">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="dc-h mb-2 block">Role name <span className="text-[#da373c]">*</span></span>
              <input name="name" defaultValue={role?.name ?? "new role"} required maxLength={100} disabled={locked} className="dc-input" />
            </label>
            <label className="block">
              <span className="dc-h mb-2 block">Color</span>
              <input name="color" type="color" defaultValue={colorInput(role?.color ?? 0)} disabled={locked} className="h-[42px] w-20 cursor-pointer rounded-[4px] border-0 bg-[#1e1f22] p-1" />
            </label>
          </div>
          <div className="mt-2">
            <SwitchRow name="hoist" label="Display role members separately from online members" checked={role?.hoist ?? false} disabled={locked} />
            <SwitchRow name="mentionable" label="Allow anyone to @mention this role" checked={role?.mentionable ?? false} disabled={locked} />
          </div>
        </Section>

        {PERMISSIONS.map((g) => (
          <Section key={g.group} title={`${g.group} permissions`}>
            {g.items.map((p) => <SwitchRow key={p.key} name={`perm_${p.key}`} label={p.name} desc={p.desc} checked={has(p.key, p.bit)} disabled={locked} />)}
          </Section>
        ))}

        {!locked && (
          <div className="sticky bottom-0 -mx-1 flex justify-end rounded-[6px] bg-[#111214]/95 p-2.5">
            <button className="dc-btn dc-btn-green">{role ? "Save changes" : "Create role"}</button>
          </div>
        )}
      </form>

      {role && !locked && (
        <form action={deleteRoleAction} className="mt-6 border-t dc-divider pt-5">
          <input type="hidden" name="role" value={role.id} />
          <input type="hidden" name="name" value={role.name} />
          <Back to={here} />
          <ConfirmButton title="Delete role?" body={<>Delete <b>{role.name}</b>? Everyone with it loses it. This can&apos;t be undone.</>} confirmLabel="Delete" danger className="dc-btn dc-btn-red">
            Delete role
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}

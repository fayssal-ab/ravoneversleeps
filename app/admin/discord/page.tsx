import { CheckCircle2, XCircle } from "lucide-react";
import { AdminTitle, Card } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { discordBotEnabled, discordSetup, type DiscordSetup } from "@/lib/discordBot";
import { providerConfig } from "@/lib/userAuth";
import { discordSetupAction } from "../actions";

const ERRORS: Record<string, string> = {
  discord_401: "The bot token is wrong (Discord says unauthorized). Reset it in the Developer Portal → Bot and update DISCORD_BOT_TOKEN.",
  discord_403: "The bot is missing permissions in the server. Give it Administrator, or re-invite it with View Channels, Manage Channels, Manage Roles, Send Messages, Embed Links, Attach Files, Read Message History, Create Invite.",
  discord_404: "The server ID (DISCORD_GUILD_ID) is wrong, or the bot isn't in that server.",
  bot_not_in_server: "The bot isn't in any server yet. Invite it with the OAuth2 → URL Generator link (scope: bot).",
  bot_in_several_servers: "The bot is in more than one server. Set DISCORD_GUILD_ID to Ravo's server ID.",
};

function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-neon" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
      <span className="w-40 shrink-0 text-sm text-muted">{label}</span>
      <span className="min-w-0 text-sm">{value}</span>
    </li>
  );
}

export default async function AdminDiscord({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const login = providerConfig("discord") != null;
  let s: DiscordSetup | null = null;
  let error: string | null = null;
  if (discordBotEnabled()) {
    try { s = await discordSetup(); } catch (e) { error = e instanceof Error ? e.message : "unknown"; }
  }

  return (
    <>
      <AdminTitle title="Discord">
        Sign-in with Discord and the ticket bot. The bot uses its server and the private <b>Tickets</b> category and
        <b> Staff</b> role (found by ID or name, created if missing). Give the Staff role to the people who verify.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Setup checked." />
      <Card title="Status">
        <ul className="divide-y divide-white/5">
          <Row ok={login} label="Discord sign-in" value={login ? "Client ID and secret set" : "Set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET"} />
          <Row ok={discordBotEnabled()} label="Bot token" value={discordBotEnabled() ? "DISCORD_BOT_TOKEN set" : "Set DISCORD_BOT_TOKEN"} />
          {s && (
            <>
              <Row ok label="Bot" value={s.botName} />
              <Row ok label="Server" value={s.guildName} />
              <Row ok label="Tickets category" value={s.categoryCreated ? "Created just now (private)" : "Ready"} />
              <Row ok label="Staff role" value={s.staffCreated ? "Created just now: give it to your mods" : "Ready"} />
            </>
          )}
        </ul>
        {error && <p className="mt-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{ERRORS[error] ?? `Discord error: ${error}`}</p>}
        <form action={discordSetupAction} className="mt-4">
          <button className="btn btn-neon btn-sm" disabled={!discordBotEnabled()}>Run setup again</button>
        </form>
      </Card>
    </>
  );
}

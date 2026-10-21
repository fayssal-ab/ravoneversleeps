import { createPublicKey, verify } from "node:crypto";
import { appPublicKey, deleteChannel, discordErrorText, discordSetup, postInTicket, renameTicket, ticketButtons } from "@/lib/discordBot";
import { forgetTicket } from "@/lib/tickets";

// Discord Interactions Endpoint (set by Admin → Discord → "Run setup"): the
// Claim / Delete buttons under every ticket's first message land here.
// Only staff (the Staff role or server admins) can use them, and only on
// the bot's own messages inside the Tickets category. Discord wants an
// answer within 3 s, so the work is short and best effort.
export const dynamic = "force-dynamic";

const ADMINISTRATOR = 1n << 3n;
const EPHEMERAL = 64;

interface Interaction {
  type: number;
  data?: { custom_id?: string };
  member?: { user: { id: string; username: string; global_name?: string | null }; roles: string[]; permissions: string };
  channel_id?: string;
  channel?: { parent_id?: string | null };
  message?: { id: string; author?: { id: string } };
}

const reply = (data: object) => Response.json(data);
const whisper = (content: string) => reply({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

async function signed(request: Request, body: string): Promise<boolean> {
  const sig = request.headers.get("x-signature-ed25519"), ts = request.headers.get("x-signature-timestamp");
  if (!sig || !ts || !/^[0-9a-f]{128}$/i.test(sig)) return false;
  try {
    const raw = Buffer.from(await appPublicKey(), "hex");
    // raw 32-byte Ed25519 key → SPKI DER
    const key = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]), format: "der", type: "spki" });
    return verify(null, Buffer.from(ts + body), key, Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

/** Staff role + category straight from env when set (no Discord calls on a cold start). */
async function ids(): Promise<{ staffRoleId: string; categoryId: string; botId: string | null }> {
  const staff = process.env.DISCORD_STAFF_ROLE_ID, category = process.env.DISCORD_TICKET_CATEGORY_ID;
  if (staff && category) return { staffRoleId: staff, categoryId: category, botId: null };
  const s = await discordSetup();
  return { staffRoleId: s.staffRoleId, categoryId: s.categoryId, botId: s.botId };
}

export async function POST(request: Request) {
  const body = await request.text();
  if (!(await signed(request, body))) return new Response("invalid request signature", { status: 401 });
  const i = JSON.parse(body) as Interaction;
  if (i.type === 1) return reply({ type: 1 }); // PING (Discord checking the endpoint)
  if (i.type !== 3 || !i.member || !i.channel_id) return whisper("Unsupported.");

  const id = i.data?.custom_id ?? "";
  const { staffRoleId, categoryId, botId } = await ids();
  const staff = i.member.roles.includes(staffRoleId) || (BigInt(i.member.permissions || "0") & ADMINISTRATOR) !== 0n;
  if (!staff) return whisper("Only the team can use these buttons. Post your proof here and a staff member will handle it.");
  if (i.channel?.parent_id && i.channel.parent_id !== categoryId) return whisper("This isn't a ticket.");
  if (botId && i.message?.author?.id && i.message.author.id !== botId) return whisper("This isn't a ticket.");
  const name = i.member.user.global_name || i.member.user.username;

  try {
    if (id === "ticket:claim") {
      await Promise.all([
        renameTicket(i.channel_id, "claimed"),
        postInTicket(i.channel_id, `🔵 **${name}** claimed this ticket and is handling it.`),
      ]);
      // swap the Claim button for "Claimed by …" on the ticket's first message
      return reply({ type: 7, data: { components: ticketButtons(name) } });
    }
    if (id === "ticket:delete") {
      return reply({
        type: 4,
        data: {
          flags: EPHEMERAL, content: "Delete this ticket for good? The channel and its messages are removed.",
          components: [{ type: 1, components: [{ type: 2, style: 4, label: "Yes, delete it", custom_id: "ticket:delete:yes", emoji: { name: "🗑️" } }] }],
        },
      });
    }
    if (id === "ticket:delete:yes") {
      await deleteChannel(i.channel_id);
      await forgetTicket(i.channel_id).catch(() => {});
      return reply({ type: 6 });
    }
  } catch (e) {
    console.error("ticket button failed", id, discordErrorText(e));
    return whisper(`That didn't work: ${discordErrorText(e)}`);
  }
  return reply({ type: 6 });
}

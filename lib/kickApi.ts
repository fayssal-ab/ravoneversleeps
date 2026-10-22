import "server-only";
import { createVerify } from "node:crypto";
import { KICK_CHANNEL } from "./constants";

// Official Kick public API (app credentials = KICK_CLIENT_ID/SECRET):
// subscribe Ravo's channel to `chat.message.sent` webhooks so `!join` is
// recorded server-side even when no admin dashboard is open. The webhook URL
// itself is set in the Kick developer app settings
// (https://<site>/api/kick/webhook).

const API = "https://api.kick.com/public/v1";
let token: { value: string; exp: number } | null = null;
let publicKey: { pem: string; at: number } | null = null;
let broadcaster: number | null = null;

async function appToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const id = process.env.KICK_CLIENT_ID;
  const secret = process.env.KICK_CLIENT_SECRET;
  if (!id || !secret) throw new Error("kick_not_configured");
  const res = await fetch("https://id.kick.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kick_token_${res.status}`);
  const d = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return token.value;
}

async function kick<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await appToken()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kick_api_${res.status}`);
  return (await res.json()) as T;
}

export async function broadcasterId(): Promise<number> {
  if (broadcaster) return broadcaster;
  const d = await kick<{ data: { broadcaster_user_id: number }[] }>(`/channels?slug=${encodeURIComponent(KICK_CHANNEL)}`);
  if (!d.data[0]) throw new Error("kick_channel_not_found");
  broadcaster = d.data[0].broadcaster_user_id;
  return broadcaster;
}

/** Make sure chat messages are delivered to our webhook. Idempotent. */
export async function ensureChatSubscription(): Promise<"exists" | "created"> {
  const id = await broadcasterId();
  const list = await kick<{ data: { event: string; broadcaster_user_id: number }[] }>("/events/subscriptions");
  if (list.data.some((s) => s.event === "chat.message.sent" && s.broadcaster_user_id === id)) return "exists";
  await kick("/events/subscriptions", {
    method: "POST",
    body: JSON.stringify({ broadcaster_user_id: id, events: [{ name: "chat.message.sent", version: 1 }], method: "webhook" }),
  });
  return "created";
}

/** A Kick-hosted https image URL, else null (Kick sends "" for the default avatar). */
export function kickImageUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "kick.com" || u.hostname.endsWith(".kick.com")) ? u.href.slice(0, 512) : null;
  } catch {
    return null;
  }
}

/** Profile pictures by Kick user id (at most 50 ids per call). */
export async function kickAvatars(ids: string[]): Promise<Map<string, string | null>> {
  const d = await kick<{ data: { user_id: number; profile_picture?: string }[] }>(`/users?${ids.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`);
  return new Map(d.data.map((u) => [String(u.user_id), kickImageUrl(u.profile_picture)]));
}

async function kickPublicKey(): Promise<string> {
  if (publicKey && Date.now() - publicKey.at < 24 * 3600_000) return publicKey.pem;
  const res = await fetch(`${API}/public-key`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error("kick_public_key");
  const pem = ((await res.json()) as { data: { public_key: string } }).data.public_key;
  publicKey = { pem, at: Date.now() };
  return pem;
}

/** RSA-SHA256 over `messageId.timestamp.body`, as documented by Kick. */
export async function verifyKickWebhook(headers: Headers, body: string): Promise<boolean> {
  const id = headers.get("kick-event-message-id");
  const ts = headers.get("kick-event-message-timestamp");
  const sig = headers.get("kick-event-signature");
  if (!id || !ts || !sig) return false;
  const v = createVerify("RSA-SHA256");
  v.update(`${id}.${ts}.${body}`);
  return v.verify(await kickPublicKey(), sig, "base64");
}

import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "./db";
import { withTx } from "./tx";
import { SITE_URL } from "./constants";

// Viewer accounts: "Continue with Kick" / "Continue with Discord", and
// linking the other provider from /account. The account holds the points
// balance and lifetime xp (rank). OAuth authorization-code flow
// (Kick additionally requires PKCE). The flow state (CSRF state, PKCE
// verifier, mode, return path) rides in a short-lived signed cookie; the
// session cookie is a random token whose SHA-256 is stored in user_sessions.

export type Provider = "kick" | "discord";
export const PROVIDERS: Provider[] = ["discord", "kick"]; // Discord first: it is the main sign-in
export const PROVIDER_NAME: Record<Provider, string> = { kick: "Kick", discord: "Discord" };
export function isProvider(v: string): v is Provider {
  return v === "kick" || v === "discord";
}

export const USER_COOKIE = "ravo_user";
export const OAUTH_COOKIE = "ravo_oauth";
const SESSION_DAYS = 30;
const STATE_TTL_SEC = 600;

export class AuthError extends Error {
  constructor(public code: string) { super(code); }
}

// ── provider config ────────────────────────────────────────────────────────
const site = () => SITE_URL.replace(/\/$/, "");
interface ProviderConfig { clientId: string; clientSecret: string; redirectUri: string }
export function providerConfig(p: Provider): ProviderConfig | null {
  const clientId = p === "kick" ? process.env.KICK_CLIENT_ID : process.env.DISCORD_CLIENT_ID;
  const clientSecret = p === "kick" ? process.env.KICK_CLIENT_SECRET : process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = (p === "kick" ? process.env.KICK_REDIRECT_URI : process.env.DISCORD_REDIRECT_URI) || `${site()}/api/auth/${p}/callback`;
  return { clientId, clientSecret, redirectUri };
}

/**
 * Origin the browser is on (Host header, which Netlify keeps public), so the
 * post-login redirect lands on the domain whose cookie was just set even if
 * NEXT_PUBLIC_SITE_URL points elsewhere. Falls back to SITE_URL.
 */
export function publicOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return site();
  const proto = process.env.NODE_ENV === "production" ? "https" : new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

// ── signed flow state ─────────────────────────────────────────────────────
export interface OAuthState { p: Provider; s: string; v: string; m: "login" | "link"; n: string; e: number }
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new AuthError("not_configured");
  return s;
}
const mac = (body: string) => createHmac("sha256", secret()).update(`ravo-oauth-v1:${body}`).digest("base64url");

export function encodeState(st: OAuthState): string {
  const body = Buffer.from(JSON.stringify(st)).toString("base64url");
  return `${body}.${mac(body)}`;
}
export function decodeState(raw: string | undefined, now = Date.now()): OAuthState | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const st = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (!isProvider(st.p) || typeof st.s !== "string" || st.e < Math.floor(now / 1000)) return null;
    return st;
  } catch { return null; }
}

/** Only same-site relative paths, never "//host" or "/\\host". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 200) return "/account";
  return next;
}

/** Authorize URL + the state cookie value to set before redirecting. */
export function beginOAuth(p: Provider, mode: "login" | "link", next: string, now = Date.now()): { url: string; state: string } {
  const cfg = providerConfig(p);
  if (!cfg) throw new AuthError("not_configured");
  const st: OAuthState = { p, s: randomBytes(24).toString("base64url"), v: randomBytes(48).toString("base64url"), m: mode, n: safeNext(next), e: Math.floor(now / 1000) + STATE_TTL_SEC };
  const q = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, state: st.s });
  let url: string;
  if (p === "kick") {
    q.set("scope", "user:read");
    q.set("code_challenge", createHash("sha256").update(st.v).digest("base64url"));
    q.set("code_challenge_method", "S256");
    url = `https://id.kick.com/oauth/authorize?${q}`;
  } else {
    // guilds.join: signing in also adds the viewer to Ravo's Discord (tickets)
    q.set("scope", "identify guilds.join");
    q.set("prompt", "none");
    url = `https://discord.com/oauth2/authorize?${q}`;
  }
  return { url, state: encodeState(st) };
}

// ── code exchange + profile ───────────────────────────────────────────────
export interface Profile { id: string; username: string; avatar: string; /** Discord only: to join the server */ accessToken?: string }

async function postForm(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new AuthError("exchange_failed");
  return (await res.json()) as Record<string, unknown>;
}
async function getJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new AuthError("profile_failed");
  return res.json();
}
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

export async function fetchProfile(st: OAuthState, code: string): Promise<Profile> {
  const cfg = providerConfig(st.p);
  if (!cfg) throw new AuthError("not_configured");
  if (st.p === "kick") {
    const tok = await postForm("https://id.kick.com/oauth/token", {
      grant_type: "authorization_code", client_id: cfg.clientId, client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri, code_verifier: st.v, code,
    });
    if (typeof tok.access_token !== "string") throw new AuthError("exchange_failed");
    const data = (await getJson("https://api.kick.com/public/v1/users", tok.access_token)) as { data?: { user_id?: number | string; name?: string; profile_picture?: string }[] };
    const u = data.data?.[0];
    if (!u?.user_id || !u.name) throw new AuthError("profile_failed");
    return { id: String(u.user_id), username: clip(u.name, 191), avatar: clip(u.profile_picture, 512) };
  }
  const tok = await postForm("https://discord.com/api/oauth2/token", {
    grant_type: "authorization_code", client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, code,
  });
  if (typeof tok.access_token !== "string") throw new AuthError("exchange_failed");
  const u = (await getJson("https://discord.com/api/users/@me", tok.access_token)) as { id?: string; username?: string; global_name?: string | null; avatar?: string | null };
  if (!u.id || !u.username) throw new AuthError("profile_failed");
  const avatar = u.avatar && /^[a-z0-9_]+$/i.test(u.avatar) ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128` : "";
  return { id: u.id, username: clip(u.global_name || u.username, 191), avatar, accessToken: tok.access_token };
}

// ── account resolution ────────────────────────────────────────────────────
/**
 * Known identity → its account (refusing when a different account is signed
 * in). New identity → attached to the signed-in account (one per provider),
 * otherwise a new account is created.
 */
export async function signInWith(p: Provider, profile: Profile, currentAccountId: number | null): Promise<number> {
  return withTx(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT account_id FROM user_identities WHERE provider = ? AND provider_user_id = ? FOR UPDATE", [p, profile.id]);
    const owner = rows[0] ? Number(rows[0].account_id) : null;
    if (owner != null) {
      if (currentAccountId != null && currentAccountId !== owner) throw new AuthError("identity_taken");
      const [ban] = await conn.query<RowDataPacket[]>("SELECT banned FROM user_accounts WHERE id = ?", [owner]);
      if (Number(ban[0]?.banned)) throw new AuthError("banned");
      await conn.query("UPDATE user_identities SET username = ?, avatar = ? WHERE provider = ? AND provider_user_id = ?", [profile.username, profile.avatar, p, profile.id]);
      await conn.query("UPDATE user_accounts SET last_login_at = CURRENT_TIMESTAMP, avatar = IF(avatar = '', ?, avatar) WHERE id = ?", [profile.avatar, owner]);
      return owner;
    }
    let accountId = currentAccountId;
    if (accountId != null) {
      const [has] = await conn.query<RowDataPacket[]>("SELECT 1 FROM user_identities WHERE account_id = ? AND provider = ? FOR UPDATE", [accountId, p]);
      if (has.length) throw new AuthError("provider_already_linked");
      await conn.query("UPDATE user_accounts SET avatar = IF(avatar = '', ?, avatar) WHERE id = ?", [profile.avatar, accountId]);
    } else {
      const [res] = await conn.query<ResultSetHeader>(
        "INSERT INTO user_accounts (display_name, avatar, last_login_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [profile.username, profile.avatar]);
      accountId = res.insertId;
    }
    await conn.query("INSERT INTO user_identities (provider, provider_user_id, account_id, username, avatar) VALUES (?, ?, ?, ?, ?)",
      [p, profile.id, accountId, profile.username, profile.avatar]);
    return accountId;
  });
}

export async function unlinkProvider(accountId: number, p: Provider): Promise<void> {
  await withTx(async (conn) => {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT provider, username, avatar FROM user_identities WHERE account_id = ? FOR UPDATE", [accountId]);
    if (!rows.some((r) => r.provider === p)) throw new AuthError("not_linked");
    if (rows.length < 2) throw new AuthError("last_identity");
    await conn.query("DELETE FROM user_identities WHERE account_id = ? AND provider = ?", [accountId, p]);
    const rest = rows.find((r) => r.provider !== p)!;
    await conn.query("UPDATE user_accounts SET display_name = ?, avatar = ? WHERE id = ?", [rest.username, rest.avatar, accountId]);
  });
}

// ── sessions ──────────────────────────────────────────────────────────────
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const sessionCookieOptions = {
  httpOnly: true, sameSite: "lax" as const, path: "/", secure: process.env.NODE_ENV === "production", maxAge: SESSION_DAYS * 86400,
};

export async function createUserSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getPool().query("INSERT INTO user_sessions (token_hash, account_id, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))",
    [hashToken(token), accountId, SESSION_DAYS]);
  // opportunistic cleanup, never blocks sign-in
  getPool().query("DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP LIMIT 200").catch(() => {});
  return token;
}

export async function destroyUserSession(token: string | undefined): Promise<void> {
  if (token) await getPool().query("DELETE FROM user_sessions WHERE token_hash = ?", [hashToken(token)]);
}

/** Account id for a session token, or null (expired / unknown). */
export async function accountForToken(token: string | undefined): Promise<number | null> {
  if (!token || token.length > 100) return null;
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT s.account_id FROM user_sessions s JOIN user_accounts a ON a.id = s.account_id
      WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP AND a.banned = 0`, [hashToken(token)]);
  return rows[0] ? Number(rows[0].account_id) : null;
}

export async function currentAccountId(): Promise<number | null> {
  return accountForToken((await cookies()).get(USER_COOKIE)?.value);
}

export const AUTH_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  state: "The sign-in link expired. Please try again.",
  not_configured: "This sign-in method isn't set up yet.",
  exchange_failed: "The provider refused the sign-in. Please try again.",
  profile_failed: "Couldn't read your profile from the provider. Please try again.",
  identity_taken: "That account is already linked to another RAVO account. Sign in with it and unlink it there first.",
  provider_already_linked: "You already have an account of that type linked. Unlink it first.",
  last_identity: "You can't unlink your only sign-in method. Link the other one first.",
  banned: "This account is suspended. Contact the team on Discord if you think it's a mistake.",
  not_linked: "That account isn't linked.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  failed: "Sign-in failed. Please try again.",
};

/** Which sign-in buttons to show (providers with credentials configured). */
export function enabledProviders(): Provider[] {
  return PROVIDERS.filter((p) => providerConfig(p) != null);
}

import "server-only";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAdminSession, verifyAdminSession } from "./adminSession";
import { logAudit } from "./audit";
import { getPool } from "./db";
import { AppError } from "./tx";
import { currentAccountId } from "./userAuth";

// Signed, expiring admin sessions. Rotating ADMIN_PASSWORD invalidates them.
export const ADMIN_COOKIE_NAME = "ravo_admin";
const ONE_WEEK = 60 * 60 * 24 * 7;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Validate a /login submission against the env credentials (timing-safe). */
export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) return false;
  // Evaluate both so timing doesn't reveal which half was wrong.
  const userOk = safeEqual(username, expectedUser);
  const passOk = safeEqual(password, expectedPass);
  return userOk && passOk;
}

export function adminCookie(): { name: string; value: string; options: Record<string, unknown> } {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not set");
  return {
    name: ADMIN_COOKIE_NAME,
    value: createAdminSession(password),
    options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: ONE_WEEK },
  };
}

// The owner: signed in on the site with this Discord or Kick account, they
// get the admin without the password, plus the owner-only pages (Server).
// Matched on the username the provider gave at their last sign-in.
const OWNER = { discord: "yuuukine", kick: "yuuukine" } as const;

/** True when the site session belongs to the owner's Discord / Kick account. */
export async function isOwner(): Promise<boolean> {
  try {
    const accountId = await currentAccountId();
    if (accountId == null) return false;
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT 1 FROM user_identities
        WHERE account_id = ? AND ((provider = 'discord' AND LOWER(username) = ?) OR (provider = 'kick' AND LOWER(username) = ?)) LIMIT 1`,
      [accountId, OWNER.discord, OWNER.kick]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function hasPasswordSession(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    return verifyAdminSession(token, process.env.ADMIN_PASSWORD ?? "");
  } catch {
    return false;
  }
}

export async function isAdminSession(): Promise<boolean> {
  return (await hasPasswordSession()) || (await isOwner());
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSession())) redirect("/login");
}

/** Owner-only pages: everyone else goes back to the dashboard. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) redirect((await isAdminSession()) ? "/admin" : "/login");
}

// Wrapper for admin Server Actions. Every action is its own POST entry point,
// so the session is checked here, not only by the /admin layout. Business
// errors come back as ?error=<code>&detail=…, shown by <Flash>.
export async function adminAction(
  opts: {
    path: string; audit: string; target?: string | number; revalidate?: string[]; ok?: string;
    /** owner-only (see requireOwner) */
    owner?: boolean;
    /** extra query on success, built from the result (e.g. a link to show) */
    more?: (result: unknown) => string;
  },
  fn: () => Promise<unknown>
): Promise<never> {
  if (opts.owner) await requireOwner();
  else await requireAdmin();
  let query: string;
  try {
    const result = await fn();
    await logAudit("admin", opts.audit, opts.target != null ? String(opts.target) : "", result ?? undefined);
    query = `ok=${encodeURIComponent(opts.ok ?? opts.audit)}${opts.more ? `&${opts.more(result)}` : ""}`;
  } catch (err) {
    if (err instanceof AppError) {
      query = `error=${encodeURIComponent(err.code)}${err.detail ? `&detail=${encodeURIComponent(err.detail.slice(0, 300))}` : ""}`;
    } else {
      console.error(`admin action ${opts.audit} failed`, err instanceof Error ? err.message : "unknown");
      query = "error=unexpected";
    }
  }
  for (const p of [opts.path, ...(opts.revalidate ?? [])]) revalidatePath(p);
  const sep = opts.path.includes("?") ? "&" : "?";
  redirect(`${opts.path}${sep}${query}`);
}

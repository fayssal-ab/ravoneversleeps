import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  AuthError, OAUTH_COOKIE, USER_COOKIE, createUserSession, currentAccountId, decodeState, fetchProfile, isProvider, publicOrigin, sessionCookieOptions, signInWith,
} from "@/lib/userAuth";
import { joinGuild } from "@/lib/discordBot";

export const dynamic = "force-dynamic";

// OAuth redirect target (register exactly this URL in the provider's app):
//   https://<site>/api/auth/kick/callback · https://<site>/api/auth/discord/callback
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const jar = await cookies();
  const st = decodeState(jar.get(OAUTH_COOKIE)?.value);
  const done = (path: string) => {
    const res = NextResponse.redirect(new URL(path, publicOrigin(request)));
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 });
    return res;
  };
  const fail = (code: string) => done(`/account?error=${code}`);

  if (!isProvider(provider)) return fail("failed");
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  if (!st || st.p !== provider || !code || url.searchParams.get("state") !== st.s) return fail("state");

  try {
    const profile = await fetchProfile(st, code);
    const current = await currentAccountId().catch(() => null);
    const accountId = await signInWith(provider, profile, current);
    // Discord: put the viewer in Ravo's server so ticket channels can reach them
    if (provider === "discord" && profile.accessToken) {
      await joinGuild(profile.id, profile.accessToken).catch((e: Error) => console.error("discord guild join failed", e.message));
    }
    const sep = st.n.includes("?") ? "&" : "?";
    const res = done(`${st.n}${sep}${current != null ? "linked" : "signed_in"}=${provider}`);
    if (current == null) res.cookies.set(USER_COOKIE, await createUserSession(accountId), sessionCookieOptions);
    return res;
  } catch (e) {
    if (!(e instanceof AuthError)) console.error("oauth callback failed", provider, e instanceof Error ? e.message : e);
    return fail(e instanceof AuthError ? e.code : "failed");
  }
}

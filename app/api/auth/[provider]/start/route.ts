import { NextResponse } from "next/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { AuthError, OAUTH_COOKIE, beginOAuth, currentAccountId, isProvider, publicOrigin, safeNext } from "@/lib/userAuth";

export const dynamic = "force-dynamic";

// GET /api/auth/kick/start?next=/account — redirects to the provider's
// consent screen. Signed in already → the new identity is linked to the
// current account; otherwise it signs in. Only Discord creates accounts
// (signInWith refuses a new Kick identity without a session).
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const back = (code: string) => NextResponse.redirect(new URL(`/account?error=${code}`, publicOrigin(request)));
  if (!isProvider(provider)) return back("failed");
  const limit = await rateLimit(`oauth:${clientIp(request)}`, 20, 300);
  if (!limit.ok) return back("rate_limited");
  try {
    const mode = (await currentAccountId().catch(() => null)) != null ? "link" : "login";
    const { url: target, state } = beginOAuth(provider, mode, next);
    const res = NextResponse.redirect(target);
    res.cookies.set(OAUTH_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth", maxAge: 600 });
    return res;
  } catch (e) {
    return back(e instanceof AuthError ? e.code : "failed");
  }
}

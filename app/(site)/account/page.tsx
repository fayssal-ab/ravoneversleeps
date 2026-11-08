import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Check, Clock, ExternalLink, LayoutDashboard, ShieldCheck, Trophy, Target, XCircle } from "lucide-react";
import { LogoutButton } from "@/components/account/LogoutButton";
import { DiscordIcon, KickIcon, LinkKickButton, SignInButtons } from "@/components/account/SignInPanel";
import { Flash } from "@/components/ui/bits";
import { getViewer } from "@/lib/account";
import { isOwner } from "@/lib/admin";
import { AUTH_MESSAGES, enabledProviders } from "@/lib/userAuth";
import { qzinoStatusOf, type QzinoState } from "@/lib/verification";
import { openQzinoTicketAction } from "../actions";
import { VerifyForm } from "@/components/account/VerifyForm";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const PERKS = [
  { icon: Target, text: "Claim slot challenges" },
  { icon: Trophy, text: "Get your Qzino username verified" },
  { icon: BadgeCheck, text: "Redeem QHub points in the store" },
];

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const providers = enabledProviders();
  const authError = sp.error && AUTH_MESSAGES[sp.error];

  if (!viewer) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <div className="panel-soft relative overflow-hidden lg:grid lg:grid-cols-[1fr_1.1fr]">
          {/* art side */}
          <div className="relative flex min-h-64 items-end justify-center overflow-hidden bg-black lg:min-h-[34rem] lg:border-r lg:border-white/[0.06]">
            <Image src="/media/claws-bg.webp" alt="" fill sizes="(min-width: 1024px) 480px, 100vw" className="object-cover opacity-70" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,rgb(141_255_74/0.25),transparent_60%)]" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#060a07] to-transparent lg:hidden" />
            <div className="relative h-56 w-52 sm:h-72 sm:w-64 lg:mb-10 lg:h-96 lg:w-80">
              <Image src="/media/ravo-mascot.webp" alt="" fill priority sizes="320px" className="animate-dance object-contain drop-shadow-[0_24px_40px_rgb(0_0_0/0.7)]" />
            </div>
          </div>

          {/* form side */}
          <div className="relative flex flex-col justify-center bg-[#060a07]/80 p-6 sm:p-10">
            <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Join the pack</p>
            <h1 className="mt-2 font-display text-5xl leading-[0.9] sm:text-6xl"><span className="chrome">Sign in</span></h1>
            <p className="mt-3 max-w-sm text-sm text-muted">One click with Discord. Your account unlocks everything on RAVO:</p>
            <ul className="mt-5 grid gap-2">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm text-text">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-neon/10 text-neon"><p.icon className="size-4" /></span>
                  {p.text}
                </li>
              ))}
            </ul>
            {authError && <p role="alert" className="mt-5 rounded-xl border border-danger/50 bg-danger/10 px-4 py-2.5 text-sm text-danger">{authError}</p>}
            <div className="mt-7"><SignInButtons providers={providers} big /></div>
            <p className="mt-3 flex items-start gap-2 text-xs text-dim">
              <ShieldCheck className="mt-px size-4 shrink-0 text-neon/70" />
              We only read your Discord name and avatar, and add you to Ravo&apos;s Discord server for your private tickets. Kick can be linked after.
            </p>
            {providers.includes("kick") && (
              <p className="mt-5 border-t border-white/[0.06] pt-4 text-xs text-dim">
                Signed up with Kick before? <a href="/api/auth/kick/start?next=/account" className="text-muted underline hover:text-neon">Sign in with Kick</a> and link your Discord.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const qz: QzinoState = await qzinoStatusOf(viewer.id).catch(() => ({ status: "none" as const, ticketUrl: null, code: null, note: null }));
  const discord = viewer.identities.find((i) => i.provider === "discord");
  const kick = viewer.identities.find((i) => i.provider === "kick");
  const step = qz.status === "verified" ? 4 : qz.status === "pending" ? 2 : 1;
  const owner = await isOwner();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
      {authError ? <Flash error="unexpected" detail={authError} /> : <Flash ok={sp.ok ?? (sp.signed_in || sp.linked ? "1" : undefined)} error={sp.error} detail={sp.detail} okText={sp.linked ? "Account linked." : sp.signed_in ? "Welcome in." : sp.ok === "ticket" ? "Your ticket is open on Discord." : sp.ok === "verify_sent" ? "Proof sent: your ticket is open on Discord." : "Saved."} />}

      {/* profile */}
      <div className="panel-soft relative overflow-hidden p-6 sm:p-8">
        <Image src="/media/claws-bg.webp" alt="" fill sizes="100vw" className="object-cover opacity-25" />
        <div className="relative flex flex-wrap items-center gap-5">
          {viewer.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={viewer.avatar} alt="" className="size-20 rounded-2xl ring-2 ring-neon/50" />
            : <span className="grid size-20 place-items-center rounded-2xl bg-surface-3 font-display text-4xl">{viewer.display_name.slice(0, 1)}</span>}
          <div className="min-w-0 flex-1">
            <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-neon">Your account</p>
            <h1 className="truncate font-display text-4xl leading-none sm:text-5xl"><span className="chrome">{viewer.display_name}</span></h1>
            <p className="mt-2 flex flex-wrap gap-2 text-xs">
              {discord && <span className="inline-flex items-center gap-1.5 rounded-full bg-discord/25 px-2.5 py-1 font-semibold"><DiscordIcon className="size-3.5" /> {discord.username}</span>}
              {kick && <span className="inline-flex items-center gap-1.5 rounded-full bg-neon/15 px-2.5 py-1 font-semibold text-neon"><KickIcon className="size-3.5" /> {kick.username}</span>}
              {qz.status === "verified" && <span className="inline-flex items-center gap-1.5 rounded-full bg-neon px-2.5 py-1 font-bold text-neon-ink"><BadgeCheck className="size-3.5" /> Qzino verified</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {owner && <Link href="/admin" className="btn btn-neon btn-sm"><LayoutDashboard className="size-4" /> Admin</Link>}
            <LogoutButton />
          </div>
        </div>
      </div>

      {!discord && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-discord/60 bg-discord/10 p-5">
          <p className="text-sm"><b>Link your Discord to keep your account.</b> RAVO sign-in is Discord only now, and verification happens in Discord tickets.</p>
          <a href="/api/auth/discord/start?next=/account" className="btn btn-discord btn-sm"><DiscordIcon className="size-4" /> Link Discord</a>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Qzino verification */}
        <section className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="eyebrow">Qzino username</p>
            {qz.status === "verified" && <span className="flex items-center gap-1.5 text-sm font-bold text-neon"><BadgeCheck className="size-4" /> Verified</span>}
          </div>

          <ol className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold uppercase tracking-wider">
            {["Send proof", "Team checks", "Verified"].map((label, i) => {
              const n = i + 1, done = step > n, now = step === n;
              return (
                <li key={label} className={`rounded-xl border px-2 py-2.5 ${done ? "border-neon/50 bg-neon/10 text-neon" : now ? "border-gold/60 bg-gold/10 text-gold" : "border-line text-dim"}`}>
                  <span className="mx-auto mb-1 grid size-6 place-items-center rounded-full border border-current">{done ? <Check className="size-3.5" /> : n}</span>
                  {label}
                </li>
              );
            })}
          </ol>

          {viewer.qzino_username && (
            <p className="mt-5 text-sm text-muted">Username: <span className="font-mono font-bold text-text">{viewer.qzino_username}</span></p>
          )}

          {qz.status === "pending" ? (
            <div className="mt-4 rounded-2xl border border-gold/50 bg-gold/[0.07] p-4 text-sm">
              <p className="flex items-center gap-1.5 font-bold text-gold"><Clock className="size-4" /> The team is checking your proof</p>
              <p className="mt-1 text-muted">You&apos;ll get an answer in your private Discord ticket and here. You can add more proof (like a longer recording) in the ticket.</p>
              {qz.ticketUrl
                ? <a href={qz.ticketUrl} target="_blank" rel="noopener noreferrer" className="btn btn-discord btn-sm mt-4"><DiscordIcon className="size-4" /> Open my ticket <ExternalLink className="size-3.5" /></a>
                : discord
                  ? <form action={openQzinoTicketAction} className="mt-4"><button className="btn btn-discord btn-sm"><DiscordIcon className="size-4" /> Open my ticket</button><span className="ml-3 text-xs text-dim">No ticket yet: this opens your private channel.</span></form>
                  : <p className="mt-3 text-xs text-dim">Link your Discord above so the team can open your private ticket.</p>}
            </div>
          ) : (
            <div className="mt-5">
              {qz.status === "rejected" && (
                <div className="mb-4 rounded-2xl border border-danger/50 bg-danger/10 p-4 text-sm">
                  <p className="flex items-center gap-1.5 font-bold text-danger"><XCircle className="size-4" /> Not verified</p>
                  <p className="mt-1 text-muted">{qz.note ?? "We couldn't verify this username."} Send a new proof to try again.</p>
                </div>
              )}
              {discord ? (
                <>
                  {qz.status !== "verified" && <p className="mb-4 text-sm text-muted">Send your Qzino username with a screenshot or short recording of your account under code <b className="text-text">RAVO50</b>. It opens your private ticket with the proof attached.</p>}
                  <VerifyForm username={viewer.qzino_username} label={qz.status === "verified" ? "Change username" : qz.status === "rejected" ? "Send new proof" : "Verify my Qzino account"} />
                </>
              ) : (
                <p className="text-sm text-muted">Link your Discord above first: verification happens in a private Discord ticket.</p>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-dim">Needed for challenges. Each Qzino username can only be verified on one account, so nobody can use someone else&apos;s.</p>
        </section>

        {/* connections */}
        <section className="panel p-6">
          <p className="eyebrow">Connections</p>
          <ul className="mt-4 space-y-2">
            <li className="flex items-center gap-3 rounded-xl border border-line bg-bg-2 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-lg bg-discord text-white"><DiscordIcon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-head text-sm font-bold">Discord</span>
                <span className="block truncate text-xs text-muted">{discord ? discord.username : "Not linked"}</span>
              </span>
              {discord ? <span className="text-[10px] font-bold uppercase tracking-wider text-dim">Sign-in</span>
                : <a href="/api/auth/discord/start?next=/account" className="btn btn-discord btn-sm">Link</a>}
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-line bg-bg-2 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-lg bg-neon text-neon-ink"><KickIcon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-head text-sm font-bold">Kick</span>
                <span className="block truncate text-xs text-muted">{kick ? kick.username : "Link it so the team knows your chat name"}</span>
              </span>
              {kick ? <Check className="size-5 text-neon" /> : providers.includes("kick") && discord ? <LinkKickButton /> : null}
            </li>
          </ul>
        </section>
      </div>

    </div>
  );
}

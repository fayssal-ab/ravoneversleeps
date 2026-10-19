import { BadgeCheck, Clock } from "lucide-react";
import { qzinoStatusOf } from "@/lib/verification";
import type { Metadata } from "next";
import Image from "next/image";
import { LogoutButton } from "@/components/account/LogoutButton";
import { RankCard } from "@/components/account/RankCard";
import { SignInButtons } from "@/components/account/SignInPanel";
import { Flash, PageHeader } from "@/components/ui/bits";
import { getLedger, getRanks, getViewer } from "@/lib/account";
import { rankProgress } from "@/lib/ranks";
import { AUTH_MESSAGES, enabledProviders, PROVIDER_NAME } from "@/lib/userAuth";
import { saveQzinoAction } from "../actions";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { grant: "Earned", deduct: "Adjusted", redeem: "Store", refund: "Refund", raffle: "Raffle" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const providers = enabledProviders();
  const authError = sp.error && AUTH_MESSAGES[sp.error];

  if (!viewer) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 sm:px-6">
        <div className="panel neon-frame is-on relative overflow-hidden p-8 text-center">
          <div className="relative mx-auto h-36 w-32">
            <div className="absolute inset-4 rounded-full bg-neon/25 blur-2xl" />
            <Image src="/media/ravo-mascot.webp" alt="" fill sizes="128px" className="animate-dance object-contain" />
          </div>
          <h1 className="mt-6 font-display text-5xl"><span className="chrome">Sign</span> <span className="neon-text">in</span></h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">Track your points and rank, redeem rewards in the store and join raffles.</p>
          {authError && <p role="alert" className="mt-4 rounded-xl border border-danger/50 bg-danger/10 px-4 py-2 text-sm text-danger">{authError}</p>}
          <div className="mt-7 flex justify-center"><SignInButtons providers={providers} /></div>
        </div>
      </div>
    );
  }

  const [ranks, ledger, qz] = await Promise.all([getRanks(), getLedger(viewer.id).catch(() => []), qzinoStatusOf(viewer.id).catch(() => ({ status: "none" as const, ticketUrl: null }))]);
  const prog = rankProgress(ranks, viewer.xp);
  const linked = new Set(viewer.identities.map((i) => i.provider));
  const linkable = providers.filter((p) => !linked.has(p));

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-6">
      <PageHeader eyebrow="Your account" title={viewer.display_name} />
      {authError ? <Flash error="unexpected" detail={authError} /> : <Flash ok={sp.ok ?? (sp.signed_in || sp.linked ? "1" : undefined)} error={sp.error} detail={sp.detail} okText={sp.linked ? "Account linked." : sp.signed_in ? "Welcome in." : "Saved."} />}

      <RankCard
        name={viewer.display_name} points={viewer.points} xp={viewer.xp} level={prog.current.level} rankName={prog.current.name}
        nextName={prog.next?.name ?? null} nextLevel={prog.next?.level ?? null} pct={prog.pct} need={prog.need}
      />

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="panel p-6">
          <p className="eyebrow mb-4">Qzino username</p>
          <form action={saveQzinoAction} className="flex gap-2">
            <input name="qzino" defaultValue={viewer.qzino_username} maxLength={64} placeholder="your Qzino username" className="field font-mono" aria-label="Qzino username" />
            <button className="btn btn-neon btn-sm">Save</button>
          </form>
          {viewer.qzino_username && qz.status === "verified" && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-neon"><BadgeCheck className="size-4" /> Verified</p>
          )}
          {viewer.qzino_username && qz.status === "pending" && (
            <div className="mt-3 rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm">
              <p className="flex items-center gap-1.5 font-bold text-gold"><Clock className="size-4" /> Under verification</p>
              <p className="mt-1 text-muted">
                {qz.ticketUrl
                  ? <>A private ticket is open for you on Discord: send a screenshot of your Qzino profile there. <a href={qz.ticketUrl} target="_blank" rel="noopener noreferrer" className="text-neon underline">Open the ticket</a></>
                  : linked.has("discord") ? "The team will check it shortly." : "Link your Discord below so the team can verify it in a private ticket."}
              </p>
            </div>
          )}
          {viewer.qzino_username && qz.status === "rejected" && (
            <p className="mt-3 rounded-xl border border-danger/50 bg-danger/10 p-3 text-sm text-danger">We couldn&apos;t verify this username. Correct it and save again.</p>
          )}
          <p className="mt-3 text-xs text-dim">Needed for store rewards, milestones and challenges. The team verifies it once.</p>
        </section>

        <section className="panel p-6">
          <p className="eyebrow mb-4">Linked accounts</p>
          <ul className="space-y-2">
            {viewer.identities.map((i) => (
              <li key={i.provider} className="flex items-center justify-between rounded-xl border border-line bg-bg-2 px-4 py-2.5 text-sm">
                <span className="font-head font-bold">{PROVIDER_NAME[i.provider]}</span>
                <span className="text-muted">{i.username}</span>
              </li>
            ))}
          </ul>
          {linkable.length > 0 && <div className="mt-4"><SignInButtons providers={linkable} /></div>}
          <div className="mt-5 flex justify-end"><LogoutButton /></div>
        </section>
      </div>

      <section className="panel mt-6 overflow-hidden">
        <p className="eyebrow border-b border-line px-6 py-4">Points history</p>
        {ledger.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">No points yet. Watch the stream and play with code RAVO to start earning.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {ledger.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{l.note || KIND[l.kind]}</p>
                  <p className="text-xs text-dim">{KIND[l.kind]} · {l.created_at} UTC</p>
                </div>
                <span className={`font-mono font-bold ${l.delta >= 0 ? "text-neon" : "text-danger"}`}>{l.delta >= 0 ? "+" : ""}{l.delta.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

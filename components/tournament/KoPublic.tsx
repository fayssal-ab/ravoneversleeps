"use client";

import { Crown, Skull, Swords, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { useAfterIdle } from "@/components/three/useAfterIdle";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { KICK_URL } from "@/lib/constants";
import type { KoParticipant, KoState } from "@/lib/knockout";
import { FinisherStage, useFinishers } from "./fight/Finishers";
import { Bracket, ChampionCard, ParticipantRow, VsScreen, teamName } from "./parts";
import { ChampionShowcase } from "./champion/ChampionShowcase";
import { useKoState } from "./useKoState";

// 3D crown (three.js) beside the title; browser only, loads after the page
const Crown3DScene = dynamic(() => import("@/components/three/Crown3DScene"), { ssr: false });
import { BossReveal, useBossReveal } from "./reaping/Boss";
import { Bestiary, EventLog, HuntAvatars, HuntPhase, HuntStats, PhaseBar, RevealOverlay, useHuntReveal } from "./hunt/HuntBoard";

const STATUS = {
  open: { label: "Registration open", tone: "border-neon/60 bg-neon/10 text-neon", dot: "bg-neon animate-pulse" },
  closed: { label: "Battles running", tone: "border-gold/60 bg-gold/10 text-gold", dot: "bg-gold animate-pulse" },
  finished: { label: "Finished", tone: "border-line-hot bg-surface-2 text-muted", dot: "bg-dim" },
  cancelled: { label: "Cancelled", tone: "border-line-hot bg-surface-2 text-muted", dot: "bg-dim" },
} as const;

/** The winner, as one clean banner: slot, name, slot name, prize. */
function ChampionBanner({ p, prize }: { p: KoParticipant; prize: string | null }) {
  return (
    <section className="hud hud-lg" style={{ ["--hc" as string]: "#f5c95a" }}>
      <ChampionShowcase name={teamName(p)} slots={[p, ...(p.partner ? [p.partner] : [])].map((m) => ({ name: m.slot_name, image: m.slot_image || null }))}
        sub={`${p.partner ? `${p.slot_name} + ${p.partner.slot_name}` : p.slot_name}${p.slot_provider ? ` · ${p.slot_provider}` : ""}`} prize={prize != null ? Number(prize) : null} />
    </section>
  );
}

// Public live view: refreshes every few seconds while a tournament runs.
export function KoPublic({ initial, id }: { initial: KoState; id?: number }) {
  const running = initial.tournament.status === "open" || initial.tournament.status === "closed";
  const { state } = useKoState(initial, running ? 4000 : 60_000, id);
  const fin = useFinishers(state);
  const boss = useBossReveal(state);
  const huntReveal = useHuntReveal(state?.hunt ?? initial.hunt, 9000);
  const s = state ?? initial;
  const idle = useAfterIdle();
  const t = s.tournament;
  const current = s.live ?? s.focus;
  const st = STATUS[t.status];
  const pct = Math.min(100, Math.round((s.registered / Math.max(1, s.capacity)) * 100));

  return (
    <div className="space-y-6">
      <FinisherStage show={fin.current} skippable onDone={fin.next} />
      {/* header */}
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        {/* gold glow + crown on the right (classic knockouts only) */}
        {t.mode !== "reaping" && t.mode !== "hunt" && (
          <>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-80 rounded-full bg-[radial-gradient(circle,rgb(245_201_90/0.16),transparent_65%)]" />
            <div aria-hidden className="pointer-events-none absolute right-0 top-1/2 hidden h-52 w-52 -translate-y-1/2 md:block lg:right-6">
              {idle && <Crown3DScene />}
            </div>
          </>
        )}
        <div className={`relative flex flex-wrap items-start justify-between gap-4 ${t.mode !== "reaping" && t.mode !== "hunt" ? "md:pr-52 lg:pr-60" : ""}`}>
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-head text-xs font-bold uppercase tracking-wider ${st.tone}`}>
              <span className={`size-2 rounded-full ${st.dot}`} />{st.label}
            </span>
            <h2 className="mt-3 truncate font-display text-4xl sm:text-5xl"><span className="chrome">{t.title}</span></h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {t.mode === "reaping" && <span className="inline-flex items-center gap-1.5 font-semibold text-[#c9a6ff]"><Skull className="size-4" />The Reaping · Wheel</span>}
              {t.mode === "hunt" && <span className="inline-flex items-center gap-1.5 font-semibold text-[#ff8a3d]"><Skull className="size-4" />The Reaping · Hunt</span>}
              <span className="inline-flex items-center gap-1.5"><Swords className="size-4 text-neon" />{t.team_size === 2 ? `Duo 2v2 · ${t.max_players} teams` : `Solo 1v1 · ${t.max_players} players`}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-neon" />{s.registered}/{s.capacity} joined</span>
              {t.prize_1 != null && <span className="inline-flex items-center gap-1.5"><Crown className="size-4 text-gold" />${Number(t.prize_1).toLocaleString("en-US")} {t.mode === "hunt" ? "base prize × bounty" : "to the champion"}</span>}
              {!t.prize_1 && t.prize && <span className="inline-flex items-center gap-1.5"><Crown className="size-4 text-gold" />{t.prize}</span>}
            </p>
          </div>
          {t.mode === "reaping" && (
            <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              {[
                { l: "Bosses risen", v: String(s.bosses.length) },
                { l: "Reaped", v: String(s.reaped) },
                { l: "Prize", v: t.prize_1 != null ? `$${Number(t.prize_1).toLocaleString("en-US")}` : t.prize || "—" },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-[#b06bff]/30 bg-[#b06bff]/[0.06] px-3 py-2 text-center">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{x.l}</dt>
                  <dd className="truncate font-mono text-lg font-bold text-[#efe9f5]">{x.v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <a href={KICK_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon"><SocialIcon name="kick" className="size-4" /> Watch live on Kick</a>
          </div>
        </div>
        {t.status === "open" && (
          <>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-neon transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { t: "Type in Kick chat", b: <><code className="rounded bg-surface-3 px-1.5 text-neon">!join</code> for a random slot</> },
                { t: "Pick your slot", b: <><code className="rounded bg-surface-3 px-1.5 text-neon">!join Gates of Olympus</code></> },
                { t: "Change your mind?", b: <>Type it again before you&apos;re drawn</> },
              ].map((x) => (
                <div key={x.t} className="rounded-xl border border-line bg-bg-2 p-3 text-sm">
                  <p className="font-head font-bold">{x.t}</p>
                  <p className="mt-0.5 text-muted">{x.b}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* champion / current battle */}
      {t.mode === "hunt" && s.hunt ? (
        <HuntAvatars participants={s.participants}>
          {huntReveal.reveal && <RevealOverlay s={s.hunt} reveal={huntReveal.reveal} onClose={huntReveal.dismiss} />}
          <PhaseBar s={s.hunt} />
          <HuntStats s={s.hunt} />
          <section className="panel p-4 sm:p-6"><HuntPhase s={s.hunt} /></section>
          <EventLog s={s.hunt} max={25} />
          <Bestiary s={s.hunt} />
        </HuntAvatars>
      ) : t.mode === "hunt" ? null : s.champion?.is_boss ? (
        <section className="mx-auto max-w-xl">
          <ChampionCard p={s.champion} />
          {t.rollover && t.prize_1 != null && <p className="mt-3 text-center text-sm text-muted">The <b className="font-mono text-gold">${Number(t.prize_1).toLocaleString("en-US")}</b> prize rolls over to the next Reaping.</p>}
        </section>
      ) : s.champion ? (
        <ChampionBanner p={s.champion} prize={t.prize_1} />
      ) : !s.live && boss.waiting ? (
        <section className="panel overflow-hidden p-4 sm:p-8">
          <BossReveal boss={boss.waiting.boss} roll={boss.waiting.roll} duo={t.team_size === 2} animateSpin={boss.animateSpin} onDone={boss.finish} />
        </section>
      ) : current && current.status !== "empty" && current.status !== "void" ? (
        <section className="panel overflow-hidden p-4 sm:p-8">
          <VsScreen key={`${current.id}-${current.status}-${current.winner_id}`} match={current} size={t.max_players} />
        </section>
      ) : null}

      {t.mode !== "hunt" && (
        <section className="panel p-4 sm:p-6">
          <h3 className="mb-4 font-head text-sm font-bold uppercase tracking-[0.2em] text-muted">Bracket</h3>
          <Bracket state={s} />
        </section>
      )}

      {s.participants.length > 0 && (
        <section className="panel p-4 sm:p-6">
          <h3 className="mb-4 font-head text-sm font-bold uppercase tracking-[0.2em] text-muted">Players ({s.registered})</h3>
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">{s.participants.map((p, i) => <ParticipantRow key={p.id} p={p} index={i} noSlot={t.mode === "hunt"} />)}</ol>
        </section>
      )}
    </div>
  );
}

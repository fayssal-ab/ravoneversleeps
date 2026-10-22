"use client";

import { Crown, Swords, Users } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { KICK_URL } from "@/lib/constants";
import type { KoParticipant, KoState } from "@/lib/knockout";
import { FinisherStage, useFinishers } from "./fight/Finishers";
import { Bracket, ParticipantRow, VsScreen, teamName } from "./parts";
import { useKoState } from "./useKoState";

const STATUS = {
  open: { label: "Registration open", tone: "border-neon/60 bg-neon/10 text-neon", dot: "bg-neon animate-pulse" },
  closed: { label: "Battles running", tone: "border-gold/60 bg-gold/10 text-gold", dot: "bg-gold animate-pulse" },
  finished: { label: "Finished", tone: "border-line-hot bg-surface-2 text-muted", dot: "bg-dim" },
  cancelled: { label: "Cancelled", tone: "border-line-hot bg-surface-2 text-muted", dot: "bg-dim" },
} as const;

/** The winner, as one clean banner: slot, name, slot name, prize. */
function ChampionBanner({ p, prize }: { p: KoParticipant; prize: string | null }) {
  return (
    <section className="ko-glow relative overflow-hidden rounded-3xl border border-gold/50 bg-gradient-to-r from-gold/15 via-surface to-surface p-5 sm:p-7">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <div className="relative shrink-0">
          <SlotArt name={p.slot_name} src={p.slot_image} fluid="clamp(96px, 22vw, 136px)" />
          <Crown className="absolute -left-3 -top-4 size-9 -rotate-12 text-gold drop-shadow-[0_2px_8px_rgb(0_0_0/0.8)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-head text-xs font-bold uppercase tracking-[0.25em] text-gold">Tournament champion</p>
          <p className="mt-1 truncate font-head text-3xl font-bold text-gold sm:text-4xl">{teamName(p)}</p>
          <p className="truncate text-base text-neon">{p.partner ? `${p.slot_name} + ${p.partner.slot_name}` : p.slot_name}<span className="text-dim"> · {p.slot_provider}</span></p>
        </div>
        {prize != null && (
          <div className="shrink-0 rounded-2xl border border-gold/40 bg-bg/60 px-6 py-3 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Prize</p>
            <p className="font-mono text-3xl font-bold text-gold">${Number(prize).toLocaleString("en-US")}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// Public live view: refreshes every few seconds while a tournament runs.
export function KoPublic({ initial, id }: { initial: KoState; id?: number }) {
  const running = initial.tournament.status === "open" || initial.tournament.status === "closed";
  const { state } = useKoState(initial, running ? 4000 : 60_000, id);
  const fin = useFinishers(state);
  const s = state ?? initial;
  const t = s.tournament;
  const current = s.live ?? s.focus;
  const st = STATUS[t.status];
  const pct = Math.min(100, Math.round((s.registered / Math.max(1, s.capacity)) * 100));

  return (
    <div className="space-y-6">
      <FinisherStage show={fin.current} skippable onDone={fin.next} />
      {/* header */}
      <section className="panel p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-head text-xs font-bold uppercase tracking-wider ${st.tone}`}>
              <span className={`size-2 rounded-full ${st.dot}`} />{st.label}
            </span>
            <h2 className="mt-3 truncate font-display text-4xl sm:text-5xl"><span className="chrome">{t.title}</span></h2>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5"><Swords className="size-4 text-neon" />{t.team_size === 2 ? `Duo 2v2 · ${t.max_players} teams` : `Solo 1v1 · ${t.max_players} players`}</span>
              <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-neon" />{s.registered}/{s.capacity} joined</span>
              {t.prize_1 != null && <span className="inline-flex items-center gap-1.5"><Crown className="size-4 text-gold" />${Number(t.prize_1).toLocaleString("en-US")} to the champion</span>}
              {!t.prize_1 && t.prize && <span className="inline-flex items-center gap-1.5"><Crown className="size-4 text-gold" />{t.prize}</span>}
            </p>
          </div>
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
      {s.champion ? (
        <ChampionBanner p={s.champion} prize={t.prize_1} />
      ) : current && current.status !== "empty" && current.status !== "void" ? (
        <section className="panel overflow-hidden p-4 sm:p-8">
          <VsScreen key={`${current.id}-${current.status}-${current.winner_id}`} match={current} size={t.max_players} />
        </section>
      ) : null}

      <section className="panel p-4 sm:p-6">
        <h3 className="mb-4 font-head text-sm font-bold uppercase tracking-[0.2em] text-muted">Bracket</h3>
        <Bracket state={s} />
      </section>

      {s.participants.length > 0 && (
        <section className="panel p-4 sm:p-6">
          <h3 className="mb-4 font-head text-sm font-bold uppercase tracking-[0.2em] text-muted">Players ({s.registered})</h3>
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">{s.participants.map((p, i) => <ParticipantRow key={p.id} p={p} index={i} />)}</ol>
        </section>
      )}
    </div>
  );
}

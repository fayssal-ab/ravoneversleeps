"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import type { KoMatch, KoParticipant } from "@/lib/knockout";
import { FinisherStage, demoShow, useFinishers } from "./fight/Finishers";
import { Podium, RollReveal, VsScreen, matchLabel, roundName, teamName } from "./parts";
import { useKoState } from "./useKoState";

// OBS overlay, transparent background. Default: a landscape card with the two
// sides next to each other (browser source about 1280×720, any landscape size
// works: everything is sized from the viewport so it scales cleanly when
// resized in OBS). `wide` keeps the old 1920×1080 centred layout. Polls the
// public state. A battle's result plays the K.O. finisher (with sound unless
// `mute`); `demo` loops made-up fights to set up the scene in OBS.
export function KoOverlay({ wide = false, mute = false, demo = false }: { wide?: boolean; mute?: boolean; demo?: boolean }) {
  const { state } = useKoState(null, 1500);
  const [revealed, setRevealed] = useState<number | null>(null);
  const fin = useFinishers(state);
  const [demoRound, setDemoRound] = useState(0);
  const { current, push } = fin;
  useEffect(() => {
    if (!demo || current) return;
    const id = setTimeout(() => { push(demoShow(demoRound)); setDemoRound((n) => n + 1); }, 1200);
    return () => clearTimeout(id);
  }, [demo, demoRound, current, push]);
  const finisher = <FinisherStage show={fin.current} sound={!mute} onDone={fin.next} />;
  if (!state) return finisher;
  const t = state.tournament;
  const focus = state.focus;
  const pool = state.participants.filter((p) => p.state === "registered");
  // random draws animate, including battles started straight away ("Start next battle")
  const rolling = (focus?.status === "rolled" || focus?.status === "live") && focus.roll_seq != null && revealed !== focus.roll_seq;
  const header = t.status === "open" ? `!join · ${state.registered}/${state.capacity}` : focus ? roundName(t.max_players, focus.round) : "";

  if (wide) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center p-10">
        {finisher}
        <div className="w-full max-w-[1500px] rounded-[2rem] border-2 border-neon/40 bg-bg/85 p-10 shadow-[0_0_120px_-30px_rgb(141_255_74/0.6)] backdrop-blur-md">
          <div className="mb-6 flex items-center justify-between">
            <p className="font-display text-5xl"><span className="chrome">{t.title}</span></p>
            <p className="font-head text-xl font-bold uppercase tracking-[0.2em] text-neon">{header}</p>
          </div>
          {state.champion ? (
            <Podium state={state} />
          ) : focus && focus.status !== "empty" ? (
            rolling ? (
              <RollReveal key={`roll-${focus.roll_seq}`} match={focus} pool={pool} size={t.max_players} big onDone={() => setRevealed(focus.roll_seq)} />
            ) : (
              <VsScreen key={`${focus.id}-${focus.status}-${focus.winner_id}`} match={focus} size={t.max_players} big />
            )
          ) : (
            <p className="py-20 text-center font-display text-7xl"><span className="chrome">Type</span> <span className="neon-text">!join</span></p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-full p-[1.6vh]">
      {finisher}
      <div className="flex w-full flex-col overflow-hidden rounded-[2.4vh] border-[0.3vh] border-neon/40 bg-bg/90 p-[2.2vh] shadow-[0_0_6vh_-2vh_rgb(141_255_74/0.6)]">
        <div className="text-center">
          <p className="truncate font-display text-[4.6vh] leading-none"><span className="chrome">{t.title}</span></p>
          <p className="mt-[0.8vh] font-head text-[2vh] font-bold uppercase tracking-[0.2em] text-neon">
            {focus && !state.champion && focus.status !== "empty" ? matchLabel(focus, t.max_players) : header}
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {state.champion ? (
            <Champion p={state.champion} prize={t.prize_1} />
          ) : focus && focus.status !== "empty" ? (
            rolling ? (
              <RollReveal key={`roll-${focus.roll_seq}`} match={focus} pool={pool} size={t.max_players} big onDone={() => setRevealed(focus.roll_seq)} />
            ) : (
              <VsRow key={`${focus.id}-${focus.status}-${focus.winner_id}`} match={focus} />
            )
          ) : (
            <div className="text-center">
              <p className="font-display text-[8vh] leading-none"><span className="chrome">Type</span><br /><span className="neon-text">!join</span></p>
              <p className="mt-[2vh] font-mono text-[4vh] font-bold">{state.registered}<span className="text-dim">/{state.capacity}</span></p>
              <p className="font-head text-[1.8vh] uppercase tracking-[0.2em] text-muted">{t.status === "open" ? "Registration open" : "Registration closed"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** One side of the VS card. */
function Side({ p, multi, color, outcome, live }: { p: KoParticipant | null; multi: string | null; color: string; outcome: "win" | "lose" | null; live: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center text-center transition-opacity duration-500 ${outcome === "lose" ? "opacity-40 grayscale" : ""}`}>
      <div className="relative overflow-hidden rounded-[1.6vh] border-[0.35vh]" style={{ borderColor: outcome === "win" ? "var(--color-gold)" : color }}>
        {p ? <SlotArt name={p.slot_name} src={p.slot_image} fluid="min(46vh, 30vw)" rounded="rounded-[1.2vh]" className="!border-0" /> : <span className="grid size-[min(46vh,30vw)] place-items-center font-display text-[6vh] text-dim">?</span>}
        {outcome === "win" && <span className="absolute inset-x-0 bottom-0 bg-gold py-[0.4vh] font-head text-[2.2vh] font-black uppercase tracking-[0.3em] text-bg">Winner</span>}
      </div>
      <p className={`mt-[1vh] w-full truncate font-head text-[4.6vh] font-bold leading-tight ${outcome === "win" ? "text-gold" : ""}`}>{p ? teamName(p) : "TBD"}</p>
      <p className="w-full truncate text-[2.8vh] font-semibold leading-tight" style={{ color }}>{p ? (p.partner ? `${p.slot_name} + ${p.partner.slot_name}` : p.slot_name) : ""}</p>
      {multi ? (
        <p className={`mt-[0.6vh] font-mono text-[6vh] font-bold leading-none ${outcome === "win" ? "text-gold" : "text-muted"}`}>x{multi}</p>
      ) : live ? (
        <p className="mt-[0.6vh] animate-pulse font-pixel text-[2.2vh] uppercase tracking-[0.2em] text-dim">Bonus pending</p>
      ) : null}
    </div>
  );
}

function VsRow({ match }: { match: KoMatch }) {
  const outcome = (p: KoParticipant | null) => (match.winner_id == null || !p ? null : match.winner_id === p.id ? "win" : "lose");
  const live = match.status === "live";
  return (
    <div className="flex items-center justify-center gap-[3vw]">
      <Side p={match.p1} multi={match.p1_multi} color="var(--color-neon)" outcome={outcome(match.p1)} live={live} />
      <span className="flex shrink-0 flex-col items-center gap-[1.5vh]">
        <span className="ko-vs font-display text-[12vh] leading-none"><span className="chrome">V</span><span className="neon-text">S</span></span>
        {live && <span className="rounded-full bg-danger px-[1.2vh] py-[0.4vh] font-head text-[2.2vh] text-white">● LIVE</span>}
      </span>
      <Side p={match.p2} multi={match.p2_multi} color="var(--color-silver)" outcome={outcome(match.p2)} live={live} />
    </div>
  );
}

function Champion({ p, prize }: { p: KoParticipant; prize: string | null }) {
  return (
    <div className="ko-glow flex flex-col items-center rounded-[2vh] border-[0.3vh] border-gold/60 bg-gradient-to-b from-gold/15 to-transparent p-[2vh] text-center">
      <Crown className="ko-crown size-[6vh] text-gold" />
      <div className="mt-[1.5vh]"><SlotArt name={p.slot_name} src={p.slot_image} fluid="22vh" /></div>
      <p className="mt-[1.5vh] w-full truncate font-head text-[3.6vh] font-bold text-gold">{teamName(p)}</p>
      <p className="w-full truncate text-[2vh] text-neon">{p.slot_name}</p>
      <p className="eyebrow mt-[1.5vh] !text-[1.6vh] !text-gold">Tournament champion</p>
      {prize != null && <p className="mt-[0.8vh] font-mono text-[3vh] font-bold text-gold">${Number(prize).toLocaleString("en-US")}</p>}
    </div>
  );
}

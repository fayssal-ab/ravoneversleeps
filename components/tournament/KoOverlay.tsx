"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import type { KoMatch, KoParticipant } from "@/lib/knockout";
import { FinisherStage, demoShow, useFinishers } from "./fight/Finishers";
import { KickAvatar, Podium, RollReveal, VsScreen, matchLabel, roundName, teamName, useRollSpin } from "./parts";
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
    <div className="flex h-[100dvh] w-full p-[1.2vh]">
      {finisher}
      <div className="flex w-full flex-col overflow-hidden rounded-[2.4vh] border-[0.5vh] border-neon/70 bg-[linear-gradient(160deg,#0d2414,#040605_55%,#071509)] p-[2.4vh] shadow-[0_0_5vh_-1vh_rgb(141_255_74/0.7),inset_0_0_8vh_-4vh_rgb(141_255_74/0.35)]">
        <div className="text-center">
          <p className="truncate font-head text-[6vh] font-bold uppercase leading-none tracking-wider text-text">{t.title}</p>
          <p className="mx-auto mt-[1vh] w-fit max-w-full truncate rounded-full bg-neon px-[2vh] py-[0.4vh] font-head text-[3.2vh] font-bold uppercase tracking-[0.15em] text-neon-ink">
            {focus && !state.champion && focus.status !== "empty" ? matchLabel(focus, t.max_players) : t.team_size === 2 ? "Duo 2v2 knockout" : "Solo 1v1 knockout"}
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          {state.champion ? (
            <Champion p={state.champion} prize={t.prize_1} />
          ) : focus && focus.status !== "empty" ? (
            rolling ? (
              <RollRow key={`roll-${focus.roll_seq}`} match={focus} pool={pool} onDone={() => setRevealed(focus.roll_seq)} />
            ) : (
              <VsRow key={`${focus.id}-${focus.status}-${focus.winner_id}`} match={focus} />
            )
          ) : (
            <Join players={state.participants.filter((p) => !p.disqualified)} capacity={state.capacity} open={t.status === "open"} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Registration: what to type on the left, and every seat on the right (Kick
 * avatar, name, slot), filling up as people join. Sized from the viewport so
 * it stays readable on a small stream source.
 */
function Join({ players, capacity, open }: { players: KoParticipant[]; capacity: number; open: boolean }) {
  const registered = players.length;
  const full = registered >= capacity;
  const status = open
    ? { label: "Registration open", tone: "border-neon bg-neon/15 text-neon", dot: "bg-neon animate-pulse" }
    : full
      ? { label: "Starting soon", tone: "border-gold bg-gold/15 text-gold", dot: "bg-gold animate-pulse" }
      : { label: "Registration closed", tone: "border-danger bg-danger/15 text-danger", dot: "bg-danger" };
  const cols = capacity <= 16 ? 2 : 4;
  const rows = Math.ceil(capacity / cols);
  const cell = 74 / rows; // vh per row
  const big = capacity > 16;
  const avatar = `${Math.min(cell * 0.62, 9.5)}vh`;
  const seats = Array.from({ length: capacity }, (_, i) => players[i] ?? null);
  return (
    <div className="flex h-full min-h-0 items-center gap-[3vh]">
      <div className={`flex shrink-0 flex-col items-center text-center ${big ? "w-[24%]" : "w-[32%]"}`}>
        <p className={`font-head font-bold uppercase leading-none tracking-[0.2em] text-text ${big ? "text-[2.6vh]" : "text-[3.4vh]"}`}>Type in chat</p>
        <p className={`font-head font-bold italic leading-[1] text-neon [text-shadow:0_0_5vh_rgb(141_255_74/0.65),0_0.8vh_0_#0b1f04] ${big ? "text-[11vh]" : "text-[15vh]"}`}>!join</p>
        <p className={`font-mono font-bold leading-none ${big ? "text-[7vh]" : "text-[9vh]"}`}>{registered}<span className="text-dim">/{capacity}</span></p>
        <p className={`mt-[2vh] inline-flex items-center gap-[1vh] rounded-full border-[0.4vh] px-[1.6vh] py-[0.6vh] font-head font-bold uppercase tracking-[0.06em] ${big ? "text-[2vh]" : "text-[2.6vh]"} ${status.tone}`}>
          <span className={`size-[1.6vh] rounded-full ${status.dot}`} />{status.label}
        </p>
      </div>
      <ol className="grid h-[76vh] min-w-0 flex-1 gap-[1vh]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`, gridAutoFlow: "column" }}>
        {seats.map((p, i) => p ? (
          <li key={p.id} className={`entrant-in flex min-w-0 items-center rounded-[1.4vh] border-[0.3vh] border-neon/45 bg-neon/[0.07] ${big ? "gap-[0.8vh] px-[0.8vh]" : "gap-[1.4vh] px-[1.4vh]"}`}>
            <KickAvatar name={p.username} src={p.avatar} size={avatar} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-head font-bold leading-tight" style={{ fontSize: `${Math.min(cell * (big ? 0.36 : 0.3), 4.2)}vh` }}>{p.username}</span>
              {rows <= 8 && cols === 2 && (
                <span className="block truncate leading-tight text-neon" style={{ fontSize: `${Math.min(cell * 0.22, 3)}vh` }}>{p.slot_name}</span>
              )}
            </span>
          </li>
        ) : (
          <li key={`free-${i}`} className={`flex min-w-0 items-center rounded-[1.4vh] border-[0.3vh] border-dashed border-line-hot text-dim ${big ? "gap-[0.8vh] px-[0.8vh]" : "gap-[1.4vh] px-[1.4vh]"}`}>
            <span className="grid shrink-0 place-items-center rounded-full border-[0.3vh] border-dashed border-line-hot font-mono font-bold"
              style={{ width: avatar, height: avatar, fontSize: `${Math.min(cell * 0.26, 3.2)}vh` }}>{i + 1}</span>
            {!big && <span className="truncate font-head font-bold uppercase tracking-wider" style={{ fontSize: `${Math.min(cell * 0.24, 3)}vh` }}>Free seat</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Landscape roller: both sides spin onto their player, then the VS card. */
function RollRow({ match, pool, onDone }: { match: KoMatch; pool: KoParticipant[]; onDone: () => void }) {
  const { phase, shown } = useRollSpin(match, pool, onDone);
  if (phase === 2) return <VsRow match={match} />;
  const side = (slot: 0 | 1, color: string) => {
    const st = phase > slot ? "locked" : phase === slot ? "spinning" : "waiting";
    const s = shown[slot];
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div className="overflow-hidden rounded-[1.6vh] border-[0.5vh]" style={{ borderColor: st === "waiting" ? "var(--color-line-hot)" : color, boxShadow: st === "locked" ? `0 0 4vh -1vh ${color}` : undefined }}>
          {st === "waiting" ? (
            <span className="grid size-[min(42vh,28vw)] place-items-center font-display text-[10vh] text-dim">?</span>
          ) : (
            <SlotArt name={s.slot_name} src={s.slot_image} fluid="min(42vh, 28vw)" rounded="rounded-[1.2vh]" className={`!border-0 ${st === "spinning" ? "opacity-80 blur-[1px]" : ""}`} />
          )}
        </div>
        <p className={`mt-[1vh] w-full truncate font-head text-[6.4vh] font-bold leading-tight ${st === "waiting" ? "text-dim" : ""}`} style={st === "locked" ? { color } : undefined}>
          {st === "waiting" ? "Waiting…" : s.username}
        </p>
        <p className="w-full truncate text-[3.6vh] font-semibold leading-tight text-muted">{st === "waiting" ? " " : s.slot_name}</p>
      </div>
    );
  };
  return (
    <div>
      <p className="mb-[1.5vh] animate-pulse text-center font-head text-[4vh] font-bold uppercase tracking-[0.2em] text-gold">Rolling player {phase + 1}…</p>
      <div className="flex items-center justify-center gap-[3vw]">
        {side(0, "var(--color-neon)")}
        <span className="font-display text-[12vh] leading-none text-dim">VS</span>
        {side(1, "var(--color-silver)")}
      </div>
    </div>
  );
}

/** One side of the VS card. */
function Side({ p, multi, color, outcome, live }: { p: KoParticipant | null; multi: string | null; color: string; outcome: "win" | "lose" | null; live: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center text-center transition-opacity duration-500 ${outcome === "lose" ? "opacity-40 grayscale" : ""}`}>
      <div className="relative overflow-hidden rounded-[1.6vh] border-[0.35vh]" style={{ borderColor: outcome === "win" ? "var(--color-gold)" : color }}>
        {p ? <SlotArt name={p.slot_name} src={p.slot_image} fluid="min(42vh, 28vw)" rounded="rounded-[1.2vh]" className="!border-0" /> : <span className="grid size-[min(42vh,28vw)] place-items-center font-display text-[6vh] text-dim">?</span>}
        {outcome === "win" && <span className="absolute inset-x-0 bottom-0 bg-gold py-[0.4vh] font-head text-[3vh] font-black uppercase tracking-[0.3em] text-bg">Winner</span>}
      </div>
      <p className={`mt-[1vh] w-full truncate font-head text-[6.4vh] font-bold leading-tight ${outcome === "win" ? "text-gold" : ""}`}>{p ? teamName(p) : "TBD"}</p>
      <p className="w-full truncate text-[3.6vh] font-semibold leading-tight" style={{ color }}>{p ? (p.partner ? `${p.slot_name} + ${p.partner.slot_name}` : p.slot_name) : ""}</p>
      {multi ? (
        <p className={`mt-[0.6vh] font-mono text-[10vh] font-bold leading-none ${outcome === "win" ? "text-gold" : "text-muted"}`}>x{multi}</p>
      ) : live ? (
        <p className="mt-[0.6vh] animate-pulse font-head text-[3.6vh] font-bold uppercase tracking-[0.2em] text-dim">Bonus pending</p>
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
        {live && <span className="rounded-full bg-danger px-[1.6vh] py-[0.5vh] font-head text-[3.4vh] font-bold text-white">● LIVE</span>}
      </span>
      <Side p={match.p2} multi={match.p2_multi} color="var(--color-silver)" outcome={outcome(match.p2)} live={live} />
    </div>
  );
}

function Champion({ p, prize }: { p: KoParticipant; prize: string | null }) {
  return (
    <div className="ko-glow flex flex-col items-center rounded-[2vh] border-[0.3vh] border-gold/60 bg-gradient-to-b from-gold/15 to-transparent p-[2vh] text-center">
      <Crown className="ko-crown size-[9vh] text-gold" />
      <div className="mt-[1.5vh]"><SlotArt name={p.slot_name} src={p.slot_image} fluid="26vh" /></div>
      <p className="mt-[1.5vh] w-full truncate font-head text-[7vh] font-bold leading-tight text-gold">{teamName(p)}</p>
      <p className="w-full truncate text-[3.4vh] text-neon">{p.slot_name}</p>
      <p className="eyebrow mt-[1vh] !text-[3vh] !text-gold">Tournament champion</p>
      {prize != null && <p className="mt-[0.8vh] font-mono text-[7vh] font-bold leading-none text-gold">${Number(prize).toLocaleString("en-US")}</p>}
    </div>
  );
}

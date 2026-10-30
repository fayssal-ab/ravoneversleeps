"use client";

import { useState, type ReactNode } from "react";
import { Ghost, Skull, UserPlus } from "lucide-react";
import type { KoParticipant, KoState } from "@/lib/knockout";
import { money } from "@/lib/hunt/engine";
import { Counter, ParticipantRow } from "../parts";
import { Bestiary, EventLog, HuntAvatars, HuntPhase, HuntStats, PhaseBar, RevealOverlay, useHuntReveal, type HuntAdmin } from "./HuntBoard";

// Admin control room for "The Reaping · Hunt". Every button is a server call
// (lib/hunt/store.ts); the dashboard only shows the saved game.

type Act = (action: string, extra?: Record<string, unknown>, confirmText?: string) => Promise<boolean>;

export function HuntDashboard({ state, act, busy, msg, reader, chat, onDisqualify }: {
  state: KoState; act: Act; busy: string | null; msg: string | null; reader: ReactNode; chat?: ReactNode; onDisqualify: (p: KoParticipant) => void;
}) {
  const t = state.tournament;
  const s = state.hunt;
  const duo = t.team_size === 2;
  const [manual, setManual] = useState({ username: "", slot: "" });
  const [secret, setSecret] = useState(false);
  const { reveal, dismiss } = useHuntReveal(s);
  const go: HuntAdmin["go"] = (op, extra = {}, confirm) => { void act("hunt", { op, ...extra }, confirm); };
  const admin: HuntAdmin = { busy: busy !== null, go };
  const setup = state.huntSetup;
  const units = duo ? Math.floor(state.registered / 2) : state.registered;

  return (
    <HuntAvatars participants={state.participants}>
    <div className="space-y-6">
      {s && reveal && <RevealOverlay s={s} reveal={reveal} onClose={dismiss} />}
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="eyebrow">Tournament #{t.id} · The Reaping · Hunt · {duo ? `Duo · ${t.max_players} teams` : `Solo · ${t.max_players} players`}</p>
          <h2 className="font-display text-3xl"><span className="chrome">{t.title}</span></h2>
          {reader}
        </div>
        {!s && <Counter value={state.registered} max={state.capacity} open={t.status === "open"} />}
        <div className="flex flex-wrap gap-2">
          {!s && (t.status === "closed"
            ? <button disabled={busy !== null || state.registered >= state.capacity} onClick={() => act("open")} className="btn btn-neon btn-sm">Open registration</button>
            : <button disabled={busy !== null} onClick={() => act("close", {}, "Close registration? Nobody new can join.")} className="btn btn-ghost btn-sm">Close registration</button>)}
          <button disabled={busy !== null} onClick={() => act("reset", {}, "Reset the tournament? It is cancelled and a new one can be created. This can't be undone.")} className="btn btn-ghost btn-sm !text-danger">Reset</button>
        </div>
      </div>

      {msg && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{msg}</p>}

      {!s ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="panel space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["I · The Hunt", "#8cff4a", `A random monster spawns for every ${duo ? "team" : "player"}: its own slot, bonus buy ($10–$3,000) and maybe an ability. Win more than the monster or get reaped.`],
                ["II · The Arena", "#f5c95a", "Survivors fight each other. Same buy for both, the bigger win goes through until one is left."],
                ["III · The Reckoning", "#ff5a5a", "Is the last one alive? The Endboss may come. Beat him to become a Legend."],
              ].map(([h, c, b]) => (
                <div key={h} className="rounded-2xl border p-4" style={{ borderColor: `${c}66`, background: `${c}0d` }}>
                  <b className="font-head text-sm uppercase tracking-[0.14em]" style={{ color: c }}>{h}</b>
                  <p className="mt-1 text-sm text-muted">{b}</p>
                </div>
              ))}
            </div>
            {setup && (
              <p className="text-sm text-muted">
                {setup.waves} monster wave{setup.waves === 1 ? "" : "s"} · Endboss chance {setup.chance}%
                {setup.weights && <> · odds: Fodder {setup.weights.Fodder}% · Minion {setup.weights.Minion}% · Brute {setup.weights.Brute}% · Warlord {setup.weights.Warlord}% · Overlord {setup.weights.Overlord}%</>} · base prize <b className="font-mono text-gold">{money(Number(t.prize_1 ?? 0))}</b> (× the best bounty) · if the Endboss wins: {setup.fall === "half" ? "the champion keeps 50%" : "nothing"}
              </p>
            )}
            <div className="flex flex-col items-center gap-2 pt-2">
              <button disabled={busy !== null || units < 2 || (duo && state.registered % 2 === 1)} className="btn btn-neon !px-8 !py-4 !text-base"
                onClick={() => act("hunt", { op: "start" }, `Start the Reaping with ${units} ${duo ? "teams" : "players"}? Registration closes${duo ? " and random teams are drawn" : ""}.`)}>
                <Skull className="size-5" /> Start the Reaping
              </button>
              <p className="text-xs text-dim">
                {units < 2 ? `At least 2 ${duo ? "teams (4 players)" : "players"} needed.` : duo && state.registered % 2 ? "Odd number of players: add or disqualify one first." : `${units} ${duo ? "teams" : "players"} ready.`}
              </p>
            </div>
          </section>
          <section className="panel p-4">
            <p className="eyebrow mb-3">Players</p>
            {t.status === "open" && (
              <form className="mb-3 grid grid-cols-[1fr_auto] gap-2" onSubmit={async (e) => {
                e.preventDefault();
                if (await act("add_player", { username: manual.username, slot: manual.slot })) setManual({ username: "", slot: "" });
              }}>
                <input required maxLength={40} value={manual.username} onChange={(e) => setManual({ ...manual, username: e.target.value })} placeholder="Player" className="field !py-2 text-sm" aria-label="Player name" />
                <button disabled={busy !== null} className="btn btn-ghost btn-sm" aria-label="Add player"><UserPlus className="size-4" /></button>
              </form>
            )}
            {state.participants.length === 0
              ? <p className="text-sm text-dim">{t.status === "open" ? "Waiting for the first !join…" : "Open registration to collect !join from chat."}</p>
              : <ol className="max-h-[520px] space-y-2 overflow-y-auto pr-1">{state.participants.map((p, i) => <ParticipantRow key={p.id} p={p} index={i} onDisqualify={onDisqualify} noSlot />)}</ol>}
            {chat}
          </section>
        </div>
      ) : (
        <>
          <PhaseBar s={s} />
          <HuntStats s={s} />
          <section className="panel space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {s.phase === "hunt" && (
                <>
                  <button disabled={busy !== null || !s.fights.some((f) => !f.monster)} onClick={() => go("spawn")} className="btn btn-sm !bg-[#ff8a3d] !text-bg">Spawn next monster</button>
                  <button disabled={busy !== null || !s.fights.some((f) => !f.monster)} onClick={() => go("spawn_all")} className="btn btn-ghost btn-sm">Spawn all instantly</button>
                  <span className="text-xs text-dim">{s.fights.filter((f) => !f.monster).length ? `Wave ${s.wave}: ${s.fights.filter((f) => !f.monster).length} still need a monster.` : "Enter both wins. Abilities and curses apply when you hit Fight."}</span>
                </>
              )}
              {s.phase === "arena" && <span className="text-sm text-muted">Same buy for both. The bigger win goes through.</span>}
              {s.phase === "reckon" && s.reckon && (
                !s.reckon.fate ? <button disabled={busy !== null} onClick={() => go("fate")} className="btn btn-sm !bg-danger !text-white">Does the Endboss come?</button>
                  : s.reckon.fate === "comes" && !s.reckon.boss ? <button disabled={busy !== null} onClick={() => go("endboss")} className="btn btn-sm !bg-danger !text-white">Summon the Endboss</button>
                  : s.reckon.boss && !s.reckon.done && !s.reckon.boss.secret ? <button disabled={busy !== null} onClick={() => go("endboss", {}, "Re-roll the Endboss?")} className="btn btn-ghost btn-sm">Re-roll the Endboss (host)</button>
                  : null
              )}
              {s.phase !== "done" && (
                <label className="ml-auto flex items-center gap-2 text-xs text-dim" title="Host test tool">
                  <input type="checkbox" checked={secret} className="accent-[#fff6d6]" onChange={async (e) => { const on = e.target.checked; if (await act("hunt", { op: "secret", on })) setSecret(on); }} />
                  <Ghost className="size-3.5" /> Test: the next spawn is the secret boss
                </label>
              )}
            </div>
            <HuntPhase s={s} admin={admin} />
          </section>
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <EventLog s={s} />
            {chat && <div className="panel p-4">{chat}</div>}
          </div>
          <Bestiary s={s} />
        </>
      )}
    </div>
    </HuntAvatars>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dices, Play, RotateCw, Skull, SkipForward, UserPlus } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm";
import type { BonusKey, KoMatch, KoParticipant, KoState } from "@/lib/knockout";
import { Bracket, Counter, ParticipantRow, Podium, RollReveal, VsScreen, roundName, teamName } from "./parts";
import { useJoinReader, type ReaderStatus } from "./useJoinReader";
import { useKoState } from "./useKoState";

import { BossReveal, useBossReveal } from "./reaping/Boss";
import { HuntDashboard } from "./hunt/HuntDashboard";
import { LastTournament } from "./LastTournament";

// Live control room (ported from ONO). All state comes from the server
// (polled); every button is a server call with backend rule checks.

const READER: Record<ReaderStatus, { label: string; tone: string }> = {
  off: { label: "Chat webhook off", tone: "text-dim" },
  connecting: { label: "Checking Kick chat webhook…", tone: "text-gold" },
  live: { label: "Kick chat webhook connected", tone: "text-neon" },
  quiet: { label: "Kick chat webhook OK · chat is quiet right now", tone: "text-gold" },
  error: { label: "Kick webhook not subscribed, retrying", tone: "text-danger" },
};

const OUTCOME: Record<string, string> = {
  registered: "registered", rerolled: "slot changed", duplicate_message: "duplicate ignored", no_tournament: "no tournament",
  registration_closed: "registration closed", full: "full", locked_in_bracket: "locked in bracket", eliminated: "eliminated, ignored",
  pending_roll: "being rolled, ignored", disqualified: "disqualified, ignored", no_slots: "slot catalogue empty!", slot_taken: "slot already called, ignored", processing_failed: "server error", network_error: "network error",
  already_joined: "already in", called: "called", no_hunt: "!call: no Hunt running", no_slot: "!call without a slot", hunt_not_player: "!call: not a player", hunt_no_monster: "!call: no monster for them yet", hunt_chat_picks: "!call: chat picks this one (host enters it)",
};

const SIZES = [4, 8, 16, 32] as const;

// Hunt monster odds per tier (rank shown on the cards: Fodder · Minion = Easy, Brute = Medium, Warlord = Hard, Overlord = Nightmare)
type RankOdds = { Fodder: number; Minion: number; Brute: number; Warlord: number; Overlord: number };
const RANKS: { key: keyof RankOdds; label: string; tiers: string; color: string }[] = [
  { key: "Fodder", label: "Fodder", tiers: "Easy", color: "#7fd6c2" },
  { key: "Minion", label: "Minion", tiers: "Easy", color: "#8cff4a" },
  { key: "Brute", label: "Brute", tiers: "Medium", color: "#f5c95a" },
  { key: "Warlord", label: "Warlord", tiers: "Hard", color: "#ff8a3d" },
  { key: "Overlord", label: "Overlord", tiers: "Nightmare", color: "#b36bff" },
];
const RANK_PRESETS: { label: string; v: RankOdds }[] = [
  { label: "Chill", v: { Fodder: 30, Minion: 40, Brute: 18, Warlord: 9, Overlord: 3 } },
  { label: "Ravo", v: { Fodder: 15, Minion: 35, Brute: 20, Warlord: 20, Overlord: 10 } },
  { label: "Brutal", v: { Fodder: 5, Minion: 25, Brute: 25, Warlord: 25, Overlord: 20 } },
];
type Tab = "bracket" | "round" | "qualified" | "eliminated" | "final";

export function KoDashboard({ initial, overlayUrl }: { initial: KoState | null; overlayUrl: string }) {
  const { state, error, refresh } = useKoState(initial, 1500);
  const t = state?.tournament ?? null;
  const running = t != null && (t.status === "open" || t.status === "closed");
  const reader = useJoinReader(running, refresh);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("bracket");
  const [form, setForm] = useState({ title: "", prize: "", size: 16 as (typeof SIZES)[number], duo: false, reaping: false, chance: 40, finalBoss: true, rollover: true, hunt: false, waves: 1 as 1 | 2 | 3, endChance: 50, fall: "half" as "half" | "nothing", rank: { Fodder: 15, Minion: 35, Brute: 20, Warlord: 20, Overlord: 10 }, p1: "", p2: "", p3: "" });
  const boss = useBossReveal(state);
  const [manual, setManual] = useState({ username: "", slot: "" });

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !(await confirmDialog(confirmText))) return false;
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(t && action !== "create" ? { id: t.id } : {}), ...extra }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; detail?: string | null; error?: string };
      if (!data.ok) setMsg(`${data.message ?? data.error ?? "Refused"}${data.detail ? ` (${data.detail})` : ""}`);
      await refresh();
      return data.ok;
    } catch {
      setMsg("Network error: nothing changed. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }, [t, refresh]);

  const disqualify = useCallback((p: KoParticipant) => {
    const where = p.state === "in_knockout" ? " Their current battle is forfeited to the opponent." : " They leave the pool and their seat frees up.";
    act("disqualify", { participantId: p.id }, `Disqualify ${p.username}?${where} They can't !join this tournament again.`);
  }, [act]);

  const pool = useMemo(() => state?.participants.filter((p) => p.state === "registered") ?? [], [state]);
  const focus: KoMatch | null = state?.focus ?? null;
  const firstRoundOpen = state ? state.matches.some((m) => m.round === 1 && m.status === "empty") : false;
  const canRoll = running && !state?.pendingRoll && !state?.live && firstRoundOpen && ((state?.eligible ?? 0) >= 2 || (state?.eligible === 1 && t?.status === "closed"));

  if (!state || !t || !running) {
    return (
      <div className="space-y-6">
        {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">Live state unavailable: check the database connection.</p>}
        {state && state.tournament.status === "finished" && <LastTournament state={state} />}
        <form
          className="panel space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            act("create", {
              title: form.title, prize: form.prize, size: form.size, duo: form.duo, prizes: [form.p1 || null, null, null],
              reaping: form.reaping ? { chance: form.chance, finalBoss: form.finalBoss, rollover: form.rollover } : null,
              hunt: form.hunt ? { waves: form.waves, chance: form.endChance, fall: form.fall, weights: form.rank } : null,
            });
          }}
        >
          <p className="font-display text-3xl"><span className="chrome">New</span> <span className="neon-text">tournament</span></p>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <label className="block"><span className="label">Title</span>
              <input required maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Friday Knockout" className="field" />
            </label>
            <label className="block"><span className="label">Prize label</span>
              <input maxLength={120} value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} placeholder="$500 pool" className="field" />
            </label>
          </div>
          <div>
            <span className="label">Mode</span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {([false, true] as const).map((duo) => {
                const on = !form.reaping && !form.hunt && form.duo === duo;
                return (
                  <button key={String(duo)} type="button" onClick={() => setForm({ ...form, duo, reaping: false, hunt: false })} aria-pressed={on}
                    className={`rounded-xl border-2 px-3 py-3 text-left transition ${on ? "border-neon bg-neon/10" : "border-line-hot hover:border-neon"}`}>
                    <span className="block font-head text-lg font-bold">{duo ? "Duo · 2v2" : "Solo · 1v1"}</span>
                    <span className="block text-xs text-muted">{duo ? "Everyone !joins alone, then gets a random teammate. Both bonuses count: the higher combined multiplier wins." : "Each player battles alone. The higher multiplier wins."}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => setForm({ ...form, reaping: true, hunt: false })} aria-pressed={form.reaping}
                className={`rounded-xl border-2 px-3 py-3 text-left transition ${form.reaping ? "border-[#b06bff] bg-[#b06bff]/10 shadow-[0_0_30px_-10px_#b06bff]" : "border-line-hot hover:border-[#b06bff]"}`}>
                <span className="flex items-center gap-1.5 font-head text-lg font-bold"><Skull className="size-4 text-[#c9a6ff]" /> The Reaping · Wheel</span>
                <span className="block text-xs text-muted">Players fight each other, but the Cult sends bosses. Spin the wheel, beat the number, or get reaped.</span>
              </button>
              <button type="button" onClick={() => setForm({ ...form, hunt: true, reaping: false })} aria-pressed={form.hunt}
                className={`rounded-xl border-2 px-3 py-3 text-left transition ${form.hunt ? "border-[#ff8a3d] bg-[#ff8a3d]/10 shadow-[0_0_30px_-10px_#ff8a3d]" : "border-line-hot hover:border-[#ff8a3d]"}`}>
                <span className="flex items-center gap-1.5 font-head text-lg font-bold"><Skull className="size-4 text-[#ff8a3d]" /> The Reaping · Hunt</span>
                <span className="block text-xs text-muted">A monster for every player, then the Arena, then the Endboss. Slay monsters to multiply the prize.</span>
              </button>
            </div>
          </div>
          {form.hunt && (
            <div className="space-y-4 rounded-2xl border border-[#ff8a3d]/40 bg-[#ff8a3d]/[0.06] p-4">
              <p className="font-head text-sm font-bold uppercase tracking-[0.18em] text-[#ff8a3d]">Hunt settings</p>
              <div className="grid grid-cols-2 gap-2">
                {([false, true] as const).map((duo) => (
                  <button key={String(duo)} type="button" onClick={() => setForm({ ...form, duo })} aria-pressed={form.duo === duo}
                    className={`rounded-xl border-2 px-3 py-2 font-head font-bold transition ${form.duo === duo ? "border-[#ff8a3d] bg-[#ff8a3d]/15" : "border-line-hot text-muted hover:text-text"}`}>
                    {duo ? "Duo · 2v2 (monster win ×2)" : "Solo"}
                  </button>
                ))}
              </div>
              <div>
                <span className="label">Monster waves in the Hunt</span>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, waves: n })} aria-pressed={form.waves === n}
                      className={`rounded-xl border-2 py-2 font-mono text-lg font-bold transition ${form.waves === n ? "border-[#ff8a3d] bg-[#ff8a3d]/15" : "border-line-hot text-muted"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">Monster ranks (odds for every player)</span>
                <div className="mb-2 flex flex-wrap gap-2">
                  {RANK_PRESETS.map((p) => {
                    const on = RANKS.every((r) => form.rank[r.key] === p.v[r.key]);
                    return (
                      <button key={p.label} type="button" onClick={() => setForm({ ...form, rank: { ...p.v } })} aria-pressed={on}
                        className={`rounded-lg border-2 px-3 py-1.5 font-head text-xs font-bold uppercase tracking-wider transition ${on ? "border-[#ff8a3d] bg-[#ff8a3d]/15" : "border-line-hot text-muted hover:text-text"}`}>{p.label}</button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {RANKS.map((r) => (
                    <label key={r.key} className="block rounded-xl border border-line bg-bg-2 p-2">
                      <span className="block font-head text-[11px] font-bold uppercase tracking-wider" style={{ color: r.color }}>{r.label}</span>
                      <span className="block text-[10px] text-dim">{r.tiers}</span>
                      <span className="mt-1 flex items-center gap-1">
                        <input type="number" min={0} max={100} value={form.rank[r.key]} onChange={(e) => setForm({ ...form, rank: { ...form.rank, [r.key]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } })} className="field !py-1 text-right font-mono" aria-label={`${r.label} %`} />
                        <span className="text-sm text-muted">%</span>
                      </span>
                    </label>
                  ))}
                </div>
                {(() => { const t = RANKS.reduce((a, r) => a + form.rank[r.key], 0); return <p className={`mt-1 text-xs ${t === 100 ? "text-dim" : "text-danger"}`}>Total {t}%{t === 100 ? "" : " · must be 100%"}</p>; })()}
              </div>
              <label className="block">
                <span className="label">Endboss chance at the end: <b className="font-mono text-text">{form.endChance}%</b></span>
                <input type="range" min={0} max={100} step={5} value={form.endChance} onChange={(e) => setForm({ ...form, endChance: Number(e.target.value) })} className="w-full accent-[#ff8a3d]" />
              </label>
              <div>
                <span className="label">If the Endboss wins, the champion gets</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["half", "nothing"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setForm({ ...form, fall: f })} aria-pressed={form.fall === f}
                      className={`rounded-xl border-2 px-3 py-2 font-head font-bold transition ${form.fall === f ? "border-[#ff8a3d] bg-[#ff8a3d]/15" : "border-line-hot text-muted"}`}>{f === "half" ? "50% of the prize" : "Nothing"}</button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted">
                The prize is flexible: the amount below is only the base, what each player wins is shown at the end. Slaying a monster raises it: Brute ×2, Warlord ×3, Overlord ×5 (the highest counts); beating the Endboss ×10. Fodder and Minion add nothing. Top 3 are paid: 1st (the champion), 2nd (lost the Arena final) and 3rd (lost the round before), each base × their own bounty.
                {form.p1 && /^\d+(\.\d{1,2})?$/.test(form.p1) ? ` Example: slay a Warlord and play for $${(Number(form.p1) * 3).toLocaleString("en-US")}; beat The Reaper King for $${(Number(form.p1) * 10).toLocaleString("en-US")}.` : ""}
              </p>
            </div>
          )}
          {form.reaping && (
            <div className="space-y-4 rounded-2xl border border-[#b06bff]/40 bg-[#b06bff]/[0.06] p-4">
              <p className="font-head text-sm font-bold uppercase tracking-[0.18em] text-[#c9a6ff]">Reaping settings</p>
              <div className="grid grid-cols-2 gap-2">
                {([false, true] as const).map((duo) => (
                  <button key={String(duo)} type="button" onClick={() => setForm({ ...form, duo })} aria-pressed={form.duo === duo}
                    className={`rounded-xl border-2 px-3 py-2 font-head font-bold transition ${form.duo === duo ? "border-[#b06bff] bg-[#b06bff]/15" : "border-line-hot text-muted hover:text-text"}`}>
                    {duo ? "Duo · 2v2" : "Solo · 1v1"}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="label">Boss chance per round: <b className="font-mono text-text">{form.chance}%</b></span>
                <input type="range" min={0} max={100} step={5} value={form.chance} onChange={(e) => setForm({ ...form, chance: Number(e.target.value) })} className="w-full accent-[#b06bff]" />
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={form.finalBoss} onChange={(e) => setForm({ ...form, finalBoss: e.target.checked })} className="mt-1 accent-[#b06bff]" />
                <span><b>Guaranteed final boss</b><span className="block text-xs text-muted">Off: the final still gets at least a 60% chance, and a boss for sure if none rose before.</span></span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" checked={form.rollover} onChange={(e) => setForm({ ...form, rollover: e.target.checked })} className="mt-1 accent-[#b06bff]" />
                <span><b>Rollover if the Cult wins</b><span className="block text-xs text-muted">The end screen says the prize rolls over to the next Reaping. Add it to that prize yourself.</span></span>
              </label>
              <p className="text-xs text-muted">
                Wheel: Minion 20–75x (45%) · Brute 76–150x (30%) · Warlord 151–300x (18%) · Overlord 301–500x (7%){form.duo ? ". Duo targets are doubled (40–1000x) against the team total." : "."}
                {" "}Nobody reaches the target → the boss advances and both are reaped.
              </p>
            </div>
          )}
          <div>
            <span className="label">{form.duo ? "Teams" : "Players"}</span>
            <div className="grid grid-cols-4 gap-2">
              {SIZES.map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, size: n })} aria-pressed={form.size === n}
                  className={`rounded-xl border-2 py-3 font-mono text-2xl font-bold transition ${form.size === n ? "border-neon bg-neon text-neon-ink shadow-[0_4px_0_var(--color-neon-deep)]" : "border-line-hot text-muted hover:border-neon hover:text-text"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <label className="block max-w-xs"><span className="label">{form.hunt ? "Base prize ($) · × bounty at the end" : "Champion prize ($)"}</span>
            <input inputMode="decimal" pattern="\d{1,9}(\.\d{1,2})?" value={form.p1} onChange={(e) => setForm({ ...form, p1: e.target.value })} placeholder="300" className="field font-mono" />
          </label>
          <button disabled={busy !== null || (form.hunt && RANKS.reduce((a, r) => a + form.rank[r.key], 0) !== 100)} className="btn btn-neon">
            Create {form.duo ? `${form.size}-team${form.reaping || form.hunt ? "" : " duo"} (${form.size * 2} players)` : `${form.size}-player`} {form.hunt ? "Hunt" : form.reaping ? "Reaping" : "tournament"}
          </button>
          {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
        </form>
      </div>
    );
  }

  if (t.mode === "hunt") {
    return (
      <HuntDashboard state={state} act={act} busy={busy} msg={msg} onDisqualify={disqualify}
        chat={reader.events.length > 0 ? (
          <div className="mt-4 border-t border-line pt-3">
            <p className="eyebrow mb-1">Chat · !join / !call</p>
            <ul className="max-h-48 space-y-0.5 overflow-y-auto font-mono text-[11px] text-dim">
              {reader.events.map((e, i) => <li key={i}><span className="text-muted">{e.username}</span> · {OUTCOME[e.outcome] ?? e.outcome}{e.slot && e.outcome === "called" ? <> → <span className="text-neon">{e.slot}</span></> : null}</li>)}
            </ul>
          </div>
        ) : null}
        reader={<>
          <p className={`mt-1 text-xs ${READER[reader.status].tone}`}>● {READER[reader.status].label}{reader.status === "error" && reader.detail ? <span className="text-dim"> ({reader.detail})</span> : null}</p>
          <p className="text-[11px] text-dim">{reader.lastSeen ? <>Last chat message: <span className="text-muted">{reader.lastSeen.username}</span> at {new Date(reader.lastSeen.at).toLocaleTimeString()}</> : "No chat message received yet (set the webhook URL in your Kick app)"}</p>
        </>} />
    );
  }

  const size = t.max_players;
  const duo = t.team_size === 2;
  // duo: teammate name for each player in the list
  const mateOf = new Map<number, string>();
  if (duo) for (const p of state.participants) if (p.partner) { mateOf.set(p.id, p.partner.username); mateOf.set(p.partner.id, p.username); }
  const showRoll = focus && (focus.status === "rolled" || focus.status === "live") && focus.roll_seq != null && revealed !== focus.roll_seq;
  const tabs: { key: Tab; label: string }[] = [
    { key: "bracket", label: "Full bracket" }, { key: "round", label: "Current round" }, { key: "qualified", label: "Qualified" },
    { key: "eliminated", label: "Eliminated" }, { key: "final", label: "Finals" },
  ];
  const currentRound = Math.min(...state.matches.filter((m) => ["empty", "rolled", "ready", "live"].includes(m.status)).map((m) => m.round), state.rounds);

  return (
    <div className="space-y-6">
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">Tournament #{t.id} · {t.mode === "reaping" ? "The Reaping · Wheel · " : ""}{duo ? `Duo 2v2 · ${size} teams` : `Solo · ${size} players`}{t.prize ? ` · ${t.prize}` : ""}</p>
          {t.mode === "reaping" && (
            <p className="mt-0.5 text-[11px] text-[#c9a6ff]">
              Boss chance {t.boss_chance}%{t.final_boss ? " · final boss guaranteed" : ""} · {state.bosses.length} boss{state.bosses.length === 1 ? "" : "es"} risen · {state.reaped} reaped
            </p>
          )}
          <h2 className="font-display text-3xl"><span className="chrome">{t.title}</span></h2>
          <p className={`mt-1 text-xs ${READER[reader.status].tone}`}>● {READER[reader.status].label}{reader.status === "error" && reader.detail ? <span className="text-dim"> ({reader.detail})</span> : null}</p>
          <p className="text-[11px] text-dim">
            {reader.lastSeen ? <>Last chat message: <span className="text-muted">{reader.lastSeen.username}</span> at {new Date(reader.lastSeen.at).toLocaleTimeString()}</> : "No chat message received yet (set the webhook URL in your Kick app)"}
          </p>
        </div>
        <Counter value={state.registered} max={state.capacity} open={t.status === "open"} />
        <div className="flex flex-wrap gap-2">
          {t.status === "closed" ? (
            <button disabled={busy !== null || state.registered >= state.capacity || state.teamsMade || state.bossRolls.length > 0} onClick={() => act("open")} className="btn btn-neon btn-sm">Open registration</button>
          ) : (
            <button disabled={busy !== null} onClick={() => act("close", {}, "Close registration? Nobody new can join (registered players can still change slot until they're rolled).")} className="btn btn-ghost btn-sm">Close registration</button>
          )}
          {duo && t.status === "closed" && !state.teamsMade && (
            <button disabled={busy !== null} onClick={() => act("make_teams", {}, `Draw random teams of 2 from the ${state.registered} registered players? Registration stays closed once teams are drawn.`)} className="btn btn-neon btn-sm">Make teams</button>
          )}
          {duo && state.teamsMade && firstRoundOpen && !state.pendingRoll && state.matches.every((m) => m.round !== 1 || m.status === "empty") && (
            <button disabled={busy !== null} onClick={() => act("undo_teams", {}, "Undo the team draw? Everyone goes back to waiting alone.")} className="btn btn-ghost btn-sm">Undo teams</button>
          )}
          <button disabled={busy !== null} onClick={() => act("reset", {}, "Reset the tournament? It is cancelled and a new one can be created. This can't be undone.")} className="btn btn-ghost btn-sm !text-danger">Reset</button>
        </div>
      </div>

      {msg && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">Lost connection to the server, retrying. Nothing is lost: the tournament is saved in the database.</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="panel relative overflow-hidden p-4 sm:p-6">
          {state.champion ? (
            <Podium state={state} />
          ) : !state.live && boss.waiting ? (
            <div className="py-2">
              <BossReveal boss={boss.waiting.boss} roll={boss.waiting.roll} duo={duo} animateSpin={boss.animateSpin} onDone={boss.finish} />
              <div className="mt-4 text-center">
                <button disabled={busy !== null} onClick={() => act("boss_respin", {}, "Re-spin the boss wheel? The boss gets a new tier and target.")} className="btn btn-ghost btn-sm">
                  <RotateCw className="size-4" /> Re-spin the wheel
                </button>
              </div>
            </div>
          ) : focus && focus.status !== "empty" ? (
            showRoll ? (
              <RollReveal key={`roll-${focus.roll_seq}`} match={focus} pool={pool} size={size} onDone={() => setRevealed(focus.roll_seq)} />
            ) : (
              <VsScreen key={`${focus.id}-${focus.status}`} match={focus} size={size} />
            )
          ) : (
            <div className="py-16 text-center">
              <p className="font-display text-4xl"><span className="chrome">{state.eligible >= 2 || firstRoundOpen ? "Ready to battle" : "Waiting for players"}</span></p>
              <p className="mt-2 text-sm text-dim">
                {duo && !state.teamsMade
                  ? <>{state.registered} player(s) registered · <b className="text-text">Start next battle</b> closes registration and draws random teams{state.registered % 2 ? <span className="text-gold"> (odd number: add or disqualify one player first)</span> : null}</>
                  : <>{state.eligible} {duo ? "team(s)" : "player(s)"} waiting · chat types <code className="text-neon">!join &lt;slot&gt;</code> · <b className="text-text">Start next battle</b> draws two at random</>}
              </p>
            </div>
          )}

          {!state.live && !state.champion && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button disabled={busy !== null} onClick={() => act("play")} className="btn btn-neon !px-8 !py-4 !text-base">
                <Play className="size-5" /> {busy === "play" ? "Drawing…" : "Start next battle"}
              </button>
              <p className="text-xs text-dim">Plays the next battle in the bracket, or draws two random {duo ? "teams" : "players"} and starts them.</p>
            </div>
          )}
          {state.live && (
            <>
              <BattleResultForm key={state.live.id} match={state.live} duo={duo} busy={busy !== null}
                onBonus={(key, bonus) => void act("bonus", { matchId: state.live!.id, key, bonus })}
                onSubmit={async (r, andNext) => {
                  if (await act("result", { matchId: state.live!.id, ...r }) && andNext) await act("play");
                }} />
              {/* disqualify straight from the battle: the opponent goes through */}
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {[state.live.p1, state.live.p2].map((p) => p && !p.is_boss && (
                  <button key={p.id} disabled={busy !== null} onClick={() => disqualify(p)}
                    className="rounded-lg border border-danger/40 px-3 py-1.5 font-head text-[11px] font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10">
                    Disqualify {teamName(p)}
                  </button>
                ))}
              </div>
            </>
          )}
          {/* rarely needed: the old step-by-step controls */}
          <details className="mt-6 text-center">
            <summary className="cursor-pointer text-xs text-dim hover:text-muted">Manual controls</summary>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button disabled={busy !== null || !canRoll} onClick={() => act("roll")} className="btn btn-ghost btn-sm"><Dices className="size-4" /> Roll 2 {duo ? "teams" : "players"}</button>
              <button disabled={busy !== null || !state.pendingRoll} onClick={() => act("confirm")} className="btn btn-ghost btn-sm">Confirm battle</button>
              <button disabled={busy !== null || !state.pendingRoll} onClick={() => act("cancel_roll", {}, "Cancel this roll? Both players go back to the pool.")} className="btn btn-ghost btn-sm">Cancel roll</button>
              <button disabled={busy !== null || !!state.live || !!state.pendingRoll || !state.nextReady} onClick={() => act("start")} className="btn btn-ghost btn-sm"><Play className="size-4" /> Start battle</button>
              <button disabled={busy !== null || !!state.live} onClick={() => act("next")} className="btn btn-ghost btn-sm"><SkipForward className="size-4" /> Focus next</button>
            </div>
          </details>
          {state.eligible === 1 && t.status === "open" && firstRoundOpen && (
            <p className="mt-3 text-center text-xs text-dim">One player is waiting. Close registration to give them a bye, or wait for another !join.</p>
          )}
        </section>

        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Players</p>
            <span className="font-mono text-xs text-dim">{state.eligible} waiting</span>
          </div>
          {t.status === "open" && (
            <form className="mb-3 grid grid-cols-[1fr_1fr_auto] gap-2" onSubmit={async (e) => {
              e.preventDefault();
              if (await act("add_player", { username: manual.username, slot: manual.slot })) setManual({ username: "", slot: "" });
            }}>
              <input required maxLength={40} value={manual.username} onChange={(e) => setManual({ ...manual, username: e.target.value })} placeholder="Player" className="field !py-2 text-sm" aria-label="Player name" />
              <input maxLength={80} value={manual.slot} onChange={(e) => setManual({ ...manual, slot: e.target.value })} placeholder="Slot (or random)" className="field !py-2 text-sm" aria-label="Slot" />
              <button disabled={busy !== null} className="btn btn-ghost btn-sm" aria-label="Add player"><UserPlus className="size-4" /></button>
            </form>
          )}
          {state.participants.length === 0 ? (
            <p className="text-sm text-dim">{t.status === "open" ? "Waiting for the first !join…" : "Open registration to collect !join from chat."}</p>
          ) : (
            <ol className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {state.participants.map((p, i) => <ParticipantRow key={p.id} p={p} index={i} onDisqualify={disqualify} team={mateOf.has(p.id) ? `with ${mateOf.get(p.id)}` : undefined} />)}
            </ol>
          )}
          {reader.events.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="eyebrow mb-1">Chat log</p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-dim">
                {reader.events.map((e, i) => <li key={i}><span className="text-muted">{e.username}</span> · {OUTCOME[e.outcome] ?? e.outcome}{e.slot ? <> → <span className="text-neon">{e.slot}</span></> : null}</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {tabs.map((x) => (
            <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)}
              className={`rounded-full px-3 py-1.5 font-head text-sm font-bold ${tab === x.key ? "bg-neon text-neon-ink" : "text-muted hover:text-text"}`}>{x.label}</button>
          ))}
        </div>
        {tab === "bracket" && <Bracket state={state} />}
        {tab === "round" && (
          <div>
            <p className="eyebrow mb-3">{roundName(size, currentRound)}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {state.matches.filter((m) => m.round === currentRound && m.status !== "void").map((m) => (
                <div key={m.id} className="rounded-2xl border border-line bg-bg-2 p-4"><VsScreen match={m} size={size} /></div>
              ))}
            </div>
          </div>
        )}
        {(tab === "qualified" || tab === "eliminated") && (
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {state.participants.filter((p) => (tab === "eliminated" ? p.state === "eliminated" : p.state === "in_knockout" || p.state === "champion")).map((p, i) => <ParticipantRow key={p.id} p={p} index={i} onDisqualify={disqualify} />)}
          </ol>
        )}
        {tab === "final" && (
          <div className="space-y-6">
            {state.matches.filter((m) => m.round === state.rounds && m.match_index === 0).map((m) => <VsScreen key={m.id} match={m} size={size} />)}
          </div>
        )}
      </section>

      <p className="text-xs text-dim">
        OBS: add a Browser Source <b>480×860</b> (tall card, resize freely) with <code className="text-neon">{overlayUrl}</code>. For the wide 1920×1080 layout add <code className="text-neon">?wide</code>. It updates by itself.
      </p>
    </div>
  );
}

type Bonus = { cost: string; payout: string };
const KEYS = ["p1", "p1b", "p2", "p2b"] as const;
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
function multi(b: Bonus): string | null {
  if (!MONEY.test(b.cost) || !MONEY.test(b.payout) || Number(b.cost) <= 0) return null;
  return (Number(b.payout) / Number(b.cost)).toFixed(2); // preview only; the server decides with exact decimals
}

/**
 * Live battle result: each bonus cost + payout. Solo: higher multiplier wins.
 * Duo: both teammates' bonuses, the higher combined multiplier wins. Exact
 * tie → replay. Each bonus is saved on its own a moment after it's typed, so
 * the stream shows it right away; the winner is decided on Save.
 */
function BattleResultForm({ match, duo, busy, onBonus, onSubmit }: {
  match: KoMatch; duo: boolean; busy: boolean;
  onBonus: (key: BonusKey, b: Bonus) => void;
  onSubmit: (r: { p1?: Bonus; p2?: Bonus; p1b?: Bonus; p2b?: Bonus }, andNext: boolean) => void;
}) {
  // Reaping: a boss side plays its target (no bonus); an ambushing boss sets a bar for both sides
  const bossSide: 1 | 2 | null = match.p1?.is_boss ? 1 : match.p2?.is_boss ? 2 : null;
  const bossOf = (n: 1 | 2) => (n === 1 ? match.p1 : match.p2);
  const bar = bossSide ? Number(bossOf(bossSide)!.boss_target) : match.boss ? Number(match.boss.boss_target) : null;
  // default bonus cost is $100 (the usual stake); payouts start empty, or with what was already saved
  const init = (r: KoMatch["p1_result"]): Bonus => (r ? { cost: String(Number(r.cost)), payout: String(Number(r.payout)) } : { cost: "100", payout: "" });
  const [b, setB] = useState<Record<BonusKey, Bonus>>(() => ({ p1: init(match.p1_result), p1b: init(match.p1b_result), p2: init(match.p2_result), p2b: init(match.p2b_result) }));
  const set = (k: keyof typeof b) => (v: Bonus) => setB((x) => ({ ...x, [k]: v }));
  const sig = (v: Bonus) => `${v.cost}/${v.payout}`;
  const [saved, setSaved] = useState<Partial<Record<BonusKey, string>>>(() => {
    const out: Partial<Record<BonusKey, string>> = {};
    for (const k of KEYS) if (b[k].payout) out[k] = sig(b[k]);
    return out;
  });
  const save = useRef(onBonus);
  useEffect(() => { save.current = onBonus; }, [onBonus]);
  useEffect(() => {
    const id = setTimeout(() => {
      for (const k of duo ? KEYS : (["p1", "p2"] as const)) {
        if (bossSide && k.startsWith(`p${bossSide}`)) continue;
        if (multi(b[k]) && saved[k] !== sig(b[k])) { save.current(k, b[k]); setSaved((x) => ({ ...x, [k]: sig(b[k]) })); }
      }
    }, 700);
    return () => clearTimeout(id);
  }, [b, saved, duo, bossSide]);
  const total = (a: Bonus, c: Bonus) => {
    const x = multi(a);
    if (!duo) return x;
    const y = multi(c);
    return x || y ? (Number(x ?? 0) + Number(y ?? 0)).toFixed(2) : null; // a missing bonus counts 0 until entered
  };
  const m1 = bossSide === 1 ? String(bar) : total(b.p1, b.p1b), m2 = bossSide === 2 ? String(bar) : total(b.p2, b.p2b);
  const needed = (duo ? KEYS : (["p1", "p2"] as const)).filter((k) => !(bossSide && k.startsWith(`p${bossSide}`)));
  const complete = needed.every((k) => multi(b[k]));
  // preview only (the server decides with exact decimals): "boss" = the ambusher takes the seat
  const lead: 0 | 1 | 2 | "boss" | null = !complete ? null
    : bossSide ? (Number(bossSide === 1 ? m2 : m1) >= bar! ? (bossSide === 1 ? 2 : 1) : bossSide)
    : bar != null && Number(m1) < bar && Number(m2) < bar ? "boss"
    : Number(m1) > Number(m2) ? 1 : Number(m2) > Number(m1) ? 2 : 0;
  const bonus = (label: string, key: BonusKey) => {
    const v = b[key], onChange = set(key);
    return (
      <div>
        <p className="mb-1 truncate text-xs font-semibold text-muted">{label}</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Cost ($)</span>
            <input inputMode="decimal" value={v.cost} onChange={(e) => onChange({ ...v, cost: e.target.value.trim() })} placeholder="100" className="field text-right font-mono" />
          </label>
          <label className="block"><span className="label">Payout ($)</span>
            <input inputMode="decimal" value={v.payout} onChange={(e) => onChange({ ...v, payout: e.target.value.trim() })} placeholder="125" className="field text-right font-mono" />
          </label>
        </div>
        <p className="mt-1 text-right font-mono text-xs text-dim">
          {multi(v) && saved[key] === sig(v) && <span className="mr-2 text-neon">✓ on stream</span>}
          {multi(v) ? `x${multi(v)}` : "x—"}
        </p>
      </div>
    );
  };
  const side = (n: 1 | 2) => {
    const cap = n === 1 ? match.p1 : match.p2;
    const m = n === 1 ? m1 : m2;
    if (bossSide === n && cap) {
      return (
        <div className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center ${lead === n ? "border-[#b06bff] bg-[#b06bff]/10" : "border-[#b06bff]/40 bg-bg-2"}`}>
          <Skull className="size-7 text-[#c9a6ff]" />
          <p className="font-head font-bold text-[#c9a6ff]">{cap.username}</p>
          <p className="text-xs text-muted">Boss target, no bonus to play</p>
          <p className="font-mono text-3xl font-bold text-[#c9a6ff]">{bar}x</p>
        </div>
      );
    }
    return (
      <div className={`space-y-3 rounded-2xl border-2 p-3 ${lead === n ? "border-gold/70 bg-gold/10" : n === 1 ? "border-neon/30 bg-bg-2" : "border-silver/30 bg-bg-2"}`}>
        <p className={`truncate font-head font-bold ${n === 1 ? "text-neon" : "text-silver"}`}>{cap ? teamName(cap) : `Side ${n}`}</p>
        {bonus(duo ? cap?.username ?? "Player 1" : "Bonus", n === 1 ? "p1" : "p2")}
        {duo && bonus(cap?.partner?.username ?? "Player 2", n === 1 ? "p1b" : "p2b")}
        <p className={`text-center font-mono text-3xl font-bold ${lead === n ? "text-gold" : "text-muted"}`}>{m ? `x${m}` : "x—"}</p>
      </div>
    );
  };
  const winner = lead === 1 ? match.p1 : lead === 2 ? match.p2 : lead === "boss" ? match.boss : null;
  return (
    <form className="mt-6 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      // which button sent it: "Save & start next" (default, Enter) or "Save only"
      const andNext = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "only";
      if (!complete) return;
      const r: { p1?: Bonus; p2?: Bonus; p1b?: Bonus; p2b?: Bonus } = {};
      for (const k of needed) r[k] = b[k];
      onSubmit(r, andNext);
    }}>
      <p className="text-center font-head text-xs font-bold uppercase tracking-[0.18em] text-muted">
        Bonus results · {bossSide ? `reach the boss's ${bar}x${duo ? " as a team" : ""} or get reaped`
          : bar != null ? `ambush: reach ${bar}x${duo ? " as a team" : ""}, the higher multiplier wins, nobody = both reaped`
          : duo ? "the higher combined multiplier wins" : "the higher multiplier wins"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{side(1)}{side(2)}</div>
      {lead === 0 && <p className="text-center text-sm text-gold">Exact tie: replay the bonus and enter the replay&apos;s results.</p>}
      {winner && (winner.is_boss
        ? <p className="text-center text-sm text-[#c9a6ff]"><Skull className="mr-1 inline size-4" /><b>{winner.username}</b> reaps {bossSide ? teamName(bossOf(bossSide === 1 ? 2 : 1)!) : "both sides"}</p>
        : <p className="text-center text-sm text-muted"><b className="text-gold">{teamName(winner)}</b> win{duo ? "" : "s"}</p>)}
      <div className="flex flex-wrap justify-center gap-2">
        <button value="next" disabled={busy || !complete || lead === 0} className="btn btn-neon"><Play className="size-4" /> Save &amp; start next</button>
        <button value="only" disabled={busy || !complete || lead === 0} className="btn btn-ghost">Save only</button>
      </div>
    </form>
  );
}

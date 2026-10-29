"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dices, Play, SkipForward, UserPlus } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm";
import type { BonusKey, KoMatch, KoParticipant, KoState } from "@/lib/knockout";
import { Bracket, Counter, ParticipantRow, Podium, RollReveal, VsScreen, roundName, teamName } from "./parts";
import { useJoinReader, type ReaderStatus } from "./useJoinReader";
import { useKoState } from "./useKoState";
import { FinisherStage, demoShow, type Show } from "./fight/Finishers";

// Live control room (ported from ONO). All state comes from the server
// (polled); every button is a server call with backend rule checks.

const READER: Record<ReaderStatus, { label: string; tone: string }> = {
  off: { label: "Chat webhook off", tone: "text-dim" },
  connecting: { label: "Checking Kick chat webhook…", tone: "text-gold" },
  live: { label: "Kick chat webhook connected", tone: "text-neon" },
  error: { label: "Kick webhook not subscribed, retrying", tone: "text-danger" },
};

const OUTCOME: Record<string, string> = {
  registered: "registered", rerolled: "slot changed", duplicate_message: "duplicate ignored", no_tournament: "no tournament",
  registration_closed: "registration closed", full: "full", locked_in_bracket: "locked in bracket", eliminated: "eliminated, ignored",
  pending_roll: "being rolled, ignored", disqualified: "disqualified, ignored", no_slots: "slot catalogue empty!", slot_taken: "slot already called, ignored", processing_failed: "server error", network_error: "network error",
};

const SIZES = [4, 8, 16, 32] as const;
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
  const [preview, setPreview] = useState<{ n: number; show: Show | null }>({ n: 0, show: null });
  const [form, setForm] = useState({ title: "", prize: "", size: 16 as (typeof SIZES)[number], duo: false, p1: "", p2: "", p3: "" });
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
        {state?.champion && <div className="panel p-6"><p className="eyebrow mb-4">Last tournament · {state.tournament.title}</p><Podium state={state} /></div>}
        <form
          className="panel space-y-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            act("create", { title: form.title, prize: form.prize, size: form.size, duo: form.duo, prizes: [form.p1 || null, null, null] });
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
            <div className="grid grid-cols-2 gap-2">
              {([false, true] as const).map((duo) => (
                <button key={String(duo)} type="button" onClick={() => setForm({ ...form, duo })} aria-pressed={form.duo === duo}
                  className={`rounded-xl border-2 px-3 py-3 text-left transition ${form.duo === duo ? "border-neon bg-neon/10" : "border-line-hot hover:border-neon"}`}>
                  <span className="block font-head text-lg font-bold">{duo ? "Duo · 2v2" : "Solo · 1v1"}</span>
                  <span className="block text-xs text-muted">{duo ? "Everyone !joins alone, then gets a random teammate. Both bonuses count: the higher combined multiplier wins." : "Each player battles alone. The higher multiplier wins."}</span>
                </button>
              ))}
            </div>
          </div>
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
          <label className="block max-w-xs"><span className="label">Champion prize ($)</span>
            <input inputMode="decimal" pattern="\d{1,9}(\.\d{1,2})?" value={form.p1} onChange={(e) => setForm({ ...form, p1: e.target.value })} placeholder="300" className="field font-mono" />
          </label>
          <button disabled={busy !== null} className="btn btn-neon">Create {form.duo ? `${form.size}-team duo (${form.size * 2} players)` : `${form.size}-player`} tournament</button>
          {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
        </form>
      </div>
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
      <FinisherStage show={preview.show} sound skippable onDone={() => setPreview((v) => ({ ...v, show: null }))} />
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">Tournament #{t.id} · {duo ? `Duo 2v2 · ${size} teams` : `Solo · ${size} players`}{t.prize ? ` · ${t.prize}` : ""}</p>
          <h2 className="font-display text-3xl"><span className="chrome">{t.title}</span></h2>
          <p className={`mt-1 text-xs ${READER[reader.status].tone}`}>● {READER[reader.status].label}{reader.status === "error" && reader.detail ? <span className="text-dim"> ({reader.detail})</span> : null}</p>
          <p className="text-[11px] text-dim">
            {reader.lastSeen ? <>Last chat message: <span className="text-muted">{reader.lastSeen.username}</span> at {new Date(reader.lastSeen.at).toLocaleTimeString()}</> : "No chat message received yet (set the webhook URL in your Kick app)"}
          </p>
        </div>
        <Counter value={state.registered} max={state.capacity} open={t.status === "open"} />
        <div className="flex flex-wrap gap-2">
          {t.status === "closed" ? (
            <button disabled={busy !== null || state.registered >= state.capacity || state.teamsMade} onClick={() => act("open")} className="btn btn-neon btn-sm">Open registration</button>
          ) : (
            <button disabled={busy !== null} onClick={() => act("close", {}, "Close registration? Nobody new can join (registered players can still change slot until they're rolled).")} className="btn btn-ghost btn-sm">Close registration</button>
          )}
          {duo && t.status === "closed" && !state.teamsMade && (
            <button disabled={busy !== null} onClick={() => act("make_teams", {}, `Draw random teams of 2 from the ${state.registered} registered players? Registration stays closed once teams are drawn.`)} className="btn btn-neon btn-sm">Make teams</button>
          )}
          {duo && state.teamsMade && firstRoundOpen && !state.pendingRoll && state.matches.every((m) => m.round !== 1 || m.status === "empty") && (
            <button disabled={busy !== null} onClick={() => act("undo_teams", {}, "Undo the team draw? Everyone goes back to waiting alone.")} className="btn btn-ghost btn-sm">Undo teams</button>
          )}
          <button type="button" onClick={() => setPreview((v) => ({ n: v.n + 1, show: demoShow(v.n) }))} className="btn btn-ghost btn-sm" title="Play a made-up finisher (what the overlay shows when a battle ends)">Preview K.O.</button>
          <button disabled={busy !== null} onClick={() => act("reset", {}, "Reset the tournament? It is cancelled and a new one can be created. This can't be undone.")} className="btn btn-ghost btn-sm !text-danger">Reset</button>
        </div>
      </div>

      {msg && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
      {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">Lost connection to the server, retrying. Nothing is lost: the tournament is saved in the database.</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="panel relative overflow-hidden p-4 sm:p-6">
          {state.champion ? (
            <Podium state={state} />
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
                {[state.live.p1, state.live.p2].map((p) => p && (
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
  onSubmit: (r: { p1: Bonus; p2: Bonus; p1b?: Bonus; p2b?: Bonus }, andNext: boolean) => void;
}) {
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
        if (multi(b[k]) && saved[k] !== sig(b[k])) { save.current(k, b[k]); setSaved((x) => ({ ...x, [k]: sig(b[k]) })); }
      }
    }, 700);
    return () => clearTimeout(id);
  }, [b, saved, duo]);
  const total = (a: Bonus, c: Bonus) => {
    const x = multi(a);
    if (!duo) return x;
    const y = multi(c);
    return x || y ? (Number(x ?? 0) + Number(y ?? 0)).toFixed(2) : null; // a missing bonus counts 0 until entered
  };
  const m1 = total(b.p1, b.p1b), m2 = total(b.p2, b.p2b);
  const complete = (duo ? KEYS : (["p1", "p2"] as const)).every((k) => multi(b[k]));
  const lead = complete ? (Number(m1) > Number(m2) ? 1 : Number(m2) > Number(m1) ? 2 : 0) : null;
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
    return (
      <div className={`space-y-3 rounded-2xl border-2 p-3 ${lead === n ? "border-gold/70 bg-gold/10" : n === 1 ? "border-neon/30 bg-bg-2" : "border-silver/30 bg-bg-2"}`}>
        <p className={`truncate font-head font-bold ${n === 1 ? "text-neon" : "text-silver"}`}>{cap ? teamName(cap) : `Side ${n}`}</p>
        {bonus(duo ? cap?.username ?? "Player 1" : "Bonus", n === 1 ? "p1" : "p2")}
        {duo && bonus(cap?.partner?.username ?? "Player 2", n === 1 ? "p1b" : "p2b")}
        <p className={`text-center font-mono text-3xl font-bold ${lead === n ? "text-gold" : "text-muted"}`}>{m ? `x${m}` : "x—"}</p>
      </div>
    );
  };
  const winner = lead === 1 ? match.p1 : lead === 2 ? match.p2 : null;
  return (
    <form className="mt-6 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      // which button sent it: "Save & start next" (default, Enter) or "Save only"
      const andNext = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "only";
      if (complete) onSubmit(duo ? b : { p1: b.p1, p2: b.p2 }, andNext);
    }}>
      <p className="text-center font-head text-xs font-bold uppercase tracking-[0.18em] text-muted">
        Bonus results · {duo ? "the higher combined multiplier wins" : "the higher multiplier wins"}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{side(1)}{side(2)}</div>
      {lead === 0 && <p className="text-center text-sm text-gold">Exact tie: replay the bonus and enter the replay&apos;s results.</p>}
      {winner && <p className="text-center text-sm text-muted"><b className="text-gold">{teamName(winner)}</b> win{duo ? "" : "s"}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button value="next" disabled={busy || !complete || lead === 0} className="btn btn-neon"><Play className="size-4" /> Save &amp; start next</button>
        <button value="only" disabled={busy || !complete || lead === 0} className="btn btn-ghost">Save only</button>
      </div>
    </form>
  );
}

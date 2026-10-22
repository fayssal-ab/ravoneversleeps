"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import type { KoMatch, KoParticipant, KoState } from "@/lib/knockout";

// Tournament presentation shared by the admin dashboard, public page and OBS
// overlay (logic ported from ONO). Player 1 is the neon side, player 2 the
// chrome side; usernames are public Kick chat handles.

/** Round names for a bracket of `size` players (client copy of lib/knockout). */
export function roundName(size: number, round: number): string {
  const fromEnd = Math.round(Math.log2(size)) - round;
  return fromEnd === 0 ? "Finals" : fromEnd === 1 ? "Semi-finals" : fromEnd === 2 ? "Quarter-finals" : `Round of ${2 ** (fromEnd + 1)}`;
}

/** Display name: the player, or "captain & teammate" for a duo team. */
export function teamName(p: Pick<KoParticipant, "username"> & { partner?: KoParticipant | null }): string {
  return p.partner ? `${p.username} & ${p.partner.username}` : p.username;
}

export function matchLabel(m: Pick<KoMatch, "round" | "match_index">, size: number): string {
  if (m.round === Math.round(Math.log2(size))) return m.match_index === 1 ? "3rd-place match" : "Grand Final";
  return `${roundName(size, m.round)} · Battle ${m.match_index + 1}`;
}

const STATE: Record<KoParticipant["state"], { label: string; tone: string }> = {
  registered: { label: "Waiting", tone: "border-line-hot text-muted" },
  in_knockout: { label: "In bracket", tone: "border-neon/50 text-neon" },
  eliminated: { label: "Out", tone: "border-danger/50 text-danger" },
  champion: { label: "Champion", tone: "border-gold/60 text-gold" },
};

export function StateBadge({ state, dq = false }: { state: KoParticipant["state"]; dq?: boolean }) {
  if (dq) return <span className="rounded-full border border-danger/60 bg-danger/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">Disqualified</span>;
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATE[state].tone}`}>{STATE[state].label}</span>;
}

/** Kick profile picture, or the name's initial when there is none (or it fails to load). */
export function KickAvatar({ name, src, size, className = "" }: { name: string; src: string | null; size: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-neon/60 bg-neon-ink font-head font-bold uppercase text-neon ${className}`}
      style={{ width: size, height: size, fontSize: `calc(${size} * 0.45)` }}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        name.charAt(0) || "?"
      )}
    </span>
  );
}

/** `onDisqualify` (admin dashboard only) adds the DQ control. */
export function ParticipantRow({ p, index, onDisqualify, team }: { p: KoParticipant; index: number; onDisqualify?: (p: KoParticipant) => void; team?: string }) {
  const canDq = onDisqualify && !p.disqualified && (p.state === "registered" || p.state === "in_knockout");
  return (
    <li className={`entrant-in flex min-w-0 items-center gap-3 rounded-xl border border-line bg-bg-2 p-2 ${p.state === "eliminated" ? "opacity-45" : ""}`}>
      <span className="w-6 text-center font-mono text-xs text-dim">{index + 1}</span>
      <SlotArt name={p.slot_name} src={p.slot_image} size={44} rounded="rounded-lg" />
      <KickAvatar name={p.username} src={p.avatar} size="32px" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-head font-bold">{p.username}</span>
        <span className="block truncate text-xs text-dim">{p.slot_name}{p.slot_provider ? ` · ${p.slot_provider}` : ""}</span>
        {team && <span className="block truncate text-[11px] text-neon/80">Team {team}</span>}
      </span>
      <StateBadge state={p.state} dq={p.disqualified} />
      {canDq && (
        <button
          type="button"
          onClick={() => onDisqualify(p)}
          className="grid h-9 shrink-0 place-items-center rounded-lg border border-danger/40 px-2.5 font-head text-[11px] font-bold uppercase tracking-wider text-danger transition hover:bg-danger/10"
          aria-label={`Disqualify ${p.username}`}
          title="Disqualify"
        >
          DQ
        </button>
      )}
    </li>
  );
}

export function Counter({ value, max, open }: { value: number; max: number; open: boolean }) {
  return (
    <div className="flex items-end gap-3">
      <span className="font-mono text-5xl font-bold tabular-nums">{value}<span className="text-dim">/{max}</span></span>
      <span className={`mb-2 rounded-full border px-2.5 py-0.5 font-head text-xs font-bold uppercase tracking-wider ${open ? "animate-pulse border-neon/60 text-neon" : "border-line-hot text-muted"}`}>
        {open ? "Registration open" : "Registration closed"}
      </span>
    </div>
  );
}

const SIDE = {
  l: { color: "var(--color-neon)", glow: "rgb(141 255 74 / 0.45)", text: "text-neon", anim: "ko-slide-l" },
  r: { color: "var(--color-silver)", glow: "rgb(217 225 220 / 0.4)", text: "text-silver", anim: "ko-slide-r" },
};

/** Duo: each teammate's slot art, two per side. */
const duoArt = (big: boolean) => (big ? "200px" : "clamp(64px, min(15vw, 7vw + 30px), 130px)");

function Fighter({ p, side, outcome, big, result, resultB, total, pending }: {
  p: KoParticipant | null; side: "l" | "r"; outcome: "win" | "lose" | null; big: boolean;
  result: KoMatch["p1_result"]; resultB: KoMatch["p1b_result"]; total: string | null; pending: boolean;
}) {
  const s = SIDE[side];
  const art = big ? "240px" : "clamp(96px, min(26vw, 12vw + 40px), 200px)";
  if (!p) {
    return (
      <div className={`flex min-w-0 flex-col items-center gap-2 text-center ${s.anim}`}>
        <span className="grid place-items-center rounded-2xl border-2 border-dashed border-line-hot font-display text-4xl text-dim" style={{ width: art, height: art }}>?</span>
        <span className="font-head text-lg text-dim">TBD</span>
      </div>
    );
  }
  const tile = (m: KoParticipant, size: string) => (
    <div
      className={`relative mb-1 overflow-hidden rounded-2xl border-2 ${outcome === "win" ? "ko-glow border-gold" : ""}`}
      style={outcome === "win" ? undefined : { borderColor: s.color, boxShadow: `0 0 40px -8px ${s.glow}` }}
    >
      <SlotArt name={m.slot_name} src={m.slot_image} fluid={size} rounded="rounded-[0.9rem]" className="!border-0" />
      <span className="ko-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {outcome === "win" && <span className="absolute inset-x-0 bottom-0 bg-gold py-1 text-center font-head text-[11px] font-black uppercase tracking-[0.3em] text-bg">Winner</span>}
    </div>
  );
  return (
    <div className={`flex min-w-0 flex-col items-center gap-1.5 text-center transition-[opacity,filter] duration-500 ${s.anim} ${outcome === "lose" ? "opacity-40 grayscale" : ""}`}>
      {p.partner ? (
        // duo: both teammates' slots side by side, each with its player
        <div className={`grid w-full grid-cols-2 ${big ? "gap-5" : "gap-2"}`}>
          {([[p, result], [p.partner, resultB]] as const).map(([m, r]) => (
            <div key={m.id} className="flex min-w-0 flex-col items-center">
              {tile(m, duoArt(big))}
              <p className={`w-full truncate font-head font-bold leading-tight ${big ? "text-3xl" : "text-[clamp(0.85rem,2.4vw,1.1rem)]"} ${outcome === "win" ? "text-gold" : ""}`}>{m.username}</p>
              <p className={`w-full truncate font-semibold leading-tight ${big ? "text-lg" : "text-[11px]"} ${s.text}`}>{m.slot_name}</p>
              {(r || pending) && <p className={`font-mono font-bold ${big ? "text-2xl" : "text-sm"} ${r ? "" : "text-dim"}`}>x{r?.multi ?? "0.00"}</p>}
            </div>
          ))}
        </div>
      ) : (
        <>
          {tile(p, art)}
          <p className={`w-full truncate font-head font-bold leading-tight ${big ? "text-4xl" : "text-[clamp(1rem,3.2vw,1.4rem)]"} ${outcome === "win" ? "text-gold" : ""}`}>{p.username}</p>
          <p className={`w-full truncate font-semibold leading-tight ${big ? "text-xl" : "text-sm"} ${s.text}`}>{p.slot_name}</p>
          <p className={`w-full truncate uppercase tracking-wider text-dim ${big ? "text-sm" : "text-[10px]"}`}>{p.slot_provider || " "}</p>
        </>
      )}
      {total || pending ? (
        // live: x0.00 until the first bonus is in, then each saved bonus counts straight away
        <div className="mt-2">
          <p className={`font-mono font-bold tabular-nums leading-none ${big ? "text-6xl" : "text-[clamp(1.6rem,4.5vw,2.2rem)]"} ${outcome === "win" ? "text-gold" : total ? "text-muted" : "text-dim"}`}>x{total ?? "0.00"}</p>
          {result && !p.partner && (
            <p className={`mt-1 font-mono text-dim ${big ? "text-base" : "text-[11px]"}`}>${Number(result.payout).toLocaleString("en-US")} / ${Number(result.cost).toLocaleString("en-US")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The 1v1 card. Key it by match id + status so the entrance replays. */
export function VsScreen({ match, size, big = false }: { match: KoMatch; size: number; big?: boolean }) {
  const outcome = (p: KoParticipant | null) => (match.winner_id == null || !p ? null : match.winner_id === p.id ? "win" : "lose");
  const duo = Boolean(match.p1?.partner || match.p2?.partner);
  const art = duo ? duoArt(big) : big ? "240px" : "clamp(96px, min(26vw, 12vw + 40px), 200px)";
  return (
    <div className="relative">
      {/* split arena glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_40%,rgb(141_255_74/0.16),transparent_55%),radial-gradient(ellipse_at_85%_40%,rgb(217_225_220/0.12),transparent_55%)]" />
      <p className="mb-5 text-center font-head text-xs font-bold uppercase tracking-[0.22em] text-muted">
        {matchLabel(match, size)}
        {match.status === "live" && <span className="ml-2 rounded-full bg-danger px-2 py-0.5 text-[10px] text-white">● Live</span>}
        {match.status === "rolled" && <span className="ml-2 text-gold">· awaiting confirmation</span>}
        {match.status === "bye" && <span className="ml-2 text-neon">· bye</span>}
      </p>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch ${big ? "gap-12" : "gap-2 sm:gap-4"}`}>
        <Fighter p={match.p1} side="l" outcome={outcome(match.p1)} big={big} result={match.p1_result} resultB={match.p1b_result} total={match.p1_multi} pending={match.status === "live"} />
        <span className="relative grid place-items-center self-start" style={{ height: art }}>
          <svg viewBox="0 0 40 120" className={`ko-bolt absolute ${big ? "h-56" : "h-28 sm:h-36"} text-neon`} aria-hidden>
            <path d="M24 0 8 58h12L12 120l20-70H20L30 0Z" fill="currentColor" opacity=".35" />
          </svg>
          <span className={`ko-vs relative font-display leading-none ${big ? "text-[10rem]" : duo ? "text-[clamp(44px,9vw,84px)]" : "text-[clamp(30px,6vw,56px)]"}`}>
            <span className="chrome">V</span><span className="neon-text">S</span>
          </span>
        </span>
        <Fighter p={match.p2} side="r" outcome={outcome(match.p2)} big={big} result={match.p2_result} resultB={match.p2b_result} total={match.p2_multi} pending={match.status === "live"} />
      </div>
    </div>
  );
}

type Spinner = Pick<KoParticipant, "username" | "slot_name" | "slot_image" | "slot_provider" | "partner">;
const BYE: Spinner = { username: "BYE", slot_name: "Free pass", slot_image: "", slot_provider: "" };

/**
 * Roller animation: the result is already decided server-side
 * (crypto.randomInt); this only reveals it, slowing down onto P1 then P2.
 */
export function useRollSpin(match: KoMatch, pool: KoParticipant[], onDone?: () => void) {
  const [items] = useState<Spinner[]>(() => (pool.length ? pool.map((p) => ({ ...p, username: teamName(p) })) : [BYE]));
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [shown, setShown] = useState<[Spinner, Spinner]>([items[0], items[0]]);
  const done = useRef(onDone);
  const asSpinner = (p: KoParticipant | null): Spinner => (p ? { ...p, username: teamName(p) } : BYE);
  const finals = useRef<[Spinner, Spinner]>([asSpinner(match.p1), asSpinner(match.p2)]);
  useEffect(() => { done.current = onDone; finals.current = [asSpinner(match.p1), asSpinner(match.p2)]; }, [onDone, match.p1, match.p2]);
  const p1Id = match.p1?.id ?? 0;
  const p2Id = match.p2?.id ?? 0;

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const [f1, f2] = finals.current;
    if (reduce) {
      timers.push(setTimeout(() => { setShown([f1, f2]); setPhase(2); done.current?.(); }, 0));
      return () => timers.forEach(clearTimeout);
    }
    const spin = (slot: 0 | 1, final: Spinner, then: () => void) => {
      let delay = 45;
      let i = Math.floor(Math.random() * items.length); // visual only
      const step = () => {
        if (cancelled) return;
        i = (i + 1) % items.length;
        setShown((s) => (slot === 0 ? [items[i], s[1]] : [s[0], items[i]]));
        delay *= 1.12;
        if (delay < 420) timers.push(setTimeout(step, delay));
        else { setShown((s) => (slot === 0 ? [final, s[1]] : [s[0], final])); timers.push(setTimeout(then, 750)); }
      };
      step();
    };
    spin(0, f1, () => { setPhase(1); spin(1, f2, () => { setPhase(2); done.current?.(); }); });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [match.id, match.roll_seq, p1Id, p2Id, items]);

  return { phase, shown };
}

export function RollSlot({ s, state, side, big = false }: { s: Spinner | null; state: "waiting" | "spinning" | "locked"; side: "l" | "r"; big?: boolean }) {
  const art = big ? 132 : 72;
  const c = SIDE[side];
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border-2 bg-bg-2 p-3 transition-colors"
      style={{ borderColor: state === "locked" ? c.color : "var(--color-line)", boxShadow: state === "locked" ? `0 0 34px -8px ${c.glow}` : undefined }}>
      {s && state !== "waiting" ? (
        <SlotArt name={s.slot_name} src={s.slot_image} size={art} className={state === "spinning" ? "opacity-80 blur-[0.5px]" : ""} />
      ) : (
        <span className="grid shrink-0 place-items-center rounded-xl border border-dashed border-line-hot text-dim" style={{ width: art, height: art }}>?</span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate font-head font-bold leading-tight ${big ? "text-4xl" : "text-xl"} ${state === "locked" ? c.text : state === "spinning" ? "" : "text-dim"}`}>
          {s && state !== "waiting" ? s.username : "Waiting…"}
        </span>
        <span className={`mt-0.5 block truncate leading-tight text-dim ${big ? "text-lg" : "text-xs"}`}>{s && state !== "waiting" ? s.slot_name : " "}</span>
      </span>
    </div>
  );
}

/** Roller reveal; ends on the VS card. */
export function RollReveal({ match, pool, size, big = false, onDone }: { match: KoMatch; pool: KoParticipant[]; size: number; big?: boolean; onDone?: () => void }) {
  const { phase, shown } = useRollSpin(match, pool, onDone);
  if (phase === 2) return <VsScreen key={`vs-${match.id}`} match={match} size={size} big={big} />;
  const st = (slot: 0 | 1) => (phase > slot ? "locked" : phase === slot ? "spinning" : "waiting");
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <p className="eyebrow !text-gold">Rolling {phase === 0 ? "player 1" : "player 2"}…</p>
      <div className={`grid w-full items-center ${big ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-10" : "mx-auto max-w-md grid-cols-1 gap-2"}`}>
        <RollSlot s={shown[0]} state={st(0)} side="l" big={big} />
        <span className={`text-center font-display leading-none text-dim ${big ? "text-7xl" : "text-2xl"}`}>VS</span>
        <RollSlot s={shown[1]} state={st(1)} side="r" big={big} />
      </div>
    </div>
  );
}

function BracketCell({ m, champion }: { m: KoMatch; champion: number | null }) {
  const row = (p: KoParticipant | null, res: string | null, side: "l" | "r") => {
    const won = p && m.winner_id === p.id;
    const lost = p && m.winner_id != null && m.winner_id !== p.id;
    return (
      <div className={`flex items-center gap-2.5 px-2.5 py-2 ${won ? "bg-gold/10" : ""} ${lost ? "opacity-45" : ""}`}>
        <span className="h-6 w-0.5 rounded-full" style={{ background: SIDE[side].color }} />
        {p ? <SlotArt name={p.slot_name} src={p.slot_image} size={34} rounded="rounded-md" /> : <span className="size-[34px] rounded-md border border-dashed border-line" />}
        <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-bold text-gold" : "text-text/80"}`}>{p ? teamName(p) : m.status === "void" ? "—" : "TBD"}</span>
        {res && <span className={`font-mono text-xs ${won ? "font-bold text-gold" : "text-dim"}`}>x{res}</span>}
        {won && champion === p?.id && <Crown className="size-3.5 text-gold" />}
      </div>
    );
  };
  const tone = m.status === "live" ? "border-danger/70 shadow-[0_0_20px_-6px_var(--color-danger)]" : m.status === "rolled" ? "border-gold/50" : m.winner_id ? "border-neon/30" : "border-line";
  return (
    <div className={`overflow-hidden rounded-xl border bg-surface ${tone} ${m.status === "void" ? "opacity-30" : ""}`}>
      {row(m.p1, m.p1_multi, "l")}
      <div className="h-px bg-line" />
      {m.status === "bye" ? <div className="px-3 py-1.5 text-xs text-dim">bye</div> : row(m.p2, m.p2_multi, "r")}
    </div>
  );
}

/** Bracket for any size: horizontal columns on desktop, stacked rounds on mobile. */
export function Bracket({ state }: { state: KoState }) {
  const size = state.tournament.max_players;
  const champ = state.tournament.champion_id ? Number(state.tournament.champion_id) : null;
  const rounds = Array.from({ length: state.rounds }, (_, i) => i + 1);
  // only the champion is awarded: the 3rd-place match of older tournaments is hidden
  const byRound = (r: number) => state.matches.filter((m) => m.round === r && !(r === state.rounds && m.match_index === 1));
  return (
    <>
      <div className="hidden overflow-x-auto pb-2 lg:block">
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${rounds.length + 1}, minmax(200px, 1fr))`, minWidth: (rounds.length + 1) * 220 }}>
          {rounds.map((r) => (
            <div key={r} className="flex flex-col">
              <p className="mb-3 text-center font-head text-xs font-bold uppercase tracking-[0.18em] text-muted">{roundName(size, r)}</p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {byRound(r).map((m) => (
                  <div key={m.id}>

                    <BracketCell m={m} champion={champ} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-col">
            <p className="mb-3 text-center font-head text-xs font-bold uppercase tracking-[0.18em] text-muted">Champion</p>
            <div className="flex flex-1 items-center"><Podium state={state} compact /></div>
          </div>
        </div>
      </div>
      <div className="space-y-6 lg:hidden">
        {state.champion && <Podium state={state} compact />}
        {[...rounds].reverse().map((r) => (
          <section key={r}>
            <p className="mb-2 font-head text-xs font-bold uppercase tracking-[0.18em] text-muted">{roundName(size, r)}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {byRound(r).map((m) => (
                <div key={m.id}><BracketCell m={m} champion={champ} /></div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function ChampionCard({ p, compact = false, celebrate = false }: { p: KoParticipant | null; compact?: boolean; celebrate?: boolean }) {
  const bursts = useMemo(() => Array.from({ length: celebrate ? 28 : 0 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return { bx: `${Math.cos(a) * (160 + (i % 4) * 40)}px`, by: `${Math.sin(a) * (120 + (i % 3) * 40)}px`, c: ["var(--color-gold)", "var(--color-neon)", "var(--color-silver)", "var(--color-neon-bright)"][i % 4], d: `${(i % 7) * 0.08}s` };
  }), [celebrate]);
  if (!p) return <div className="w-full rounded-xl border border-dashed border-line p-4 text-center text-sm text-dim">To be crowned</div>;
  return (
    <div className={`ko-glow relative w-full overflow-hidden rounded-2xl border border-gold/50 bg-gradient-to-b from-gold/15 to-transparent text-center ${compact ? "p-3" : "p-8"}`}>
      {bursts.map((b, i) => (
        <span key={i} className="ko-burst pointer-events-none absolute left-1/2 top-1/2 size-2 rounded-full"
          style={{ background: b.c, animationDelay: b.d, ["--bx" as string]: b.bx, ["--by" as string]: b.by }} />
      ))}
      <Crown className={`ko-crown mx-auto text-gold ${compact ? "size-6" : "size-12"}`} />
      <div className={`mx-auto w-fit ${compact ? "mt-2" : "mt-4"}`}><SlotArt name={p.slot_name} src={p.slot_image} size={56} fluid={compact ? undefined : "clamp(96px, 28vw, 170px)"} /></div>
      <p className={`mt-2 truncate font-head font-bold text-gold ${compact ? "text-base" : "text-3xl md:text-5xl"}`}>{teamName(p)}</p>
      <p className={`truncate text-neon ${compact ? "text-[11px]" : "text-base md:text-xl"}`}>{p.slot_name}</p>
      {!compact && <p className="eyebrow mt-3 !text-gold">Tournament champion</p>}
    </div>
  );
}

/** The champion and their prize (only 1st place is awarded). */
export function Podium({ state, compact = false }: { state: KoState; compact?: boolean }) {
  const t = state.tournament;
  const p = state.champion;
  const amount = t.prize_1;
  if (compact) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-gold/50 bg-gold/10 p-2">
        <Crown className="size-4 shrink-0 text-gold" />
        {p && <SlotArt name={p.slot_name} src={p.slot_image} size={28} rounded="rounded-md" />}
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-gold">{p ? teamName(p) : "To be crowned"}</span>
        {amount != null && <span className="font-mono text-[11px] text-dim">${Number(amount).toLocaleString("en-US")}</span>}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md">
      <ChampionCard p={p} celebrate />
      {amount != null && <p className="mt-2 text-center font-mono text-lg text-gold">${Number(amount).toLocaleString("en-US")}</p>}
    </div>
  );
}

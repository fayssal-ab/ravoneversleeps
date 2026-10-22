"use client";

import { useCallback, useEffect, useState } from "react";
import type { KoMatch, KoParticipant, KoState } from "@/lib/knockout";
import { matchLabel } from "../parts";
import { ChampionFinale, KoFinisher, type FightCard } from "./KoFinisher";

// Watches the polled tournament state and queues a K.O. finisher each time a
// battle gets its winner, then the champion finale when the crown is given.
// The first snapshot only records what is already decided, so opening or
// refreshing the page never replays old fights.

export type Show =
  | { key: string; kind: "fight"; card: FightCard }
  | { key: string; kind: "champion"; p: KoParticipant; prize: string | null; title: string };

interface Seen { tid: number; winners: Map<number, number | null>; champion: number | null }

export function useFinishers(state: KoState | null) {
  const [snap, setSnap] = useState<{ state: KoState | null; seen: Seen | null }>({ state: null, seen: null });
  const [queue, setQueue] = useState<Show[]>([]);

  // compare each new snapshot with the previous one, during render
  if (state && state !== snap.state) {
    const t = state.tournament;
    const prev = snap.seen;
    setSnap({ state, seen: { tid: t.id, winners: new Map(state.matches.map((m) => [m.id, m.winner_id])), champion: state.champion?.id ?? null } });
    if (prev && prev.tid === t.id) {
      const add: Show[] = [];
      for (const m of state.matches) {
        if (m.winner_id == null || !m.p1 || !m.p2 || m.status === "bye" || m.status === "void") continue;
        if (prev.winners.has(m.id) && prev.winners.get(m.id) == null) {
          add.push({ key: `f${m.id}-${m.winner_id}`, kind: "fight", card: { match: m, label: matchLabel(m, t.max_players) } });
        }
      }
      if (state.champion && prev.champion == null) {
        add.push({ key: `c${state.champion.id}`, kind: "champion", p: state.champion, prize: t.prize_1, title: t.title });
      }
      // a backlog (several results saved at once) keeps only the latest few
      if (add.length) setQueue((q) => [...q, ...add].slice(-4));
    }
  }

  const next = useCallback(() => setQueue((q) => q.slice(1)), []);
  const push = useCallback((s: Show) => setQueue((q) => [...q, s]), []);
  return { current: queue[0] ?? null, next, push };
}

/** Plays one finisher full screen. `skippable` adds a Skip button and Esc. */
export function FinisherStage({ show, sound = false, skippable = false, onDone }: { show: Show | null; sound?: boolean; skippable?: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show || !skippable) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDone(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [show, skippable, onDone]);
  if (!show) return null;
  return (
    <>
      {show.kind === "fight"
        ? <KoFinisher key={show.key} card={show.card} sound={sound} onDone={onDone} />
        : <ChampionFinale key={show.key} p={show.p} prize={show.prize} title={show.title} sound={sound} onDone={onDone} />}
      {skippable && (
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm fixed bottom-4 right-4 z-[210]">
          Skip
        </button>
      )}
    </>
  );
}

// made-up battles: [player 1, slot, multi] vs [player 2, slot, multi]
const DEMO = [
  [["neon_ninja", "Gates of Olympus", "412.50"], ["silverfox", "Sweet Bonanza", "38.20"]],
  [["kickmaster", "Sugar Rush 1000", "12.10"], ["ravo_fan", "Wanted Dead or a Wild", "1250.00"]],
  [["highroller", "Zeus vs Hades", "96.00"], ["lucky_pug", "Dog House Megaways", "0.00"]],
] as const;

const demoPlayer = (id: number, username: string, slot: string): KoParticipant => ({
  id, username, avatar: null, slot_name: slot, slot_provider: "Demo", slot_image: "", state: "in_knockout", disqualified: false,
  bracket_pos: null, rerolls: 0, joined_at: "", team_id: null,
});

const MATES = [["blep90", "Xmas Drop"], ["cake_b", "Le Viking"]] as const;

/** A made-up battle for previews (`?demo` on the overlay, the admin preview button). Every other one is 2v2. */
export function demoShow(i: number): Show {
  const [a, b] = DEMO[i % DEMO.length];
  if (i % 4 === 3) return { key: `demo-c${i}`, kind: "champion", p: demoPlayer(1, a[0], a[1]), prize: "500", title: "Demo knockout" };
  const p1 = demoPlayer(1, a[0], a[1]), p2 = demoPlayer(2, b[0], b[1]);
  if (i % 2 === 1) {
    p1.partner = demoPlayer(3, MATES[0][0], MATES[0][1]);
    p2.partner = demoPlayer(4, MATES[1][0], MATES[1][1]);
  }
  const match: KoMatch = {
    id: i, round: 1, match_index: 0, status: "done", p1, p2, winner_id: Number(a[2]) > Number(b[2]) ? 1 : 2, roll_seq: null,
    p1_result: null, p2_result: null, p1b_result: null, p2b_result: null, p1_multi: a[2], p2_multi: b[2],
  };
  return { key: `demo-f${i}`, kind: "fight", card: { match, label: "Demo battle" } };
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  arenaFight, bossFight, callSlot, createHunt, fight, revealFate, spawnNext, summonEndboss, type HuntState,
} from "@/lib/hunt/engine";
import { HuntPhase, HuntStats } from "./HuntBoard";
import { HuntStage } from "./HuntStage";

// `/overlay/tournament?hunt-demo`: a made-up Hunt that plays itself in the
// browser (same engine as the real one, random wins) so the OBS scene and
// every animation can be checked without a live tournament. Nothing is saved.

const NAMES = ["Bekind777", "blep90", "NightOwl", "LuckyLena", "GraveDigga", "Mira_X", "Spinz", "CultLeader"];
const SLOTS = ["Gates of Olympus", "Sweet Bonanza", "Wanted Dead or a Wild", "Mental", "Le Bandit", "Sugar Rush"];
const rand = (n: number) => Math.floor(Math.random() * n);
const win = (price: number) => Math.round(price * (0.05 + Math.random() ** 3 * 9) * 100) / 100;
const clone = (s: HuntState): HuntState => JSON.parse(JSON.stringify(s));
const fresh = () => createHunt({ title: "Demo Reaping", prize: 300, duo: false, waves: 1, chance: 100, fall: "half", weights: { Fodder: 20, Minion: 25, Brute: 25, Warlord: 18, Overlord: 12 } }, NAMES.slice(0, 4).map((name, i) => ({ name, pids: [-1 - i] })), rand);

/** One host step on a copy of the game; returns how long the stream needs for it. */
function step(prev: HuntState): { s: HuntState; ms: number } {
  const s = clone(prev);
  try {
    if (s.phase === "hunt") {
      const waiting = s.fights.findIndex((f) => !f.monster);
      if (waiting >= 0) { spawnNext(s, rand); return { s, ms: 8500 }; }
      const i = s.fights.findIndex((f) => !f.done);
      const f = s.fights[i];
      if (!f.call && !f.monster!.secret) { callSlot(s, f.eid, { name: SLOTS[rand(SLOTS.length)], provider: "", image: null, by: s.ents[f.eid].name }); return { s, ms: 2500 }; }
      fight(s, i, win(f.monster!.price), win(f.monster!.price), rand);
      return { s, ms: 8800 };
    }
    if (s.phase === "arena") {
      const r = s.arena!.rounds.at(-1)!;
      const i = r.ms.findIndex((m) => !m.done);
      arenaFight(s, i, win(r.ms[i].price), win(r.ms[i].price), rand);
      return { s, ms: 7800 };
    }
    if (s.phase === "reckon") {
      const r = s.reckon!;
      if (!r.fate) { revealFate(s, rand); return { s, ms: 7600 }; }
      if (!r.boss) { summonEndboss(s, rand); return { s, ms: 10000 }; }
      if (!r.call && !r.boss.secret) { callSlot(s, r.champ, { name: SLOTS[rand(SLOTS.length)], provider: "", image: null, by: s.ents[r.champ].name }); return { s, ms: 2500 }; }
      bossFight(s, win(r.boss.price) * 2, win(r.boss.price), rand);
      return { s, ms: 14000 };
    }
  } catch { /* a rule refused the made-up step: start over */ }
  return { s: again(prev), ms: 1500 };
}

/** A new game that keeps counting events from the last one (the stage only plays newer ones). */
const again = (prev: HuntState | null) => { const s = fresh(); if (prev) s.seq = prev.seq + 1; return s; };

export function HuntDemo({ mute = false }: { mute?: boolean }) {
  // the game is made in the browser only (random), so the server renders nothing
  const [s, setS] = useState<HuntState | null>(null);
  const ref = useRef<HuntState | null>(null);
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const cur = ref.current;
      const next = !cur || cur.phase === "done" ? { s: again(cur), ms: 1500 } : step(cur);
      ref.current = next.s;
      setS(next.s);
      id = setTimeout(tick, next.ms);
    };
    id = setTimeout(tick, 0);
    return () => clearTimeout(id);
  }, []);
  if (!s) return null;
  return (
    <div className="flex h-[100dvh] w-full p-[1.2vh]">
      <HuntStage s={s} sound={!mute} />
      <div className="hud hud-lg flex w-full" style={{ ["--hc" as string]: "#8cff4a" }}>
        <div className="hud-scan flex w-full flex-col gap-[1.5vh] overflow-hidden p-[2.4vh]">
          <div className="flex items-center justify-between gap-[2vh]">
            <p className="truncate font-display text-[6vh] leading-none text-[#f1ece4] [text-shadow:0_0.5vh_0_#000]">{s.cfg.title}</p>
            <span className="hud-tab shrink-0 !text-[2.2vh]" style={{ ["--hc" as string]: "#ff8a3d" }}>Demo · nothing is saved</span>
          </div>
          <HuntStats s={s} />
          <div className="min-h-0 flex-1 overflow-hidden"><HuntPhase s={s} compact /></div>
        </div>
      </div>
    </div>
  );
}

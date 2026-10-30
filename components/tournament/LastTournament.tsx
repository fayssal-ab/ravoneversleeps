"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ExternalLink, Skull, Users } from "lucide-react";
import { Crown3D } from "./champion/ChampionShowcase";
import { SlotArt } from "@/components/ui/SlotArt";
import type { KoState } from "@/lib/knockout";
import { teamName } from "./parts";

// Admin → Tournament, above the creator: a compact summary of the last
// finished tournament (champion, mode, field, prize, when) in the HUD look.

const MODE: Record<string, string> = { classic: "Knockout", reaping: "The Reaping · Wheel", hunt: "The Reaping · Hunt" };
const noop = () => () => {};

export function LastTournament({ state }: { state: KoState }) {
  const t = state.tournament;
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const champ = state.champion;
  const cult = !champ || champ.is_boss;
  const hunt = state.hunt?.result ?? null;
  const prize = hunt ? hunt.total ?? hunt.payout : t.prize_1 != null ? Number(t.prize_1) : null;
  const tone = cult ? "#b36bff" : "#f5c95a";
  // a Date from the server render, an ISO string from the poll, or a bare UTC "YYYY-MM-DD HH:MM:SS"
  const raw = t.finished_at as unknown;
  const when = raw instanceof Date ? raw : raw ? new Date(/Z$|[+-]\d\d:?\d\d$/.test(String(raw)) ? String(raw) : `${String(raw).replace(" ", "T")}Z`) : null;
  return (
    <section className="hud hud-lg" style={{ ["--hc" as string]: tone }}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          {champ && !champ.is_boss
            ? <SlotArt name={champ.slot_name} src={champ.slot_image} size={108} rounded="rounded-xl" />
            : <span className="grid size-[108px] place-items-center rounded-xl bg-[#140c1c]"><Skull className="size-12 text-[#c9a6ff]" /></span>}
          <Crown3D variant={cult ? "cult" : "champion"} className="absolute -left-4 -top-6 w-16 -rotate-12 drop-shadow-[0_4px_10px_rgb(0_0_0/0.8)]" />
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <span className="hud-tab" style={{ ["--hc" as string]: tone }}>Last tournament · #{t.id}</span>
          <p className="mt-2 truncate font-display text-3xl leading-none"><span className="chrome">{t.title || "Tournament"}</span></p>
          <p className="mt-1 text-xs text-muted">
            {MODE[t.mode] ?? "Knockout"} · {t.team_size === 2 ? `duo · ${t.max_players} teams` : `${t.max_players} players`}
            {mounted && when ? ` · ${when.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${when.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
            <span className="min-w-0 truncate font-head text-xl font-bold" style={{ color: tone }}>
              {cult ? (champ?.is_boss ? `The Cult · ${champ.username}` : "The Cult wins") : teamName(champ!)}
            </span>
            {!cult && champ && <span className="truncate text-sm text-neon">{champ.partner ? `${champ.slot_name} + ${champ.partner.slot_name}` : champ.slot_name}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-4 sm:flex-col sm:items-end">
          <dl className="flex gap-4 text-center sm:text-right">
            <div><dt className="font-head text-[9px] uppercase tracking-[0.2em] text-dim">Prize</dt><dd className="hud-num text-2xl font-bold text-gold">{prize != null ? `$${prize.toLocaleString("en-US")}` : "—"}</dd></div>
            <div><dt className="font-head text-[9px] uppercase tracking-[0.2em] text-dim">Field</dt><dd className="hud-num flex items-center gap-1 text-2xl font-bold text-text"><Users className="size-4 text-dim" />{state.registered}</dd></div>
          </dl>
          <Link href={`/tournaments?id=${t.id}`} target="_blank" className="btn btn-ghost btn-sm"><ExternalLink className="size-4" /> View</Link>
        </div>
      </div>
    </section>
  );
}

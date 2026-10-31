"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Skull, Swords } from "lucide-react";
import { SlotArt } from "@/components/ui/SlotArt";
import { ChampionShowcase } from "../champion/ChampionShowcase";
import { AB, ANGEL, ANGEL_ODDS, CURSE_CHANCE, CURSES, END, ENDBOSSES, HUNT, findMonster, portrait, tierById } from "@/lib/hunt/bestiary.js";
import { arenaName, chatPicks, DEFAULT_WEIGHTS, money, type Entrant, type HuntState, type Monster, type SlotCall } from "@/lib/hunt/engine";

// "The Reaping · Hunt" views shared by the admin dashboard (with inputs),
// the public page and the OBS overlay (read-only). Game HUD look (.hud
// panels in globals.css): chamfered frames glowing in the tier colour,
// hex rank emblems, segmented meters, bestiary portraits.

type Look = { n: string; t?: string; l?: string; s?: string; ab?: string };
type Info = { name: string; desc: string; boon?: boolean; clutch?: number; f?: unknown };
const ABI = AB as unknown as Record<string, Info>;
const CUR = CURSES as unknown as Record<string, Info>;
const look = (name: string) => findMonster(name) as Look | null;
export const tierColor = (id: string) => (tierById(id) as { c?: string } | null)?.c ?? "#ff5a5a";
const roman = (id: string) => (tierById(id) as { roman?: string } | null)?.roman ?? "";
/** Rank of a tier, as the host's odds name them. */
export const RANK: Record<string, string> = { Fodder: "Easy", Minion: "Easy", Brute: "Medium", Warlord: "Hard", Overlord: "Nightmare", Endboss: "Boss", Secret: "???" };
const TONE: Record<string, string> = { g: "#8cff4a", gold: "#f5c95a", o: "#ff8a3d", v: "#b36bff", r: "#ff5a5a", m: "#9aa59d", w: "#fff6d6" };
const css = (o: Record<string, string>) => o as React.CSSProperties;

/** Bestiary portrait (static SVG built from the bestiary data; names are escaped there). */
export function Portrait({ name, tier, size }: { name: string; tier: string; size: number | string }) {
  const def = look(name);
  if (!def) return <span className="grid place-items-center bg-black text-dim" style={{ width: size, height: size }}>?</span>;
  return <span aria-hidden className="block shrink-0 overflow-hidden [&>svg]:block [&>svg]:size-full" style={{ width: size, height: size }}
    dangerouslySetInnerHTML={{ __html: portrait(def, tierColor(tier), 240) }} />;
}

/** Hex rank badge: tier numeral over the rank name. */
export function Emblem({ tier, size = 34 }: { tier: string; size?: number }) {
  return (
    <span className="emblem shrink-0" style={{ width: size, ...css({ "--hc": tierColor(tier) }) }} title={`${tier} · ${RANK[tier] ?? ""}`}>
      <span style={{ fontSize: size * 0.36 }}>{tier === "Endboss" ? "☠" : tier === "Secret" ? "∞" : roman(tier)}</span>
    </span>
  );
}

const Tag = ({ c, children, solid = false }: { c: string; children: React.ReactNode; solid?: boolean }) => (
  <span className="inline-flex items-center px-2 py-[3px] font-head text-[10px] font-bold uppercase tracking-[0.16em]"
    style={{ clipPath: "polygon(5px 0,100% 0,calc(100% - 5px) 100%,0 100%)", color: solid ? "#060807" : c, background: solid ? c : `color-mix(in srgb, ${c} 16%, transparent)` }}>{children}</span>
);

function AbilityBox({ m }: { m: Monster }) {
  const def = look(m.name);
  const a = def?.ab ? ABI[def.ab] : null;
  return (
    <>
      {a && (m.secret || m.tier === "Endboss" || m.abOn) && (
        <div className="hud hud-sm w-full px-3 py-2 text-left" style={css({ "--hc": a.boon ? "#8cff4a" : tierColor(m.tier) })}>
          <b className="font-head text-[11px] uppercase tracking-[0.18em]" style={{ color: a.boon ? "#8cff4a" : tierColor(m.tier) }}>{a.boon ? "⬢ Boon · " : "⚡ Ability · "}{a.name}</b>
          <p className="text-[13px] leading-snug text-text/90">{a.desc}</p>
        </div>
      )}
      {m.curse && (
        <div className="hud hud-sm w-full px-3 py-2 text-left" style={css({ "--hc": "#4af0ff" })}>
          <b className="font-head text-[11px] uppercase tracking-[0.18em] text-[#4af0ff]">✶ Cult curse · {CUR[m.curse].name}</b>
          <p className="text-[13px] leading-snug text-text/90">{CUR[m.curse].desc}</p>
        </div>
      )}
    </>
  );
}

/** The called slot (`!call`), or a hint to call one. */
function CallLine({ call, big = false, chat = false }: { call?: SlotCall | null; big?: boolean; chat?: boolean }) {
  if (!call) return <p className={`font-head uppercase tracking-[0.14em] text-dim ${big ? "text-sm" : "text-[10px]"}`}>{chat ? <><span className="text-[#b36bff]">Chat picks the slot</span> · host enters it</> : <>Waiting for <span className="text-neon">!call &lt;slot&gt;</span></>}</p>;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <SlotArt name={call.name} src={call.image} size={big ? 44 : 26} rounded="rounded-md" />
      <span className="min-w-0 text-left">
        <span className={`block truncate font-semibold text-neon ${big ? "text-base" : "text-xs"}`}>{call.name}</span>
        <span className={`block truncate text-dim ${big ? "text-xs" : "text-[10px]"}`}>called by {call.by}</span>
      </span>
    </div>
  );
}

/** The big monster card (reveals, Reckoning). */
export function MonsterCard({ m, line, big = false }: { m: Monster; line?: string; big?: boolean }) {
  const def = look(m.name);
  const c = tierColor(m.tier);
  return (
    <div className="hud hud-lg hunt-live mx-auto w-full max-w-md" style={css({ "--hc": c })}>
      <div className="flex flex-col items-center gap-2 p-5 text-center">
        <div className="flex w-full items-center justify-between">
          <span className="hud-tab" style={css({ "--hc": c })}>{m.secret ? "Secret boss" : m.tier === "Endboss" ? "Endboss" : `${m.tier} · ${RANK[m.tier]}`}</span>
          <Emblem tier={m.secret ? "Secret" : m.tier} size={big ? 44 : 36} />
        </div>
        <div className="relative">
          <div aria-hidden className="absolute inset-0 -z-10 rounded-full blur-2xl" style={{ background: `${c}44` }} />
          <Portrait name={m.name} tier={m.tier} size={big ? 200 : 156} />
        </div>
        <h3 className={`font-display leading-none text-[#f1ece4] drop-shadow-[0_2px_0_#000] ${big ? "text-5xl" : "text-[2rem]"}`}>{m.name}</h3>
        {def?.t && <p className="-mt-1 font-head text-[11px] uppercase tracking-[0.18em] text-dim">{def.t}</p>}
        {def?.l && <p className="text-sm italic text-muted">“{def.l}”</p>}
        <dl className="grid w-full grid-cols-3 gap-1.5">
          {[["Bonus buy", money(m.price), "text-gold"], ["Slot", m.secret ? "∞" : chatPicks(m) ? "Chat picks" : m.slot?.name ?? def?.s ?? "", "text-text"], ["Bounty", m.bounty > 1 ? `×${m.bounty}` : "none", "text-gold"]].map(([l, v, tone]) => (
            <div key={l} className="hud hud-sm p-2" style={css({ "--hc": "rgb(255 255 255 / 0.12)" })}>
              <dt className="font-head text-[9px] uppercase tracking-[0.18em] text-dim">{l}</dt>
              <dd className={`truncate font-semibold ${l === "Slot" ? "text-sm" : "hud-num text-base"} ${tone}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <AbilityBox m={m} />
        {line && <p className="text-xs text-dim">{line}</p>}
      </div>
    </div>
  );
}

export function PhaseBar({ s }: { s: HuntState }) {
  const order = ["hunt", "arena", "reckon"] as const;
  const cur = s.phase === "done" ? 3 : order.indexOf(s.phase as (typeof order)[number]);
  const info = [["The Hunt", `Wave ${s.wave} of ${s.cfg.waves}`, "#8cff4a"], ["The Arena", "Player vs player", "#f5c95a"], ["The Reckoning", `Endboss ${s.cfg.chance}%`, "#ff5a5a"]] as const;
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {info.map(([n, sub, c], i) => (
        <li key={n} className={`hud hud-sm transition ${i === cur ? "" : i < cur ? "opacity-55" : "opacity-35"}`} style={css({ "--hc": i === cur ? c : "rgb(255 255 255 / 0.1)" })}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="emblem" style={{ width: 30, ...css({ "--hc": c }) }}><span className="text-[11px]">{["I", "II", "III"][i]}</span></span>
            <span>
              <b className="block font-head text-sm uppercase tracking-[0.16em]" style={{ color: c }}>{n}</b>
              <span className="text-xs text-muted">{i < cur ? "Cleared" : i === cur ? sub : "Locked"}</span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HuntStats({ s }: { s: HuntState }) {
  const st: [string, string, string][] = [
    ["Alive", String(s.ents.filter((e) => e.alive).length), "#8cff4a"], ["Reaped", String(s.reaped), "#b36bff"],
    ["Slain", String(s.slain), "#ff8a3d"], ["Bonuses bought", money(s.bought), "#e7ece9"], ["Base prize", money(s.cfg.prize), "#f5c95a"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {st.map(([l, v, c]) => (
        <div key={l} className="hud hud-sm" style={css({ "--hc": `color-mix(in srgb, ${c} 45%, transparent)` })}>
          <div className="px-3 py-2 text-center">
            <dt className="font-head text-[9px] font-bold uppercase tracking-[0.2em] text-dim">{l}</dt>
            <dd className="hud-num truncate text-xl font-bold" style={{ color: c, textShadow: `0 0 18px ${c}55` }}>{v}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

const Bounty = ({ n }: { n: number }) => (n > 1 ? <Tag c="#f5c95a" solid>×{n}</Tag> : null);
/** Kick profile pictures by participant id (the Hunt state only keeps ids). */
const AvatarsCtx = createContext<Map<number, string | null>>(new Map());
export function HuntAvatars({ participants, children }: { participants: { id: number; avatar: string | null }[]; children: React.ReactNode }) {
  const map = useMemo(() => new Map(participants.map((p) => [p.id, p.avatar])), [participants]);
  return <AvatarsCtx.Provider value={map}>{children}</AvatarsCtx.Provider>;
}

/** What to frame for a Hunt winner: the slot they called last, else their Kick picture. */
export function useWinnerArt(s: HuntState, eid: number): { name: string; image: string | null } {
  const pics = useContext(AvatarsCtx);
  const e = s.ents[eid];
  const call = (s.reckon?.champ === eid ? s.reckon?.call : null) ?? [...s.fights].reverse().find((f) => f.eid === eid && f.call)?.call ?? null;
  if (call) return { name: call.name, image: call.image };
  return { name: e.name, image: e.pids.map((id) => pics.get(id)).find(Boolean) ?? null };
}

/** Hex avatar: the Kick picture when known (duo: the captain's), else the initials. */
export function Avatar({ e, big = false, size }: { e: Pick<Entrant, "name"> & { pids?: number[] }; big?: boolean; size?: number | string }) {
  const pics = useContext(AvatarsCtx);
  const [broken, setBroken] = useState(false);
  let h = 7;
  for (const ch of e.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const ini = e.name.split(/[\s&_]+/).filter(Boolean);
  const d = size ?? (big ? 64 : 30);
  const src = e.pids?.map((id) => pics.get(id)).find(Boolean) ?? null;
  return (
    <span aria-hidden className="emblem relative shrink-0 overflow-hidden !text-white" style={{ width: d, ...css({ "--hc": `hsl(${h} 50% 38%)` }) }}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-[6%] size-[88%] object-cover [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]" />
      ) : (
        <span style={{ fontSize: `calc(${typeof d === "number" ? `${d}px` : d} * 0.34)` }}>{(ini.length > 1 ? ini[0][0] + ini[1][0] : e.name.slice(0, 2)).toUpperCase()}</span>
      )}
    </span>
  );
}

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
/** Two dollar inputs and a button (admin only). */
function DuelInputs({ la, lb, a0 = "", b0 = "", lockA, busy, label = "Fight", danger = false, onGo }: {
  la: string; lb: string; a0?: string; b0?: string; lockA?: string | null; busy: boolean; label?: string; danger?: boolean; onGo: (a: string, b: string) => void;
}) {
  const [a, setA] = useState(a0), [b, setB] = useState(b0);
  const av = lockA ?? a;
  const ok = MONEY.test(av) && MONEY.test(b);
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (ok) onGo(av, b); }}>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label !text-[10px]">{la} ($)</span>
          <input inputMode="decimal" value={av} disabled={lockA != null} onChange={(e) => setA(e.target.value.trim())} placeholder="0" className="field !py-2 text-right font-mono" />
        </label>
        <label className="block"><span className="label !text-[10px]">{lb} ($)</span>
          <input inputMode="decimal" value={b} onChange={(e) => setB(e.target.value.trim())} placeholder="0" className="field !py-2 text-right font-mono" />
        </label>
      </div>
      <div className="flex justify-end"><button disabled={busy || !ok} className={`btn btn-sm ${danger ? "!bg-danger !text-white" : "btn-neon"}`}><Swords className="size-4" /> {label}</button></div>
    </form>
  );
}

/** Host fallback for `!call` when chat can't. */
function HostCall({ eid, admin }: { eid: number; admin: HuntAdmin }) {
  const [v, setV] = useState("");
  return (
    <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (v.trim().length >= 2) { admin.go("call", { index: eid, slot: v.trim() }); setV(""); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} maxLength={80} placeholder="Call a slot for them" className="field !py-1.5 text-xs" aria-label="Call a slot" />
      <button disabled={admin.busy || v.trim().length < 2} className="btn btn-ghost btn-sm !px-3 text-xs">Call</button>
    </form>
  );
}

export interface HuntAdmin { busy: boolean; go: (op: string, extra?: Record<string, unknown>, confirm?: string) => void }

function Verdict({ v, who, foe }: { v: NonNullable<HuntState["fights"][number]["verdict"]>; who: string; foe: string }) {
  const max = Math.max(v.pf, v.bf === Infinity ? v.pf : v.bf, 1);
  return (
    <div className="space-y-1.5 text-[12px] text-muted">
      {[[who, v.pf, v.p, "#8cff4a"], [foe, v.bf, v.b, "#ff5a5a"]].map(([n, f, raw, c]) => (
        <div key={String(n)}>
          <p className="flex justify-between gap-2"><span className="truncate">{n}</span><b className="hud-num text-text">{money(f as number)}{f !== raw && f !== Infinity && <span className="ml-1 font-normal opacity-60">({money(raw as number)})</span>}</b></p>
          <div className="hud-bar" style={css({ "--hc": c as string })}><i style={{ width: `${f === Infinity ? 100 : Math.max(3, ((f as number) / max) * 100)}%` }} /></div>
        </div>
      ))}
      {v.notes.map((n, i) => <p key={i} className="text-[11.5px] text-gold">⚡ {n}</p>)}
    </div>
  );
}

export function HuntGrid({ s, admin, compact = false }: { s: HuntState; admin?: HuntAdmin; compact?: boolean }) {
  const fallen = s.ents.filter((e) => !e.alive && !s.fights.some((f) => f.eid === e.id));
  return (
    <div>
      <div className={`grid gap-3 ${compact ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {s.fights.map((f, i) => {
          const e = s.ents[f.eid], m = f.monster;
          const c = f.done ? (f.won ? "#8cff4a" : "#b36bff") : m ? tierColor(m.tier) : "rgb(255 255 255 / 0.12)";
          const def = m ? look(m.name) : null;
          const a = def?.ab ? ABI[def.ab] : null;
          return (
            <article key={`${s.wave}-${f.eid}`} className={`hud hunt-live transition ${f.done && !f.won ? "opacity-60 grayscale-[0.7]" : ""}`} style={css({ "--hc": c })}>
              <div className="flex flex-col gap-2 p-3">
                <header className="flex min-w-0 items-center gap-2">
                  <Avatar e={e} />
                  <span className="min-w-0 flex-1 truncate font-head font-bold" title={e.name}>{e.name}</span>
                  <Bounty n={e.bounty} />
                  {f.done ? <Tag c={f.won ? "#8cff4a" : "#b36bff"} solid>{f.won ? "Slain it" : "Reaped"}</Tag> : m ? <Tag c={tierColor(m.tier)}>{m.secret ? "Seraph" : RANK[m.tier]}</Tag> : <Tag c="#7d877f">Waiting</Tag>}
                </header>
                {m ? (
                  <div className="flex min-w-0 items-center gap-3 bg-black/35 p-2 [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]">
                    <Portrait name={m.name} tier={m.tier} size={compact ? 54 : 64} />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="flex items-center gap-1.5"><Emblem tier={m.secret ? "Secret" : m.tier} size={18} /><b className="truncate">{m.name}</b></span>
                      <span className="block truncate text-[11px] text-dim">{m.secret ? "∞" : chatPicks(m) ? "Chat picks the slot" : `plays ${m.slot?.name ?? def?.s}`}</span>
                      <span className="text-xs">Buy <b className="hud-num text-gold">{money(m.price)}</b></span>
                      {(m.abOn || m.curse) && !m.secret && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {m.abOn && a && <Tag c={a.boon ? "#8cff4a" : tierColor(m.tier)}>{a.boon ? "Boon · " : ""}{a.name}</Tag>}
                          {m.curse && <Tag c="#4af0ff">{CUR[m.curse].name}</Tag>}
                        </span>
                      )}
                    </div>
                  </div>
                ) : <div className="hud-scan grid min-h-[80px] place-items-center border border-dashed border-line text-sm text-dim">No monster yet</div>}
                {m && !m.secret && (!f.done || f.call) && <CallLine call={f.call} chat={chatPicks(m)} />}
                {m && !f.done && !compact && (
                  <div className="space-y-1 text-[12.5px] leading-snug text-muted">
                    {m.abOn && a && <p><b className="text-text">{a.name}:</b> {a.desc}</p>}
                    {m.curse && <p><b className="text-text">{CUR[m.curse].name}:</b> {CUR[m.curse].desc}</p>}
                    {m.revived && <p><b className="text-text">Risen:</b> he lost once and buys again. Enter his new win.</p>}
                    {m.prebuy && <p><b className="text-text">Second try:</b> the monster dozed off. Enter the player&apos;s new win.</p>}
                  </div>
                )}
                {admin && m && !f.done && (m.secret ? (
                  <div className="flex justify-end"><button disabled={admin.busy} onClick={() => admin.go("fight", { index: i, p: "0", b: "0" })} className="btn btn-sm !bg-[#fff6d6] !text-[#1a1408]">Face judgment</button></div>
                ) : (
                  <div className="space-y-2">
                    <HostCall eid={f.eid} admin={admin} />
                    <DuelInputs key={`${s.seq}-${i}`} la="Player win" lb="Monster win" busy={admin.busy}
                      lockA={m.revived && f.keep != null ? String(f.keep) : null}
                      b0={m.prebuy && f.verdict ? String(f.verdict.b) : ""}
                      onGo={(p, b) => admin.go("fight", { index: i, p, b })} />
                    <div className="flex justify-end"><button type="button" disabled={admin.busy} onClick={() => admin.go("reroll", { index: i }, `Re-roll ${m.name}? ${e.name} gets a new monster.`)} className="text-xs text-dim underline hover:text-text">Re-roll (host)</button></div>
                  </div>
                ))}
                {f.done && f.verdict && !compact && <Verdict v={f.verdict} who={e.name} foe={m!.name} />}
              </div>
            </article>
          );
        })}
      </div>
      {fallen.length > 0 && (
        <div className="mt-4">
          <p className="label">Fallen in earlier waves</p>
          <div className="flex flex-wrap gap-1.5">{fallen.map((e) => <Tag key={e.id} c="#b36bff">{e.name} · {e.fate}</Tag>)}</div>
        </div>
      )}
    </div>
  );
}

export function ArenaView({ s, admin }: { s: HuntState; admin?: HuntAdmin }) {
  const R = s.arena?.rounds ?? [];
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {R.map((r, ri) => {
          const active = ri === R.length - 1 && s.phase === "arena";
          return (
            <section key={ri} className={`w-64 shrink-0 space-y-3 ${active ? "" : "opacity-70"}`}>
              <h3 className="text-center"><span className="hud-tab" style={css({ "--hc": active ? "#f5c95a" : "#5b665e" })}>{arenaName(r)}</span></h3>
              {r.ms.map((m, i) => {
                const side = (id: number, v: number | null) => {
                  const e = s.ents[id];
                  const won = m.done && m.winner === id, lost = m.done && m.winner !== id;
                  return (
                    <div className={`flex items-center gap-2 px-2.5 py-2 ${won ? "bg-gold/10" : ""} ${lost ? "opacity-40" : ""}`}>
                      <Avatar e={e} size={26} />
                      <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-bold text-gold" : ""}`}>{e.name}</span>
                      <Bounty n={e.bounty} />
                      <span className="hud-num text-xs text-dim">{v == null ? "—" : money(v)}</span>
                    </div>
                  );
                };
                return (
                  <div key={i} className="hud hud-sm" style={css({ "--hc": active && !m.done ? "#f5c95a" : m.done ? "rgb(245 201 90 / 0.35)" : "rgb(255 255 255 / 0.12)" })}>
                    <p className="bg-black/30 px-2.5 py-1 font-head text-[10px] uppercase tracking-[0.16em] text-muted">Both buy <b className="hud-num text-gold">{money(m.price)}</b>{m.tie && " · coin flip"}</p>
                    {side(m.a, m.va)}
                    <div className="h-px bg-line" />
                    {side(m.b, m.vb)}
                    {admin && active && !m.done && (
                      <div className="border-t border-line p-2.5">
                        <DuelInputs key={`${s.seq}-${i}`} la={s.ents[m.a].name} lb={s.ents[m.b].name} busy={admin.busy} onGo={(a, b) => admin.go("arena", { index: i, p: a, b })} />
                      </div>
                    )}
                  </div>
                );
              })}
              {r.bye != null && (
                <div className="hud hud-sm" style={css({ "--hc": "rgb(255 255 255 / 0.1)" })}>
                  <div className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted"><Avatar e={s.ents[r.bye]} size={26} /><span><b className="text-text">{s.ents[r.bye].name}</b> · free pass</span></div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function ReckonView({ s, admin }: { s: HuntState; admin?: HuntAdmin }) {
  const r = s.reckon!;
  const c = s.ents[r.champ], b = r.boss;
  return (
    <div>
      <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <div className="hud hud-lg" style={css({ "--hc": "#f5c95a" })}>
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <Avatar e={c} big />
            <span className="hud-tab" style={css({ "--hc": "#f5c95a" })}>Last one standing</span>
            <h3 className="break-words font-display text-4xl leading-none">{c.name}</h3>
            <p className="text-xs text-muted">Best win <b className="hud-num text-text">{money(c.best)}</b> · {c.slain} monster{c.slain === 1 ? "" : "s"} slain</p>
            <p className="font-head text-xs uppercase tracking-[0.16em] text-gold">Playing for <b className="hud-num text-lg">{money(s.cfg.prize * c.bounty)}</b> (×{c.bounty})</p>
            {b && !b.secret && !r.done && <CallLine call={r.call} big chat={chatPicks(b)} />}
          </div>
        </div>
        <p className="text-center font-display text-6xl"><span className="chrome">V</span><span className="neon-text">S</span></p>
        {b ? <MonsterCard m={b} line={b.secret ? "There is nothing to play. Fate has already been decided." : `Both buy ${money(b.price)}. Beat the Endboss and the prize becomes ×${b.bounty}.`} />
          : r.fate === "spared" ? (
            <div className="hud hud-lg opacity-80" style={css({ "--hc": "#8cff4a" })}><div className="flex flex-col items-center gap-2 p-8 text-center"><span className="font-display text-7xl text-neon">Z</span><h3 className="font-head text-xl font-bold text-neon">Spared</h3><p className="text-xs text-muted">The Endboss sleeps</p></div></div>
          ) : (
            <div className="hud hud-lg" style={css({ "--hc": "#ff5a5a" })}><div className="flex flex-col items-center gap-2 p-8 text-center"><span className="heartbeat font-display text-7xl text-[#c06060]">?</span><h3 className="font-head text-xl font-bold text-[#e08080]">{r.fate === "comes" ? "He comes…" : "Unknown"}</h3><p className="text-xs text-muted">{r.fate === "comes" ? "The Endboss is being summoned" : `${s.cfg.chance}% chance he comes`}</p></div></div>
          )}
      </div>
      {admin && b && !r.done && (
        <div className="mx-auto mt-5 max-w-lg space-y-2">
          {b.revived && <p className="text-sm text-muted"><b className="text-text">Risen:</b> the Endboss buys again. Enter his new win.</p>}
          {!b.secret && <HostCall eid={c.id} admin={admin} />}
          {b.secret ? <div className="flex justify-center"><button disabled={admin.busy} onClick={() => admin.go("boss", { p: "0", b: "0" })} className="btn !bg-[#fff6d6] !text-[#1a1408]">Face judgment</button></div>
            : <DuelInputs key={s.seq} la={`${c.name} win`} lb="Endboss win" busy={admin.busy} danger label="Fight the Endboss" lockA={b.revived && r.keep != null ? String(r.keep) : null} onGo={(p, x) => admin.go("boss", { p, b: x })} />}
        </div>
      )}
      {b && r.done && r.verdict && <div className="mx-auto mt-5 max-w-lg"><Verdict v={r.verdict} who={c.name} foe={b.name} /></div>}
    </div>
  );
}

const PLACE = { 1: ["1st", "#f5c95a"], 2: ["2nd", "#d7dde3"], 3: ["3rd", "#d08a52"] } as const;
/** Who won what: every paid place with its bounty and amount, and the total paid out. */
export function Podium({ s, big = false }: { s: HuntState; big?: boolean }) {
  const R = s.result;
  const rows = R?.podium ?? [];
  if (!R || rows.length === 0) return null;
  const fs = big ? "text-[2.6vh]" : "text-sm";
  return (
    <div className={`mx-auto w-full ${big ? "max-w-[80vw]" : "max-w-2xl"}`}>
      <p className={`mb-1.5 font-head font-bold uppercase tracking-[0.2em] text-dim ${big ? "text-[1.8vh]" : "text-[10px]"}`}>Prizes · {money(s.cfg.prize)} base × bounty</p>
      <ol className={`grid gap-1.5 ${big ? "gap-[1vh]" : ""}`}>
        {rows.map((p) => {
          const e = s.ents[p.eid];
          const [label, c] = PLACE[p.place];
          const fell = p.place === 1 && (R.type === "fallen" || R.type === "judged");
          return (
            <li key={p.eid} className="hud hud-sm" style={css({ "--hc": `color-mix(in srgb, ${c} 55%, transparent)` })}>
              <div className={`flex items-center gap-3 ${big ? "px-[2vh] py-[1vh]" : "px-3 py-2"}`}>
                <span className={`w-[3.2em] shrink-0 font-head font-bold uppercase ${fs}`} style={{ color: c }}>{label}</span>
                <Avatar e={e} size={big ? "4.4vh" : 28} />
                <span className={`min-w-0 flex-1 truncate text-left font-semibold ${fs}`}>{e.name}</span>
                <span className={`shrink-0 text-dim ${big ? "text-[2vh]" : "text-xs"}`}>{fell ? (R.payout > 0 ? "fell · keeps 50%" : "fell") : p.place === 1 && R.type === "legend" ? "Legend ×10" : `×${p.bounty}`}</span>
                <span className={`hud-num w-[5.5em] shrink-0 text-right font-bold text-gold ${fs}`}>{money(p.payout)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {rows.length > 1 && <p className={`mt-1.5 text-right text-muted ${big ? "text-[2vh]" : "text-xs"}`}>Total paid <b className="hud-num text-gold">{money(R.total ?? rows.reduce((a, p) => a + p.payout, 0))}</b></p>}
    </div>
  );
}

export function ResultBanner({ s, compact = false }: { s: HuntState; compact?: boolean }) {
  const R = s.result;
  if (!R) return null;
  const c = R.champ != null ? s.ents[R.champ] : null;
  // OBS: winner and prizes side by side, so the stream window shows who won what
  if (compact && (R.podium?.length ?? 0) > 0) {
    const won = c && (R.type === "champion" || R.type === "legend");
    return (
      <section className="grid h-full grid-cols-[1fr_1.15fr] items-center gap-[3vh]">
        <div className="min-w-0">
          {won ? <WinnerShowcase s={s} eid={c.id} legend={R.type === "legend"} size="1.05vh" />
            : <div className="text-center"><Skull className="mx-auto size-[10vh] text-[#b36bff]" /><p className="font-display text-[9vh] leading-none text-[#efe9f5]">The Cult wins</p>
              <p className="mt-[1vh] text-[2.2vh] text-muted">{R.boss ? `${R.boss} took the champion` : "The champion fell"}</p></div>}
        </div>
        <Podium s={s} big />
      </section>
    );
  }
  const cult = R.type === "wipe" || R.type === "fallen";
  const tone = cult ? "#b36bff" : R.type === "judged" ? "#fff6d6" : "#f5c95a";
  const top = s.ents.reduce((a, b) => (b.slain > a.slain ? b : a), s.ents[0]);
  const deadly = Object.entries(s.kills).sort((a, b) => b[1] - a[1])[0];
  const head = R.type === "wipe" ? ["Total Reaping", "The Cult wins", "Every hunter fell in the Hunt. No champion this time."]
    : R.type === "champion" ? ["Spared by fate · Champion", c!.name, null]
    : R.type === "legend" ? ["Endboss slain · Legend", c!.name, `Beat ${R.boss} ${money(R.pf!)} to ${money(R.bf!)}.`]
    : R.type === "judged" ? ["One in a million", "Judged", `The Seraph descended and ended ${c!.name}'s run.`]
    : ["The champion fell", "The Cult wins", `${R.boss} won ${money(R.bf!)} against ${money(R.pf!)}.`];
  return (
    <section className="hud hud-lg relative overflow-hidden" style={css({ "--hc": tone })}>
      <div aria-hidden className="rays pointer-events-none absolute left-1/2 top-1/2 -z-[1] size-[900px] -translate-x-1/2 -translate-y-1/2 opacity-20" style={css({ "--rc": tone })} />
      <div className="p-6 text-center">
        {c && (R.type === "champion" || R.type === "legend") ? (
          <>
            <WinnerShowcase s={s} eid={c.id} legend={R.type === "legend"} />
            <p className="-mt-2 text-sm text-muted">{head[2] ? `${head[2]} ` : ""}{money(s.cfg.prize)} base × {c.bounty} bounty</p>
          </>
        ) : (
          <>
            <Skull className="mx-auto size-10" style={{ color: tone }} />
            <span className="hud-tab mt-2" style={css({ "--hc": tone })}>{head[0]}</span>
            <h2 className="mt-2 break-words font-display text-5xl leading-none sm:text-7xl"><span className={cult ? "text-[#efe9f5]" : "chrome"}>{head[1]}</span></h2>
            {head[2] && <p className="mt-2 text-sm text-muted">{head[2]}</p>}
          </>
        )}
        {(R.type === "fallen" || R.type === "judged") && <p className="mt-3 text-base">{R.payout > 0 ? <>{c!.name} keeps <b className="hud-num text-gold">{money(R.payout)}</b>.</> : "No prize for the champion."}</p>}
        <div className="mt-5"><Podium s={s} /></div>
        <dl className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Biggest win", s.bigWin.v ? money(s.bigWin.v) : "—", s.bigWin.name],
            ["Top slayer", top?.slain ? top.name : "—", top?.slain ? `${top.slain} monster${top.slain === 1 ? "" : "s"}` : ""],
            ["Deadliest monster", deadly ? deadly[0] : "—", deadly ? `${deadly[1]} kill${deadly[1] === 1 ? "" : "s"}` : ""],
            ["Bonuses bought", money(s.bought), `${s.reaped} reaped · ${s.slain} slain`],
          ].map(([l, v, sub]) => (
            <div key={l} className="hud hud-sm" style={css({ "--hc": "rgb(255 255 255 / 0.12)" })}>
              <div className="p-2.5"><dt className="font-head text-[9px] uppercase tracking-[0.18em] text-dim">{l}</dt><dd className="truncate font-head font-bold">{v}</dd><dd className="truncate text-[11px] text-muted">{sub}</dd></div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function WinnerShowcase({ s, eid, legend, size }: { s: HuntState; eid: number; legend: boolean; size?: string }) {
  const art = useWinnerArt(s, eid);
  return <ChampionShowcase name={s.ents[eid].name} slots={[art]} prize={s.result?.payout ?? null} variant={legend ? "legend" : "champion"} size={size}
    label={legend ? "LEGEND" : "CHAMPION"} sub={legend ? `Slew ${s.result?.boss}` : "Spared by fate"} />;
}
export { WinnerShowcase };

export function EventLog({ s, max = 40 }: { s: HuntState; max?: number }) {
  return (
    <div className="hud" style={css({ "--hc": "rgb(255 255 255 / 0.12)" })}>
      <div className="p-3">
        <span className="hud-tab" style={css({ "--hc": "#5b665e" })}>Event log</span>
        <ol className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1 font-mono text-[12px]">
          {s.log.slice(0, max).map((l, i) => <li key={s.log.length - i} className="border-l-2 pl-2" style={{ borderColor: TONE[l.c], color: l.c === "m" ? "var(--color-muted)" : TONE[l.c] }}>{l.t}</li>)}
        </ol>
      </div>
    </div>
  );
}

/** Phase view: Hunt grid, Arena bracket or Reckoning duel (the result banner on top once done). */
export function HuntPhase({ s, admin, compact = false }: { s: HuntState; admin?: HuntAdmin; compact?: boolean }) {
  // OBS after the end: only the winner and the prizes
  if (compact && s.phase === "done" && (s.result?.podium?.length ?? 0) > 0) return <ResultBanner s={s} compact />;
  return (
    <div className="space-y-5">
      <ResultBanner s={s} compact={compact} />
      {s.phase === "hunt" || (s.phase === "done" && !s.arena && !s.reckon) ? <HuntGrid s={s} admin={admin} compact={compact} />
        : s.phase === "arena" || (s.phase === "done" && !s.reckon) ? <ArenaView s={s} admin={admin} />
        : <ReckonView s={s} admin={admin} />}
    </div>
  );
}

/** Pops a reveal (new monster, the Endboss's fate, the Endboss) once per change, never on page load. */
export function useHuntReveal(s: HuntState | null, autoMs?: number) {
  const [seen, setSeen] = useState<{ init: boolean; seq: number }>({ init: false, seq: 0 });
  if (s && !seen.init) setSeen({ init: true, seq: s.reveal?.seq ?? 0 });
  const r = s?.reveal && seen.init && s.reveal.seq > seen.seq ? s.reveal : null;
  // the page pop-up only shows spawns, the fate and the Endboss (fights play on the stream)
  const fresh = r && (r.kind === "spawn" || r.kind === "fate" || r.kind === "endboss") ? r : null;
  const freshSeq = fresh?.seq ?? null;
  useEffect(() => {
    if (freshSeq == null || !autoMs) return;
    const id = setTimeout(() => setSeen((x) => ({ ...x, seq: Math.max(x.seq, freshSeq) })), autoMs);
    return () => clearTimeout(id);
  }, [freshSeq, autoMs]);
  return { reveal: fresh, dismiss: () => fresh && setSeen((x) => ({ ...x, seq: fresh.seq })) };
}

/** Full-screen pop-up for a reveal (admin and public page). */
export function RevealOverlay({ s, reveal, onClose, big = false }: { s: HuntState; reveal: NonNullable<HuntState["reveal"]>; onClose: () => void; big?: boolean }) {
  let body: React.ReactNode = null;
  let eyebrow = "", title = "";
  if (reveal.kind === "spawn" && reveal.fight != null) {
    const f = s.fights[reveal.fight];
    if (!f?.monster) return null;
    const e = s.ents[f.eid];
    eyebrow = `The Hunt · wave ${s.wave} of ${s.cfg.waves}`;
    title = f.monster.secret ? "A light descends" : ((tierById(f.monster.tier) as { head?: string } | null)?.head ?? "Something stirs…");
    body = <MonsterCard m={f.monster} big={big} line={`Both buy ${money(f.monster.price)}${s.cfg.duo ? " (each teammate once, monster win ×2)" : ""}. ${e.name} must win more than the monster. ${chatPicks(f.monster) ? "Chat picks the slot this time!" : `${e.name}: type !call <slot> to pick yours.`}`} />;
  } else if (reveal.kind === "fate" && s.reckon) {
    const comes = s.reckon.fate === "comes";
    eyebrow = "The Reckoning";
    title = comes ? "The ground shakes" : "The Cult sleeps";
    body = (
      <div className="hud hud-lg mx-auto max-w-md" style={css({ "--hc": comes ? "#ff5a5a" : "#8cff4a" })}>
        <div className="p-8 text-center">
          <p className={`font-display text-7xl ${comes ? "text-danger" : "text-neon"}`}>{comes ? "He comes" : "Spared"}</p>
          <p className="mt-2 text-sm text-muted">{comes ? `${s.ents[s.reckon.champ].name} must beat the Endboss to keep the crown.` : `The Endboss stays asleep. ${s.ents[s.reckon.champ].name} wins the Reaping.`}</p>
        </div>
      </div>
    );
  } else if (reveal.kind === "endboss" && s.reckon?.boss) {
    eyebrow = "The Reckoning · Endboss";
    title = s.reckon.boss.secret ? "A light descends" : s.reckon.boss.name;
    body = <MonsterCard m={s.reckon.boss} big={big} line={`Both buy ${money(s.reckon.boss.price)}. Beat the Endboss and the prize becomes ×${s.reckon.boss.bounty}.`} />;
  }
  if (!body) return null;
  const heavy = reveal.kind === "endboss" || (reveal.kind === "spawn" && ["Warlord", "Overlord", "Secret"].includes(s.fights[reveal.fight ?? 0]?.monster?.tier ?? ""));
  return (
    <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full max-w-xl text-center ${heavy ? "ko-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
        <span className="hud-tab" style={css({ "--hc": "#ff8a3d" })}>{eyebrow}</span>
        <h2 className="mb-4 mt-2 font-display text-5xl text-[#f1ece4] drop-shadow-[0_3px_0_#000]">{title}</h2>
        {body}
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm mt-4">Close</button>
      </div>
    </div>
  );
}

type TierRow = { id: string; c: string; prices: number[]; abChance: number; bounty?: number; roster: (Look & { bounty?: number })[] };
const range = (p: number[]) => (p.length > 1 ? `${money(Math.min(...p))} – ${money(Math.max(...p))}` : money(p[0]));
/** How often a monster's ability fires (clutch-only ones are always armed, like the engine). */
const abilityOdds = (ab: string | undefined, tierChance: number) => {
  const a = ab ? ABI[ab] : null;
  if (!a) return "";
  return tierChance >= 1 || (a.clutch && !a.f) ? "always on" : `on in ${Math.round(tierChance * 100)}% of fights`;
};

function BeastRow({ m, c, tier, chance, bounty }: { m: Look; c: string; tier: string; chance: number; bounty?: number }) {
    const a = m.ab ? ABI[m.ab] : null;
    return (
      <div className="hud hud-sm flex gap-3 p-2.5" style={css({ "--hc": `color-mix(in srgb, ${c} 50%, transparent)` })}>
        <Portrait name={m.n} tier={tier} size={52} />
        <div className="min-w-0 text-left">
          <p className="truncate font-semibold text-text">{m.n}{bounty ? <span className="ml-1.5 font-mono text-[11px] text-gold">bounty ×{bounty}</span> : null}</p>
          <p className="truncate text-[11px] text-dim">Slot: {m.ab === "veil" ? "chat picks" : m.s}</p>
          {a && <p className="mt-0.5 text-[11px] leading-snug"><b className="font-head uppercase tracking-[0.12em]" style={{ color: a.boon ? "#8cff4a" : c }}>{a.boon ? "Boon · " : ""}{a.name}</b> <span className="text-text/80">{a.desc}</span></p>}
          {a && <p className="text-[10px] text-dim">{abilityOdds(m.ab, chance)}</p>}
        </div>
      </div>
    );
}
const BeastHead = ({ name, c, buy, pct, extra }: { name: string; c: string; buy: string; pct: string; extra?: string }) => (
    <div className="mb-2 mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-1.5" style={{ borderColor: `color-mix(in srgb, ${c} 45%, transparent)` }}>
      <span className="font-head text-lg font-bold uppercase tracking-[0.14em]" style={{ color: c }}>{name}</span>
      <span className="font-mono text-sm text-gold">Buy {buy}</span>
      <span className="text-xs text-muted">{pct}</span>
      {extra && <span className="text-xs text-text/80">{extra}</span>}
    </div>
  );

/** Ravo's bestiary: every tier with its buy range, spawn odds (this tournament's), bounty and the prize it unlocks; every monster with its slot and ability. */
export function Bestiary({ s, open = false }: { s: HuntState; open?: boolean }) {
  const odds = s.cfg.weights ?? DEFAULT_WEIGHTS;
  const base = s.cfg.prize;
  const tiers = HUNT as unknown as TierRow[];
  const end = END as unknown as { c: string; prices: number[] };
  const bosses = ENDBOSSES as unknown as (Look & { bounty?: number })[];
  const angel = ANGEL as unknown as Look;
  return (
    <details open={open} className="panel group p-4 sm:p-6">
      <summary className="cursor-pointer list-none font-display text-2xl text-text">
        The Bestiary <span className="ml-2 align-middle font-head text-xs uppercase tracking-[0.18em] text-dim group-open:hidden">tap to open</span>
      </summary>
      <p className="mt-1 text-sm text-muted">
        Base prize <b className="font-mono text-gold">{money(base)}</b>: slaying a monster sets your prize to base × its bounty (the highest counts).
        Every monster has a {Math.round(CURSE_CHANCE * 100)}% chance of a Cult curse.
      </p>
      {tiers.map((t) => {
        const b = t.bounty ?? 1;
        return (
          <div key={t.id}>
            <BeastHead name={t.id} c={t.c} buy={range(t.prices)} pct={`Spawns in ${odds[t.id as keyof typeof odds] ?? 0}% of cases`}
              extra={b > 1 ? `Bounty ×${b} · prize ${money(base * b)}` : "No extra prize"} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{t.roster.map((m) => <BeastRow key={m.n} m={m} c={t.c} tier={t.id} chance={t.abChance} />)}</div>
          </div>
        );
      })}
      <BeastHead name="Endboss" c={end.c} buy={range(end.prices)} pct={`Only at the end: ${s.cfg.chance}% chance`}
        extra={`Beat it: ×10 · prize ${money(base * 10)} · it wins: ${s.cfg.fall === "half" ? `champion keeps ${money(base / 2)}` : "nothing"}`} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{bosses.map((m) => <BeastRow key={m.n} m={m} c={end.c} tier="Endboss" chance={1} bounty={m.bounty} />)}</div>
      <BeastHead name="Secret boss" c="#fff6d6" buy="∞" pct={`1 in ${Math.round(1 / ANGEL_ODDS).toLocaleString("en-US")} on every spawn (${(ANGEL_ODDS * 100).toFixed(4)}%)`} />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><BeastRow m={angel} c="#fff6d6" tier="Secret" chance={1} /></div>
    </details>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Crown, Skull, Swords } from "lucide-react";
import { AB, CURSES, findMonster, portrait, tierById } from "@/lib/hunt/bestiary.js";
import { arenaName, money, type Entrant, type HuntState, type Monster } from "@/lib/hunt/engine";

// "The Reaping · Hunt" views shared by the admin dashboard (with inputs),
// the public page and the OBS overlay (read-only). Looks follow Ravo's
// prototype: dark cards glowing in the tier colour, portraits from the
// bestiary, Hunt grid → Arena bracket → Reckoning duel.

type Look = { n: string; t?: string; l?: string; s?: string; ab?: string };
type Info = { name: string; desc: string; boon?: boolean };
const ABI = AB as unknown as Record<string, Info>;
const CUR = CURSES as unknown as Record<string, Info>;
const look = (name: string) => findMonster(name) as Look | null;
export const tierColor = (id: string) => (tierById(id) as { c?: string } | null)?.c ?? "#ff5a5a";
const TONE: Record<string, string> = { g: "#8cff4a", gold: "#f5c95a", o: "#ff8a3d", v: "#b36bff", r: "#ff5a5a", m: "#9aa59d", w: "#fff6d6" };

/** Bestiary portrait (static SVG built from the bestiary data; names are escaped there). */
export function Portrait({ name, tier, size }: { name: string; tier: string; size: number }) {
  const def = look(name);
  if (!def) return <span className="grid place-items-center rounded-xl bg-black text-dim" style={{ width: size, height: size }}>?</span>;
  return <span aria-hidden className="block shrink-0 overflow-hidden rounded-xl [&>svg]:block [&>svg]:size-full" style={{ width: size, height: size }}
    dangerouslySetInnerHTML={{ __html: portrait(def, tierColor(tier), size) }} />;
}

const Chip = ({ c, children }: { c: string; children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border px-2 py-0.5 font-head text-[10px] font-bold uppercase tracking-[0.14em]" style={{ borderColor: `${c}99`, color: c, background: `${c}14` }}>{children}</span>
);

function AbilityBox({ m }: { m: Monster }) {
  const def = look(m.name);
  const a = def?.ab ? ABI[def.ab] : null;
  return (
    <>
      {a && (m.secret || m.tier === "Endboss" || m.abOn) && (
        <div className="w-full rounded-xl border px-3 py-2 text-left" style={{ borderColor: a.boon ? "#8cff4a" : tierColor(m.tier), background: `${a.boon ? "#8cff4a" : tierColor(m.tier)}14` }}>
          <b className="font-head text-xs uppercase tracking-wider" style={{ color: a.boon ? "#8cff4a" : tierColor(m.tier) }}>{a.boon ? "Boon · " : "Ability · "}{a.name}</b>
          <p className="text-[13px] leading-snug text-text">{a.desc}</p>
        </div>
      )}
      {m.curse && (
        <div className="w-full rounded-xl border border-[#4af0ff] bg-[#4af0ff]/10 px-3 py-2 text-left">
          <b className="font-head text-xs uppercase tracking-wider text-[#4af0ff]">Cult curse · {CUR[m.curse].name}</b>
          <p className="text-[13px] leading-snug text-text">{CUR[m.curse].desc}</p>
        </div>
      )}
    </>
  );
}

/** The big reveal card (spawn, Endboss), like the prototype's pop-up. */
export function MonsterCard({ m, line, big = false }: { m: Monster; line?: string; big?: boolean }) {
  const def = look(m.name);
  const c = tierColor(m.tier);
  return (
    <div className="hunt-live mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-3xl border-2 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_srgb,var(--tc)_18%,transparent),#070806_70%)] p-5 text-center"
      style={{ borderColor: c, boxShadow: `0 0 60px -14px ${c}`, ["--tc" as string]: c }}>
      <Portrait name={m.name} tier={m.tier} size={big ? 190 : 150} />
      {m.secret ? <Chip c={c}>Secret boss · 1 in 1,000,000</Chip> : <Chip c={c}>{m.tier === "Endboss" ? "Endboss" : `${m.tier} · tier ${(tierById(m.tier) as { roman?: string }).roman ?? ""}`}</Chip>}
      <h3 className={`font-display leading-none text-[#f1ece4] ${big ? "text-5xl" : "text-3xl"}`}>{m.name}</h3>
      {def?.t && <p className="-mt-1 text-xs text-dim">{def.t}</p>}
      {def?.l && <p className="text-sm italic text-muted">“{def.l}”</p>}
      <dl className="grid w-full grid-cols-3 gap-2">
        <div className="rounded-xl bg-black/40 p-2"><dt className="text-[10px] uppercase tracking-wider text-dim">Bonus buy</dt><dd className="font-mono font-bold text-gold">{money(m.price)}</dd></div>
        <div className="rounded-xl bg-black/40 p-2"><dt className="text-[10px] uppercase tracking-wider text-dim">Slot</dt><dd className="truncate text-sm font-semibold">{m.secret ? "∞" : m.curse === "blind" ? "Chat picks" : def?.s}</dd></div>
        <div className="rounded-xl bg-black/40 p-2"><dt className="text-[10px] uppercase tracking-wider text-dim">Bounty</dt><dd className="font-mono font-bold text-gold">{m.bounty > 1 ? `×${m.bounty}` : "none"}</dd></div>
      </dl>
      <AbilityBox m={m} />
      {line && <p className="text-xs text-dim">{line}</p>}
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
        <li key={n} className={`rounded-2xl border px-4 py-2.5 transition ${i === cur ? "" : i < cur ? "opacity-60" : "opacity-40"}`}
          style={{ borderColor: i === cur ? c : "var(--color-line)", background: i === cur ? `${c}12` : undefined, boxShadow: i === cur ? `0 0 30px -14px ${c}` : undefined }}>
          <b className="block font-head text-sm uppercase tracking-[0.14em]" style={{ color: c }}>{["I", "II", "III"][i]} · {n}</b>
          <span className="text-xs text-muted">{i < cur ? "Done" : sub}</span>
        </li>
      ))}
    </ol>
  );
}

export function HuntStats({ s }: { s: HuntState }) {
  const st: [string, string, string][] = [
    ["Alive", String(s.ents.filter((e) => e.alive).length), "#8cff4a"], ["Reaped", String(s.reaped), "#b36bff"],
    ["Monsters slain", String(s.slain), "#ff8a3d"], ["Bonuses bought", money(s.bought), "var(--color-text)"], ["Prize", money(s.cfg.prize), "#f5c95a"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {st.map(([l, v, c]) => (
        <div key={l} className="rounded-xl border border-line bg-bg-2 px-3 py-2 text-center">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-dim">{l}</dt>
          <dd className="truncate font-mono text-lg font-bold" style={{ color: c }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const Bounty = ({ n }: { n: number }) => (n > 1 ? <span className="rounded-md bg-gold/15 px-1.5 font-mono text-[11px] font-bold text-gold">×{n}</span> : null);
function Avatar({ e, big = false }: { e: Entrant; big?: boolean }) {
  let h = 7;
  for (const ch of e.name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const ini = e.name.split(/[\s&_]+/).filter(Boolean);
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-head font-bold text-white ${big ? "size-16 text-xl" : "size-8 text-xs"}`} style={{ background: `hsl(${h} 45% 28%)`, boxShadow: `inset 0 0 0 2px hsl(${h} 60% 50%)` }}>
      {(ini.length > 1 ? ini[0][0] + ini[1][0] : e.name.slice(0, 2)).toUpperCase()}
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

export interface HuntAdmin { busy: boolean; go: (op: string, extra?: Record<string, unknown>, confirm?: string) => void }

function Verdict({ v, who, foe }: { v: NonNullable<HuntState["fights"][number]["verdict"]>; who: string; foe: string }) {
  return (
    <div className="space-y-0.5 text-[13px] tabular-nums text-muted">
      <p>{who}: <b className="font-mono text-text">{money(v.pf)}</b>{v.pf !== v.p && <span className="opacity-70"> (rolled {money(v.p)})</span>}</p>
      <p>{foe}: <b className="font-mono text-text">{money(v.bf)}</b>{v.bf !== v.b && v.bf !== Infinity && <span className="opacity-70"> (rolled {money(v.b)})</span>}</p>
      {v.notes.map((n, i) => <p key={i} className="text-[12px] text-gold">{n}</p>)}
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
          const c = m ? tierColor(m.tier) : "var(--color-line)";
          const def = m ? look(m.name) : null;
          const a = def?.ab ? ABI[def.ab] : null;
          return (
            <article key={`${s.wave}-${f.eid}`} className={`hunt-live flex flex-col gap-2 rounded-2xl border-2 bg-surface p-3 transition ${f.done && !f.won ? "opacity-55 grayscale-[0.6]" : ""}`}
              style={{ borderColor: f.done ? (f.won ? "#8cff4a88" : "#b36bff88") : m ? `${c}aa` : "var(--color-line)" }}>
              <header className="flex min-w-0 items-center gap-2">
                <Avatar e={e} />
                <span className="min-w-0 flex-1 truncate font-head font-bold" title={e.name}>{e.name}</span>
                <Bounty n={e.bounty} />
                {f.done ? (f.won ? <Chip c="#8cff4a">Survived</Chip> : <Chip c="#b36bff">Reaped</Chip>) : m ? <Chip c={c}>{m.secret ? "Seraph" : m.tier}</Chip> : <Chip c="#7d877f">Waiting</Chip>}
              </header>
              {m ? (
                <div className="flex min-w-0 items-center gap-3 rounded-xl bg-black/30 p-2" style={{ boxShadow: `inset 0 0 0 1px ${c}33` }}>
                  <Portrait name={m.name} tier={m.tier} size={compact ? 56 : 64} />
                  <div className="min-w-0 text-sm">
                    <b className="block truncate">{m.name}</b>
                    <span className="block truncate text-xs text-dim">{m.secret ? "∞" : m.curse === "blind" ? "Chat picks the slot" : def?.s}</span>
                    <span className="text-xs">Buy <b className="font-mono text-gold">{money(m.price)}</b></span>
                    {(m.abOn || m.curse) && !m.secret && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {m.abOn && a && <Chip c={a.boon ? "#8cff4a" : c}>{a.boon ? "Boon · " : ""}{a.name}</Chip>}
                        {m.curse && <Chip c="#4af0ff">{CUR[m.curse].name}</Chip>}
                      </span>
                    )}
                  </div>
                </div>
              ) : <div className="grid min-h-[80px] place-items-center rounded-xl border border-dashed border-line text-sm text-dim">No monster yet</div>}
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
                  <DuelInputs key={`${s.seq}-${i}`} la="Player win" lb="Monster win" busy={admin.busy}
                    lockA={m.revived && f.keep != null ? String(f.keep) : null}
                    b0={m.prebuy && f.verdict ? String(f.verdict.b) : ""}
                    onGo={(p, b) => admin.go("fight", { index: i, p, b })} />
                  <div className="flex justify-end"><button type="button" disabled={admin.busy} onClick={() => admin.go("reroll", { index: i }, `Re-roll ${m.name}? ${e.name} gets a new monster.`)} className="text-xs text-dim underline hover:text-text">Re-roll (host)</button></div>
                </div>
              ))}
              {f.done && f.verdict && !compact && <Verdict v={f.verdict} who={e.name} foe="Monster" />}
            </article>
          );
        })}
      </div>
      {fallen.length > 0 && (
        <div className="mt-4">
          <p className="label">Fallen in earlier waves</p>
          <div className="flex flex-wrap gap-1.5">{fallen.map((e) => <Chip key={e.id} c="#b36bff">{e.name} · {e.fate}</Chip>)}</div>
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
            <section key={ri} className={`w-64 shrink-0 space-y-3 ${active ? "" : "opacity-75"}`}>
              <h3 className="text-center font-head text-xs font-bold uppercase tracking-[0.18em]" style={{ color: active ? "#f5c95a" : "var(--color-muted)" }}>{arenaName(r)}</h3>
              {r.ms.map((m, i) => {
                const side = (id: number, v: number | null) => {
                  const e = s.ents[id];
                  const won = m.done && m.winner === id, lost = m.done && m.winner !== id;
                  return (
                    <div className={`flex items-center gap-2 px-2.5 py-2 ${won ? "bg-gold/10" : ""} ${lost ? "opacity-45" : ""}`}>
                      <Avatar e={e} />
                      <span className={`min-w-0 flex-1 truncate text-sm ${won ? "font-bold text-gold" : ""}`}>{e.name}</span>
                      <Bounty n={e.bounty} />
                      <span className="font-mono text-xs text-dim">{v == null ? "—" : money(v)}</span>
                    </div>
                  );
                };
                return (
                  <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface" style={active && !m.done ? { borderColor: "#f5c95a88" } : undefined}>
                    <p className="bg-black/30 px-2.5 py-1 text-[11px] text-muted">Both buy <b className="font-mono text-gold">{money(m.price)}</b>{m.tie && " · coin flip"}</p>
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
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-muted">
                  <Avatar e={s.ents[r.bye]} /><span><b className="text-text">{s.ents[r.bye].name}</b> has a free pass</span>
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
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-gold/60 bg-gold/[0.06] p-5 text-center">
          <Avatar e={c} big />
          <p className="eyebrow !text-gold">Last one standing</p>
          <h3 className="break-words font-head text-2xl font-bold">{c.name}</h3>
          <p className="text-xs text-muted">Best win {money(c.best)} · {c.slain} monster{c.slain === 1 ? "" : "s"} slain</p>
          <Chip c="#f5c95a">Playing for {money(s.cfg.prize * c.bounty)} (×{c.bounty})</Chip>
        </div>
        <p className="text-center font-display text-5xl"><span className="chrome">V</span><span className="neon-text">S</span></p>
        {b ? <MonsterCard m={b} line={b.secret ? "There is nothing to play. Fate has already been decided." : `Both buy ${money(b.price)}. Beat the Endboss and the prize becomes ×${b.bounty}.`} />
          : r.fate === "spared" ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-line p-6 text-center opacity-70"><span className="grid size-24 place-items-center rounded-2xl border-2 border-[#2a4a2a] font-display text-5xl text-[#2a4a2a]">Z</span><h3 className="font-head text-xl font-bold text-neon">Spared</h3><p className="text-xs text-muted">The Endboss sleeps</p></div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-line p-6 text-center"><span className="grid size-24 animate-pulse place-items-center rounded-2xl border-2 border-[#4a2a2a] font-display text-5xl text-[#7a4a4a]">?</span><h3 className="font-head text-xl font-bold text-[#c08080]">{r.fate === "comes" ? "He comes…" : "Unknown"}</h3><p className="text-xs text-muted">{r.fate === "comes" ? "The Endboss is being summoned" : `${s.cfg.chance}% chance he comes`}</p></div>
          )}
      </div>
      {admin && b && !r.done && (
        <div className="mx-auto mt-5 max-w-lg space-y-2">
          {b.revived && <p className="text-sm text-muted"><b className="text-text">Risen:</b> the Endboss buys again. Enter his new win.</p>}
          {b.secret ? <div className="flex justify-center"><button disabled={admin.busy} onClick={() => admin.go("boss", { p: "0", b: "0" })} className="btn !bg-[#fff6d6] !text-[#1a1408]">Face judgment</button></div>
            : <DuelInputs key={s.seq} la={`${c.name} win`} lb="Endboss win" busy={admin.busy} danger label="Fight the Endboss" lockA={b.revived && r.keep != null ? String(r.keep) : null} onGo={(p, x) => admin.go("boss", { p, b: x })} />}
        </div>
      )}
      {b && r.done && r.verdict && <div className="mx-auto mt-5 max-w-lg"><Verdict v={r.verdict} who={c.name} foe="Endboss" /></div>}
    </div>
  );
}

export function ResultBanner({ s }: { s: HuntState }) {
  const R = s.result;
  if (!R) return null;
  const c = R.champ != null ? s.ents[R.champ] : null;
  const cult = R.type === "wipe" || R.type === "fallen";
  const top = s.ents.reduce((a, b) => (b.slain > a.slain ? b : a), s.ents[0]);
  const deadly = Object.entries(s.kills).sort((a, b) => b[1] - a[1])[0];
  const head = R.type === "wipe" ? ["Total Reaping", "The Cult wins", "Every hunter fell in the Hunt. No champion this time."]
    : R.type === "champion" ? ["Spared by fate · Champion", c!.name, null]
    : R.type === "legend" ? ["Endboss slain · Legend", c!.name, `Beat ${R.boss} ${money(R.pf!)} to ${money(R.bf!)}.`]
    : R.type === "judged" ? ["One in a million", "Judged", `The Seraph descended and ended ${c!.name}'s run.`]
    : ["The champion fell", "The Cult wins", `${R.boss} won ${money(R.bf!)} against ${money(R.pf!)}.`];
  return (
    <section className={`rounded-3xl border-2 p-6 text-center ${cult ? "border-[#b36bff] bg-[radial-gradient(ellipse_at_50%_0%,rgb(179_107_255/0.2),#07050a_70%)]" : R.type === "judged" ? "border-[#fff6d6] bg-[#14120c]" : "border-gold/70 bg-gold/[0.07]"}`}>
      {cult ? <Skull className="mx-auto size-10 text-[#c9a6ff]" /> : <Crown className="mx-auto size-10 text-gold" />}
      <p className="eyebrow mt-2">{head[0]}</p>
      <h2 className="mt-1 break-words font-display text-4xl sm:text-6xl"><span className={cult ? "text-[#efe9f5]" : "chrome"}>{head[1]}</span></h2>
      {head[2] && <p className="mt-2 text-sm text-muted">{head[2]}</p>}
      {(R.type === "champion" || R.type === "legend") && (
        <p className="mt-3 text-base">Takes home {money(s.cfg.prize)} base × {c!.bounty} bounty = <b className="font-mono text-2xl text-gold">{money(R.payout)}</b></p>
      )}
      {(R.type === "fallen" || R.type === "judged") && <p className="mt-3 text-base">{R.payout > 0 ? <>{c!.name} keeps <b className="font-mono text-gold">{money(R.payout)}</b>.</> : "No prize is paid."}</p>}
      <dl className="mx-auto mt-5 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Biggest win", s.bigWin.v ? money(s.bigWin.v) : "—", s.bigWin.name],
          ["Top slayer", top?.slain ? top.name : "—", top?.slain ? `${top.slain} monster${top.slain === 1 ? "" : "s"}` : ""],
          ["Deadliest monster", deadly ? deadly[0] : "—", deadly ? `${deadly[1]} kill${deadly[1] === 1 ? "" : "s"}` : ""],
          ["Bonuses bought", money(s.bought), `${s.reaped} reaped · ${s.slain} slain`],
        ].map(([l, v, sub]) => (
          <div key={l} className="rounded-xl bg-black/30 p-2.5"><dt className="text-[10px] uppercase tracking-wider text-dim">{l}</dt><dd className="truncate font-head font-bold">{v}</dd><dd className="truncate text-[11px] text-muted">{sub}</dd></div>
        ))}
      </dl>
    </section>
  );
}

export function EventLog({ s, max = 40 }: { s: HuntState; max?: number }) {
  return (
    <div>
      <p className="label">Event log</p>
      <ol className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line bg-bg-2 p-3 text-[13px]">
        {s.log.slice(0, max).map((l, i) => <li key={s.log.length - i} className="border-l-2 pl-2" style={{ borderColor: TONE[l.c], color: l.c === "m" ? "var(--color-muted)" : TONE[l.c] }}>{l.t}</li>)}
      </ol>
    </div>
  );
}

/** Phase view: Hunt grid, Arena bracket or Reckoning duel (the result banner on top once done). */
export function HuntPhase({ s, admin, compact = false }: { s: HuntState; admin?: HuntAdmin; compact?: boolean }) {
  return (
    <div className="space-y-5">
      <ResultBanner s={s} />
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
  const fresh = s?.reveal && seen.init && s.reveal.seq > seen.seq ? s.reveal : null;
  const freshSeq = fresh?.seq ?? null;
  // stream / public page: the pop-up closes on its own
  useEffect(() => {
    if (freshSeq == null || !autoMs) return;
    const id = setTimeout(() => setSeen((x) => ({ ...x, seq: Math.max(x.seq, freshSeq) })), autoMs);
    return () => clearTimeout(id);
  }, [freshSeq, autoMs]);
  return { reveal: fresh, dismiss: () => fresh && setSeen((x) => ({ ...x, seq: fresh.seq })) };
}

/** Full-screen pop-up for a reveal. */
export function RevealOverlay({ s, reveal, onClose, big = false }: { s: HuntState; reveal: NonNullable<HuntState["reveal"]>; onClose: () => void; big?: boolean }) {
  let body: React.ReactNode = null;
  let eyebrow = "", title = "";
  if (reveal.kind === "spawn" && reveal.fight != null) {
    const f = s.fights[reveal.fight];
    if (!f?.monster) return null;
    const e = s.ents[f.eid];
    eyebrow = `The Hunt · wave ${s.wave} of ${s.cfg.waves}`;
    title = f.monster.secret ? "A light descends" : ((tierById(f.monster.tier) as { head?: string } | null)?.head ?? "Something stirs…");
    body = <MonsterCard m={f.monster} big={big} line={`Both buy ${money(f.monster.price)}${s.cfg.duo ? " (each teammate once, monster win ×2)" : ""}. ${e.name} must win more than the monster.`} />;
  } else if (reveal.kind === "fate" && s.reckon) {
    const comes = s.reckon.fate === "comes";
    eyebrow = "The Reckoning";
    title = comes ? "The ground shakes" : "The Cult sleeps";
    body = (
      <div className={`mx-auto max-w-md rounded-3xl border-2 p-8 text-center ${comes ? "border-danger" : "border-neon"}`}>
        <p className={`font-display text-6xl ${comes ? "text-danger" : "text-neon"}`}>{comes ? "He comes" : "Spared"}</p>
        <p className="mt-2 text-sm text-muted">{comes ? `${s.ents[s.reckon.champ].name} must beat the Endboss to keep the crown.` : `The Endboss stays asleep. ${s.ents[s.reckon.champ].name} wins the Reaping.`}</p>
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
    <div className="fixed inset-0 z-[150] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full max-w-xl text-center ${heavy ? "ko-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow !text-[#ff8a3d]">{eyebrow}</p>
        <h2 className="mb-4 mt-1 font-display text-4xl text-[#f1ece4] sm:text-5xl">{title}</h2>
        {body}
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm mt-4">Close</button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm";

// Admin → Tournament, bottom: every tournament ever made, to clean up tests
// by hand. Only finished or cancelled ones can be deleted (a running one is
// reset first); deleting removes its players, battles and boss rolls.

export interface ArchiveRow { id: number; title: string; status: string; mode: string; max_players: number; team_size: number; created: string; players: number; champion: string | null }

const MODE: Record<string, string> = { classic: "Classic", reaping: "Reaping · Wheel", hunt: "Reaping · Hunt" };
const TONE: Record<string, string> = { finished: "text-neon border-neon/40", cancelled: "text-dim border-line-hot", open: "text-gold border-gold/50", closed: "text-gold border-gold/50" };

export function KoArchiveAdmin({ rows }: { rows: ArchiveRow[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return k ? list.filter((r) => `${r.id} ${r.title} ${r.status} ${r.champion ?? ""}`.toLowerCase().includes(k)) : list;
  }, [list, q]);

  const remove = async (r: ArchiveRow) => {
    if (!(await confirmDialog(`Delete tournament #${r.id} "${r.title}" for good? Its ${r.players} player(s), battles and results are removed. This can't be undone.`))) return;
    setBusy(r.id); setMsg(null);
    try {
      const res = await fetch("/api/admin/tournament", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: r.id }) });
      const d = (await res.json()) as { ok: boolean; message?: string; detail?: string | null };
      if (!d.ok) setMsg(`${d.message ?? "Refused"}${d.detail ? ` (${d.detail})` : ""}`);
      else { setList((l) => l.filter((x) => x.id !== r.id)); router.refresh(); }
    } catch {
      setMsg("Network error: nothing changed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel mt-8 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl"><span className="chrome">Archive</span></p>
          <p className="text-xs text-dim">{list.length} tournaments · delete tests and junk; finished ones show under Past champions on the site.</p>
        </div>
        <label className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search #, title, champion" className="field !py-2 !pl-9 text-sm" aria-label="Search tournaments" />
        </label>
      </div>
      {msg && <p role="alert" className="mb-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left font-head text-[11px] uppercase tracking-[0.14em] text-dim">
              <th className="py-2 pr-3">#</th><th className="pr-3">Title</th><th className="pr-3">Mode</th><th className="pr-3">Status</th><th className="pr-3">Players</th><th className="pr-3">Champion</th><th className="pr-3">Created</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const running = r.status === "open" || r.status === "closed";
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-mono text-dim">{r.id}</td>
                  <td className="max-w-[220px] truncate pr-3 font-semibold">{r.title || "—"}</td>
                  <td className="pr-3 text-muted">{MODE[r.mode] ?? r.mode} · {r.max_players}{r.team_size === 2 ? " teams" : ""}</td>
                  <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TONE[r.status] ?? "text-dim"}`}>{running ? "running" : r.status}</span></td>
                  <td className="pr-3 font-mono text-muted">{r.players}</td>
                  <td className="max-w-[160px] truncate pr-3 text-gold">{r.champion ?? "—"}</td>
                  <td className="pr-3 text-xs text-dim">{new Date(r.created).toLocaleDateString(undefined, { month: "short", day: "numeric" })} {new Date(r.created).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="text-right">
                    <button type="button" disabled={running || busy !== null} onClick={() => remove(r)} title={running ? "Reset it first" : "Delete for good"}
                      className="inline-flex items-center gap-1 rounded-lg border border-danger/40 px-2.5 py-1 text-xs font-bold text-danger transition hover:bg-danger/10 disabled:opacity-30">
                      <Trash2 className="size-3.5" /> {busy === r.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

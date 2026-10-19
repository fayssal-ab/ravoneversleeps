import { SlotPicker } from "@/components/admin/SlotPicker";
import { AdminTitle, Card, Field } from "@/components/admin/ui";
import { Flash } from "@/components/ui/bits";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SlotArt } from "@/components/ui/SlotArt";
import { listChallenges } from "@/lib/challenges";
import { formatMoney } from "@/lib/money";
import { ensureCatalog } from "@/lib/slots";
import { challengeClaimsByChallenge, type AdminClaim } from "@/lib/verification";
import { challengeOpAction, createChallengeAction } from "../actions";

const STATUS = { open: "text-neon", won: "text-gold", closed: "text-dim" } as const;
const multi = (v: string) => `${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}x`;

export default async function AdminChallenges({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await ensureCatalog();
  const [list, claims] = await Promise.all([listChallenges(200), challengeClaimsByChallenge().catch(() => new Map<number, AdminClaim[]>())]);
  return (
    <>
      <AdminTitle title="Challenges">
        &ldquo;First to hit <i>N</i>x on a slot wins $X.&rdquo; Viewers send their proof (bet and win visible) on Discord; when it checks out, mark the winner here.
      </AdminTitle>
      <Flash ok={sp.ok} error={sp.error} detail={sp.detail} okText="Saved." />

      <Card title="New challenge">
        <form action={createChallengeAction} className="grid gap-3 md:grid-cols-[1fr_8rem_8rem_8rem_auto] md:items-end">
          <Field label="Slot"><SlotPicker /></Field>
          <Field label="Target (x)"><input name="target_multi" required inputMode="decimal" placeholder="1000" className="field font-mono" /></Field>
          <Field label="Reward ($)"><input name="reward" required inputMode="decimal" placeholder="50" className="field font-mono" /></Field>
          <Field label="Min bet ($)"><input name="min_bet" inputMode="decimal" placeholder="0.40" className="field font-mono" /></Field>
          <button className="btn btn-neon h-[42px]">Create</button>
        </form>
      </Card>

      <div className="mt-6 space-y-2">
        {list.length === 0 && <p className="text-sm text-dim">No challenges yet.</p>}
        {list.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <SlotArt name={c.slot_name} src={c.image_url} size={52} rounded="rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-head font-bold">{c.slot_name} <span className="text-xs font-normal text-dim">{c.provider}</span></p>
              <p className="text-sm text-muted">
                First to hit <span className="font-mono text-neon">{multi(c.target_multi)}</span> wins <span className="font-mono text-gold">{formatMoney(c.reward)}</span>
                {Number(c.min_bet) > 0 && <> · min bet {formatMoney(c.min_bet)}</>}
                {" · "}<span className={`font-bold uppercase ${STATUS[c.status]}`}>{c.status}</span>
                {c.winner && <> · won by <span className="text-text">{c.winner}</span>{c.winner_multi && <> ({multi(c.winner_multi)})</>}</>}
              </p>
            </div>
            {(claims.get(c.id) ?? []).length > 0 && (
              <ul className="w-full space-y-1 border-t border-line pt-2 text-sm">
                {claims.get(c.id)!.map((cl) => (
                  <li key={cl.display_name + cl.created_at} className="flex flex-wrap items-center justify-between gap-2">
                    <span><span className="font-bold">{cl.display_name}</span> · Qzino <span className="font-mono text-neon">{cl.qzino_username}</span> <span className="text-xs text-dim">{cl.created_at}</span></span>
                    {cl.ticket_url ? <a href={cl.ticket_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Proof ticket</a> : <span className="text-xs text-dim">no ticket</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {c.status === "open" && (
                <form action={challengeOpAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="op" value="won" />
                  <input name="winner" required maxLength={64} placeholder="Winner" className="field !w-32 !py-1.5 text-sm" aria-label="Winner" />
                  <input name="winner_multi" required inputMode="decimal" placeholder="Multi" className="field !w-24 !py-1.5 font-mono text-sm" aria-label="Winning multi" />
                  <button className="btn btn-neon btn-sm">Mark won</button>
                </form>
              )}
              <form action={challengeOpAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="op" value={c.status === "open" ? "close" : "reopen"} />
                <button className="btn btn-ghost btn-sm">{c.status === "open" ? "Close" : "Reopen"}</button>
              </form>
              <form action={challengeOpAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="op" value="delete" />
                <ConfirmButton className="btn btn-ghost btn-sm !text-danger" title="Delete this challenge?" confirmLabel="Delete" body={<>{c.slot_name} · {multi(c.target_multi)} · {formatMoney(c.reward)}</>}>Delete</ConfirmButton>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

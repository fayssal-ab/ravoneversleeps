"use client";

import { Send } from "lucide-react";
import { claimChallengeAction } from "@/app/(site)/actions";
import { ProofForm } from "@/components/ui/ProofForm";

// "I hit it · Claim": the multi, the bet and a screenshot / clip of the win
// open the player's claim ticket with everything attached.
export function ClaimForm({ id, slot, target, minBet }: { id: number; slot: string; target: number; minBet: number }) {
  return (
    <ProofForm
      action={claimChallengeAction}
      trigger={<>I hit it · Claim</>}
      triggerClass="btn btn-neon btn-sm"
      eyebrow={`Challenge · ${slot}`}
      title="Claim your win"
      hidden={{ challenge: String(id) }}
      proofLabel="Proof: screenshot or clip of the win"
      bullets={[
        <>The <b className="text-text">bet</b> and the <b className="text-text">win / multiplier</b> must be visible</>,
        <>On Qzino, with your verified username if possible</>,
      ]}
      note="This opens your private Discord ticket with the proof attached. The first verified hit wins."
      submitLabel="Send my claim"
      submitIcon={<Send className="size-4" />}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Multi hit</span>
          <div className="relative">
            <input name="multi" type="number" required min={target} step="0.01" placeholder={String(target)} className="field !pr-8 font-mono" autoFocus />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-dim">x</span>
          </div>
          <span className="mt-1 block text-xs text-dim">target {target}x</span>
        </label>
        <label className="block">
          <span className="label">Bet</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dim">$</span>
            <input name="bet" type="number" required min={minBet > 0 ? minBet : 0.01} step="0.01" placeholder={minBet > 0 ? String(minBet) : "0.40"} className="field !pl-7 font-mono" />
          </div>
          {minBet > 0 && <span className="mt-1 block text-xs text-dim">min ${minBet}</span>}
        </label>
      </div>
    </ProofForm>
  );
}

"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import { submitVerificationAction } from "@/app/(site)/actions";
import { ProofForm } from "@/components/ui/ProofForm";

// "Verify my Qzino account": the username and the proof (screenshots or a
// short recording of the Qzino account, logged in, under code RAVO50).
// Sending it opens the player's Discord ticket with the proof attached.
export function VerifyForm({ username, label }: { username: string; label: string }) {
  return (
    <ProofForm
      action={submitVerificationAction}
      trigger={<><BadgeCheck className="size-4" /> {label}</>}
      eyebrow="Qzino verification"
      title="Prove it's you"
      proofLabel="Proof: screenshot or short recording"
      bullets={[
        <>Your Qzino account, <b className="text-text">logged in</b>, with the username visible</>,
        <>Showing you play <b className="text-text">under code RAVO50</b> (affiliate / promo section)</>,
      ]}
      note="This opens your private Discord ticket with everything attached. The team checks it and verifies you here. Never send passwords or login codes."
      submitLabel="Send for verification"
      submitIcon={<ShieldCheck className="size-4" />}
    >
      <label className="block">
        <span className="label">Your Qzino username</span>
        <input name="qzino" required defaultValue={username} maxLength={64} pattern="[\w.\-]+" placeholder="exact username on Qzino" className="field font-mono" autoFocus />
      </label>
    </ProofForm>
  );
}

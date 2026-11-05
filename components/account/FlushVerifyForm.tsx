"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import { submitFlushVerificationAction } from "@/app/(site)/actions";
import { ProofForm } from "@/components/ui/ProofForm";

export function FlushVerifyForm({ username, label }: { username: string; label: string }) {
  return (
    <ProofForm
      action={submitFlushVerificationAction}
      trigger={<><BadgeCheck className="size-4" /> {label}</>}
      eyebrow="Flush verification"
      title="Prove it's you"
      proofLabel="Proof: screenshot or short recording"
      bullets={[
        <>Your Flush account, <b className="text-text">logged in</b>, with the username visible</>,
        <>The proof must be genuine. Never send a password, wallet recovery phrase, or login code.</>,
      ]}
      note="This opens your private Discord ticket with the proof attached. The team checks it and verifies your username here."
      submitLabel="Send for verification"
      submitIcon={<ShieldCheck className="size-4" />}
    >
      <label className="block">
        <span className="label">Your Flush username</span>
        <input name="flush" required defaultValue={username} maxLength={64} pattern="[\w.\-]+" placeholder="exact username on Flush" className="field font-mono" autoFocus />
      </label>
    </ProofForm>
  );
}

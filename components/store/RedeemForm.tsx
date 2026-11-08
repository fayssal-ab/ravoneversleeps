"use client";

import { Gift } from "lucide-react";
import { redeemAction } from "@/app/(site)/actions";
import { ProofForm } from "@/components/ui/ProofForm";

// "Redeem": QHub username + a screenshot of the QHub Points balance. The
// request opens the viewer's private Discord ticket with the proof attached.
export function RedeemForm({ id, name, price }: { id: number; name: string; price: number }) {
  return (
    <ProofForm
      action={redeemAction}
      trigger={<><Gift className="size-4" /> Redeem</>}
      triggerClass="btn btn-neon btn-sm"
      eyebrow={`Store · ${price.toLocaleString("en-US")} QHub Points`}
      title={name}
      hidden={{ item: String(id) }}
      proofLabel="Proof: screenshot of your QHub Points"
      bullets={[
        <>Your <b className="text-text">QHub username</b> and your <b className="text-text">Points balance</b> must be visible</>,
        <>At least <b className="text-gold">{price.toLocaleString("en-US")} Points</b>, taken while logged in on q-hub.tv</>,
        <>Never include a password or a login code</>,
      ]}
      note="This opens your private Discord ticket with the proof attached. The team checks your Points, takes them on QHub and sends the reward to your verified Qzino account."
      submitLabel="Send my request"
      submitIcon={<Gift className="size-4" />}
    >
      <label className="block">
        <span className="label">QHub username</span>
        <input name="qhub" required maxLength={64} pattern="[^<>@#:`]{2,64}" placeholder="as shown on q-hub.tv" className="field font-mono" autoFocus />
      </label>
    </ProofForm>
  );
}

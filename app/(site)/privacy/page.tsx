import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/bits";
import { DISCORD_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy" };

const SECTIONS: { h: string; p: string[] }[] = [
  { h: "What we store", p: [
    "When you sign in with Kick or Discord we keep your public username, avatar and account id from that provider, the Qzino and QHub usernames you add, your points and rank, and what you redeem or claim.",
    "Leaderboard wagers come from Qzino's affiliate dashboard. Usernames are partly hidden on public pages.",
  ] },
  { h: "Cookies", p: [
    "Essential cookies keep you signed in (ravo_user) and keep the admin panel secure. They're needed for the site to work.",
    "ravo_consent remembers your cookie choice for a year. We don't use advertising or tracking cookies.",
  ] },
  { h: "Who we share it with", p: [
    "Nobody sells your data. To pay a reward, the team uses your Qzino username or the details you give us on Discord.",
  ] },
  { h: "Your choices", p: [
    "You can sign out at any time. To delete your account and its data, contact the team on Discord.",
  ] },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6">
      <PageHeader eyebrow="Legal" title="Privacy" accent="policy" />
      <div className="panel space-y-8 p-6 sm:p-8">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="font-head text-xl font-bold text-neon">{s.h}</h2>
            {s.p.map((t) => <p key={t} className="mt-2 text-sm leading-relaxed text-muted">{t}</p>)}
          </section>
        ))}
        <p className="text-sm text-dim">Questions? <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-neon hover:underline">Ask on Discord</a>.</p>
      </div>
    </div>
  );
}

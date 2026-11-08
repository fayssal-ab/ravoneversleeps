import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Crosshair, Clapperboard } from "lucide-react";
import { StreamBox } from "@/components/stream/StreamBox";
import { PageHeader } from "@/components/ui/bits";
import { Reveal, SpotlightCard } from "@/components/ui/motion";
import { getLiveStatus, getSchedule, WEEKDAYS } from "@/lib/stream";

export const metadata: Metadata = { title: "Stream", description: "Watch Ravo live on Kick: slots, bonus hunts and tournaments. Weekly schedule." };
export const dynamic = "force-dynamic";

export default async function StreamPage() {
  const [live, schedule] = await Promise.all([getLiveStatus(), getSchedule()]);
  const today = (new Date().getUTCDay() + 6) % 7;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow={live.live ? "● Live now" : "Kick · Slots & Casino"} title="The" accent="stream">
        Slots, bonus hunts, tournaments and giveaways. &ldquo;I never sleep.&rdquo;
      </PageHeader>

      <Reveal><StreamBox live={live} /></Reveal>

      <div className="mt-8 grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <div className="panel h-full p-6">
            <p className="eyebrow mb-4 flex items-center gap-2"><CalendarDays className="size-4" /> Weekly schedule (UTC)</p>
            {schedule.length === 0 ? (
              <p className="text-sm text-muted">No fixed schedule. Ravo goes live when Ravo goes live. Follow on Kick for the ping.</p>
            ) : (
              <ul className="space-y-2">
                {WEEKDAYS.map((day, i) => {
                  const slots = schedule.filter((s) => s.weekday === i);
                  return (
                    <li key={day} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${i === today ? "border-neon/60 bg-neon/[0.06]" : "border-line bg-bg-2"}`}>
                      <span className={`font-head font-bold ${i === today ? "text-neon" : ""}`}>{day}{i === today && <span className="ml-2 text-xs uppercase tracking-widest">today</span>}</span>
                      <span className="text-right text-sm text-muted">
                        {slots.length ? slots.map((s) => <span key={s.id} className="block"><span className="font-mono text-text">{s.start_time}</span>{s.title && ` · ${s.title}`}</span>) : "Rest day"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Reveal>
        <div className="grid gap-5">
          {[
            { href: "/bonus-hunts", icon: Crosshair, title: "Bonus hunts", text: "Follow every bonus, multi and the running total live." },
            { href: "/clips", icon: Clapperboard, title: "Clips", text: "The best moments from the stream, clipped by chat." },
          ].map((c, i) => (
            <Reveal key={c.href} delay={i * 0.08}>
              <Link href={c.href} className="block h-full">
                <SpotlightCard className="panel neon-frame flex h-full items-center gap-5 p-6">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-neon/10 text-neon"><c.icon className="size-7" /></span>
                  <span>
                    <span className="block font-head text-xl font-bold">{c.title}</span>
                    <span className="block text-sm text-muted">{c.text}</span>
                  </span>
                </SpotlightCard>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

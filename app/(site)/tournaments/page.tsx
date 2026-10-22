import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown } from "lucide-react";
import { LiveRefresh } from "@/components/shell/AutoUpdate";
import { KoPublic } from "@/components/tournament/KoPublic";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { Stagger } from "@/components/ui/motion";
import { SlotArt } from "@/components/ui/SlotArt";
import { getFeaturedKo, getKoArchive, getKoById, getKoState } from "@/lib/knockout";

export const metadata: Metadata = { title: "Tournaments", description: "Solo and duo slot knockout tournaments on Ravo's stream: join from Kick chat with !join." };
export const dynamic = "force-dynamic";

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const idParam = Number((await searchParams).id);
  const requested = Number.isInteger(idParam) && idParam > 0 ? idParam : null;
  let data: Awaited<ReturnType<typeof load>> | null = null;
  async function load() {
    const t = requested ? await getKoById(requested) : await getFeaturedKo();
    return { state: t && t.status !== "cancelled" ? await getKoState(t) : null, archive: await getKoArchive(12) };
  }
  try { data = await load(); } catch { data = null; }
  if (requested && data && !data.state) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* a new tournament or archived champion shows up without a reload */}
      <LiveRefresh every={20_000} />
      <PageHeader eyebrow="1v1 & 2v2 slot battles" title="Slot" accent="tournaments">
        Players from chat, one slot each. Higher multiplier wins the battle. Last one standing takes the crown.
      </PageHeader>
      {requested && <Link href="/tournaments" className="mb-6 inline-block text-sm text-muted hover:text-neon">← Current tournament</Link>}
      {data == null ? (
        <EmptyState title="Tournaments offline">Temporarily unavailable. Try again in a minute.</EmptyState>
      ) : data.state ? (
        <KoPublic initial={data.state} id={requested ?? undefined} />
      ) : (
        <EmptyState title="No tournament yet" action={<Link href="/stream" className="btn btn-neon">Watch the stream</Link>}>
          When registration opens on stream, type <code className="text-neon">!join</code> in Kick chat to grab a seat.
        </EmptyState>
      )}
      {data && data.archive.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-4xl"><span className="chrome">Past</span> <span className="neon-text">champions</span></h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.archive.map((a) => (
              <Link key={a.id} href={`/tournaments?id=${a.id}`} className="panel neon-frame flex items-center gap-4 p-5 transition hover:-translate-y-1">
                <SlotArt name={a.champion_slot ?? "?"} src={a.champion_image} size={64} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-muted">{a.title || "Knockout"} · {a.team_size === 2 ? `duo · ${a.max_players} teams` : `${a.max_players} players`}</span>
                  <span className="flex items-center gap-1.5 truncate font-head text-lg font-bold text-gold"><Crown className="size-4" /> {a.champion ?? "—"}</span>
                  {a.champion_slot && <span className="block truncate text-xs text-dim">{a.champion_slot}</span>}
                </span>
              </Link>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}

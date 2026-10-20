import type { Metadata } from "next";
import Link from "next/link";
import { ClipGrid } from "@/components/clips/ClipGrid";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { getClips, type ClipSort } from "@/lib/clips";
import { KICK_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Clips", description: "The best moments from Ravo's Kick streams: big wins, bonus hunts and chaos." };
export const revalidate = 600;

export default async function ClipsPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sort: ClipSort = (await searchParams).sort === "top" ? "view" : "date";
  const clips = await getClips(sort).catch(() => null);
  const tab = (key: "latest" | "top", label: string) => {
    const on = (key === "top") === (sort === "view");
    return (
      <Link href={key === "top" ? "/clips?sort=top" : "/clips"} className={`rounded-full px-4 py-2 font-head text-sm font-bold uppercase tracking-wider transition ${on ? "bg-neon text-neon-ink" : "text-muted hover:text-text"}`}>
        {label}
      </Link>
    );
  };
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="From the stream" title="Kick" accent="clips">
        Big wins, wild bonus hunts and the best moments, clipped by chat.
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-full border border-line bg-surface p-1" aria-label="Sort clips">
          {tab("latest", "Latest")}
          {tab("top", "Most viewed")}
        </nav>
        <a href={`${KICK_URL}/clips`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm"><SocialIcon name="kick" className="size-4" /> All clips on Kick</a>
      </div>
      {clips == null ? (
        <EmptyState title="Clips offline" action={<a href={`${KICK_URL}/clips`} target="_blank" rel="noopener noreferrer" className="btn btn-neon">Watch on Kick</a>}>
          Kick didn&apos;t answer. Try again in a minute.
        </EmptyState>
      ) : clips.length === 0 ? (
        <EmptyState title="No clips yet" action={<a href={KICK_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon">Watch the stream</a>}>
          Catch a big win on stream and clip it: it shows up here.
        </EmptyState>
      ) : (
        <ClipGrid clips={clips} />
      )}
    </div>
  );
}

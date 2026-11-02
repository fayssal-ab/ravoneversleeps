import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/bits";
import { DISCORD_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Leaderboard", description: "Ravo's leaderboard is coming soon." };

// The last leaderboard has finished and its data is no longer shown. The
// Q-boards sync (lib/leaderboard.ts) is left in place for when a new one starts.
export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <header className="pb-10 pt-6 text-center">
        <h1 className="font-display text-6xl sm:text-8xl"><span className="chrome">Leaderboard</span></h1>
      </header>
      <EmptyState
        title="Soon"
        action={<a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="btn btn-neon">Join the Discord</a>}
      >
        A new leaderboard is on the way. Join the Discord to hear the moment it starts.
      </EmptyState>
    </div>
  );
}

import { KICK_CHANNEL, KICK_URL } from "@/lib/constants";
import type { LiveStatus } from "@/lib/stream";
import { PugVideo } from "@/components/ui/PugVideo";
import { SocialIcon } from "@/components/ui/SocialIcon";

// Live → the Kick player. Offline → Ravo's pug film with the sleeping pug
// line (an offline Kick embed is just a black box).
export function StreamBox({ live }: { live: LiveStatus }) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="flex items-center gap-2 font-head text-sm font-bold uppercase tracking-[0.18em]">
          <span className={`size-2.5 rounded-full ${live.live ? "animate-pulse bg-danger shadow-[0_0_10px_var(--color-danger)]" : "bg-dim"}`} />
          {live.live ? <>Live now{live.viewers ? ` · ${live.viewers.toLocaleString("en-US")} watching` : ""}</> : "Offline"}
        </p>
        <a href={KICK_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-neon">kick.com/{KICK_CHANNEL} ↗</a>
      </div>
      {/* offline: phones get a taller box so the message never runs under the header */}
      <div className={`relative bg-black ${live.live ? "aspect-video" : "min-h-[22rem] sm:aspect-video sm:min-h-0"}`}>
        {live.live ? (
          <iframe
            src={`https://player.kick.com/${KICK_CHANNEL}?autoplay=true&muted=true`}
            title="RAVONEVERSLEEPS live on Kick"
            className="absolute inset-0 size-full"
            allow="autoplay; fullscreen; picture-in-picture"
          />
        ) : (
          <a href={KICK_URL} target="_blank" rel="noopener noreferrer" className="group absolute inset-0 block overflow-hidden">
            {/* Ravo's pug film (4K), dimmed behind the message */}
            <PugVideo className="absolute inset-0 size-full object-cover opacity-75 transition duration-700 group-hover:scale-105 group-hover:opacity-90" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgb(4_6_5/0.85)_85%)]" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-6 text-center sm:p-10">
              <p className="font-display text-[2.1rem] leading-[0.95] sm:text-6xl"><span className="chrome">Ravo is</span> <span className="neon-text">resting his eyes</span></p>
              <p className="max-w-md text-sm text-text/70">{live.followers ? `${live.followers.toLocaleString("en-US")} followers · ` : ""}Follow on Kick to get pinged the second he goes live.</p>
              <span className="btn btn-neon mt-2"><SocialIcon name="kick" className="size-4" /> Follow on Kick</span>
            </div>
          </a>
        )}
      </div>
      {live.live && live.title && <p className="border-t border-line px-5 py-3 text-sm text-muted">{live.title}</p>}
    </div>
  );
}

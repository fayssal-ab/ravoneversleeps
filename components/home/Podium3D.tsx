"use client";

import dynamic from "next/dynamic";

// Home top 3 as a real 3D podium (three.js, components/three/Podium3DScene).
// The scene loads in the browser only; the list below is what search engines
// and screen readers get.

export type PodiumEntry = { name: string | null; score: string | null; prize: string | null };

const Scene = dynamic(() => import("@/components/three/Podium3DScene"), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

export function Podium3D({ entries }: { entries: PodiumEntry[] }) {
  return (
    <div className="relative h-[21rem] sm:h-[26rem]">
      <Scene entries={entries} />
      <ol className="sr-only">
        {entries.slice(0, 3).map((e, i) => (
          <li key={i}>{i + 1}. {e.name ?? "Open spot"}{e.score ? `, ${e.score}` : ""}{e.prize ? `, prize ${e.prize}` : ""}</li>
        ))}
      </ol>
    </div>
  );
}

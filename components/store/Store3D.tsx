"use client";

import dynamic from "next/dynamic";

// three.js only loads in the browser; the box keeps its size meanwhile.
const Scene = dynamic(() => import("@/components/three/Store3DScene"), { ssr: false, loading: () => null });

export function Store3D({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div aria-hidden className="store-halo absolute inset-[12%] rounded-full" />
      <Scene />
    </div>
  );
}

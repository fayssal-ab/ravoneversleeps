"use client";

import { Environment, Lightformer } from "@react-three/drei";

/** Shared chrome-studio lighting: soft white key, green rim, ring glint.
 *  Built from Lightformers, so no HDR file is downloaded. */
export function StudioLights({ green = 1 }: { green?: number }) {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={6 * green} color="#8dff4a" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 4]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.6 * green} color="#8dff4a" position={[-5, 0, 2]} rotation-y={Math.PI / 3} scale={[3, 8, 1]} />
        <Lightformer form="ring" intensity={2} position={[5, -1, 3]} scale={2.5} />
      </Environment>
    </>
  );
}

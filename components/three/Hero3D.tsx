"use client";

import { Float, Sparkles } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";
import { chipFace, chipSide, suitGeometry } from "./shapes";

// Hero ambience in real 3D: poker chips and chrome card suits floating
// around the RAVO reels. They stay in place (the mouse does not move them),
// tumble slowly and bob; they are decoration only, not clickable. The two
// clickable dice sit on the table in the art (TableDice3D).

function Chip({ tone, size = 1 }: { tone: "green" | "black"; size?: number }) {
  const mats = useMemo(() => {
    const base = tone === "green" ? "#1f6b2b" : "#151b17";
    const edge = tone === "green" ? "#2e9a3e" : "#0b0f0c";
    const face = chipFace(base, edge);
    const side = chipSide(base);
    side.repeat.set(3, 1);
    return [
      new THREE.MeshStandardMaterial({ map: side, roughness: 0.45, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.1 }),
    ];
  }, [tone]);
  useEffect(() => () => mats.forEach((m) => { m.map?.dispose(); m.dispose(); }), [mats]);
  return (
    <mesh scale={size} material={mats}>
      <cylinderGeometry args={[0.7, 0.7, 0.16, 64]} />
    </mesh>
  );
}

function Suit({ kind, size = 1 }: { kind: "spade" | "heart" | "club" | "diamond"; size?: number }) {
  const geo = useMemo(() => suitGeometry(kind), [kind]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} scale={size}>
      <meshStandardMaterial color="#d4f5d8" metalness={1} roughness={0.14} emissive="#1d4f12" emissiveIntensity={0.25} />
    </mesh>
  );
}

/** Slow tumble on its own axis (each prop has its own speed). */
function Tumble({ speed, children }: { speed: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.x += dt * speed[0];
    g.rotation.y += dt * speed[1];
    g.rotation.z += dt * speed[2];
  });
  return <group ref={ref}>{children}</group>;
}

type Prop = { el: React.ReactNode; at: [number, number, number]; speed: [number, number, number]; mobile?: boolean };

function Props() {
  const { viewport } = useThree();
  const w = viewport.width / 2, h = viewport.height / 2;
  const narrow = viewport.width < 7;

  // positions as fractions of the visible area (x: -1 left … 1 right)
  const props: Prop[] = [
    { el: <Suit kind="diamond" size={0.75} />, at: [-0.82, 0.55, 0], speed: [0, 0.8, 0], mobile: true },
    { el: <Chip tone="green" size={1.1} />, at: [-0.66, -0.45, 0.5], speed: [0.6, 0.15, 0.35] },
    { el: <Suit kind="spade" size={0.95} />, at: [-0.93, -0.05, -0.6], speed: [0, 0.7, 0] },
    { el: <Chip tone="black" size={0.8} />, at: [0.62, 0.72, -0.4], speed: [0.45, 0.2, 0.5], mobile: true },
    { el: <Suit kind="heart" size={0.7} />, at: [0.9, -0.1, 0.2], speed: [0, 0.8, 0] },
    { el: <Suit kind="club" size={0.55} />, at: [0.3, 0.82, -0.8], speed: [0, -0.6, 0] },
    { el: <Suit kind="heart" size={0.5} />, at: [-0.35, -0.82, -0.5], speed: [0, 0.9, 0], mobile: true },
  ];

  return (
    <group>
      {props.filter((p) => !narrow || p.mobile).map((p, i) => (
        <Float key={i} speed={1.4 + (i % 3) * 0.3} rotationIntensity={0.4} floatIntensity={0.9}>
          <group position={[p.at[0] * w * (narrow ? 0.92 : 1), p.at[1] * h * (narrow ? 0.62 : 1), p.at[2]]} scale={narrow ? 0.6 : 1}>
            <Tumble speed={p.speed}>{p.el}</Tumble>
          </group>
        </Float>
      ))}
    </group>
  );
}

export default function Hero3D() {
  return (
    <LazyCanvas className="pointer-events-none absolute inset-0" camera={{ position: [0, 0, 10], fov: 40 }}>
      <StudioLights />
      <Props />
      <Sparkles count={28} scale={[16, 8, 4]} size={2} speed={0.3} color="#8dff4a" opacity={0.5} />
    </LazyCanvas>
  );
}

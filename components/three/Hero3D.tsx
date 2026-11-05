"use client";

import { Float, RoundedBox, Sparkles } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";
import { chipFace, chipSide, DIE_PIPS, suitGeometry } from "./shapes";

// Hero props in real 3D: dice with glowing pips, poker chips and chrome card
// suits floating around the RAVO reels. They tumble slowly, bob, and the
// whole set drifts with the pointer for depth. Kept to the sides so the
// mascot and reels stay clear.

const pointer = { x: 0, y: 0 };

function Die({ size = 1 }: { size?: number }) {
  return (
    <group scale={size}>
      <RoundedBox args={[1, 1, 1]} radius={0.16} smoothness={5}>
        <meshPhysicalMaterial color="#121a14" roughness={0.25} metalness={0.2} clearcoat={1} clearcoatRoughness={0.15} />
      </RoundedBox>
      {DIE_PIPS.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color="#8dff4a" emissive="#8dff4a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

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
      <meshPhysicalMaterial color="#d4f5d8" metalness={1} roughness={0.12} clearcoat={1} emissive="#1d4f12" emissiveIntensity={0.25} />
    </mesh>
  );
}

/** Slow tumble on its own axis; tap it and it jumps, spins fast, bounces
 *  back down and settles into its slow tumble again. */
function Tumble({ speed, children }: { speed: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const kick = useRef({ y: 0, vy: 0, spin: 0, pop: 0, dir: 1 });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = kick.current;
    const step = Math.min(dt, 1 / 30);
    // jump: gravity + bouncy landing
    if (k.y > 0 || k.vy !== 0) {
      k.vy -= 30 * step;
      k.y += k.vy * step;
      if (k.y <= 0) { k.y = 0; k.vy = Math.abs(k.vy) > 2 ? -k.vy * 0.42 : 0; }
    }
    k.spin = THREE.MathUtils.damp(k.spin, 0, 1.6, step);
    k.pop = THREE.MathUtils.damp(k.pop, 0, 5, step);
    g.position.y = k.y;
    g.scale.setScalar(1 + k.pop * 0.25);
    g.rotation.x += step * (speed[0] + k.spin * 0.8 * k.dir);
    g.rotation.y += step * (speed[1] + k.spin * k.dir);
    g.rotation.z += step * (speed[2] + k.spin * 0.4);
  });

  const setCursor = (on: boolean) => {
    const hero = document.getElementById("hero");
    if (hero) hero.style.cursor = on ? "pointer" : "";
  };

  return (
    <group
      ref={ref}
      onClick={(e) => {
        // the lever, links and buttons over the scene keep their own click
        if ((e.nativeEvent.target as HTMLElement | null)?.closest("a,button")) return;
        e.stopPropagation();
        const k = kick.current;
        k.vy = 6.5 + Math.random() * 1.5;
        if (k.y === 0) k.y = 0.001;
        k.spin = 14 + Math.random() * 8;
        k.dir = Math.random() < 0.5 ? -1 : 1;
        k.pop = 1;
      }}
      onPointerOver={(e) => { e.stopPropagation(); setCursor(true); }}
      onPointerOut={() => setCursor(false)}
    >
      {children}
    </group>
  );
}

type Prop = { el: React.ReactNode; at: [number, number, number]; speed: [number, number, number]; mobile?: boolean };

function Props() {
  const group = useRef<THREE.Group>(null);
  const { viewport } = useThree();
  const w = viewport.width / 2, h = viewport.height / 2;
  const narrow = viewport.width < 7;

  // positions as fractions of the visible area (x: -1 left … 1 right)
  const props: Prop[] = [
    { el: <Die size={0.9} />, at: [-0.82, 0.55, 0], speed: [0.35, 0.5, 0.1], mobile: true },
    { el: <Chip tone="green" size={1.1} />, at: [-0.66, -0.45, 0.5], speed: [0.6, 0.15, 0.35] },
    { el: <Suit kind="spade" size={0.95} />, at: [-0.93, -0.05, -0.6], speed: [0, 0.7, 0] },
    { el: <Die size={0.6} />, at: [-0.48, 0.78, -1], speed: [0.5, 0.3, 0.25] },
    { el: <Chip tone="black" size={0.8} />, at: [0.62, 0.72, -0.4], speed: [0.45, 0.2, 0.5], mobile: true },
    { el: <Suit kind="heart" size={0.7} />, at: [0.9, -0.1, 0.2], speed: [0, 0.8, 0] },
    { el: <Suit kind="club" size={0.55} />, at: [0.42, -0.72, -0.8], speed: [0, -0.6, 0] },
    { el: <Suit kind="diamond" size={0.6} />, at: [-0.35, -0.82, -0.5], speed: [0, 0.9, 0], mobile: true },
  ];

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.position.x = THREE.MathUtils.damp(g.position.x, pointer.x * 0.35, 3, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, -pointer.y * 0.22, 3, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, pointer.x * 0.08, 3, dt);
  });

  return (
    <group ref={group}>
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
  // the hero's content sits on top of the canvas, so the scene listens on
  // the whole hero section instead (taps on dice behind the copy still land)
  // (this component only ever renders in the browser: ssr is off)
  const source = useMemo(() => ({ current: document.getElementById("hero") }), []);
  useEffect(() => {
    const move = (e: PointerEvent) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <LazyCanvas className="pointer-events-none absolute inset-0" camera={{ position: [0, 0, 10], fov: 40 }} eventSource={source} eventPrefix="client">
      <StudioLights />
      <Props />
      <Sparkles count={50} scale={[16, 8, 4]} size={2} speed={0.3} color="#8dff4a" opacity={0.55} />
    </LazyCanvas>
  );
}

"use client";

import { ContactShadows, Float, RoundedBox, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { PodiumEntry } from "@/components/home/Podium3D";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";
import { suitGeometry } from "./shapes";

// Three solid podium blocks standing 2 · 1 · 3, each front printed with the
// place, name, score and prize, and a metal coin with a card suit spinning
// over it. The stage sways gently on its own (the mouse does not move it).

const SPOTS = [
  { idx: 1, label: "2nd", suit: "heart", color: "#d9e1dc", h: 1.55, x: -1.85 },
  { idx: 0, label: "1st", suit: "spade", color: "#ffd76a", h: 2.1, x: 0 },
  { idx: 2, label: "3rd", suit: "club", color: "#e09a5c", h: 1.2, x: 1.85 },
] as const;
const W = 1.65, D = 1.4;

/** The page's own fonts (next/font variables), once they've loaded. */
function useFonts() {
  const [f, setF] = useState<{ display: string; head: string; mono: string } | null>(null);
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      const css = getComputedStyle(document.documentElement);
      const v = (n: string, fb: string) => css.getPropertyValue(n).trim() || fb;
      setF({ display: v("--nf-metal", "serif"), head: v("--nf-chakra", "sans-serif"), mono: v("--nf-mono", "monospace") });
    });
    return () => { live = false; };
  }, []);
  return f;
}

function frontTexture(s: (typeof SPOTS)[number], e: PodiumEntry | undefined, fonts: NonNullable<ReturnType<typeof useFonts>>) {
  const cw = 512, ch = Math.round((512 * s.h) / W);
  const c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, "#16231a"); bg.addColorStop(1, "#060907");
  g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
  // accent bar on top
  g.fillStyle = s.color; g.globalAlpha = 0.85; g.fillRect(0, 0, cw, 10); g.globalAlpha = 1;
  g.textAlign = "center";
  // place
  const champ = s.idx === 0;
  g.font = `${champ ? 150 : 124}px ${fonts.display}`;
  const grad = g.createLinearGradient(0, 40, 0, 200);
  grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.5, s.color); grad.addColorStop(1, "#3c5a40");
  g.fillStyle = grad;
  g.shadowColor = s.color; g.shadowBlur = 24;
  g.fillText(s.label, cw / 2, champ ? 185 : 165);
  g.shadowBlur = 0;
  // name + score
  g.font = `700 ${champ ? 46 : 40}px ${fonts.head}`;
  g.fillStyle = e?.name ? "#e9f5ec" : "#7a8c80";
  g.fillText((e?.name ?? "Open spot").slice(0, 16), cw / 2, champ ? 265 : 235);
  g.font = `32px ${fonts.mono}`;
  g.fillStyle = "#9fb3a5";
  g.fillText(e?.score ?? "—", cw / 2, champ ? 315 : 282);
  if (e?.prize && ch > 380) {
    g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(40, ch - 130, cw - 80, 96);
    g.font = `600 22px ${fonts.head}`; g.fillStyle = "#7a8c80"; g.fillText("PRIZE", cw / 2, ch - 92);
    g.font = `700 40px ${fonts.head}`; g.fillStyle = s.color; g.fillText(e.prize.slice(0, 12), cw / 2, ch - 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Coin({ color, suit, y }: { color: string; suit: "heart" | "spade" | "club"; y: number }) {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => suitGeometry(suit, 0.06), [suit]);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * 1.1; });
  return (
    <Float speed={2.2} floatIntensity={0.6} rotationIntensity={0.1}>
      <group ref={ref} position={[0, y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.1, 64]} />
          <meshStandardMaterial color={color} metalness={0.85} roughness={0.22} emissive={color} emissiveIntensity={0.22} envMapIntensity={1.6} />
        </mesh>
        {[1, -1].map((side) => (
          <mesh key={side} geometry={geo} position={[0, 0, side * 0.07]} scale={0.48} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
            <meshStandardMaterial color="#0b120d" metalness={0.4} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </Float>
  );
}

function Block({ s, entry, fonts }: { s: (typeof SPOTS)[number]; entry?: PodiumEntry; fonts: NonNullable<ReturnType<typeof useFonts>> }) {
  const tex = useMemo(() => frontTexture(s, entry, fonts), [s, entry, fonts]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[s.x, s.h / 2, 0]}>
      <RoundedBox args={[W, s.h, D]} radius={0.06} smoothness={4}>
        <meshPhysicalMaterial color="#0d1510" metalness={0.5} roughness={0.35} clearcoat={0.6} />
      </RoundedBox>
      {/* metal rim along the top */}
      <mesh position={[0, s.h / 2 + 0.005, 0]}>
        <boxGeometry args={[W + 0.04, 0.05, D + 0.04]} />
        <meshStandardMaterial color={s.color} metalness={1} roughness={0.25} emissive={s.color} emissiveIntensity={0.08} />
      </mesh>
      <mesh position={[0, 0, D / 2 + 0.002]}>
        <planeGeometry args={[W - 0.1, s.h - 0.1]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.7} roughness={0.5} />
      </mesh>
      <Coin color={s.color} suit={s.suit} y={s.h / 2 + 0.75} />
    </group>
  );
}

function Stage({ entries }: { entries: PodiumEntry[] }) {
  const fonts = useFonts();
  const ref = useRef<THREE.Group>(null);
  const glow = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, "rgba(141,255,74,0.22)"); r.addColorStop(0.55, "rgba(46,125,18,0.1)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => glow.dispose(), [glow]);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.12;
  });
  if (!fonts) return null;
  return (
    <group ref={ref} position={[0, -1.75, 0]} scale={1.15}>
      {SPOTS.map((s) => <Block key={s.label} s={s} entry={entries[s.idx]} fonts={fonts} />)}
      {/* soft green pool of light under the blocks, fading out at the edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[3.6, 64]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} />
      </mesh>
      <ContactShadows position={[0, 0.002, 0]} scale={9} blur={2.4} opacity={0.7} far={3} frames={1} />
    </group>
  );
}

export default function Podium3DScene({ entries }: { entries: PodiumEntry[] }) {
  return (
    <LazyCanvas className="absolute inset-0" camera={{ position: [0, 1.9, 8.6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 0.1, 0)}>
      <StudioLights green={0.8} />
      <Stage entries={entries} />
      <Sparkles count={30} scale={[7, 4, 3]} position={[0, 0.5, 0]} size={2} speed={0.3} color="#ffd76a" opacity={0.5} />
    </LazyCanvas>
  );
}

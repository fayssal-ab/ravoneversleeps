"use client";

import { Float, Sparkles } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";
import { chipFace, chipSide } from "./shapes";

// Store hero in real 3D: a big gold QHub Points coin in the middle that
// leans toward the pointer (damped, so it glides rather than snaps) and
// jumps into a double flip when tapped, a tilted ring of poker chips
// orbiting it, and small gold coins rising slowly behind. Everything moves
// with frame-rate independent damping, so it stays smooth at any FPS;
// LazyCanvas pauses it off screen and lowers the resolution on slow devices.

const damp = THREE.MathUtils.damp;

function coinFace(top: string, bottom: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const m = 256;
  const grad = g.createRadialGradient(m * 0.8, m * 0.7, 40, m, m, m);
  grad.addColorStop(0, "#fff3b8"); grad.addColorStop(0.45, "#f1c64e"); grad.addColorStop(1, "#9a6a12");
  g.fillStyle = grad; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(90,55,5,0.55)"; g.lineWidth = 14;
  g.beginPath(); g.arc(m, m, m * 0.84, 0, Math.PI * 2); g.stroke();
  g.setLineDash([10, 14]); g.lineWidth = 6;
  g.beginPath(); g.arc(m, m, m * 0.74, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#5a3705"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "900 230px ui-sans-serif, system-ui"; g.fillText(top, m, m - 14);
  g.font = "800 44px ui-sans-serif, system-ui"; g.fillText(bottom, m, m + 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** The big coin: leans toward the pointer, spins slowly, flips when tapped. */
function PointsCoin() {
  const ref = useRef<THREE.Group>(null);
  const jump = useRef({ t: -1, base: 0 });
  const spin = useRef(0);
  const [front, back] = useMemo(() => [coinFace("P", "QHUB POINTS"), coinFace("R", "RAVO STORE")], []);
  useEffect(() => () => { front.dispose(); back.dispose(); }, [front, back]);

  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.min(dt, 0.05);
    spin.current += d * 0.35;
    const j = jump.current;
    let lift = 0, flip = 0;
    if (j.t >= 0) {
      j.t += d / 1.1;
      const k = Math.min(j.t, 1);
      lift = Math.sin(k * Math.PI) * 0.9;
      flip = THREE.MathUtils.smootherstep(k, 0, 1) * Math.PI * 4;
      if (j.t >= 1) { spin.current += Math.PI * 4; j.t = -1; flip = 0; }
    }
    // lean toward the pointer, damped
    g.rotation.y = damp(g.rotation.y, spin.current + flip + state.pointer.x * 0.6, 6, d);
    g.rotation.x = damp(g.rotation.x, -state.pointer.y * 0.45, 6, d);
    g.position.y = damp(g.position.y, lift, 10, d);
  });

  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); if (jump.current.t < 0) jump.current.t = 0; }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.24, 96, 1, true]} />
        <meshStandardMaterial color="#e7b53c" metalness={1} roughness={0.22} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.35, 0.075, 24, 128]} />
        <meshStandardMaterial color="#ffe08a" metalness={1} roughness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.121]}>
        <circleGeometry args={[1.34, 96]} />
        <meshStandardMaterial map={front} metalness={0.65} roughness={0.28} emissive="#5a3a00" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 0, -0.121]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[1.34, 96]} />
        <meshStandardMaterial map={back} metalness={0.65} roughness={0.28} emissive="#5a3a00" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}

const CHIPS: [string, string][] = [
  ["#1f6b2b", "#2e9a3e"], ["#151b17", "#0b0f0c"], ["#8a1c24", "#c22d38"],
  ["#1f6b2b", "#2e9a3e"], ["#1d3f8a", "#2f61c9"], ["#151b17", "#0b0f0c"],
];

function Chip({ base, edge }: { base: string; edge: string }) {
  const mats = useMemo(() => {
    const face = chipFace(base, edge);
    const side = chipSide(base);
    side.repeat.set(3, 1);
    return [
      new THREE.MeshStandardMaterial({ map: side, roughness: 0.45, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ map: face, roughness: 0.35, metalness: 0.1 }),
    ];
  }, [base, edge]);
  useEffect(() => () => mats.forEach((m) => { m.map?.dispose(); m.dispose(); }), [mats]);
  return (
    <mesh material={mats} scale={0.5}>
      <cylinderGeometry args={[0.7, 0.7, 0.16, 48]} />
    </mesh>
  );
}

/** Chips on a tilted ring around the coin; the ring turns, each chip tumbles. */
function ChipRing({ radius }: { radius: number }) {
  const ring = useRef<THREE.Group>(null);
  const chips = useRef<(THREE.Group | null)[]>([]);
  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    if (ring.current) {
      ring.current.rotation.y += d * 0.28;
      ring.current.rotation.z = damp(ring.current.rotation.z, 0.32 + state.pointer.x * 0.12, 3, d);
      ring.current.rotation.x = damp(ring.current.rotation.x, 0.18 - state.pointer.y * 0.1, 3, d);
    }
    chips.current.forEach((c, i) => {
      if (!c) return;
      c.rotation.x += d * (0.6 + i * 0.07);
      c.rotation.z += d * 0.35;
    });
  });
  return (
    <group ref={ring}>
      {CHIPS.map(([b, e], i) => {
        const a = (i / CHIPS.length) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * radius, Math.sin(a * 2) * 0.18, Math.sin(a) * radius]} ref={(el) => { chips.current[i] = el; }}>
            <Chip base={b} edge={e} />
          </group>
        );
      })}
    </group>
  );
}

/** Small gold coins rising behind everything (one instanced mesh, one draw call). */
function CoinRain({ count, width }: { count: number; width: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * width,
    z: -1.5 - ((i * 7) % 5) * 0.5,
    y: ((i * 37) % 100) / 100 * 8 - 4,
    speed: 0.25 + ((i * 13) % 10) / 25,
    spin: 0.8 + ((i * 17) % 10) / 6,
    s: 0.12 + ((i * 11) % 10) / 70,
  })), [count, width]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const d = Math.min(dt, 0.05);
    seeds.forEach((p, i) => {
      p.y += d * p.speed;
      if (p.y > 4.2) p.y = -4.2;
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(Math.PI / 2 + p.y * p.spin * 0.6, 0, p.y * p.spin);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[1, 1, 0.18, 32]} />
      <meshStandardMaterial color="#f1c64e" metalness={1} roughness={0.25} emissive="#3a2600" emissiveIntensity={0.4} />
    </instancedMesh>
  );
}

function Scene() {
  const { viewport } = useThree();
  const narrow = viewport.width < 6;
  const reduce = useReducedMotion() ?? false;
  return (
    <>
      <StudioLights green={0.8} />
      <pointLight position={[0, 2, 3]} intensity={5} color="#ffd76a" />
      {!reduce && <CoinRain count={narrow ? 14 : 28} width={viewport.width * 1.2} />}
      <group scale={narrow ? 0.6 : 1}>
        <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.6}>
          <PointsCoin />
        </Float>
        <ChipRing radius={2.3} />
      </group>
      {!reduce && <Sparkles count={narrow ? 30 : 60} scale={[viewport.width, 4, 3]} size={2.4} speed={0.35} color="#ffd76a" opacity={0.75} />}
    </>
  );
}

export default function Store3DScene() {
  return (
    <LazyCanvas className="absolute inset-0" camera={{ position: [0, 0.4, 6.4], fov: 42 }}>
      <Scene />
    </LazyCanvas>
  );
}

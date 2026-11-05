"use client";

import { Float, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";

// The tournament crown in real 3D: a gold band with five peaks, pearl tips
// and emerald gems, turning slowly over a pool of gold dust.

const GOLD = { color: "#f5c95a", metalness: 0.9, roughness: 0.26, envMapIntensity: 2, emissive: "#7a5410", emissiveIntensity: 0.55 } as const;
const PEAKS = 5;

function Crown() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y += dt * 0.55;
    g.rotation.x = 0.28 + Math.sin(state.clock.elapsedTime * 0.7) * 0.05;
  });
  return (
    <Float speed={1.8} floatIntensity={0.7} rotationIntensity={0.15}>
      <group ref={ref}>
        {/* band */}
        <mesh>
          <cylinderGeometry args={[1, 1, 0.55, 64, 1, true]} />
          <meshStandardMaterial {...GOLD} side={THREE.DoubleSide} />
        </mesh>
        {[-0.27, 0.27].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1, 0.05, 16, 96]} />
            <meshStandardMaterial {...GOLD} roughness={0.1} />
          </mesh>
        ))}
        {Array.from({ length: PEAKS }, (_, i) => {
          const a = (i / PEAKS) * Math.PI * 2;
          const x = Math.sin(a), z = Math.cos(a);
          return (
            <group key={i}>
              {/* peak, leaning slightly outward */}
              <mesh position={[x * 0.97, 0.72, z * 0.97]} rotation={[z * 0.12, 0, -x * 0.12]}>
                <coneGeometry args={[0.3, 0.9, 4]} />
                <meshStandardMaterial {...GOLD} />
              </mesh>
              {/* pearl tip */}
              <mesh position={[x * 1.03, 1.2, z * 1.03]}>
                <sphereGeometry args={[0.1, 24, 24]} />
                <meshPhysicalMaterial color="#fff8e6" roughness={0.15} clearcoat={1} />
              </mesh>
              {/* emerald on the band */}
              <mesh position={[Math.sin(a + Math.PI / PEAKS) * 1.02, 0, Math.cos(a + Math.PI / PEAKS) * 1.02]} rotation={[0, a + Math.PI / PEAKS, Math.PI / 4]}>
                <octahedronGeometry args={[0.13]} />
                <meshPhysicalMaterial color="#8dff4a" emissive="#2e7d12" emissiveIntensity={0.8} roughness={0.05} transmission={0.3} thickness={0.5} />
              </mesh>
            </group>
          );
        })}
      </group>
    </Float>
  );
}

export default function Crown3DScene() {
  return (
    <LazyCanvas className="absolute inset-0" camera={{ position: [0, 0.8, 5], fov: 38 }} onCreated={({ camera }) => camera.lookAt(0, 0.35, 0)}>
      <StudioLights green={0.6} />
      <pointLight position={[0, 3, 2]} intensity={6} color="#ffd76a" />
      <Crown />
      <Sparkles count={36} scale={[4, 3, 3]} position={[0, 0.3, 0]} size={2.4} speed={0.35} color="#ffd76a" opacity={0.7} />
    </LazyCanvas>
  );
}

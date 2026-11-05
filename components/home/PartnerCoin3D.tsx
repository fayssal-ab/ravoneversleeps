"use client";

import { Environment, Float, Lightformer, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// A chrome coin: Flush on the front, Qzino on the back, flipping between them and
// leaning toward the pointer. Faces are canvas textures drawn from the real
// logo SVGs; lighting is built in (Lightformers), so nothing loads from a CDN.

const SIZE = 1024;

async function faceTexture(src: string, label: string): Promise<THREE.CanvasTexture> {
  const svg = await fetch(src).then((r) => r.text());
  // Firefox won't rasterise an SVG without intrinsic size
  const sized = /<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace("<svg", '<svg width="780" height="370"');
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);

  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d")!;
  const mid = SIZE / 2;
  // dark enamel with a soft green core
  const bg = g.createRadialGradient(mid, mid * 0.8, 40, mid, mid, mid);
  bg.addColorStop(0, "#14301a");
  bg.addColorStop(1, "#040705");
  g.fillStyle = bg;
  g.fillRect(0, 0, SIZE, SIZE);
  // two thin rings
  g.strokeStyle = "rgba(141,255,74,0.55)";
  g.lineWidth = 10;
  g.beginPath(); g.arc(mid, mid, mid - 40, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "rgba(217,225,220,0.25)";
  g.lineWidth = 4;
  g.beginPath(); g.arc(mid, mid, mid - 80, 0, Math.PI * 2); g.stroke();
  // logo
  const w = SIZE * 0.56;
  const h = (w * img.height) / img.width;
  g.drawImage(img, mid - w / 2, mid - h / 2 - 20, w, h);
  // caption
  g.fillStyle = "rgba(195,255,143,0.85)";
  g.font = "700 46px ui-sans-serif, system-ui, sans-serif";
  g.textAlign = "center";
  g.letterSpacing = "14px";
  g.fillText(label, mid, mid + h / 2 + 90);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function Coin({ front, back }: { front: THREE.Texture; back: THREE.Texture }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    // hold a face, then flip: Flush → Qzino → Flush… (3.2 s per face)
    const phase = state.clock.elapsedTime / 3.2;
    const k = THREE.MathUtils.smoothstep(phase % 1, 0.62, 1);
    g.rotation.y = (Math.floor(phase) + k) * Math.PI + Math.sin(state.clock.elapsedTime * 0.8) * 0.18;
    // lean toward the pointer
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, state.pointer.y * -0.35, 4, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, state.pointer.x * -0.2, 4, dt);
  });
  return (
    <Float speed={2} rotationIntensity={0.25} floatIntensity={0.8}>
      <group ref={ref}>
        {/* chrome rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.5, 1.5, 0.22, 96, 1, true]} />
          <meshStandardMaterial color="#cfd8d3" metalness={1} roughness={0.18} side={THREE.DoubleSide} />
        </mesh>
        <mesh>
          <torusGeometry args={[1.5, 0.07, 24, 120]} />
          <meshStandardMaterial color="#e9f5ec" metalness={1} roughness={0.12} />
        </mesh>
        {/* faces */}
        <mesh position={[0, 0, 0.111]}>
          <circleGeometry args={[1.49, 96]} />
          <meshStandardMaterial map={front} emissiveMap={front} emissive="#ffffff" emissiveIntensity={0.55} metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, -0.111]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[1.49, 96]} />
          <meshStandardMaterial map={back} emissiveMap={back} emissive="#ffffff" emissiveIntensity={0.55} metalness={0.55} roughness={0.35} />
        </mesh>
      </group>
    </Float>
  );
}

export default function PartnerCoin3D() {
  const [faces, setFaces] = useState<[THREE.Texture, THREE.Texture] | null>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    let live = true;
    Promise.all([faceTexture("/media/flush-logo.svg", "PARTNER 01"), faceTexture("/media/qzino-logo.svg", "PARTNER 02")])
      .then((f) => { if (live) setFaces(f); })
      .catch(() => { /* coin stays hidden; the cards still show both partners */ });
    return () => { live = false; };
  }, []);

  if (!faces) return null;
  return (
    <Canvas
      camera={{ position: [0, 0, 5.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      frameloop={reduce ? "demand" : "always"}
      aria-hidden
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-3, -2, 3]} intensity={8} color="#8dff4a" />
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={3} position={[0, 3, 4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#8dff4a" position={[-4, 0, 2]} rotation-y={Math.PI / 3} scale={[3, 6, 1]} />
        <Lightformer form="ring" intensity={2} position={[4, -1, 3]} scale={2} />
      </Environment>
      <Coin front={faces[0]} back={faces[1]} />
      {!reduce && <Sparkles count={40} scale={[5, 4, 2]} size={2.2} speed={0.4} color="#8dff4a" opacity={0.7} />}
    </Canvas>
  );
}

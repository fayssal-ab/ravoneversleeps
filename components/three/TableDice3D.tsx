"use client";

import { ContactShadows, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LazyCanvas } from "./LazyCanvas";
import { StudioLights } from "./StudioLights";
import { DIE_PIPS } from "./shapes";

// Two dice resting on the felt in the hero art (left of the chip stack).
// Tap one: it hops, tumbles and lands flat on a new face with a little
// bounce. The scene only renders while a die is moving (frameloop
// "demand"), so at rest it costs nothing.

const SIZE = 0.98;
const HALF = SIZE / 2;
const FLIGHT = 0.95; // seconds in the air

// every pip except the single one on face 1 (+z), which shows Ravo instead
const PIPS_NO_ONE = DIE_PIPS.filter(([x, y, z]) => !(z > 0.49 && Math.abs(x) < 0.01 && Math.abs(y) < 0.01));

/** Rotation that leaves the die flat on the table, showing some face. */
function restingRotation(seedY: number, faceX: number, faceZ: number) {
  return new THREE.Euler(faceX * (Math.PI / 2), seedY, faceZ * (Math.PI / 2));
}

function Die({ x, z, rest, ravo }: { x: number; z: number; rest: THREE.Euler; ravo: THREE.Texture }) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ t: number; from: THREE.Quaternion; to: THREE.Quaternion; h: number; axis: THREE.Vector3; turns: number } | null>(null);
  const spin = useMemo(() => new THREE.Quaternion(), []);
  const start = useMemo(() => new THREE.Quaternion().setFromEuler(rest), [rest]);

  useFrame((_, dt) => {
    const g = ref.current;
    const a = anim.current;
    if (!g || !a) return;
    // on-demand rendering: the first frame after a rest reports the whole
    // idle time as dt, so cap the step or the hop is skipped
    a.t = Math.min(1.25, a.t + Math.min(dt, 1 / 30) / FLIGHT);
    const t = Math.min(1, a.t);
    // hop: parabola, then a small bounce after landing
    const hop = 4 * a.h * t * (1 - t);
    const bounce = a.t > 1 ? Math.sin(((a.t - 1) / 0.25) * Math.PI) * a.h * 0.12 : 0;
    g.position.y = HALF + hop + bounce;
    // tumble: ease from the old face to the new one, plus whole turns around
    // a random axis (whole turns end where they started, so it lands flat)
    const e = 1 - Math.pow(1 - t, 3);
    g.quaternion.slerpQuaternions(a.from, a.to, e);
    spin.setFromAxisAngle(a.axis, a.turns * Math.PI * 2 * e);
    g.quaternion.premultiply(spin);
    if (a.t >= 1.25) {
      g.position.y = HALF;
      g.quaternion.copy(a.to);
      anim.current = null;
      return;
    }
    invalidate();
  });

  return (
    <group
      ref={ref}
      position={[x, HALF, z]}
      quaternion={start}
      onClick={(e) => {
        if ((e.nativeEvent.target as HTMLElement | null)?.closest("a,button")) return;
        e.stopPropagation();
        const g = ref.current;
        if (!g || anim.current) return;
        const fx = Math.floor(Math.random() * 4), fz = Math.floor(Math.random() * 4);
        const to = new THREE.Quaternion().setFromEuler(restingRotation(Math.random() * Math.PI * 2, fx, fz));
        const axis = new THREE.Vector3(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
        anim.current = { t: 0, from: g.quaternion.clone(), to, h: 0.6 + Math.random() * 0.2, axis, turns: 1 + Math.round(Math.random()) };
        invalidate();
      }}
      onPointerOver={(e) => { e.stopPropagation(); const h = document.getElementById("hero"); if (h) h.style.cursor = "pointer"; }}
      onPointerOut={() => { const h = document.getElementById("hero"); if (h) h.style.cursor = ""; }}
    >
      <RoundedBox args={[SIZE, SIZE, SIZE]} radius={0.14} smoothness={4}>
        <meshStandardMaterial color="#111813" roughness={0.3} metalness={0.25} />
      </RoundedBox>
      {/* the "1" face is Ravo himself, in a neon ring */}
      <mesh position={[0, 0, SIZE / 2 + 0.003]}>
        <circleGeometry args={[SIZE * 0.36, 48]} />
        <meshStandardMaterial map={ravo} roughness={0.5} emissiveMap={ravo} emissive="#ffffff" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, SIZE / 2 + 0.004]}>
        <ringGeometry args={[SIZE * 0.36, SIZE * 0.4, 48]} />
        <meshStandardMaterial color="#8dff4a" emissive="#8dff4a" emissiveIntensity={1.2} toneMapped={false} />
      </mesh>
      {PIPS_NO_ONE.map((p, i) => (
        <mesh key={i} position={[p[0] * SIZE, p[1] * SIZE, p[2] * SIZE]}>
          <sphereGeometry args={[0.068, 12, 12]} />
          <meshStandardMaterial color="#8dff4a" emissive="#8dff4a" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Dice({ rests }: { rests: THREE.Euler[] }) {
  const invalidate = useThree((s) => s.invalidate);
  // Ravo's face for the "1" side (redraw once the image arrives: on-demand scene)
  const ravo = useMemo(() => {
    const t = new THREE.TextureLoader().load("/media/ravo-avatar.webp", () => invalidate());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [invalidate]);
  useEffect(() => () => ravo.dispose(), [ravo]);
  return (
    <>
      <Die x={-1.0} z={0.2} rest={rests[0]} ravo={ravo} />
      <Die x={0.9} z={-0.25} rest={rests[1]} ravo={ravo} />
    </>
  );
}

export default function TableDice3D({ onReady }: { onReady?: () => void }) {
  // the hero copy sits above the art, so taps are read on the hero section
  const source = useMemo(() => ({ current: document.getElementById("hero") }), []);
  const rests = useMemo(() => [restingRotation(0.35, 0, 0), restingRotation(-0.45, 1, 0)], []);
  return (
    <LazyCanvas
      className="absolute inset-0"
      camera={{ position: [0, 2.2, 6], fov: 44 }}
      frameloop="demand"
      onReady={onReady}
      eventSource={source}
      eventPrefix="client"
      onCreated={(st) => {
        // taller box than the dice need, so a hop never leaves the canvas
        st.camera.lookAt(0, 1.14, 0);
        // events arrive from the hero section: map the pointer from this
        // canvas's live box (it moves with the art's parallax and zoom)
        st.setEvents({
          compute: (event, state) => {
            const r = state.gl.domElement.getBoundingClientRect();
            state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
            state.raycaster.setFromCamera(state.pointer, state.camera);
          },
        });
      }}
    >
      <StudioLights green={0.7} />
      <Dice rests={rests} />
      <ContactShadows position={[0, 0.001, 0]} scale={6} blur={2.2} opacity={0.85} far={2.5} resolution={256} frames={Infinity} />
    </LazyCanvas>
  );
}

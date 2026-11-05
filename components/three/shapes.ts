import * as THREE from "three";

// Shared three.js geometry + textures for the casino props (dice, chips,
// card suits). Built once per page and reused by every scene.

/** Pip layout per face (3×3 grid indexes) and the face's normal. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES: [number, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [
  // value, normal, u axis, v axis
  [1, new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  [6, new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
  [2, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
  [5, new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  [3, new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)],
  [4, new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
];

/** Pip centres for a unit die (size 1). */
export const DIE_PIPS: [number, number, number][] = FACES.flatMap(([n, normal, u, v]) =>
  PIPS[n].map((i) => {
    const gx = (i % 3) - 1, gy = 1 - Math.floor(i / 3);
    const p = normal.clone().multiplyScalar(0.5).addScaledVector(u, gx * 0.27).addScaledVector(v, gy * 0.27);
    return [p.x, p.y, p.z] as [number, number, number];
  }),
);

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Chip face: coloured disc, eight white edge spots, inner ring. */
export function chipFace(base: string, edge: string) {
  return canvas(512, 512, (g) => {
    const m = 256;
    g.fillStyle = base; g.beginPath(); g.arc(m, m, m, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? "#e9f5ec" : edge;
      g.beginPath(); g.moveTo(m, m); g.arc(m, m, m, (i * Math.PI) / 4 - 0.18, (i * Math.PI) / 4 + 0.18); g.fill();
    }
    g.fillStyle = base; g.beginPath(); g.arc(m, m, m * 0.72, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(233,245,236,0.85)"; g.lineWidth = 10; g.setLineDash([26, 18]);
    g.beginPath(); g.arc(m, m, m * 0.62, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(233,245,236,0.9)"; g.font = "900 120px ui-sans-serif, system-ui"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("R", m, m + 6);
  });
}

/** Chip rim: alternating stripes, wrapped around the side. */
export function chipSide(base: string) {
  const t = canvas(512, 32, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 512, 32);
    g.fillStyle = "#e9f5ec";
    for (let i = 0; i < 8; i++) g.fillRect(i * 64 + 8, 0, 22, 32);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

type SuitKind = "spade" | "heart" | "club" | "diamond";

function heart(flip = false): THREE.Shape {
  const f = flip ? -1 : 1;
  const s = new THREE.Shape();
  s.moveTo(0, -0.55 * f);
  s.bezierCurveTo(-0.15, -0.35 * f, -0.6, -0.1 * f, -0.6, 0.2 * f);
  s.bezierCurveTo(-0.6, 0.5 * f, -0.25, 0.62 * f, 0, 0.35 * f);
  s.bezierCurveTo(0.25, 0.62 * f, 0.6, 0.5 * f, 0.6, 0.2 * f);
  s.bezierCurveTo(0.6, -0.1 * f, 0.15, -0.35 * f, 0, -0.55 * f);
  return s;
}

function stem(top: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.07, top); s.lineTo(-0.24, -0.78); s.lineTo(0.24, -0.78); s.lineTo(0.07, top);
  return s;
}

function circle(x: number, y: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

/** Card-suit outlines (about 1.2 units tall), as one or more filled parts. */
export function suitShapes(kind: SuitKind): THREE.Shape[] {
  if (kind === "heart") return [heart()];
  if (kind === "spade") return [heart(true), stem(-0.2)];
  if (kind === "club") return [circle(0, 0.3, 0.27), circle(-0.29, -0.08, 0.27), circle(0.29, -0.08, 0.27), circle(0, 0.02, 0.18), stem(-0.05)];
  const s = new THREE.Shape();
  s.moveTo(0, 0.7); s.quadraticCurveTo(0.2, 0.25, 0.48, 0); s.quadraticCurveTo(0.2, -0.25, 0, -0.7);
  s.quadraticCurveTo(-0.2, -0.25, -0.48, 0); s.quadraticCurveTo(-0.2, 0.25, 0, 0.7);
  return [s];
}

export function suitGeometry(kind: SuitKind, depth = 0.18) {
  const g = new THREE.ExtrudeGeometry(suitShapes(kind), { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 4, curveSegments: 24 });
  g.center();
  return g;
}

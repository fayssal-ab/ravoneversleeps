// Shadow-fighter rig for the K.O. finisher. A pose is a set of joint angles
// in degrees (0 = straight down, 90 = forward, 180 = up), sampled from
// keyframes and turned into world points by forward kinematics. Everything is
// a pure function of time, so trails and effects can sample the past.

export interface Pose {
  /** forward offset from the fighter's base, world units */
  x: number;
  /** height above the ground */
  air: number;
  /** whole-body rotation around the hip; + tumbles forward */
  rot: number;
  /** 1 = facing the opponent, -1 = turned around (lerped: a quick turn) */
  face: number;
  lean: number;
  uaF: number; faF: number; uaB: number; faB: number;
  thF: number; shF: number; thB: number; shB: number;
  /** sword angle, and 1 = sword in hand / 0 = sheathed on the back */
  sw: number; swa: number;
  /** idle breathing */
  bob: number;
}

const IDLE: Pose = { x: 0, air: 0, rot: 0, face: 1, lean: 8, uaF: 45, faF: 125, uaB: 25, faB: 110, thF: 26, shF: 4, thB: -24, shB: -8, sw: 140, swa: 1, bob: 1 };

export const POSES = {
  IDLE,
  RUN: { ...IDLE, lean: 30, uaF: -50, faF: -20, uaB: 70, faB: 100, thF: 72, shF: 12, thB: -45, shB: -80, sw: -112, bob: 0 },
  CLASH: { ...IDLE, lean: 18, uaF: 85, faF: 100, uaB: 60, faB: 95, thF: 42, shF: 8, thB: -38, shB: -20, sw: 128, bob: 0 },
  DRAW: { ...IDLE, lean: 24, uaF: -10, faF: 62, uaB: 30, faB: 78, thF: 62, shF: -4, thB: -58, shB: -50, sw: -98, bob: 0 },
  IAI: { ...IDLE, lean: 40, uaF: 100, faF: 95, uaB: -40, faB: -20, thF: 78, shF: 2, thB: -72, shB: -86, sw: 94, bob: 0 },
  VICTORY: { ...IDLE, lean: -4, uaF: 166, faF: 178, uaB: -30, faB: 40, thF: 18, shF: 2, thB: -16, shB: -4, sw: 182, bob: 1 },
  HIT: { ...IDLE, lean: -28, uaF: -20, faF: 20, uaB: -45, faB: -10, thF: 20, shF: 5, thB: -30, shB: -8, sw: 40, bob: 0 },
  FLY: { ...IDLE, air: 90, rot: -55, lean: -20, uaF: 160, faF: 140, uaB: 130, faB: 170, thF: 60, shF: 100, thB: 30, shB: 70, sw: 10, bob: 0 },
  DOWN: { ...IDLE, rot: -88, air: -74, lean: 0, uaF: 170, faF: 170, uaB: 150, faB: 160, thF: 6, shF: 2, thB: -6, shB: -4, sw: 120, bob: 0 },
  CHARGE: { ...IDLE, lean: -8, uaF: -40, faF: 20, uaB: -45, faB: 15, thF: 42, shF: 5, thB: -42, shB: -20, swa: 0, bob: 0 },
  CAST: { ...IDLE, lean: 24, uaF: 88, faF: 90, uaB: 84, faB: 88, thF: 56, shF: 10, thB: -46, shB: -36, swa: 0, bob: 0 },
  CROUCH: { ...IDLE, lean: 28, uaF: 20, faF: 60, uaB: -20, faB: 30, thF: 80, shF: -10, thB: -60, shB: -70, sw: 100, bob: 0 },
  RISE: { ...IDLE, air: 150, rot: -5, lean: -12, uaF: 170, faF: 180, uaB: 110, faB: 140, thF: 95, shF: -5, thB: -10, shB: -5, sw: 180, bob: 0 },
} satisfies Record<string, Pose>;

export type Ease = (u: number) => number;
export const ease = {
  lin: (u: number) => u,
  out: (u: number) => 1 - (1 - u) ** 3,
  in: (u: number) => u ** 3,
  inOut: (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
};

/** A keyframe: a partial pose merged over the previous key; `e` eases into it. */
export interface Key { t: number; p: Partial<Pose>; e?: Ease }

/** Keyframes → a sampler of the pose at time t (ms). */
export function track(keys: Key[]): (t: number) => Pose {
  const full: { t: number; p: Pose; e: Ease }[] = [];
  let acc = IDLE;
  for (const k of keys) { acc = { ...acc, ...k.p }; full.push({ t: k.t, p: acc, e: k.e ?? ease.inOut }); }
  return (t) => {
    if (t <= full[0].t) return full[0].p;
    for (let i = 1; i < full.length; i++) {
      const b = full[i];
      if (t < b.t) {
        const a = full[i - 1];
        const u = b.e((t - a.t) / (b.t - a.t));
        const out = {} as Pose;
        for (const key of Object.keys(a.p) as (keyof Pose)[]) out[key] = a.p[key] + (b.p[key] - a.p[key]) * u;
        return out;
      }
    }
    return full[full.length - 1].p;
  };
}

export type V = [number, number];
export const S = 1.7;
const LEN = { torso: 62 * S, head: 15 * S, ua: 34 * S, fa: 32 * S, th: 46 * S, sh: 46 * S, sword: 96 * S, hilt: 16 * S };
const dir = (a: number): V => { const r = (a * Math.PI) / 180; return [Math.sin(r), Math.cos(r)]; };
const add = (p: V, len: number, a: number): V => { const d = dir(a); return [p[0] + len * d[0], p[1] + len * d[1]]; };

export interface Body {
  hip: V; neck: V; head: V; headR: number;
  elbowF: V; handF: V; elbowB: V; handB: V;
  kneeF: V; footF: V; kneeB: V; footB: V;
  swordTip: V; swordBase: V; swa: number;
  sheathA: V; sheathB: V;
  eye: [V, V]; ribbon: V[];
}

/**
 * World points of a fighter. `side` 1 = the left fighter (faces right),
 * -1 = the right one (mirrored). `t` drives breathing and the headband.
 */
export function solve(p: Pose, baseX: number, side: 1 | -1, groundY: number, t: number): Body {
  const breathe = Math.sin(t / 170) * p.bob;
  const lean = p.lean + breathe * 2;
  const cos = (a: number) => Math.cos((a * Math.PI) / 180);
  const depth = Math.max(LEN.th * cos(p.thF) + LEN.sh * cos(p.shF), LEN.th * cos(p.thB) + LEN.sh * cos(p.shB), 20);
  const hip: V = [0, -depth - p.air + Math.abs(breathe) * 3];
  const neck = add(hip, LEN.torso, 180 - lean);
  const head = add(neck, LEN.head * 1.35, 180 - lean * 1.3);
  const elbowF = add(neck, LEN.ua, p.uaF + breathe * 3);
  const handF = add(elbowF, LEN.fa, p.faF + breathe * 4);
  const elbowB = add(neck, LEN.ua, p.uaB + breathe * 3);
  const handB = add(elbowB, LEN.fa, p.faB + breathe * 4);
  const kneeF = add(hip, LEN.th, p.thF);
  const footF = add(kneeF, LEN.sh, p.shF);
  const kneeB = add(hip, LEN.th, p.thB);
  const footB = add(kneeB, LEN.sh, p.shB);
  const swordBase = add(handF, -LEN.hilt, p.sw);
  const swordTip = add(handF, LEN.sword, p.sw);
  // scabbard on the back: handle above the shoulder, tip down behind the hip
  const up = dir(180 - lean), back = dir(-90 - lean);
  const sheathA: V = [neck[0] + up[0] * 14 * S + back[0] * 10 * S, neck[1] + up[1] * 14 * S + back[1] * 10 * S];
  const sheathB: V = [sheathA[0] + 100 * S * (-up[0] * 0.87 + back[0] * 0.5), sheathA[1] + 100 * S * (-up[1] * 0.87 + back[1] * 0.5)];
  const r = LEN.head;
  const eye: [V, V] = [[head[0] + r * 0.3, head[1] - r * 0.12], [head[0] + r * 0.88, head[1] - r * 0.12]];
  const rb: V = [head[0] - r * 0.85, head[1] - r * 0.3];
  const ribbon: V[] = [rb, ...[1, 2, 3].map((i): V => [rb[0] - i * 13 * S, rb[1] + Math.sin(t / 55 + i * 1.3) * 4 * S + i * 3 * S])];

  const rr = (p.rot * Math.PI) / 180;
  const c = Math.cos(rr), s = Math.sin(rr);
  const w = (q: V): V => {
    const x = q[0] - hip[0], y = q[1] - hip[1];
    const rx = hip[0] + x * c - y * s, ry = hip[1] + x * s + y * c;
    return [baseX + side * (p.x + p.face * rx), groundY + ry];
  };
  return {
    hip: w(hip), neck: w(neck), head: w(head), headR: r,
    elbowF: w(elbowF), handF: w(handF), elbowB: w(elbowB), handB: w(handB),
    kneeF: w(kneeF), footF: w(footF), kneeB: w(kneeB), footB: w(footB),
    swordTip: w(swordTip), swordBase: w(swordBase), swa: p.swa,
    sheathA: w(sheathA), sheathB: w(sheathB),
    eye: [w(eye[0]), w(eye[1])], ribbon: ribbon.map(w),
  };
}

/** Deterministic random (mulberry32) so effects look the same on every frame. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fight sound effects, synthesized with WebAudio (no audio files, nothing
// external). Browsers keep audio silent until the page has had a click; an
// OBS browser source plays it straight away.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime, out: AudioNode = c.destination): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(out);
  return g;
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, seconds: number, peak: number, at = c.currentTime, out?: AudioNode) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + seconds);
  o.connect(env(c, peak, 0.005, seconds, at, out));
  o.start(at);
  o.stop(at + seconds + 0.05);
}

function burst(c: AudioContext, filter: BiquadFilterType, from: number, to: number, seconds: number, peak: number, at = c.currentTime, out?: AudioNode) {
  const n = noise(c, seconds + 0.05);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + seconds);
  n.connect(f).connect(env(c, peak, 0.01, seconds, at, out));
  n.start(at);
}

export type Sfx = "whoosh" | "clash" | "impact" | "charge" | "blast" | "ko" | "fanfare";

export function play(name: Sfx) {
  const c = ac();
  if (!c) return;
  switch (name) {
    case "whoosh":
      burst(c, "bandpass", 500, 3400, 0.32, 0.5);
      break;
    case "clash":
      for (const f of [1870, 2490, 3320, 4410]) tone(c, "square", f, f * 0.97, 0.5, 0.05);
      burst(c, "highpass", 3000, 6000, 0.18, 0.4);
      break;
    case "impact":
      tone(c, "sine", 140, 38, 0.45, 0.9);
      burst(c, "lowpass", 2400, 200, 0.3, 0.7);
      break;
    case "charge":
      tone(c, "sawtooth", 160, 900, 0.55, 0.08);
      tone(c, "sine", 320, 1400, 0.55, 0.12);
      break;
    case "blast":
      tone(c, "sine", 110, 30, 0.8, 1);
      burst(c, "lowpass", 4000, 120, 0.7, 0.8);
      break;
    case "ko":
      tone(c, "sine", 70, 28, 1.4, 1);
      tone(c, "triangle", 220, 55, 1.1, 0.25);
      burst(c, "lowpass", 1800, 60, 1, 0.5);
      break;
    case "fanfare":
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => {
        const at = c.currentTime + i * 0.14 + (i > 3 ? 0.1 : 0);
        tone(c, "triangle", f, f, i === 5 ? 0.9 : 0.22, 0.22, at);
        tone(c, "square", f / 2, f / 2, i === 5 ? 0.9 : 0.22, 0.04, at);
      });
      break;
  }
}

// battle theme: A minor, Am F G E, 160 bpm, four bars on loop
const STEP = 60 / 160 / 4;
const BARS = [110, 87.31, 98, 82.41]; // bass roots: A2 F2 G2 E2
const OCT = [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1]; // 1 = octave up
const LEAD = [ // eighth notes, 0 = rest
  [659.25, 0, 659.25, 587.33, 523.25, 0, 587.33, 659.25],
  [440, 0, 523.25, 0, 698.46, 0, 659.25, 523.25],
  [587.33, 0, 493.88, 0, 392, 0, 493.88, 587.33],
  [415.3, 0, 493.88, 0, 659.25, 0, 587.33, 493.88],
];

/**
 * Street-fighter style battle music (drums, pumping bass, lead), scheduled
 * up front for `seconds`. Returns a function that cuts it (short fade).
 */
export function fightTheme(seconds = 12): () => void {
  const c = ac();
  if (!c) return () => {};
  const bus = c.createGain();
  bus.gain.value = 0.55;
  bus.connect(c.destination);
  const t0 = c.currentTime + 0.05;
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const at = t0 + i * STEP, k = i % 16, bar = Math.floor(i / 16) % 4;
    if (k % 4 === 0 || k === 10) tone(c, "sine", 150, 45, 0.18, 0.9, at, bus); // kick
    if (k === 4 || k === 12) { burst(c, "bandpass", 2200, 1200, 0.13, 0.45, at, bus); tone(c, "triangle", 220, 130, 0.08, 0.2, at, bus); } // snare
    if (k % 2 === 1) burst(c, "highpass", 8000, 9000, 0.035, 0.12, at, bus); // hat
    const root = BARS[bar] * (OCT[k] ? 2 : 1);
    tone(c, "square", root, root, STEP * 0.8, 0.06, at, bus);
    tone(c, "sawtooth", root / 2, root / 2, STEP * 0.8, 0.04, at, bus);
    const note = k % 2 === 0 ? LEAD[bar][k / 2] : 0;
    if (note) {
      tone(c, "square", note, note, STEP * 1.7, 0.05, at, bus);
      tone(c, "triangle", note * 2, note * 2, STEP * 1.5, 0.05, at, bus);
    }
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    bus.gain.cancelScheduledValues(c.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, c.currentTime);
    bus.gain.linearRampToValueAtTime(0, c.currentTime + 0.08);
    setTimeout(() => bus.disconnect(), 200);
  };
}

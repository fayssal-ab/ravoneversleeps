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

function env(c: AudioContext, peak: number, attack: number, decay: number, at = c.currentTime): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(c.destination);
  return g;
}

function tone(c: AudioContext, type: OscillatorType, from: number, to: number, seconds: number, peak: number, at = c.currentTime) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + seconds);
  o.connect(env(c, peak, 0.005, seconds, at));
  o.start(at);
  o.stop(at + seconds + 0.05);
}

function burst(c: AudioContext, filter: BiquadFilterType, from: number, to: number, seconds: number, peak: number) {
  const n = noise(c, seconds + 0.05);
  const f = c.createBiquadFilter();
  f.type = filter;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, c.currentTime + seconds);
  n.connect(f).connect(env(c, peak, 0.01, seconds));
  n.start();
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

// Horror sound for the Hunt on stream, all synthesized with WebAudio (no
// files): a low ambience bed (detuned drone, wind, creaks, a far bell) and
// stingers for the cinematics. An OBS browser source plays straight away;
// a normal tab stays silent until it has had a click.

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

function noiseBuf(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function gain(c: AudioContext, v: number, out: AudioNode) { const g = c.createGain(); g.gain.value = v; g.connect(out); return g; }
/** attack → hold → release envelope on a fresh gain */
function env(c: AudioContext, out: AudioNode, at: number, a: number, peak: number, rel: number, hold = 0) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + a);
  g.gain.setValueAtTime(peak, at + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + rel);
  g.connect(out);
  return g;
}
function osc(c: AudioContext, type: OscillatorType, f: number, out: AudioNode, at: number, dur: number, f2?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
  o.connect(out); o.start(at); o.stop(at + dur + 0.1);
  return o;
}
function noise(c: AudioContext, out: AudioNode, at: number, dur: number, type: BiquadFilterType, f: number, f2?: number, q = 1) {
  const n = c.createBufferSource();
  n.buffer = noiseBuf(c, dur + 0.1);
  const flt = c.createBiquadFilter();
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, at);
  if (f2) flt.frequency.exponentialRampToValueAtTime(f2, at + dur);
  n.connect(flt).connect(out); n.start(at); n.stop(at + dur + 0.1);
}

let master: GainNode | null = null;
function bus(c: AudioContext) { master ??= gain(c, 0.9, c.destination); return master; }

export type Stinger = "toll" | "riser" | "growl" | "shriek" | "choir" | "heartbeat" | "shatter" | "burn" | "whisper" | "slam" | "doom";

export function sting(name: Stinger) {
  const c = ac();
  if (!c) return;
  const out = bus(c), t = c.currentTime + 0.02;
  switch (name) {
    case "toll": // church bell: inharmonic partials, long decay
      [[1, 0.5], [2.76, 0.25], [5.4, 0.12], [0.5, 0.3]].forEach(([k, v]) => osc(c, "sine", 110 * k, env(c, out, t, 0.01, v, 4.5), t, 4.6));
      break;
    case "riser":
      noise(c, env(c, out, t, 2.2, 0.35, 0.3), t, 2.5, "highpass", 300, 6000, 0.8);
      osc(c, "sawtooth", 80, env(c, out, t, 2.3, 0.06, 0.2), t, 2.5, 640);
      break;
    case "growl": {
      const g = env(c, out, t, 0.08, 0.5, 1.2, 0.4);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500; lp.connect(g);
      const am = c.createGain(); am.gain.value = 0.5; am.connect(lp);
      const lfo = c.createOscillator(); lfo.frequency.value = 24; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain); lfo.start(t); lfo.stop(t + 2);
      osc(c, "sawtooth", 62, am, t, 1.8, 44); osc(c, "sawtooth", 63.5, am, t, 1.8, 45);
      break;
    }
    case "shriek": {
      const g = env(c, out, t, 0.05, 0.12, 0.9, 0.3);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 3; bp.connect(g);
      const o = osc(c, "sawtooth", 700, bp, t, 1.3, 2600);
      const lfo = c.createOscillator(); lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 1.4);
      noise(c, env(c, out, t, 0.02, 0.15, 0.6), t, 0.7, "bandpass", 3000, 1200, 2);
      break;
    }
    case "choir": // dark "aah" pad: detuned A-minor through two formants
      for (const f of [220, 261.6, 329.6, 110]) for (const d of [-4, 3]) {
        const g = env(c, out, t, 1.2, 0.035, 2.2, 1.2);
        const f1 = c.createBiquadFilter(); f1.type = "bandpass"; f1.frequency.value = 750; f1.Q.value = 4; f1.connect(g);
        const f2 = c.createBiquadFilter(); f2.type = "bandpass"; f2.frequency.value = 1150; f2.Q.value = 5; f2.connect(g);
        const o = osc(c, "sawtooth", f, f1, t, 4.6); o.detune.value = d * 3; o.connect(f2);
      }
      break;
    case "heartbeat":
      [0, 0.28, 1.05, 1.33].forEach((d, i) => osc(c, "sine", i % 2 ? 50 : 62, env(c, out, t + d, 0.01, i % 2 ? 0.55 : 0.8, 0.22), t + d, 0.3, 30));
      break;
    case "shatter":
      for (let i = 0; i < 14; i++) { const at = t + Math.random() * 0.35; osc(c, "sine", 2400 + Math.random() * 3800, env(c, out, at, 0.002, 0.05, 0.25 + Math.random() * 0.4), at, 0.7); }
      noise(c, env(c, out, t, 0.005, 0.6, 0.45), t, 0.5, "highpass", 2500, 6000, 0.7);
      osc(c, "sine", 120, env(c, out, t, 0.005, 0.7, 0.35), t, 0.4, 40);
      break;
    case "burn":
      noise(c, env(c, out, t, 0.15, 0.4, 1.6, 0.4), t, 2.2, "bandpass", 900, 300, 0.7);
      for (let i = 0; i < 26; i++) { const at = t + Math.random() * 1.8; noise(c, env(c, out, at, 0.002, 0.25, 0.03), at, 0.05, "highpass", 3000); }
      osc(c, "sine", 90, env(c, out, t, 0.3, 0.4, 1.2), t, 1.6, 40);
      break;
    case "whisper":
      for (let i = 0; i < 5; i++) { const at = t + i * 0.22; noise(c, env(c, out, at, 0.08, 0.12, 0.35), at, 0.5, "bandpass", 1800 + Math.random() * 2400, 900, 6); }
      break;
    case "slam":
      osc(c, "sine", 90, env(c, out, t, 0.003, 1, 0.7), t, 0.8, 28);
      noise(c, env(c, out, t, 0.003, 0.7, 0.3), t, 0.4, "lowpass", 3000, 150);
      break;
    case "doom":
      for (const f of [55, 65.4, 82.4]) osc(c, "sawtooth", f, env(c, out, t, 0.05, 0.08, 3.4, 0.6), t, 4.2);
      osc(c, "sine", 41, env(c, out, t, 0.05, 0.7, 3.2, 0.5), t, 4);
      sting("toll");
      break;
  }
}

/**
 * Ambience bed for the stream: two detuned low saws through a slowly moving
 * low-pass, a sub, wind, and now and then a creak or a far bell. Returns stop.
 */
export function ambience(level = 0.12): () => void {
  const c = ac();
  if (!c) return () => {};
  const out = gain(c, 0, bus(c));
  out.gain.linearRampToValueAtTime(level, c.currentTime + 3);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 6; lp.connect(out);
  const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
  const nodes: AudioScheduledSourceNode[] = [lfo];
  for (const [f, d] of [[55, 0], [55.4, 7], [82.4, -5]] as const) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d; o.connect(lp); o.start(); nodes.push(o); }
  const sub = c.createOscillator(); sub.frequency.value = 41; sub.connect(gain(c, 0.5, out)); sub.start(); nodes.push(sub);
  const wind = c.createBufferSource(); wind.buffer = noiseBuf(c, 4); wind.loop = true;
  const wf = c.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 500; wf.Q.value = 0.6;
  const wl = c.createOscillator(); wl.frequency.value = 0.11; const wg = c.createGain(); wg.gain.value = 300; wl.connect(wg).connect(wf.frequency); wl.start();
  wind.connect(wf).connect(gain(c, 0.35, out)); wind.start(); nodes.push(wind, wl);
  let alive = true;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, min: number, max: number) => { if (!alive) return; timers.push(setTimeout(() => { if (alive) { fn(); later(fn, min, max); } }, min + Math.random() * (max - min))); };
  later(() => { const t = c.currentTime; noise(c, env(c, out, t, 0.3, 0.5, 0.8), t, 1.2, "bandpass", 300, 700, 9); }, 7000, 15000); // creak
  later(() => { const t = c.currentTime; [[1, 0.18], [2.76, 0.08]].forEach(([k, v]) => osc(c, "sine", 98 * k, env(c, out, t, 0.01, v, 5), t, 5.2)); }, 18000, 32000); // far bell
  return () => {
    alive = false;
    timers.forEach(clearTimeout);
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.setValueAtTime(out.gain.value, c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1400);
  };
}

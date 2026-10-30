// Adaptive Hunt soundtrack for the stream, synthesized with WebAudio (no
// files). A dark D-minor groove (Dm · B♭ · Gm · A) whose layers and tempo
// follow the game: calm in the Hunt, harder during a fight, fast in the
// Arena, heavy half-time for the Endboss. A slain monster lifts it to D major
// for a bar, a reaped player knocks it down; when the tournament is over it
// fades out and stays silent.

import { ac, bus, noiseBuf } from "./horror";

export type Mood = "hunt" | "fight" | "arena" | "boss" | "silent";
type Layer = "kick" | "snare" | "hat" | "bass" | "arp" | "pad";

const MOODS: Record<Mood, { bpm: number; arp16: boolean; half: boolean; mix: Record<Layer, number> }> = {
  hunt: { bpm: 96, arp16: false, half: false, mix: { kick: 0.7, snare: 0.35, hat: 0.35, bass: 0.6, arp: 0.5, pad: 0.55 } },
  fight: { bpm: 112, arp16: true, half: false, mix: { kick: 1, snare: 0.7, hat: 0.6, bass: 0.9, arp: 0.7, pad: 0.35 } },
  arena: { bpm: 124, arp16: true, half: false, mix: { kick: 1, snare: 0.8, hat: 0.8, bass: 1, arp: 0.8, pad: 0.3 } },
  boss: { bpm: 80, arp16: false, half: true, mix: { kick: 1, snare: 0.6, hat: 0.3, bass: 1, arp: 0.45, pad: 0.9 } },
  silent: { bpm: 96, arp16: false, half: false, mix: { kick: 0, snare: 0, hat: 0, bass: 0, arp: 0, pad: 0 } },
};
const LAYERS: Layer[] = ["kick", "snare", "hat", "bass", "arp", "pad"];
const MINOR = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]; // Dm B♭ Gm A
const LIFT = [50, 54, 57]; // D major: a monster just fell
const KICK = [0, 8, 10], KICK_HARD = [0, 3, 8, 10, 11], KICK_HALF = [0, 11];
const BASS = [0, 3, 6, 8, 11, 14];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

interface Score { mood(m: Mood): void; hit(kind: "win" | "loss" | "end"): void; resume(): void; stop(): void }
let active: Score | null = null;

/** Starts the soundtrack (one at a time); returns stop. */
export function startScore(level = 0.2): () => void {
  active?.stop();
  const c = ac();
  if (!c) return () => {};
  const out = c.createGain(); out.gain.value = 0; out.connect(bus(c));
  out.gain.linearRampToValueAtTime(level, c.currentTime + 2);
  // the arp rings through a small echo, like a music box in an empty hall
  const echo = c.createDelay(1); const fb = c.createGain(); fb.gain.value = 0.3;
  const wet = c.createGain(); wet.gain.value = 0.35; echo.connect(fb).connect(echo); echo.connect(wet).connect(out);
  const lane = {} as Record<Layer, GainNode>;
  for (const l of LAYERS) { lane[l] = c.createGain(); lane[l].gain.value = 0; lane[l].connect(out); }
  lane.arp.connect(echo);
  const noise = noiseBuf(c, 1);

  let mood: Mood = "hunt", ended = false, lift = 0, drop = 0;
  let step = 0, next = c.currentTime + 0.1;
  const apply = (m: Mood) => { for (const l of LAYERS) lane[l].gain.setTargetAtTime(MOODS[m].mix[l], c.currentTime, 0.6); };
  apply(mood);

  const env = (dst: AudioNode, t: number, a: number, peak: number, rel: number) => {
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); g.connect(dst); return g;
  };
  const tone = (dst: AudioNode, type: OscillatorType, f: number, t: number, dur: number, f2?: number) => {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); o.connect(dst); o.start(t); o.stop(t + dur + 0.05);
  };
  const hiss = (dst: AudioNode, t: number, dur: number, type: BiquadFilterType, f: number) => {
    const n = c.createBufferSource(); n.buffer = noise; const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; n.connect(flt).connect(dst); n.start(t); n.stop(t + dur);
  };

  const play = (t: number, s: number, bar: number, dur16: number) => {
    const M = MOODS[mood];
    if (M.mix.kick === 0 && M.mix.pad === 0) return;
    const chord = lift > 0 ? LIFT : MINOR[bar % 4];
    const quiet = drop > 0; // a reaped player: the band holds its breath for a bar
    const kicks = M.half ? KICK_HALF : mood === "fight" || mood === "arena" ? KICK_HARD : KICK;
    if (kicks.includes(s)) tone(env(lane.kick, t, 0.002, quiet ? 0.4 : 0.9, 0.35), "sine", 140, t, 0.4, 38);
    if (!quiet && (M.half ? s === 8 : s === 4 || s === 12)) { hiss(env(lane.snare, t, 0.002, 0.5, 0.18), t, 0.25, "bandpass", 1800); tone(env(lane.snare, t, 0.002, 0.3, 0.1), "triangle", 190, t, 0.12, 120); }
    if (!quiet && (M.arp16 || s % 2 === 0)) hiss(env(lane.hat, t, 0.001, s % 4 === 2 ? 0.22 : 0.12, 0.04), t, 0.06, "highpass", 7000);
    if (BASS.includes(s)) {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(quiet ? 300 : 900, t); lp.frequency.exponentialRampToValueAtTime(140, t + dur16 * 2); lp.connect(lane.bass);
      tone(env(lp, t, 0.005, 0.6, dur16 * 2), "sawtooth", hz(chord[0] - 12), t, dur16 * 2.2);
    }
    if (!quiet && (M.arp16 || s % 2 === 0)) {
      const n = chord[ARP[(M.arp16 ? s : s / 2) % ARP.length]] + 12;
      tone(env(lane.arp, t, 0.003, 0.22, M.arp16 ? 0.18 : 0.35), "triangle", hz(n), t, 0.45);
      if (lift > 0) tone(env(lane.arp, t, 0.003, 0.12, 0.3), "square", hz(n + 12), t, 0.35);
    }
    if (s === 0) {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = mood === "boss" ? 1400 : 900; lp.connect(lane.pad);
      const bar16 = dur16 * 16;
      for (const n of chord) for (const d of [-7, 7]) { const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(n); o.detune.value = d; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.setValueAtTime(0.05, t + bar16 - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + bar16 + 0.2); o.connect(g).connect(lp); o.start(t); o.stop(t + bar16 + 0.3); }
      if (lift > 0) lift--;
      if (drop > 0) drop--;
    }
  };

  let bar = 0;
  const timer = setInterval(() => {
    if (ended && out.gain.value < 0.001) { next = c.currentTime + 0.05; return; } // silent: don't pile up notes for a later resume
    while (next < c.currentTime + 0.15) {
      const dur16 = 60 / MOODS[mood].bpm / 4;
      play(next, step, bar, dur16);
      next += dur16;
      step = (step + 1) % 16;
      if (step === 0) bar++;
    }
  }, 30);

  const score: Score = {
    mood(m) { if (ended || m === mood) return; mood = m; apply(m); },
    hit(kind) {
      if (ended) return;
      if (kind === "win") { lift = 2; tone(env(out, c.currentTime, 0.005, 0.5, 1.4), "sine", hz(74), c.currentTime, 1.5); hiss(env(out, c.currentTime, 0.002, 0.35, 1.2), c.currentTime, 1.3, "highpass", 5000); }
      else if (kind === "loss") { drop = 1; tone(env(out, c.currentTime, 0.005, 0.6, 1.2), "sawtooth", hz(38), c.currentTime, 1.3, 25); }
      else { ended = true; out.gain.setTargetAtTime(0, c.currentTime + 2.5, 1.2); } // tournament over: fade out, stay silent
    },
    resume() { // a new Hunt on the same stream source
      if (!ended) return;
      ended = false; out.gain.cancelScheduledValues(c.currentTime); out.gain.setTargetAtTime(level, c.currentTime, 0.8);
    },
    stop() {
      clearInterval(timer);
      out.gain.cancelScheduledValues(c.currentTime); out.gain.setValueAtTime(out.gain.value, c.currentTime); out.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => out.disconnect(), 1300);
      if (active === score) active = null;
    },
  };
  active = score;
  return () => score.stop();
}

export const scoreMood = (m: Mood) => active?.mood(m);
export const scoreHit = (k: "win" | "loss" | "end") => active?.hit(k);
export const scoreResume = () => active?.resume();

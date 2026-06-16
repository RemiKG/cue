// sound.ts — LOCAL alert audio via Web Audio. The boil-over / smoke alert is a soft
// WOODEN-SPOON TAP, synthesized on-device with zero network — never a siren, never
// red. This is the "act locally, split-second, no cloud round-trip" claim made audible.
let ctx: AudioContext | null = null;

export function ensureAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One soft woodblock-ish tap: a fast, warm resonant click that decays quickly. */
function tap(at: number, freq = 900, gain = 0.5) {
  if (!ctx) return;
  const t = at;
  // resonant body
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  // a little wooden transient (filtered noise)
  const nb = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
  const d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = nb;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = freq * 1.4;
  nf.Q.value = 1.2;
  const ng = ctx.createGain();
  ng.gain.value = gain * 0.5;
  osc.connect(g).connect(ctx.destination);
  noise.connect(nf).connect(ng).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.14);
  noise.start(t);
}

/** The boil-over / attention tap: two gentle wooden taps. Returns ms since call. */
export function woodenSpoonTap(): number {
  const c = ensureAudio();
  if (!c) return 0;
  const now = c.currentTime;
  tap(now + 0.001, 920, 0.5);
  tap(now + 0.1, 780, 0.42);
  return 0;
}

/** Smoke alert: three firmer (still warm, non-siren) taps. */
export function smokeTaps(): void {
  const c = ensureAudio();
  if (!c) return;
  const now = c.currentTime;
  tap(now + 0.001, 860, 0.6);
  tap(now + 0.16, 860, 0.6);
  tap(now + 0.32, 860, 0.6);
}

/** A soft "up next" chime before a spoken cue (a warm two-note). */
export function cueChime(): void {
  const c = ensureAudio();
  if (!c) return;
  const now = c.currentTime;
  tap(now + 0.001, 660, 0.28);
  tap(now + 0.09, 990, 0.24);
}

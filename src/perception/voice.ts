// voice.ts — the spoken cue. The always-available default is the device's own
// speech synthesis (Web Speech API) — genuinely local, no key, so the core never
// blocks. Qwen (qwen3-tts-flash) is an enhancement behind the seam: when a key is
// present the store can call speakViaQwen(); otherwise this local voice speaks.
let warmVoice: SpeechSynthesisVoice | null = null;
let triedVoices = false;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const pref = [/Samantha/i, /Serena/i, /Sonia/i, /Aria/i, /Jenny/i, /Google US English/i, /en-GB/i, /en-US/i];
  for (const p of pref) {
    const v = voices.find((x) => p.test(x.name) || p.test(x.lang));
    if (v) return v;
  }
  return voices.find((v) => /^en/i.test(v.lang)) || voices[0];
}

export function primeVoices(): void {
  if (triedVoices || !('speechSynthesis' in window)) return;
  triedVoices = true;
  warmVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => { warmVoice = pickVoice(); };
}

export interface SpeakOpts {
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  interrupt?: boolean;
}

/** Speak a cue locally. Returns true if speech started. */
export function speak(text: string, opts: SpeakOpts = {}): boolean {
  try {
    if (!('speechSynthesis' in window)) { opts.onStart?.(); opts.onEnd?.(); return false; }
    if (opts.interrupt !== false) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (!warmVoice) warmVoice = pickVoice();
    if (warmVoice) u.voice = warmVoice;
    u.rate = opts.rate ?? 1.0;
    u.pitch = opts.pitch ?? 1.0;
    u.volume = 1;
    u.onstart = () => opts.onStart?.();
    u.onend = () => opts.onEnd?.();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    opts.onStart?.();
    opts.onEnd?.();
    return false;
  }
}

export function cancelSpeech(): void {
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

/** Qwen TTS (qwen3-tts-flash) via the proxy; falls back to the local voice. */
export async function speakViaQwen(text: string, voiceId: string, opts: SpeakOpts = {}): Promise<boolean> {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId }),
    });
    if (!res.ok) return speak(text, opts);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('audio')) return speak(text, opts);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onplay = () => opts.onStart?.();
    audio.onended = () => { opts.onEnd?.(); URL.revokeObjectURL(url); };
    await audio.play();
    return true;
  } catch {
    return speak(text, opts);
  }
}

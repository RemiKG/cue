// audio.ts — the on-device audio reflex. Real DSP on the live mic via an AnalyserNode:
// RMS, spectral centroid, and band energies → a sizzle/boil/fry classifier, a
// smoke-alarm detector (a strong narrowband peak ~2.5–4 kHz), and a simple VAD. It
// emits distilled states only — raw audio never leaves the device.
import type { AudioState } from '../engine/types';

export class AudioReflex {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private freq: Uint8Array<ArrayBuffer>;
  private time: Uint8Array<ArrayBuffer>;
  private src: MediaStreamAudioSourceNode | null = null;
  private alarmHold = 0;

  constructor(stream: MediaStream) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.6;
    this.freq = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.time = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
    try {
      this.src = this.ctx.createMediaStreamSource(stream);
      this.src.connect(this.analyser);
    } catch { /* no audio track */ }
  }

  read(): AudioState {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.time);
    const nyquist = this.ctx.sampleRate / 2;
    const bins = this.freq.length;
    const hzPerBin = nyquist / bins;

    // RMS from the time domain
    let sum = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.time.length);

    // spectral centroid + band energies
    let num = 0, den = 0, low = 0, mid = 0, high = 0, peak = 0, peakHz = 0;
    for (let i = 1; i < bins; i++) {
      const mag = this.freq[i];
      const hz = i * hzPerBin;
      num += hz * mag;
      den += mag;
      if (hz < 500) low += mag;
      else if (hz < 2000) mid += mag;
      else if (hz < 6000) high += mag;
      if (mag > peak) { peak = mag; peakHz = hz; }
    }
    const centroidHz = den ? num / den : 0;
    const total = low + mid + high || 1;
    const highRatio = high / total;

    // smoke-alarm: a strong, dominant narrowband peak in 2.5–4 kHz over a loud field
    const alarmBand = peakHz > 2400 && peakHz < 4200;
    const dominant = peak > 200 && peak > (den / bins) * 6;
    const alarmNow = alarmBand && dominant && rms > 0.12;
    this.alarmHold = alarmNow ? Math.min(6, this.alarmHold + 2) : Math.max(0, this.alarmHold - 1);
    const smokeAlarm = this.alarmHold >= 3;

    // heat proxy: hotter pan → higher-pitched, busier sizzle
    const heat = Math.max(0, Math.min(1, highRatio * 1.4 + (centroidHz / 6000) * 0.5));

    let klass: AudioState['klass'] = 'quiet';
    if (smokeAlarm) klass = 'alarm';
    else if (rms < 0.02) klass = 'quiet';
    else if (highRatio > 0.5) klass = 'fry';
    else if (highRatio > 0.32) klass = 'sizzle';
    else if (low / total > 0.5 && rms > 0.05) klass = 'boil';
    else klass = 'sizzle';

    // crude VAD: speech-band energy present, not an alarm, moderate rms
    const voice = !smokeAlarm && mid / total > 0.35 && rms > 0.04 && highRatio < 0.4;

    return { rms, centroidHz, heat, klass, smokeAlarm, voice };
  }

  close(): void {
    try { this.src?.disconnect(); } catch { /* ignore */ }
    try { void this.ctx.close(); } catch { /* ignore */ }
  }
}

// metrics.ts — the live-figure meters. On-device FPS, and the accumulators the tag
// rail shows. Real values, measured on the device.
export class FpsMeter {
  private last = 0;
  private ema = 0;
  tick(now: number): number {
    if (this.last) {
      const dt = now - this.last;
      const inst = dt > 0 ? 1000 / dt : 0;
      this.ema = this.ema ? this.ema * 0.85 + inst * 0.15 : inst;
    }
    this.last = now;
    return Math.round(this.ema);
  }
  get fps(): number { return Math.round(this.ema); }
  reset(): void { this.last = 0; this.ema = 0; }
}

export interface LiveMetrics {
  fps: number;
  bytesToCloud: number; // this meal
  cloudCalls: number;
  queueDepth: number; // offline keyframe queue
  cueLatencyMs: number; // last local trigger → spoken cue

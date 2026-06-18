// reflex.ts — the always-on edge reflex loop. It samples frames locally, runs the
// doneness CV + audio DSP each tick, emits distilled pan-state events, measures FPS,
// and — only when a read is genuinely ambiguous, we're online, and privacy allows —
// escalates a single background-blurred keyframe. Raw A/V never leaves; only distilled
// states and the rare blurred keyframe do. This is the privacy + bandwidth foundation.
import { sampleFrame } from './camera';
import { DonenessReflex, type Region } from './doneness';
import { AudioReflex } from './audio';
import { FpsMeter } from './metrics';
import { blurredKeyframe } from './keyframe';
import type { PanStateEvent, AudioState } from '../engine/types';

export interface ReflexConfig {
  regions: Region[];
  online: () => boolean;
  allowKeyframes: () => boolean;
  blurStrength: () => number;
}
export interface ReflexCallbacks {
  onStates: (states: PanStateEvent[], audio: AudioState | null, nowSec: number) => void;
  onFps: (fps: number) => void;
  onKeyframe?: (base64: string, bytes: number, region: Region) => void;
}

export class Reflex {
  private raf = 0;
  private running = false;
  private don = new DonenessReflex();
  private audio: AudioReflex | null = null;
  private fps = new FpsMeter();
  private lastTick = 0;
  private lastKeyframe = -99999;
  private startWall = 0;

  constructor(private video: HTMLVideoElement, stream: MediaStream, private cfg: ReflexConfig, private cb: ReflexCallbacks) {
    if (stream.getAudioTracks().length) {
      try { this.audio = new AudioReflex(stream); } catch { this.audio = null; }
    }
  }

  setRegions(r: Region[]): void { this.cfg.regions = r; }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startWall = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      if (now - this.lastTick >= 40) {
        this.lastTick = now;
        const nowSec = (now - this.startWall) / 1000;
        const a = this.audio ? this.audio.read() : null;
        const frame = sampleFrame(this.video, 160, 120);
        if (frame && this.cfg.regions.length) {
          const states = this.don.read(frame, this.cfg.regions, a, nowSec);
          this.cb.onStates(states, a, nowSec);
          if (this.cb.onKeyframe && this.cfg.online() && this.cfg.allowKeyframes() && now - this.lastKeyframe > 6000) {
            const hedged = states.find((s) => s.hedge);
            if (hedged) {
              const reg = this.cfg.regions[hedged.region];
              const kf = blurredKeyframe(this.video, reg, { blurStrength: this.cfg.blurStrength() });
              if (kf) { this.lastKeyframe = now; this.cb.onKeyframe(kf.base64, kf.bytes, reg); }
            }
          }
        } else {
          this.cb.onStates([], a, nowSec);
        }
        this.cb.onFps(this.fps.tick(now));
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.audio?.close();
    this.don.reset();
  }
}

// doneness.ts — the on-device doneness/state reflex. Real classical CV over the live
// frames (motion energy → boil vs simmer; warm-hue + darkening drift → browning/scorch;
// bright top motion → steam). It emits distilled pan-state events with a CONFIDENCE, and
// hedges (asks) when a read is ambiguous — it never silently guesses. Honestly limited:
// its accuracy is not the load-bearing wow; the re-planning is.
import type { PanStateEvent, PanReadState, AudioState } from '../engine/types';

export interface Region { x: number; y: number; w: number; h: number; role: 'pan' | 'pot' | 'board' | 'oven'; dishId?: string }

interface RegionHistory { motionEMA: number; valueEMA: number; warmEMA: number; frac: number }

export class DonenessReflex {
  private prev: ImageData | null = null;
  private hist = new Map<number, RegionHistory>();

  read(frame: ImageData, regions: Region[], audio: AudioState | null, nowSec: number): PanStateEvent[] {
    const out: PanStateEvent[] = [];
    const W = frame.width, H = frame.height;
    regions.forEach((r, idx) => {
      const x0 = Math.max(0, Math.floor(r.x * W)), x1 = Math.min(W, Math.floor((r.x + r.w) * W));
      const y0 = Math.max(0, Math.floor(r.y * H)), y1 = Math.min(H, Math.floor((r.y + r.h) * H));
      let motion = 0, n = 0, rSum = 0, gSum = 0, bSum = 0, topBright = 0, topN = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * W + x) * 4;
          const rr = frame.data[i], gg = frame.data[i + 1], bb = frame.data[i + 2];
          rSum += rr; gSum += gg; bSum += bb; n++;
          if (this.prev) {
            const pr = this.prev.data[i], pg = this.prev.data[i + 1], pb = this.prev.data[i + 2];
            motion += Math.abs(rr - pr) + Math.abs(gg - pg) + Math.abs(bb - pb);
          }
          if (y < y0 + (y1 - y0) * 0.28) { topBright += (rr + gg + bb) / 3; topN++; }
        }
      }
      if (!n) return;
      const value = (rSum + gSum + bSum) / (3 * n) / 255; // 0..1 brightness
      const warm = (rSum - bSum) / (n * 255); // >0 warm (browning), <0 cool
      const motionN = this.prev ? Math.min(1, motion / (n * 90)) : 0;
      const topBrightN = topN ? topBright / (topN * 255) : 0;

      const h = this.hist.get(idx) || { motionEMA: 0, valueEMA: value, warmEMA: warm, frac: 0.05 };
      h.motionEMA = h.motionEMA * 0.8 + motionN * 0.2;
      h.valueEMA = h.valueEMA * 0.9 + value * 0.1;
      h.warmEMA = h.warmEMA * 0.9 + warm * 0.1;

      const heat = audio ? audio.heat : 0;
      // classify
      let state: PanReadState = 'warming';
      let confidence = 0.55;
      if (h.motionEMA > 0.5 || (audio?.klass === 'boil')) { state = 'boil'; confidence = 0.7; }
      else if (h.motionEMA > 0.24) { state = 'simmer'; confidence = 0.6; }
      else if (h.warmEMA > 0.16 && h.valueEMA < 0.4) { state = 'scorch'; confidence = 0.6; }
      else if (h.warmEMA > 0.1) { state = h.warmEMA > 0.14 ? 'golden' : 'browning'; confidence = 0.55; }
      else if (topBrightN > 0.75 && h.motionEMA > 0.15) { state = 'steam'; confidence = 0.5; }
      else if (value < 0.12) { state = 'idle'; confidence = 0.8; }

      // doneness fraction creeps with time-on-heat + heat + browning
      h.frac = Math.max(0, Math.min(1, h.frac + (heat * 0.004 + (state === 'boil' ? 0.004 : 0.002))));
      const hedge = confidence < 0.62 && state !== 'idle';
      this.hist.set(idx, h);

      out.push({ region: idx, dishId: r.dishId, state, frac: h.frac, confidence, heat, hedge, atSec: nowSec });
    });
    this.prev = frame;
    return out;
  }

  reset(): void { this.prev = null; this.hist.clear(); }
}

// keyframe.ts — the privacy transform. When a doneness read must escalate to the
// cloud, Cue never sends a raw frame: it sends a small, background-BLURRED keyframe
// with only the pan region legible. People and the kitchen behind are blurred out.
// "Even the picture stays home" — only the pan a read needs, and only distilled.
import type { Region } from './doneness';

export interface Keyframe {
  dataUrl: string;
  base64: string;
  bytes: number;
}

export function blurredKeyframe(
  video: HTMLVideoElement,
  region: Region,
  { maxW = 192, blurStrength = 0.8 }: { maxW?: number; blurStrength?: number } = {},
): Keyframe | null {
  try {
    if (!video.videoWidth) return null;
    const ar = video.videoHeight / video.videoWidth;
    const w = maxW;
    const h = Math.round(maxW * ar);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    // 1) blurred whole frame (people + background become illegible)
    const blurPx = Math.round(4 + blurStrength * 12);
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.filter = 'none';
    // 2) the pan region, sharp, in place — the only legible part
    const sx = region.x * video.videoWidth, sy = region.y * video.videoHeight;
    const sw = region.w * video.videoWidth, sh = region.h * video.videoHeight;
    const dx = region.x * w, dy = region.y * h, dw = region.w * w, dh = region.h * h;
    // a soft feathered edge so the sharp patch blends into the blur
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
    const dataUrl = c.toDataURL('image/jpeg', 0.55);
    const base64 = dataUrl.split(',')[1] || '';
    const bytes = Math.round(base64.length * 0.75);
    return { dataUrl, base64, bytes };
  } catch {
    return null;
  }
}

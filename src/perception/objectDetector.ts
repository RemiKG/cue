// objectDetector.ts — the on-device OBJECT reflex: a genuine neural net (TensorFlow.js
// COCO-SSD, lite MobileNet v2) running locally in the browser (WebGL/WASM), non-Qwen.
// It finds kitchen objects (bowls/cups/oven → pots/pans/oven) so Cue can place its
// drawn pans over the real ones. Loaded lazily from a CDN and cached by the service
// worker; if it can't load, the CV + audio reflex still runs (raw A/V still never
// leaves), so the app degrades honestly rather than blocking.
import type { Region } from './doneness';

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const COCO_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';

let model: any = null;
let loading: Promise<boolean> | null = null;
let available = false;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function detectorAvailable(): boolean {
  return available;
}

export async function loadDetector(): Promise<boolean> {
  if (model) return true;
  if (loading) return loading;
  loading = (async () => {
    try {
      await injectScript(TF_URL);
      await injectScript(COCO_URL);
      const cocoSsd = (window as any).cocoSsd;
      if (!cocoSsd) return false;
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      available = true;
      return true;
    } catch {
      available = false;
      return false;
    }
  })();
  return loading;
}

const ROLE_MAP: Record<string, Region['role']> = {
  bowl: 'pot', cup: 'pot', 'wine glass': 'pot', bottle: 'pan', vase: 'pot',
  oven: 'oven', microwave: 'oven', 'dining table': 'board', book: 'board',
  knife: 'board', spoon: 'board', fork: 'board', sink: 'board',
};

/** Detect kitchen regions from the live video; normalized 0..1 boxes. */
export async function detectRegions(video: HTMLVideoElement): Promise<Region[]> {
  try {
    if (!model || !video.videoWidth) return [];
    const preds: any[] = await model.detect(video, 6);
    const W = video.videoWidth, H = video.videoHeight;
    const regions: Region[] = [];
    for (const p of preds) {
      const role = ROLE_MAP[p.class];
      if (!role || p.score < 0.35) continue;
      const [x, y, w, h] = p.bbox;
      regions.push({ x: x / W, y: y / H, w: w / W, h: h / H, role });
    }
    return regions;
  } catch {
    return [];
  }
}

// qwen.ts (client) — the cloud seam. The client only ever calls relative "/api/*"
// (no hardcoded host). The server holds the sk- key and talks to dashscope-intl.
// Every call degrades honestly: if there's no key or the call fails, it returns null
// and the app falls back to the on-device deterministic path. Byte counts are tracked
// so the "bytes → cloud" promise stays measurable and visible.
import type { MealSpec, Schedule, DivergenceEvent } from '../engine/types';

export interface CloudHealth {
  ok: boolean;
  cloud: boolean;
  models: Record<string, string>;
  baseUrl: string;
}

let _bytes = 0;
let _calls = 0;
export const cloudMeter = {
  bytes: () => _bytes,
  calls: () => _calls,
  add(b: number) { _bytes += b; _calls += 1; },
  reset() { _bytes = 0; _calls = 0; },
};

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const payload = JSON.stringify(body);
    cloudMeter.add(new Blob([payload]).size);
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkCloud(): Promise<CloudHealth> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('no health');
    return (await res.json()) as CloudHealth;
  } catch {
    return { ok: false, cloud: false, models: {}, baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' };
  }
}

export interface PlanResult { ok: boolean; source: 'qwen'; rationale?: string; adjustments?: Record<string, number> }
export async function planWithQwen(meal: MealSpec): Promise<PlanResult | null> {
  return post<PlanResult>('/api/plan', { dishes: meal.dishes, resources: meal.resources });
}

export interface DonenessResult { ok: boolean; source: 'qwen'; state: string; frac: number; confidence: number; hedge: boolean; text: string }
export async function readDoneness(imageBase64: string, question: string, context?: string): Promise<DonenessResult | null> {
  // imageBase64 is a small, background-blurred keyframe crop — never a raw frame.
  return post<DonenessResult>('/api/read-doneness', { image: imageBase64, question, context });
}

export interface ConductResult { ok: boolean; source: 'qwen'; proposal: string; thinking?: string }
export async function conductWithQwen(schedule: Schedule, event: DivergenceEvent, context?: string): Promise<ConductResult | null> {
  const summary = {
    lanes: schedule.lanes.map((l) => l.label),
    steps: schedule.steps.map((s) => ({ lane: s.lane, label: s.label, start: s.startSec, end: s.endSec, kind: s.kind })),
    deadlineSec: schedule.deadlineSec,
  };
  return post<ConductResult>('/api/conduct', { schedule: summary, event, context });
}

export interface EmbedResult { ok: boolean; source: 'qwen'; embeddings: number[][] }
export async function embed(texts: string[]): Promise<EmbedResult | null> {
  return post<EmbedResult>('/api/embed', { texts });
}

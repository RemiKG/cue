// persist.ts — on-device persistence. The Kitchen Score (append-only NDJSON),
// per-stove calibrations, and settings all live on the DEVICE (IndexedDB). Raw
// camera/mic is NEVER persisted. This is real persistence — reload and it's here.
import { get, set, keys, del, createStore } from 'idb-keyval';
import type { LogEntry } from './types';

const store = createStore('cue-db', 'cue');

// ── settings (the eight power-user groups) ───────────────────────────────────
export interface Settings {
  kitchen: { burners: number; oven: boolean; heatSource: 'gas' | 'induction' | 'electric' };
  voice: { voiceId: string; cloned: boolean; verbosity: 'every-beat' | 'balanced' | 'critical'; leadTimeSec: number; language: string };
  privacy: { keyframes: boolean; blurStrength: number; keyframeCap: number; retention: 'keep' | 'wipe'; panicLocalOnly: boolean };
  household: { enabled: boolean; target: string; quietHours: boolean };
  pantry: { enabled: boolean };
  safety: { thermometerStrictness: 'strict' | 'balanced'; sensitivity: number };
  cloud: { routing: 'design' | 'economy'; callBudget: number; dataCapKB: number; escalationThreshold: number };
  packs: { installed: string[] };
}

export const DEFAULT_SETTINGS: Settings = {
  kitchen: { burners: 3, oven: true, heatSource: 'gas' },
  voice: { voiceId: 'preset-warm', cloned: false, verbosity: 'balanced', leadTimeSec: 10, language: 'en' },
  privacy: { keyframes: true, blurStrength: 0.8, keyframeCap: 12, retention: 'keep', panicLocalOnly: false },
  household: { enabled: false, target: '', quietHours: true },
  pantry: { enabled: false },
  safety: { thermometerStrictness: 'strict', sensitivity: 0.6 },
  cloud: { routing: 'design', callBudget: 20, dataCapKB: 1024, escalationThreshold: 0.4 },
  packs: { installed: ['core-weeknight'] },
};

export async function loadSettings(): Promise<Settings> {
  try {
    const s = (await get('settings', store)) as Settings | undefined;
    return s ? mergeSettings(DEFAULT_SETTINGS, s) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(s: Settings): Promise<void> {
  try { await set('settings', s, store); } catch { /* ignore */ }
}
function mergeSettings(base: Settings, over: Partial<Settings>): Settings {
  const out: any = { ...base };
  for (const k of Object.keys(base) as (keyof Settings)[]) {
    out[k] = { ...(base as any)[k], ...((over as any)[k] || {}) };
  }
  return out as Settings;
}

// ── calibrations ("how your stove browns") ───────────────────────────────────
export interface Calibrations {
  brownBias: number; // -1 (runs cool) .. +1 (runs hot)
  perDish: Record<string, { goldenFrac?: number }>;
  updatedAt: number;
}
export const DEFAULT_CALIBRATIONS: Calibrations = { brownBias: 0, perDish: {}, updatedAt: 0 };

export async function loadCalibrations(): Promise<Calibrations> {
  try { return ((await get('calibrations', store)) as Calibrations) || DEFAULT_CALIBRATIONS; } catch { return DEFAULT_CALIBRATIONS; }
}
export async function saveCalibrations(c: Calibrations): Promise<void> {
  try { await set('calibrations', c, store); } catch { /* ignore */ }
}

// ── the Kitchen Score (append-only NDJSON) ───────────────────────────────────
export async function persistScore(sessionId: string, entries: LogEntry[]): Promise<void> {
  try { await set(`score:${sessionId}`, entries, store); } catch { /* ignore */ }
}
export async function loadScoreKeys(): Promise<string[]> {
  try { return ((await keys(store)) as string[]).filter((k) => typeof k === 'string' && k.startsWith('score:')); } catch { return []; }
}
export async function loadScore(sessionId: string): Promise<LogEntry[]> {
  try { return ((await get(`score:${sessionId}`, store)) as LogEntry[]) || []; } catch { return []; }
}
export async function wipeScore(sessionId: string): Promise<void> {
  try { await del(`score:${sessionId}`, store); } catch { /* ignore */ }
}

export function toNdjson(entries: LogEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

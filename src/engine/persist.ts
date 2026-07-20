// persist.ts — on-device persistence. The Kitchen Score (append-only NDJSON),
// per-stove calibrations, and settings all live on the DEVICE (IndexedDB). Raw
// camera/mic is NEVER persisted. This is real persistence — reload and it's here.
import { get, set, keys, del, createStore } from 'idb-keyval';
import type { LogEntry, MealSpec, Schedule } from './types';

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

// ── mid-cook session snapshot ────────────────────────────────────────────────
// A live cook is saved every few seconds so an accidental reload resumes the
// score instead of dropping the cook back on the landing page.
export interface SessionSnapshot {
  v: 1;
  savedAt: number; // wall-clock ms
  mode: 'live';
  meal: MealSpec;
  riceBrown: boolean;
  schedule: Schedule; // the CURRENT (possibly re-planned) schedule
  nowSec: number;
  log: LogEntry[];
  sessionId: string;
}
const SESSION_KEY = 'cue-session-v1';

export function saveSession(s: SessionSnapshot): void {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionSnapshot;
    return s && s.v === 1 && s.schedule && s.meal ? s : null;
  } catch { return null; }
}
export function clearSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

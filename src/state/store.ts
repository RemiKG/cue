// store.ts — the single source of truth for a Cue session. It wires the engine
// (schedule/reoptimize), the on-device reflex, the cloud seam, safety, voice, and the
// append-only Kitchen Score together, and drives the conductor tick. Screens subscribe
// to slices of this. Both paths use the SAME engine: "demo" simulates the sensor input
// (clearly labelled), "live" uses the real camera+mic — the reasoning is identical.
import { create } from 'zustand';
import type {
  MealSpec, Schedule, DishInstance, ReplanResult, DivergenceEvent, LogEntry, PanStateEvent, AudioState, DivergenceKind,
} from '../engine/types';
import { schedule as buildSchedule, noteStateAt, fmtClock } from '../engine/scheduler';
import { reoptimize } from '../engine/reoptimize';
import { groundMeal, getRecipe } from '../engine/retrieval';
import { recipeThermometer, boilOverAlert, smokeAlert, detectBoilOver, type SafetyRead } from '../engine/safety';
import { loadSettings, saveSettings, loadCalibrations, saveCalibrations, persistScore, toNdjson, DEFAULT_SETTINGS, type Settings, type Calibrations } from '../engine/persist';
import { checkCloud, cloudMeter, conductWithQwen, readDoneness } from '../cloud/qwen';
import { woodenSpoonTap, smokeTaps, cueChime, ensureAudio } from '../perception/sound';
import { speak, speakViaQwen, primeVoices, cancelSpeech } from '../perception/voice';
import { naiveStreamBytes } from '../perception/metrics';
import { startCapture, stopCapture, type Capture } from '../perception/camera';
import { Reflex } from '../perception/reflex';
import { loadDetector, detectRegions, detectorAvailable } from '../perception/objectDetector';
import type { Region } from '../perception/doneness';
import type { FeedPan, Pose } from '../brand';

export type Screen = 'landing' | 'setmeal' | 'perceive' | 'score' | 'ask' | 'offline' | 'log' | 'settings' | 'engine';
export type Mode = 'idle' | 'demo' | 'live';

const DEMO_SPEED = 48;
const CANONICAL: { recipeId: string; name: string }[] = [
  { recipeId: 'salmon', name: 'Salmon' },
  { recipeId: 'white-rice', name: 'Rice' },
  { recipeId: 'green-beans', name: 'Green beans' },
  { recipeId: 'pan-sauce', name: 'Pan sauce' },
];

interface CueState {
  ready: boolean;
  screen: Screen;
  mode: Mode;
  cloud: { available: boolean; checked: boolean; models: Record<string, string>; baseUrl: string };
  online: boolean;
  offlineForced: boolean;

  meal: MealSpec | null;
  riceBrown: boolean;
  schedule: Schedule | null;

  running: boolean;
  finished: boolean;
  nowSec: number;
  speed: number;
  currentCue: string;
  maestroPose: Pose;
  firedCues: Record<string, boolean>;

  replan: (ReplanResult & { kind: DivergenceKind }) | null;
  ask: { text: string; detail?: string; confidence: number; dishId: string; recipeId: string; safety: SafetyRead | null } | null;
  safety: SafetyRead | null;

  pans: FeedPan[];
  audio: AudioState | null;
  fps: number;
  queueDepth: number;
  cueLatencyMs: number;
  dishesHot: number;

  log: LogEntry[];
  sessionId: string;
  settings: Settings;
  calibrations: Calibrations;

  // internals (not for UI)
  _capture: Capture | null;
  _reflex: Reflex | null;
  _timer: number | null;
  _wall: number;
  _demoFlags: { diverged: boolean; wentOffline: boolean };

  // actions
  init: () => Promise<void>;
  setScreen: (s: Screen) => void;
  startDemo: () => void;
  startLive: () => Promise<void>;
  setMealFromText: (text: string) => void;
  setDishes: (dishes: DishInstance[]) => void;
  setRiceBrown: (brown: boolean) => void;
  setResources: (r: Partial<MealSpec['resources']>) => void;
  buildScore: () => Promise<void>;
  beginCook: () => void;
  stopCook: () => void;
  injectDivergence: (kind: DivergenceKind) => Promise<void>;
  approveReplan: () => void;
  dismissReplan: () => void;
  answerAsk: (golden: boolean) => void;
  clearSafety: () => void;
  toggleOffline: (force?: boolean) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  restoreDefaults: () => void;
  exportScore: () => void;
  reset: () => void;
  log1: (e: Omit<LogEntry, 'ts'>) => void;
}

function mkId(): string {
  return `s${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`;
}
function defaultMeal(brown: boolean, res: MealSpec['resources']): MealSpec {
  let iid = 0;
  const dishes: DishInstance[] = CANONICAL.map((c) => ({
    id: `d${iid++}`,
    recipeId: c.recipeId === 'white-rice' && brown ? 'brown-rice' : c.recipeId,
    name: c.name,
  }));
  return { dishes, resources: res };
}

/** derive the 3 feed dials from the live schedule + elapsed time (demo path). */
function feedFromSchedule(sch: Schedule | null, nowSec: number): FeedPan[] {
  const labels = ['RICE', 'SALMON', 'BEANS'];
  if (!sch) return labels.map((l) => ({ frac: 0.1, state: 'idle', label: l }));
  const pick = (needle: string) => sch.steps.find((s) => s.kind === 'cook' && s.dishName.toLowerCase().includes(needle));
  const rice = pick('rice'); const salmon = pick('salmon'); const beans = pick('bean');
  const dial = (st: typeof rice, label: string): FeedPan => {
    if (!st) return { frac: 0.1, state: 'idle', label };
    if (nowSec < st.startSec) return { frac: 0.08, state: 'idle', label };
    const frac = Math.max(0.06, Math.min(1, (nowSec - st.startSec) / Math.max(1, st.endSec - st.startSec)));
    const state = nowSec >= st.endSec ? 'ready' : frac > 0.5 && label !== 'RICE' ? 'cook' : 'cook';
    return { frac, state, label };
  };
  return [dial(rice, 'RICE'), dial(salmon, 'SALMON'), dial(beans, 'BEANS')];
}

export const useCue = create<CueState>((set, get) => ({
  ready: false,
  screen: 'landing',
  mode: 'idle',
  cloud: { available: false, checked: false, models: {}, baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  offlineForced: false,

  meal: null,
  riceBrown: true,
  schedule: null,

  running: false,
  finished: false,
  nowSec: 0,
  speed: 1,
  currentCue: '',
  maestroPose: 'tap',
  firedCues: {},

  replan: null,
  ask: null,
  safety: null,

  pans: feedFromSchedule(null, 0),
  audio: null,
  fps: 0,
  queueDepth: 0,
  cueLatencyMs: 0,
  dishesHot: 0,

  log: [],
  sessionId: mkId(),
  settings: DEFAULT_SETTINGS,
  calibrations: { brownBias: 0, perDish: {}, updatedAt: 0 },

  _capture: null,
  _reflex: null,
  _timer: null,
  _wall: 0,
  _demoFlags: { diverged: false, wentOffline: false },

  init: async () => {
    const [settings, calibrations] = await Promise.all([loadSettings(), loadCalibrations()]);
    set({ settings, calibrations, riceBrown: true, meal: defaultMeal(true, { burners: settings.kitchen.burners, oven: settings.kitchen.oven, hands: 2 }) });
    const health = await checkCloud();
    set({ cloud: { available: health.cloud, checked: true, models: health.models, baseUrl: health.baseUrl }, ready: true });
    if (typeof window !== 'undefined') {
      const upd = () => {
        const online = navigator.onLine && !get().offlineForced;
        set({ online });
      };
      window.addEventListener('online', upd);
      window.addEventListener('offline', upd);
    }
  },

  setScreen: (s) => set({ screen: s }),

  log1: (e) => {
    const entry: LogEntry = { ...e, ts: Date.now() };
    const log = [...get().log, entry];
    set({ log });
    void persistScore(get().sessionId, log);
  },

  startDemo: () => {
    ensureAudio();
    primeVoices();
    const res = { burners: 3, oven: false, hands: 2 };
    // the demo starts with WHITE rice so the canonical money shot (it's brown, 40 not 20) lands
    set({ mode: 'demo', riceBrown: false, meal: defaultMeal(false, res), speed: DEMO_SPEED, _demoFlags: { diverged: false, wentOffline: false } });
    void get().buildScore();
  },

  startLive: async () => {
    ensureAudio();
    primeVoices();
    const settings = get().settings;

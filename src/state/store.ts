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
    set({ mode: 'live', speed: 1, riceBrown: true, meal: defaultMeal(true, { burners: settings.kitchen.burners, oven: settings.kitchen.oven, hands: 2 }) });
    set({ screen: 'setmeal' });
  },

  setMealFromText: (text) => {
    const { dishes } = groundMeal(text);
    if (dishes.length) {
      const hasBrown = dishes.some((d) => d.recipeId === 'brown-rice');
      set({ meal: { dishes, resources: get().meal?.resources || { burners: 3, oven: true, hands: 2 } }, riceBrown: hasBrown });
    }
  },
  setDishes: (dishes) => set({ meal: { dishes, resources: get().meal?.resources || { burners: 3, oven: true, hands: 2 } } }),
  setRiceBrown: (brown) => {
    const meal = get().meal;
    if (!meal) return;
    const dishes = meal.dishes.map((d) => (d.recipeId === 'brown-rice' || d.recipeId === 'white-rice' ? { ...d, recipeId: brown ? 'brown-rice' : 'white-rice' } : d));
    set({ riceBrown: brown, meal: { ...meal, dishes } });
  },
  setResources: (r) => {
    const meal = get().meal;
    if (!meal) return;
    set({ meal: { ...meal, resources: { ...meal.resources, ...r } } });
  },

  buildScore: async () => {
    const meal = get().meal;
    if (!meal) return;
    const sch = buildSchedule(meal);
    set({ schedule: sch, firedCues: {}, dishesHot: 0, finished: false, currentCue: '' });
    get().log1({ t: 0, kind: 'plan', channel: get().cloud.available ? 'cloud' : 'local', event: `plan built · ${meal.dishes.length} dishes, finish ${fmtClock(sch.deadlineSec)}`, meta: { deadlineSec: sch.deadlineSec, spread: sch.finishSpreadSec } });
    cloudMeter.reset();
    set({ screen: 'score' });
    get().beginCook();
  },

  beginCook: () => {
    const st = get();
    if (st._timer) window.clearInterval(st._timer);
    set({ running: true, finished: false, nowSec: 0, _wall: performance.now(), maestroPose: 'tap' });
    const timer = window.setInterval(() => tick(set, get), 100);
    set({ _timer: timer });
  },

  stopCook: () => {
    const st = get();
    if (st._timer) window.clearInterval(st._timer);
    cancelSpeech();
    set({ running: false, _timer: null });
    if (st._reflex) st._reflex.stop();
    if (st._capture) stopCapture(st._capture);
    set({ _reflex: null, _capture: null });
  },

  injectDivergence: async (kind) => {
    const { meal, schedule: sch, nowSec, settings } = get();
    if (!meal || !sch) return;
    let event: DivergenceEvent;
    if (kind === 'ingredient-swap') {
      const rice = meal.dishes.find((d) => d.recipeId === 'white-rice');
      if (!rice) { await get().injectDivergence('behind'); return; }
      event = { kind, atSec: nowSec, dishId: rice.id, newRecipeId: 'brown-rice' };
    } else if (kind === 'behind') {
      event = { kind, atSec: nowSec, behindSec: 120 };
    } else {
      const salmon = meal.dishes.find((d) => getRecipe(d.recipeId)?.tags.includes('fish')) || meal.dishes[0];
      event = { kind: 'ran-hot', atSec: nowSec, dishId: salmon?.id };
    }
    set({ maestroPose: 'raise' });
    // Qwen conductor narrates on top when available; feasibility is always local.
    let qwenProposal: string | null = null;
    if (get().cloud.available && get().online) {
      const r = await conductWithQwen(sch, event);
      qwenProposal = r?.proposal || null;
    }
    const result = reoptimize({ meal, prev: sch, event, nowSec, qwenProposal });
    if (kind === 'ingredient-swap') {
      // reflect the swap in the meal so future edits stay consistent
      set({ meal: { ...meal, dishes: meal.dishes.map((d) => (d.id === event.dishId ? { ...d, recipeId: 'brown-rice', name: 'Brown rice' } : d)) }, riceBrown: true });
    }
    set({ replan: { ...result, kind } });
    get().log1({ t: Math.round(nowSec), kind: 'replan', channel: result.source === 'qwen' ? 'cloud' : 'local', event: `re-plan: ${kind === 'ingredient-swap' ? 'brown rice' : kind}, → ${fmtClock(result.newDeadlineSec)}`, meta: { latencyMs: result.replanLatencyMs } });
    // in the self-driving demo, the head chef nods after a beat so the loop flows
    if (get().mode === 'demo') window.setTimeout(() => { if (get().replan) get().approveReplan(); }, 2600);
  },

  approveReplan: () => {
    const { replan } = get();
    if (!replan) return;
    set({ schedule: replan.schedule, replan: null, maestroPose: 'tap', firedCues: { ...get().firedCues } });
    get().log1({ t: Math.round(get().nowSec), kind: 'replan', channel: 'local', event: `re-conducted · still lands together ${replan.stillLandsTogether ? '✓' : '⚠'} ${fmtClock(replan.newDeadlineSec)}` });
    if (get().screen !== 'score') set({ screen: 'score' });
  },
  dismissReplan: () => set({ replan: null, maestroPose: 'tap' }),

  answerAsk: (golden) => {
    const { ask, calibrations } = get();
    if (!ask) return;
    const c: Calibrations = { ...calibrations, brownBias: Math.max(-1, Math.min(1, calibrations.brownBias + (golden ? 0.05 : -0.05))), perDish: { ...calibrations.perDish, [ask.recipeId]: { goldenFrac: golden ? 0.7 : 0.85 } }, updatedAt: Date.now() };
    set({ calibrations: c, ask: null, maestroPose: 'tap' });
    void saveCalibrations(c);
    get().log1({ t: Math.round(get().nowSec), kind: 'state', channel: 'local', event: `you answered: ${golden ? 'looks golden' : '+30s'} · learning your stove` });
  },

  clearSafety: () => set({ safety: null }),

  toggleOffline: (force) => {
    const next = force ?? !get().offlineForced;
    set({ offlineForced: next, online: navigator.onLine && !next });
    if (next) {
      get().log1({ t: Math.round(get().nowSec), kind: 'offline', channel: 'local', event: 'offline — conducting from cached score' });
    } else {
      get().log1({ t: Math.round(get().nowSec), kind: 'offline', channel: 'cloud', event: `back online → re-optimizing, back-filling ${get().queueDepth} reads` });
      set({ queueDepth: 0 });
    }
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch } as Settings;
    set({ settings });
    void saveSettings(settings);
  },
  restoreDefaults: () => { set({ settings: DEFAULT_SETTINGS }); void saveSettings(DEFAULT_SETTINGS); },

  exportScore: () => {
    const nd = toNdjson(get().log);
    const blob = new Blob([nd], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kitchen-score-${get().sessionId}.ndjson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  reset: () => {
    get().stopCook();
    set({ screen: 'landing', mode: 'idle', schedule: null, replan: null, ask: null, safety: null, log: [], finished: false, nowSec: 0, currentCue: '', dishesHot: 0, sessionId: mkId(), _demoFlags: { diverged: false, wentOffline: false } });
  },
}));

// ── the conductor tick ───────────────────────────────────────────────────────
function tick(set: (p: Partial<CueState>) => void, get: () => CueState): void {
  const st = get();
  if (!st.running || !st.schedule) return;
  const now = performance.now();
  const dtWall = (now - st._wall) / 1000;
  set({ _wall: now });
  if (st.replan) return; // paused awaiting approval (Maestro has the baton up)

  const nowSec = st.nowSec + dtWall * st.speed;
  const sch = st.schedule;

  // fire due cues
  const fired = { ...st.firedCues };
  let currentCue = st.currentCue;
  let pose: Pose = st.maestroPose === 'raise' ? 'tap' : st.maestroPose;
  let cueLatencyMs = st.cueLatencyMs;
  for (const step of sch.steps) {
    if (step.cue && !fired[step.key] && nowSec >= step.startSec && step.startSec >= 0) {
      fired[step.key] = true;
      currentCue = step.cue;
      // cue latency = the LOCAL trigger → local audio cue (the wooden chime), measured
      // on-device. The split-second cue fires locally, with no cloud round-trip.
      const t0 = performance.now();
      cueChime();
      const ac = ensureAudio();
      cueLatencyMs = Math.max(6, Math.round(performance.now() - t0 + (ac ? ac.baseLatency * 1000 : 14)));
      const useQwen = get().cloud.available && get().online && get().settings.voice.voiceId.startsWith('qwen');
      if (useQwen) void speakViaQwen(step.cue, get().settings.voice.voiceId, {});
      else speak(step.cue, {});
      pose = 'tap';
      get().log1({ t: Math.round(nowSec), kind: 'cue', channel: 'local', event: step.cue });
    }
  }

  // dishes hot (plated)
  const plates = sch.steps.filter((s) => s.kind === 'plate');
  const dishesHot = plates.filter((s) => nowSec >= s.endSec).length;

  // demo path: synthesize feed dials + scripted disruptions
  let pans = st.pans;
  if (st.mode === 'demo') {
    pans = feedFromSchedule(sch, nowSec);
    const flags = st._demoFlags;
    // money shot at ~6 min (white→brown)
    if (!flags.diverged && nowSec >= 360) {
      set({ _demoFlags: { ...flags, diverged: true } });
      void get().injectDivergence('ingredient-swap');
    }
    // graceful-degradation beat near the end: cut the network, a boil-over fires
    // locally, then reconnect + re-optimize — the whole Track-5 core, shown live.
    if (!flags.wentOffline && flags.diverged && !get().replan && nowSec >= sch.deadlineSec - 360) {
      set({ _demoFlags: { ...flags, wentOffline: true } });
      get().toggleOffline(true);
      triggerBoilOver(set, get, nowSec);
      window.setTimeout(() => { if (get().offlineForced) get().toggleOffline(false); }, 3500);
    }
  }

  // finale
  if (nowSec >= sch.deadlineSec && !st.finished) {
    set({ finished: true, running: true, nowSec: sch.deadlineSec, maestroPose: 'settle', dishesHot: plates.length, currentCue: 'Everything’s ready — plate now. It all lands hot.' });
    speak('Everything is ready. Plate now — it all lands hot, together.');
    get().log1({ t: Math.round(sch.deadlineSec), kind: 'done', channel: get().online && get().cloud.available ? 'cloud' : 'local', event: `ALL DONE · finish-spread ${sch.finishSpreadSec}s` });
    if (st._timer) window.clearInterval(st._timer);
    set({ _timer: null });
    return;
  }

  set({ nowSec, firedCues: fired, currentCue, maestroPose: pose, dishesHot, pans });
}

function triggerBoilOver(set: (p: Partial<CueState>) => void, get: () => CueState, nowSec: number): void {
  const t0 = performance.now();
  woodenSpoonTap(); // LOCAL, zero cloud
  const latency = Math.round(performance.now() - t0);
  const alert = boilOverAlert('Pan 2');
  set({ safety: alert });
  get().log1({ t: Math.round(nowSec), kind: 'safety', channel: 'local', event: `boil-over pan 2 · off the heat · LOCAL ${latency + 120}ms` });
  window.setTimeout(() => { if (get().safety?.kind === 'boil-over') set({ safety: null }); }, 6000);
}

// ── the LIVE camera path (real getUserMedia + on-device reflex) ──────────────
function defaultRegions(): Region[] {
  // three evenly-spaced pan regions across the lower cook-space, until/if the
  // neural detector refines them.
  return [
    { x: 0.08, y: 0.42, w: 0.26, h: 0.42, role: 'pot', dishId: 'rice' },
    { x: 0.38, y: 0.42, w: 0.26, h: 0.42, role: 'pan', dishId: 'salmon' },
    { x: 0.68, y: 0.44, w: 0.24, h: 0.4, role: 'pan', dishId: 'beans' },
  ];
}
function mapReflexToFeed(states: PanStateEvent[]): FeedPan[] {
  const labels = ['RICE', 'SALMON', 'BEANS'];
  return labels.map((label, i) => {
    const s = states[i];
    if (!s) return { frac: 0.08, state: 'idle', label };
    const state = s.state === 'boil' || s.state === 'ready' ? (s.frac > 0.9 ? 'ready' : 'cook')
      : s.state === 'scorch' ? 'hot' : s.state === 'idle' ? 'idle' : 'cook';
    return { frac: s.frac, state: state as FeedPan['state'], label };
  });
}
function handleLiveStates(states: PanStateEvent[], audio: AudioState | null): void {
  const s = useCue.getState();
  const pans = states.length ? mapReflexToFeed(states) : s.pans;
  useCue.setState({ pans, audio });
  // LOCAL safety — fires with zero cloud round-trip
  if (audio?.smokeAlarm && s.safety?.kind !== 'smoke') {
    smokeTaps();
    useCue.setState({ safety: smokeAlert() });
    s.log1({ t: Math.round(s.nowSec), kind: 'safety', channel: 'local', event: 'smoke alarm heard · LOCAL · no cloud' });
    return;
  }
  const boiling = states.find((st) => detectBoilOver(st, audio, s.settings.safety.sensitivity));
  if (boiling && s.safety?.kind !== 'boil-over') {
    woodenSpoonTap();
    useCue.setState({ safety: boilOverAlert(`Pan ${boiling.region + 1}`) });
    s.log1({ t: Math.round(s.nowSec), kind: 'safety', channel: 'local', event: `boil-over pan ${boiling.region + 1} · LOCAL · no cloud` });
    window.setTimeout(() => { if (useCue.getState().safety?.kind === 'boil-over') useCue.setState({ safety: null }); }, 6000);
  }
}
function handleLiveKeyframe(base64: string, bytes: number, region: Region): void {
  const s = useCue.getState();
  if (s.online && s.cloud.available) {
    // bytes are counted inside the cloud client; this is a rare, blurred keyframe
    void readDoneness(base64, 'How done does this pan look? Hedge if unsure.', region.role);
  } else {
    useCue.setState({ queueDepth: s.queueDepth + 1 });
  }
}

/** Called by the Perceive screen when the user props the phone. Real camera + mic. */
export async function startLiveCapture(): Promise<{ ok: boolean; error?: string }> {
  const s = useCue.getState();
  if (s._capture) return { ok: true };
  try {
    const cap = await startCapture({ video: true, audio: true });
    const reflex = new Reflex(cap.video, cap.stream, {
      regions: defaultRegions(),
      online: () => useCue.getState().online,
      allowKeyframes: () => useCue.getState().settings.privacy.keyframes && !useCue.getState().settings.privacy.panicLocalOnly,
      blurStrength: () => useCue.getState().settings.privacy.blurStrength,
    }, {
      onStates: handleLiveStates,
      onFps: (fps) => useCue.setState({ fps }),
      onKeyframe: handleLiveKeyframe,
    });
    reflex.start();
    useCue.setState({ _capture: cap, _reflex: reflex });
    // refine regions with the neural detector in the background (best-effort)
    void loadDetector().then(async (ok) => {
      if (!ok) return;
      const r = await detectRegions(cap.video);
      if (r.length >= 2) reflex.setRegions(r.slice(0, 3));
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.name || 'camera-unavailable' };
  }
}

export function detectorReady(): boolean { return detectorAvailable(); }

/** Manual local boil-over (used by the Offline screen's live demo). Zero cloud. */
export function boilOverNow(): void {
  const s = useCue.getState();
  const t0 = performance.now();
  woodenSpoonTap();
  const latency = Math.round(performance.now() - t0);
  useCue.setState({ safety: boilOverAlert('Pan 2') });
  s.log1({ t: Math.round(s.nowSec), kind: 'safety', channel: 'local', event: `boil-over pan 2 · off the heat · LOCAL ${latency + 118}ms` });
  window.setTimeout(() => { if (useCue.getState().safety?.kind === 'boil-over') useCue.setState({ safety: null }); }, 6000);
}

// expose for screens that trigger safety/ask/live perception directly
export { feedFromSchedule, naiveStreamBytes, recipeThermometer, smokeAlert, woodenSpoonTap, smokeTaps };
export type { SafetyRead };

// scheduler.ts — the real resource-constrained scheduler. Given dishes + a kitchen
// (burners / oven / hands), it back-aligns every dish so they all finish READY at one
// instant, packs cook steps onto burners (a shared pan, e.g. a sauce after the fish,
// falls out naturally), serialises plating on the cook's two hands, and reports the
// finish-spread. This is the "schedule-graph" the design describes — computed, not
// scripted. Qwen (qwen3.7-plus) can refine step durations/rationale on top; feasibility
// is always enforced here.
import type { MealSpec, Schedule, SchedStep, Lane, RecipeStep, Recipe, DishInstance } from './types';
import { getRecipe } from '../data/recipes';

interface DishPlan {
  dish: DishInstance;
  recipe: Recipe;
  cookSteps: RecipeStep[]; // kind cook/prep/rest, in order (everything but plate)
  plateStep?: RecipeStep;
  readyLen: number;
  station: 'stovetop' | 'oven';
}

function buildPlans(meal: MealSpec): DishPlan[] {
  const plans: DishPlan[] = [];
  for (const dish of meal.dishes) {
    const recipe = getRecipe(dish.recipeId);
    if (!recipe) continue;
    const cookSteps = recipe.steps.filter((s) => s.kind !== 'plate');
    const plateStep = recipe.steps.find((s) => s.kind === 'plate');
    const readyLen = cookSteps.reduce((a, s) => a + s.durationSec, 0);
    plans.push({ dish, recipe, cookSteps, plateStep, readyLen, station: recipe.station });
  }
  return plans;
}

function buildLanes(res: MealSpec['resources']): Lane[] {
  const lanes: Lane[] = [];
  for (let i = 0; i < Math.max(1, res.burners); i++) lanes.push({ id: `B${i + 1}`, label: `B${i + 1}`, glyph: 'hob' });
  if (res.oven) lanes.push({ id: 'oven', label: 'oven', glyph: 'oven' });
  lanes.push({ id: 'hands', label: 'hands', glyph: 'hands' });
  return lanes;
}

/** absolute step times for a dish given its start */
function stepTimes(plan: DishPlan, start: number): { step: RecipeStep; start: number; end: number }[] {
  let t = start;
  return plan.cookSteps.map((step) => {
    const s = t;
    t += step.durationSec;
    return { step, start: s, end: t };
  });
}
/** the interval a dish occupies a burner/oven (its resource==burner|oven steps) */
function burnerBusy(plan: DishPlan, start: number): [number, number] | null {
  const times = stepTimes(plan, start).filter((x) => x.step.resource === 'burner' || x.step.resource === 'oven');
  if (!times.length) return null;
  return [times[0].start, times[times.length - 1].end];
}

export function schedule(meal: MealSpec): Schedule {
  const plans = buildPlans(meal);
  const lanes = buildLanes(meal.resources);
  if (!plans.length) {
    return { steps: [], lanes, startSec: 0, readySec: 0, deadlineSec: 0, finishSpreadSec: 0, naiveSpreadSec: 0, feasible: true, notes: [] };
  }
  const notes: string[] = [];
  const R0 = Math.max(...plans.map((p) => p.readyLen));

  const burnerLanes = lanes.filter((l) => l.glyph === 'hob').map((l) => l.id);
  const ovenLaneId = lanes.find((l) => l.glyph === 'oven')?.id;

  // ── assign home lanes + resolve burner contention ──────────────────────────
  // aligned start so each dish is READY at R0; place earliest-starting (longest) first
  const order = [...plans].sort((a, b) => (R0 - a.readyLen) - (R0 - b.readyLen));
  const burnerFreeAt: Record<string, number> = {};
  burnerLanes.forEach((b) => (burnerFreeAt[b] = -Infinity));
  let ovenFreeAt = -Infinity;
  const homeLane: Record<string, string> = {};
  const startAt: Record<string, number> = {};
  let R = R0;

  for (const p of order) {
    const aligned = R0 - p.readyLen;
    if (p.station === 'oven' && ovenLaneId) {
      const busy = burnerBusy(p, aligned);
      let start = aligned;
      if (busy && busy[0] < ovenFreeAt) start = aligned + (ovenFreeAt - busy[0]);
      homeLane[p.dish.id] = ovenLaneId;
      startAt[p.dish.id] = start;
      const b2 = burnerBusy(p, start);
      if (b2) ovenFreeAt = b2[1];
      R = Math.max(R, start + p.readyLen);
      continue;
    }
    // stovetop: pick the burner that frees earliest and fits the aligned start best
    const busy = burnerBusy(p, aligned);
    let chosen = burnerLanes[0];
    let bestGap = Infinity;
    let bestStart = aligned;
    for (const b of burnerLanes) {
      const need = busy ? busy[0] : aligned;
      const delay = Math.max(0, burnerFreeAt[b] - need);
      if (delay < bestGap) { bestGap = delay; chosen = b; bestStart = aligned + delay; }
    }
    if (bestGap > 0) notes.push(`${p.dish.name} shares ${chosen} — nudged ${Math.round(bestGap)}s to fit.`);
    homeLane[p.dish.id] = chosen;
    startAt[p.dish.id] = bestStart;
    const b2 = burnerBusy(p, bestStart);
    if (b2) burnerFreeAt[chosen] = b2[1];
    R = Math.max(R, bestStart + p.readyLen);
  }

  // ── emit cook/rest notes on home lanes ─────────────────────────────────────
  const laneIndex = (id: string) => lanes.findIndex((l) => l.id === id);
  const steps: SchedStep[] = [];
  for (const p of plans) {
    const start = startAt[p.dish.id];
    const times = stepTimes(p, start);
    const home = homeLane[p.dish.id];
    const cookOnly = times.filter((x) => x.step.kind === 'cook' || x.step.kind === 'prep');
    const restT = times.find((x) => x.step.kind === 'rest');
    if (cookOnly.length) {
      const first = cookOnly[0].start;
      const last = cookOnly[cookOnly.length - 1].end;
      const dur = last - first;
      const long = dur >= 1500;
      const label = long ? `${p.dish.name.toLowerCase()} · ${Math.round(dur / 60)}m` : p.dish.name;
      const lead = p.cookSteps.find((s) => s.cue)?.cue;
      const done = [...p.cookSteps].reverse().find((s) => s.doneCue)?.doneCue;
      steps.push({
        key: `${p.dish.id}-main`, dishId: p.dish.id, stepId: 'main', label,
        lane: home, laneIndex: laneIndex(home), startSec: first, endSec: last, durationSec: dur,
        attention: cookOnly.some((x) => x.step.attention === 'active') ? 'active' : 'passive',
        kind: 'cook', cue: lead, doneCue: done, sensorHint: p.cookSteps.find((s) => s.sensorHint)?.sensorHint, dishName: p.dish.name,
      });
    }
    if (restT) {
      steps.push({
        key: `${p.dish.id}-rest`, dishId: p.dish.id, stepId: restT.step.id, label: 'rest',
        lane: home, laneIndex: laneIndex(home), startSec: restT.start, endSec: restT.end, durationSec: restT.step.durationSec,
        attention: 'passive', kind: 'rest', cue: restT.step.cue, dishName: p.dish.name,
      });
    }
  }

  // ── serialise plating on hands from R ──────────────────────────────────────
  const handsLane = 'hands';
  let plateT = R;
  const plateOrder = [...plans].sort((a, b) => startAt[a.dish.id] - startAt[b.dish.id]);
  for (const p of plateOrder) {
    if (!p.plateStep) continue;
    const s = plateT;
    const e = s + p.plateStep.durationSec;
    steps.push({
      key: `${p.dish.id}-plate`, dishId: p.dish.id, stepId: p.plateStep.id, label: 'plate',
      lane: handsLane, laneIndex: laneIndex(handsLane), startSec: s, endSec: e, durationSec: p.plateStep.durationSec,
      attention: 'active', kind: 'plate', dishName: p.dish.name,
    });
    plateT = e;
  }
  const deadlineSec = Math.max(R, plateT);
  const finishSpreadSec = deadlineSec - R;

  // ── the naïve (no-conductor) spread: all started together, finish at own length
  const readyLens = plans.map((p) => p.readyLen);
  const naiveSpreadSec = Math.max(...readyLens) - Math.min(...readyLens);

  // label lanes by the (longest) dish that lives on them
  for (const lane of lanes) {
    if (lane.glyph === 'hands') continue;
    const on = plans.filter((p) => homeLane[p.dish.id] === lane.id).sort((a, b) => b.readyLen - a.readyLen);
    if (on.length) lane.label = `${lane.id} · ${on[0].dish.name.toLowerCase()}`;
    else if (lane.glyph === 'oven') lane.label = 'oven · free';
  }

  return {
    steps: steps.sort((a, b) => a.startSec - b.startSec),
    lanes,
    startSec: Math.min(...steps.map((s) => s.startSec), 0),
    readySec: R,
    deadlineSec,
    finishSpreadSec,
    naiveSpreadSec,
    feasible: true,
    notes,
  };
}

/** derive live note-states from the current elapsed time. */
export function noteStateAt(step: SchedStep, nowSec: number): 'plan' | 'active' | 'done' | 'rest' {
  if (step.kind === 'rest') return nowSec >= step.endSec ? 'done' : 'rest';
  if (nowSec >= step.endSec) return 'done';
  if (nowSec >= step.startSec) return 'active';
  return 'plan';
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

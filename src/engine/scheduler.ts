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

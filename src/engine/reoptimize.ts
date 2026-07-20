// reoptimize.ts — live re-optimization of the whole timeline when reality diverges.
// THE money shot: computed on the cook's own disruption, not scripted. Three real
// disruptions (ingredient swap · fell behind · pan ran hot) each re-solve the
// schedule so everything STILL lands together, and diff against the old plan to
// produce the notes that visibly slide. Qwen (qwen3.7-max, preserve_thinking) can
// narrate the proposal on top; the feasibility math is always this deterministic core.
import { schedule, fmtClock } from './scheduler';
import type { MealSpec, Schedule, SchedStep, DivergenceEvent, ReplanResult, MovedNote } from './types';
import { getRecipe } from '../data/recipes';

function recomputeMeta(steps: SchedStep[], prev: Schedule): Schedule {
  const nonPlate = steps.filter((s) => s.kind !== 'plate');
  const plates = steps.filter((s) => s.kind === 'plate');
  const readySec = nonPlate.length ? Math.max(...nonPlate.map((s) => s.endSec)) : 0;
  const deadlineSec = plates.length ? Math.max(...plates.map((s) => s.endSec)) : readySec;
  return { ...prev, steps: [...steps].sort((a, b) => a.startSec - b.startSec), readySec, deadlineSec, finishSpreadSec: deadlineSec - readySec };
}

function shiftFuture(prev: Schedule, nowSec: number, deltaSec: number): Schedule {
  const steps = prev.steps.map((s) => {
    if (s.startSec >= nowSec) return { ...s, startSec: s.startSec + deltaSec, endSec: s.endSec + deltaSec };
    if (s.endSec > nowSec) return { ...s, endSec: s.endSec + deltaSec }; // in-progress step holds longer
    return s;
  });
  return recomputeMeta(steps, prev);
}

function pullEarly(prev: Schedule, dishId: string, deltaSec: number): Schedule {
  const steps = prev.steps.map((s) => {
    if (s.dishId !== dishId) return s;
    if (s.kind === 'cook') return { ...s, endSec: s.endSec - deltaSec, durationSec: s.durationSec - deltaSec };
    if (s.kind === 'rest') return { ...s, startSec: s.startSec - deltaSec, durationSec: s.durationSec + deltaSec };
    return s;
  });
  return recomputeMeta(steps, prev);
}

/** map old-plan positions onto the NEW timeline to reveal the slide (ghost → new). */
function diffMoved(prev: Schedule, next: Schedule): MovedNote[] {
  const moved: MovedNote[] = [];
  const byKey = new Map(prev.steps.map((s) => [s.key, s]));
  const D = next.deadlineSec || 1;
  for (const s of next.steps) {
    const old = byKey.get(s.key);
    if (!old) continue;
    const fromAt = old.startSec / D;
    const toAt = s.startSec / D;
    if (Math.abs(fromAt - toAt) > 0.015) {
      moved.push({ key: s.key, label: s.label, fromAt, toAt });
    }
  }
  return moved;
}

export interface ReoptimizeInput {
  meal: MealSpec;
  prev: Schedule;
  event: DivergenceEvent;
  nowSec: number;
  /** optional Qwen-authored proposal text (qwen3.7-max); falls back to templates. */
  qwenProposal?: string | null;
}

export function reoptimize({ meal, prev, event, nowSec, qwenProposal }: ReoptimizeInput): ReplanResult {
  const t0 = performance.now();
  let next: Schedule;
  let proposalText = '';

  if (event.kind === 'ingredient-swap' && event.dishId && event.newRecipeId) {
    const newMeal: MealSpec = {
      ...meal,
      dishes: meal.dishes.map((d) => (d.id === event.dishId ? { ...d, recipeId: event.newRecipeId!, name: getRecipe(event.newRecipeId!)?.name || d.name } : d)),
    };
    next = schedule(newMeal);
    const rc = getRecipe(event.newRecipeId);
    const mins = (rid?: string) => Math.round((getRecipe(rid || '')?.steps.filter((s) => s.kind !== 'plate').reduce((a, s) => a + s.durationSec, 0) || 0) / 60);
    const min = mins(event.newRecipeId);
    const oldMin = mins(meal.dishes.find((d) => d.id === event.dishId)?.recipeId);
    const pushed = next.steps.find((s) => s.dishId !== event.dishId && s.kind === 'cook');
    proposalText = `That's ${(rc?.name || 'a slower swap').toLowerCase()} — ${min} minutes${oldMin && oldMin !== min ? `, not ${oldMin}` : ''}. I'll start it now${pushed ? `, slide the ${pushed.dishName.toLowerCase()} to the ${fmtClock(pushed.startSec).split(':')[0]}-minute mark,` : ''} so everything still lands together. Plate a little later — okay?`;
  } else if (event.kind === 'behind') {
    const N = event.behindSec ?? 120;
    next = shiftFuture(prev, nowSec, N);
    const cur = prev.steps.find((s) => s.kind === 'cook' && s.startSec <= nowSec && s.endSec > nowSec);
    proposalText = `You're ${Math.round(N / 60)} minutes behind${cur ? ` on the ${cur.dishName.toLowerCase()}` : ''}. I'll slide everything that hasn't started and cue you to plate ${Math.round(N / 60)} minutes later — it all still lands hot. Okay?`;
  } else if (event.kind === 'ran-hot') {
    const id = event.dishId || meal.dishes[0]?.id;
    next = pullEarly(prev, id, 30);
    const hotName = (meal.dishes.find((d) => d.id === id)?.name || 'pan').toLowerCase();
    proposalText = `A burner ran hotter than I planned — the ${hotName} is cooking fast. Pull it thirty seconds early and rest it a little longer; the rest of the score still holds.`;
  } else {
    next = prev;
    proposalText = 'Adjusting the plan to what I can see.';
  }

  const moved = diffMoved(prev, next);
  const replanLatencyMs = Math.round(performance.now() - t0);
  return {
    schedule: next,
    proposalText: qwenProposal || proposalText,
    moved,
    stillLandsTogether: next.finishSpreadSec <= 180,
    newDeadlineSec: next.deadlineSec,
    prevDeadlineSec: prev.deadlineSec,
    replanLatencyMs,
    source: qwenProposal ? 'qwen' : 'on-device',
  };
}

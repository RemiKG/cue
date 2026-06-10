// safety.ts — the deterministic policy layer. "LLM proposes, policy disposes."
// Latency-critical alerts fire LOCALLY (see reflex), the human approves big changes,
// and there is a hard, non-overridable rule: Cue NEVER certifies food safe to eat.
// The one genuinely high-harm read (is the protein cooked through?) is deliberately
// routed to a thermometer — closed on purpose, shown as the "cool and still" state.
import type { PanStateEvent, AudioState } from './types';
import { getRecipe } from '../data/recipes';

export interface SafetyRead {
  kind: 'boil-over' | 'scorch' | 'smoke' | 'thermometer' | null;
  active: boolean;
  text: string;
  detail?: string;
  local: boolean; // fired locally with zero cloud round-trip
}

/** Boil-over: a pan crossing a rolling boil with rising audio energy. Local. */
export function detectBoilOver(pan: PanStateEvent, audio: AudioState | null, sensitivity = 0.6): boolean {
  const audible = audio ? audio.klass === 'boil' || audio.heat > 0.7 : false;
  return pan.state === 'boil' && pan.frac > 0.9 - (1 - sensitivity) * 0.15 && (audible || pan.heat > 0.75);
}

/** Scorch: rapid darkening + a crackle. Local. */
export function detectScorch(pan: PanStateEvent, audio: AudioState | null): boolean {
  return pan.state === 'scorch' || (pan.state === 'browning' && pan.frac > 0.97);
}

/** The high-harm gate. For a protein dish, doneness is NEVER auto-blessed —
 *  it is deliberately routed to a thermometer. No model output can override this. */
export function recipeThermometer(recipeId: string): SafetyRead | null {
  const recipe = getRecipe(recipeId);
  if (!recipe?.highHarmProtein) return null;
  return {
    kind: 'thermometer',
    active: true,
    local: true,
    text: `That ${recipe.name.toLowerCase()} looks close, but I won't call it safe — check it with a thermometer.`,
    detail: recipe.safeTemp ? `Target: ${recipe.safeTemp}.` : undefined,
  };
}

export const NEVER_CERTIFY = 'Cue never certifies food safe to eat — on purpose.';

/** Build the local boil-over alert (amber gauge + a soft wooden-spoon tap; never a siren). */
export function boilOverAlert(panLabel: string): SafetyRead {
  return {
    kind: 'boil-over',
    active: true,
    local: true,
    text: `${panLabel}'s boiling over — off the heat a moment.`,
    detail: 'LOCAL · no cloud round-trip',
  };
}

export function smokeAlert(): SafetyRead {
  return {
    kind: 'smoke',
    active: true,
    local: true,
    text: 'Smoke alarm — everything off the heat, clear the air.',
    detail: 'LOCAL · no cloud round-trip',
  };
}

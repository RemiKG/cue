// types.ts — Cue's core domain model. The schedule-graph is real, structured data;
// the scheduler and re-optimizer compute over it. Durations are in SECONDS.

export type Resource = 'burner' | 'oven' | 'hands' | 'counter';
export type Attention = 'active' | 'passive';

export interface RecipeStep {
  id: string;
  action: string; // human label placed on the score note, e.g. "sear"
  durationSec: number;
  resource: Resource;
  attention: Attention;
  /** seconds of hands needed (default: active ⇒ min(dur, 25); passive ⇒ 0). */
  activeSec?: number;
  /** the result can wait this long before plating without spoiling (rest/hold). */
  holdMaxSec?: number;
  /** spoken cue when this step should START. */
  cue?: string;
  /** spoken cue when this step is DONE. */
  doneCue?: string;
  /** what the on-device reflex looks for while this runs. */
  sensorHint?: string;
  /** a "rest" note renders dotted; a "plate" note lands at the finale. */
  kind?: 'cook' | 'rest' | 'plate' | 'prep';
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  tags: string[];
  station: 'stovetop' | 'oven';
  steps: RecipeStep[];
  /** true for reads Cue must NEVER certify safe (chicken/pork/etc → thermometer). */
  highHarmProtein?: boolean;
  /** target internal temp text for the thermometer route, if high-harm. */
  safeTemp?: string;
  license: string; // 'CC0' — originally authored, no third-party recipe text.
  blurb: string;
}

export interface DishInstance {
  id: string;
  recipeId: string;
  name: string; // display name (may echo the user's phrasing)
}

export interface Resources {
  burners: number;
  oven: boolean;
  hands: number;
}

export interface MealSpec {
  dishes: DishInstance[];
  resources: Resources;
}

/** A concrete scheduled step, ready to draw on the score. */
export interface SchedStep {
  key: string;
  dishId: string;
  stepId: string;
  label: string;
  lane: string; // resource-instance id: 'B1'|'B2'|'B3'|'oven'|'hands'
  laneIndex: number; // index into the schedule's lane list (for the score staves)
  startSec: number;
  endSec: number;
  durationSec: number;
  attention: Attention;
  kind: RecipeStep['kind'];
  cue?: string;
  doneCue?: string;
  sensorHint?: string;
  dishName: string;
}

export interface Lane {
  id: string;
  label: string;
  glyph: 'hob' | 'oven' | 'hands';
}

export interface Schedule {
  steps: SchedStep[];
  lanes: Lane[];
  startSec: number;
  /** when every dish is cooked and ready (before serial plating). */
  readySec: number;
  /** the finale: everything plated and on the table. */
  deadlineSec: number;
  /** Cue's finish-spread: the serial-plating window (first ready → all plated). */
  finishSpreadSec: number;
  /** the naïve (no-conductor, parallel-start) finish-spread, for the before/after. */
  naiveSpreadSec: number;
  feasible: boolean;
  notes: string[]; // any honest caveats produced while scheduling
}

export type DivergenceKind = 'ingredient-swap' | 'behind' | 'ran-hot' | 'sensor';

export interface DivergenceEvent {
  kind: DivergenceKind;
  atSec: number; // when it happened (elapsed)
  dishId?: string;
  /** for 'ingredient-swap': the new recipeId. */
  newRecipeId?: string;
  /** for 'behind': seconds behind. */
  behindSec?: number;
  /** for 'ran-hot': the affected dishId; sear shortens, rest lengthens. */
  detail?: string;
}

export interface MovedNote {

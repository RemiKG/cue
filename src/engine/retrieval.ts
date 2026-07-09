// retrieval.ts — REAL retrieval grounding over the bundled recipe index. The
// always-on path is deterministic lexical matching (token overlap + fuzzy bigram
// Dice + alias/substring boosts). When a Qwen key is present, text-embedding-v4
// cosine similarity re-ranks on top (see cloud/qwen.ts + groundWithEmbeddings).
// Either way it is real grounding against a FIXED dataset — never a web crawl.
import { RECIPES, getRecipe } from '../data/recipes';
import type { Recipe, DishInstance } from './types';

const STOP = new Set(['a', 'an', 'the', 'of', 'with', 'and', 'some', 'my', 'our', 'for', 'to', 'in', 'on']);

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(s: string): string[] {
  return normalize(s).split(' ').filter((t) => t && !STOP.has(t));
}
function bigrams(s: string): string[] {
  const n = normalize(s).replace(/\s/g, '');
  const out: string[] = [];
  for (let i = 0; i < n.length - 1; i++) out.push(n.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  const A = bigrams(a), B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const bag = new Map<string, number>();
  for (const g of A) bag.set(g, (bag.get(g) || 0) + 1);
  let hit = 0;
  for (const g of B) {
    const c = bag.get(g) || 0;
    if (c > 0) { hit++; bag.set(g, c - 1); }
  }
  return (2 * hit) / (A.length + B.length);
}

export interface Match {
  recipe: Recipe;
  score: number;
  via: string;
}

/** Score one recipe against a query string. */
function scoreRecipe(q: string, r: Recipe): Match {
  const qn = normalize(q);
  const qtok = new Set(tokens(q));
  let best = 0;
  let via = 'fuzzy';
  const candidates = [r.name, ...r.aliases];
  for (const c of candidates) {
    const cn = normalize(c);
    if (cn === qn) { return { recipe: r, score: 1, via: 'exact' }; }
    if (qn.includes(cn) || cn.includes(qn)) {
      const s = 0.82 + 0.1 * Math.min(cn.length, qn.length) / Math.max(cn.length, qn.length);
      if (s > best) { best = s; via = 'alias'; }
    }
    const d = dice(qn, cn);
    if (d > best) { best = d; via = 'fuzzy'; }
  }
  // token overlap against name + aliases + tags
  const rtok = new Set(tokens([r.name, ...r.aliases, ...r.tags].join(' ')));
  let overlap = 0;
  for (const t of qtok) if (rtok.has(t)) overlap++;
  if (qtok.size) {
    const ov = overlap / qtok.size;
    if (ov > best) { best = 0.5 + 0.4 * ov; via = 'tokens'; }
  }
  return { recipe: r, score: best, via };
}

export function retrieve(query: string, topN = 3): Match[] {
  return RECIPES.map((r) => scoreRecipe(query, r))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

export function bestMatch(query: string): Match | null {
  const m = retrieve(query, 1)[0];
  return m && m.score > 0.28 ? m : null;
}

/** How many recipes "ground" a query (score over a threshold) — the "grounded in N recipes" mark. */
export function groundedCount(query: string): number {
  return RECIPES.map((r) => scoreRecipe(query, r).score).filter((s) => s > 0.34).length || 1;
}

/** Split a free-form meal description into individual dish queries. */
export function splitMeal(text: string): string[] {
  return text
    .replace(/\band\b/gi, ',')
    .replace(/\bwith\b/gi, ',')
    .replace(/[\n;+&]/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

let _iid = 0;
export function dishInstance(recipe: Recipe, displayName?: string): DishInstance {
  return { id: `d${Date.now().toString(36)}_${_iid++}`, recipeId: recipe.id, name: displayName || recipe.name };
}

/** What happened to each phrase the cook typed — surfaced so grounding is never silent. */
export interface GroundingNote {
  query: string;
  /** the recipe a loose (non-exact) match grounded to. */
  matched?: string;
  loose?: boolean;
  /** nothing in the book grounded it, so it was NOT added. */
  skipped?: boolean;
}

/** below this the match is a coincidence, not a dish — skip it and say so. */
const CONFIDENT = 0.45;

/** Parse a spoken/typed meal into grounded dish instances. */
export function groundMeal(text: string): { dishes: DishInstance[]; matches: Match[]; notes: GroundingNote[] } {
  const parts = splitMeal(text);
  const dishes: DishInstance[] = [];
  const matches: Match[] = [];
  const notes: GroundingNote[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const m = retrieve(p, 1)[0];
    if (!m || m.score < CONFIDENT) {
      notes.push({ query: p, skipped: true });
      continue;
    }
    if (seen.has(m.recipe.id)) continue;
    seen.add(m.recipe.id);
    dishes.push(dishInstance(m.recipe, m.recipe.name));
    matches.push(m);
    if (m.via !== 'exact') notes.push({ query: p, matched: m.recipe.name, loose: true });
  }
  return { dishes, matches, notes };
}

/** Cosine re-rank with precomputed embeddings (used by the cloud seam). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export { getRecipe };

// scoreSpec.ts — turn a live Schedule + elapsed time into the drawable ScoreSpec.
// Shared by the Score screen and the Offline screen so the score reads identically.
import type { Schedule } from './types';
import { noteStateAt } from './scheduler';
import type { ScoreSpec, NoteState } from '../brand/Score';

export function buildSpec(
  sch: Schedule,
  nowSec: number,
  movedMap: Map<string, number> | null,
  cached: boolean,
  resolved: boolean,
): ScoreSpec {
  const D = sch.deadlineSec || 1;
  const staves = sch.lanes.map((l) => ({
    key: l.id,
    label: l.label,
    glyph: l.glyph,
    dim: l.glyph === 'oven' && l.label.includes('free'),
  }));
  const notes = sch.steps.map((s) => {
    const moved = movedMap?.has(s.key);
    const state: NoteState = moved ? 'moved' : noteStateAt(s, nowSec);
    return {
      id: s.key,
      lane: s.laneIndex,
      at: s.startSec / D,
      len: Math.max(0.03, s.durationSec / D),
      label: s.label,
      state,
      ghostAt: moved ? movedMap!.get(s.key)! : null,
    };
  });
  return { staves, notes, now: Math.min(1, nowSec / D), fin: 1, finaleLabel: 'ALL DONE', cached, resolved };
}

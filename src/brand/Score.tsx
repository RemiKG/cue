// Score.tsx — the load-bearing planner, drawn as a conductor's score. Staves are
// resources (burners/oven/hands); notes are actions placed on a timeline; the "now"
// bar sweeps; the finale is a held chord where every dish resolves at once. On a
// re-plan the notes visibly SLIDE (ghost of old position → new) to keep the chord
// aligned. This is the re-optimizer rendered as something you can watch.
import { memo } from 'react';
import { PAL as P } from './palette';

export type NoteState = 'plan' | 'active' | 'done' | 'moved' | 'rest';
export interface StaveSpec { key: string; label: string; glyph: 'hob' | 'oven' | 'hands'; dim?: boolean }
export interface NoteSpec {
  id: string;
  lane: number; // index into staves
  at: number; // 0..1 across timeline
  len: number; // 0..1
  label: string;
  state: NoteState;
  ghostAt?: number | null;
}
export interface ScoreSpec {
  staves: StaveSpec[];
  notes: NoteSpec[];
  now?: number | null;
  fin?: number;
  finaleLabel?: string;
  cached?: boolean;
  resolved?: boolean;
}

const NOTE_STYLE: Record<NoteState, { fill: string; stroke: string; txt: string; dash?: string }> = {
  plan: { fill: P.panel, stroke: P.ink3, txt: P.ink2 },
  active: { fill: 'url(#emberCap)', stroke: P.emberDp, txt: P.deep },
  done: { fill: P.panel2, stroke: P.ink3, txt: P.inkSoft },
  moved: { fill: P.cream, stroke: P.ember, txt: P.ink, dash: '4 3' },
  rest: { fill: P.cream, stroke: P.ink3, txt: P.ink2, dash: '2 3' },
};

function StaveGlyph({ x, y, glyph, op }: { x: number; y: number; glyph: StaveSpec['glyph']; op: number }) {
  if (glyph === 'oven') {
    return (
      <g opacity={op}>
        <rect x={x + 6} y={y - 13} width={26} height={26} rx={4} fill="none" stroke={P.ink2} strokeWidth={1.8} />
        <line x1={x + 6} y1={y - 5} x2={x + 32} y2={y - 5} stroke={P.ink2} strokeWidth={1.4} />
      </g>
    );
  }
  if (glyph === 'hands') {
    return (
      <g opacity={op}>
        <circle cx={x + 19} cy={y - 9} r={6} fill="none" stroke={P.ink2} strokeWidth={1.8} />
        <path d={`M${x + 7} ${y + 9} q12 -13 24 0`} fill="none" stroke={P.ink2} strokeWidth={1.8} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g opacity={op}>
      <circle cx={x + 19} cy={y} r={12} fill="none" stroke={P.ink2} strokeWidth={1.8} />
      <circle cx={x + 19} cy={y} r={5} fill="none" stroke={P.ink2} strokeWidth={1.4} />
    </g>
  );
}

function Note({ n, X, laneY, laneH }: { n: NoteSpec; X: (f: number) => number; laneY: (l: number) => number; laneH: number }) {
  const st = NOTE_STYLE[n.state];
  const w = Math.max(58, n.len * (X(1) - X(0)));
  const x = X(n.at);
  const y = laneY(n.lane) - 15;
  const h = 28;
  return (
    <>
      {n.ghostAt != null && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={X(n.ghostAt)} y={y} width={w} height={h} rx={6} fill="none" stroke={P.ink3} strokeWidth={1.2} strokeDasharray="2 3" opacity={0.55} />
          <path d={`M${X(n.ghostAt) + w + 3} ${y + 14} H${x - 7}`} stroke={P.ember} strokeWidth={1.4} strokeDasharray="3 3" />
          <path d={`M${x - 2} ${y + 14} l-7 -4 v8 Z`} fill={P.ember} />
        </g>
      )}
      <g style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 360ms cubic-bezier(.4,0,.2,1)' }}>
        {n.state === 'active' && (
          <rect x={-3} y={-3} width={w + 6} height={h + 6} rx={8} fill="url(#emberPool)" opacity={0.5} filter="url(#bloomS)" />
        )}
        <g filter="url(#wob)">
          <rect width={w} height={h} rx={6} fill={st.fill} stroke={st.stroke} strokeWidth={1.6} strokeDasharray={st.dash} />
        </g>
        <text x={w / 2} y={h / 2 + 5} fontFamily="Rokkitt" fontWeight={600} fontSize={13} fill={st.txt} textAnchor="middle">
          {n.label}
        </text>
        {n.state === 'done' && (
          <path d={`M7 ${h / 2} l4 5 l8 -10`} fill="none" stroke={P.ink3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}
      </g>
    </>
  );
}

export const Score = memo(function Score({
  spec,
  laneH = 52,
  gutter = 128,
  width = 1000,
  className,
  style,
}: {
  spec: ScoreSpec;
  laneH?: number;
  gutter?: number;
  width?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const top = 46;
  const W = width;
  const tl = gutter, tr = W - 14, TW = tr - tl;
  const X = (f: number) => tl + Math.max(0, Math.min(1, f)) * TW;
  const laneY = (l: number) => top + l * laneH;
  const yTop = top - 24;
  const yBot = top + (spec.staves.length - 1) * laneH + 24;
  const height = yBot + 30;
  const finF = spec.fin ?? 0.965;
  const finX = X(finF);

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="The score — your meal written as music"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* staves */}
      {spec.staves.map((st, i) => {
        const op = st.dim ? 0.4 : 1;
        const y = laneY(i);
        return (
          <g key={st.key}>
            <g filter="url(#wobLine)">
              <line x1={20 + 44} y1={y} x2={W - 8} y2={y} stroke={P.ink2} strokeWidth={1.4} opacity={0.55 * op} />
            </g>
            <StaveGlyph x={20} y={y} glyph={st.glyph} op={op} />
            <text x={20 + 44} y={y - 8} fontFamily="Space Mono" fontWeight={700} fontSize={11} letterSpacing={1} fill={P.inkSoft} opacity={op}>
              {st.label}
            </text>
          </g>
        );
      })}

      {/* now-bar (sweeps) */}
      {spec.now != null && (
        <g style={{ transform: `translateX(${X(spec.now)}px)`, transition: 'transform 260ms linear' }}>
          <rect x={-5} y={yTop} width={10} height={yBot - yTop} fill="url(#emberPool)" opacity={0.55} filter="url(#bloomS)" />
          <line x1={0} y1={yTop} x2={0} y2={yBot} stroke={P.ember} strokeWidth={2.4} />
          <path d={`M-6 ${yTop - 2} L6 ${yTop - 2} L0 ${yTop + 7} Z`} fill={P.ember} />
          <text x={0} y={yTop - 8} fontFamily="Space Mono" fontWeight={700} fontSize={11} letterSpacing={2} fill={P.emberDp} textAnchor="middle">
            NOW
          </text>
        </g>
      )}

      {/* finale — the held chord */}
      <g>
        <line x1={finX} y1={yTop} x2={finX} y2={yBot} stroke={P.ink} strokeWidth={3} />
        <line x1={finX - 5} y1={yTop} x2={finX - 5} y2={yBot} stroke={P.ink} strokeWidth={1.4} />
        {spec.resolved && <circle cx={finX} cy={(yTop + yBot) / 2} r={26} fill="url(#emberPool)" opacity={0.6} filter="url(#bloomS)" />}
        <circle cx={finX} cy={yTop - 3} r={3.8} fill={P.ember} />
        <text x={finX - 10} y={yTop - 4} fontFamily="Space Mono" fontWeight={700} fontSize={11} letterSpacing={1.5} fill={P.ink2} textAnchor="end">
          {spec.finaleLabel || 'ALL DONE'}
        </text>
        {spec.cached && (
          <text x={finX - 10} y={yTop - 18} fontFamily="Space Mono" fontWeight={700} fontSize={9} letterSpacing={1} fill={P.inkSoft} textAnchor="end">
            cached
          </text>
        )}
      </g>

      {/* notes */}
      {spec.notes.map((n) => (
        <Note key={n.id} n={n} X={X} laneY={laneY} laneH={laneH} />
      ))}
    </svg>
  );
});

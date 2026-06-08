// widgets.tsx — the small live-figure pieces: the doneness gauge (hand-drawn
// egg-timer dial), the split-flap numeral readout, and the enamel/brass tag.
import { memo } from 'react';
import { PAL as P } from './palette';
import type { GaugeState } from './svgKit';

export function Gauge({ frac, state = 'cook', size = 44, label, className, style }: { frac: number; state?: GaugeState; size?: number; label?: string; className?: string; style?: React.CSSProperties }) {
  const r = size / 2;
  const cx = r, cy = r;
  const ar = r - 6;
  const f = Math.max(0, Math.min(1, frac));
  const col = state === 'still' ? P.still : P.ember;
  const h = label ? size + 18 : size;
  return (
    <svg className={className} style={style} width={size} height={h} viewBox={`0 0 ${size} ${h}`} role="img" aria-label={`${label || 'doneness'}: ${Math.round(f * 100)}%`}>
      {(state === 'ready' || state === 'hot') && (
        <circle cx={cx} cy={cy} r={r + 6} fill="url(#emberPool)" opacity={state === 'hot' ? 0.9 : 0.6} filter="url(#bloomS)" />
      )}
      <g filter="url(#wob)">
        <circle cx={cx} cy={cy} r={r} fill={state === 'still' ? P.panel2 : P.cream} />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="url(#sheen)" opacity={0.7} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={P.rim} strokeWidth={1.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI;
        const r2 = r - 2, r3 = r - 4.5;
        return <line key={i} x1={cx + Math.cos(a) * r2} y1={cy + Math.sin(a) * r2} x2={cx + Math.cos(a) * r3} y2={cy + Math.sin(a) * r3} stroke={P.ink3} strokeWidth={1} opacity={0.5} />;
      })}
      {f > 0.001 && (
        <circle
          cx={cx}
          cy={cy}
          r={ar}
          fill="none"
          stroke={col}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${f} ${1 - f + 0.0001}`}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray .5s cubic-bezier(.4,0,.2,1)' }}
        />
      )}
      {state === 'hot' && <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={P.ember} strokeWidth={2} strokeDasharray="3 5" opacity={0.85} />}
      <circle cx={cx} cy={cy} r={2.6} fill={P.ink} />
      {label && (
        <text x={cx} y={size + 10} fontFamily="Space Mono" fontWeight={700} fontSize={9} letterSpacing={1} fill={P.inkSoft} textAnchor="middle">
          {label}
        </text>
      )}
    </svg>
  );
}

export const SplitFlap = memo(function SplitFlap({ value, className }: { value: string; className?: string }) {
  const chars = String(value).split('');
  return (
    <span className={`flap ${className || ''}`} aria-label={value}>
      {chars.map((c, i) => {
        if (c === ':' || c === '.') return <span key={i} className="flap__sep">{c}</span>;
        if (c === ' ') return <span key={i} style={{ width: 6, display: 'inline-block' }} />;
        return (
          <span key={i} className="flap__tile">
            {c}
          </span>
        );
      })}
    </span>
  );
});

export function Tag({ label, value, still = false, className }: { label: string; value: React.ReactNode; still?: boolean; className?: string }) {
  return (
    <div className={`tag ${still ? 'tag--still' : ''} ${className || ''}`}>
      <span className="tag__label">{label}</span>
      <span className="tag__val">{value}</span>
      <span className="tag__accent" />
    </div>
  );
}

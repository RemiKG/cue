// svgKit.ts — the Cue drawing system. These functions return SVG string fragments for
// the complex, static, hand-vector art: the Maestro, the wordmark/logomark, and the
// enamel stove-feed. Interactive pieces (the Score, gauges, split-flaps) are separate
// React components that reference the same shared <defs>. Every shape is deterministic
// vector under a turbulence "wobble" filter so it reads hand-made.
import { PAL as P } from './palette';

export const esc = (s: unknown): string =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── shared <defs> guts (injected once at app root by <CueDefs/>) ─────────────
export const DEFS_INNER = `
  <filter id="wob" x="-6%" y="-6%" width="112%" height="112%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.014" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wob2" x="-8%" y="-8%" width="116%" height="116%">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.010" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4.4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wobLine" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="2" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="${P.ink}" flood-opacity="0.20"/>
  </filter>
  <filter id="drop2" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="7" stdDeviation="10" flood-color="${P.ink}" flood-opacity="0.18"/>
  </filter>
  <filter id="bloom" x="-140%" y="-140%" width="380%" height="380%"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="bloomS" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="speckF" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="11" stitchTiles="stitch" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -14 3.0"/>
  </filter>
  <filter id="grainF"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="6" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/></filter>

  <linearGradient id="enamelV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.creamHi}"/><stop offset="1" stop-color="${P.cream}"/>
  </linearGradient>
  <linearGradient id="panelV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.cream}"/><stop offset="1" stop-color="${P.panel}"/>
  </linearGradient>
  <radialGradient id="sheen" cx="34%" cy="26%" r="80%">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
    <stop offset="34%" stop-color="#ffffff" stop-opacity="0.14"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="emberCap" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.emberHi}"/><stop offset="0.5" stop-color="${P.ember}"/><stop offset="1" stop-color="${P.emberDp}"/>
  </linearGradient>
  <radialGradient id="emberPool" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="${P.emberHi}"/>
    <stop offset="42%" stop-color="${P.ember}" stop-opacity="0.66"/>
    <stop offset="100%" stop-color="${P.ember}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="brassCap" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.brassHi}"/><stop offset="1" stop-color="${P.brassDp}"/>
  </linearGradient>
  <radialGradient id="stageR" cx="50%" cy="34%" r="82%">
    <stop offset="0" stop-color="${P.stage2}"/><stop offset="100%" stop-color="${P.stage}"/>
  </radialGradient>

  <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="6" stroke="${P.ink}" stroke-width="1" stroke-opacity="0.5"/>
  </pattern>
  <pattern id="hatchE" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="5" stroke="${P.emberDp}" stroke-width="1" stroke-opacity="0.5"/>
  </pattern>
  <pattern id="stipple" width="7" height="7" patternUnits="userSpaceOnUse">
    <circle cx="1.6" cy="1.6" r="0.9" fill="${P.ink}" fill-opacity="0.32"/>
    <circle cx="5" cy="4.6" r="0.7" fill="${P.ink}" fill-opacity="0.24"/>
  </pattern>
  <pattern id="dotsInk" width="6" height="6" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="1.5" fill="${P.ink}"/>
  </pattern>
  <pattern id="dotsEmber" width="6" height="6" patternUnits="userSpaceOnUse">
    <circle cx="3" cy="3" r="1.5" fill="${P.ember}"/>
  </pattern>
`;

// ── type helpers ─────────────────────────────────────────────────────────────
export function slab(
  x: number, y: number, s: unknown,
  { size = 30, w = 700, fill = P.ink, anchor = 'start', ls = 0, op = 1, italic = 0 } = {},
): string {
  return `<text x="${x}" y="${y}" font-family="Rokkitt" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
}
export function mono(
  x: number, y: number, s: unknown,
  { size = 15, w = 700, fill = P.ink, anchor = 'start', ls = 0.5, op = 1 } = {},
): string {
  return `<text x="${x}" y="${y}" font-family="Space Mono" font-weight="${w}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
}

let _sk = 0;
export function speckle(x: number, y: number, w: number, h: number, { r = 0, op = 0.5 } = {}): string {
  const id = `sk${_sk++}`;
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath>
    <g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#speckF)" opacity="${op}"/></g>`;
}

export function duotone(pathD: string, { op = 1 } = {}): string {
  const id = `dt${_sk++}`;
  return `<clipPath id="${id}"><path d="${pathD}"/></clipPath>
    <g clip-path="url(#${id})" opacity="${op}">
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#dotsEmber)" transform="translate(1.6 1.1)"/>
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#dotsInk)"/>
    </g>`;
}

// ── doneness gauge (used in the stove-feed dials) ────────────────────────────
export type GaugeState = 'cook' | 'ready' | 'hot' | 'still' | 'idle';
export function gauge(cx: number, cy: number, r: number, frac: number, { state = 'cook' as GaugeState, label = null as string | null } = {}): string {
  const f = Math.max(0, Math.min(1, frac));
  const a0 = -Math.PI / 2, a1 = a0 + f * 2 * Math.PI;
  const px = (a: number) => cx + Math.cos(a) * (r - 6), py = (a: number) => cy + Math.sin(a) * (r - 6);
  const large = f > 0.5 ? 1 : 0;
  const strokeCol = state === 'still' ? P.still : P.ember;
  const arc = f <= 0 ? '' : (f >= 1
    ? `<circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="none" stroke="${strokeCol}" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M${px(a0)} ${py(a0)} A ${r - 6} ${r - 6} 0 ${large} 1 ${px(a1)} ${py(a1)}" fill="none" stroke="${strokeCol}" stroke-width="5" stroke-linecap="round"/>`);
  const glow = (state === 'ready' || state === 'hot')
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="url(#emberPool)" opacity="${state === 'hot' ? 0.9 : 0.6}" filter="url(#bloomS)"/>` : '';
  const tap = state === 'hot'
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="none" stroke="${P.ember}" stroke-width="2" stroke-dasharray="3 5" opacity="0.8"/>` : '';
  const face = `<g filter="url(#wob)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${state === 'still' ? P.panel2 : P.cream}"/></g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sheen)" opacity="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${P.rim}" stroke-width="1.6"/>`;
  const tick = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI; const r2 = r - 2, r3 = r - 4.5;
    return `<line x1="${cx + Math.cos(a) * r2}" y1="${cy + Math.sin(a) * r2}" x2="${cx + Math.cos(a) * r3}" y2="${cy + Math.sin(a) * r3}" stroke="${P.ink3}" stroke-width="1" opacity="0.5"/>`;
  }).join('');
  const hub = `<circle cx="${cx}" cy="${cy}" r="2.6" fill="${P.ink}"/>`;
  const lab = label ? mono(cx, cy + r + 13, label, { size: 9, fill: P.inkSoft, anchor: 'middle', ls: 1 }) : '';
  return `${glow}${face}${tick}${arc}${tap}${hub}${lab}`;
}

// ── the wooden-spoon baton ───────────────────────────────────────────────────
function spoon(hx: number, hy: number, tx: number, ty: number, { len = 1 } = {}): string {
  const dx = tx - hx, dy = ty - hy;
  const bx = hx + dx * len, by = hy + dy * len;
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return `<g>
    <line x1="${hx}" y1="${hy}" x2="${bx}" y2="${by}" stroke="${P.brassDp}" stroke-width="7" stroke-linecap="round"/>
    <line x1="${hx}" y1="${hy}" x2="${bx}" y2="${by}" stroke="${P.brass}" stroke-width="4.4" stroke-linecap="round"/>
    <line x1="${hx}" y1="${hy}" x2="${bx - dx * 0.12}" y2="${by - dy * 0.12}" stroke="${P.brassHi}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>
    <g transform="translate(${bx} ${by}) rotate(${ang})">
      <ellipse cx="7" cy="0" rx="11" ry="8" fill="${P.brass}" stroke="${P.brassDp}" stroke-width="1.6"/>
      <ellipse cx="7" cy="-1.5" rx="6" ry="3.6" fill="${P.brassHi}" opacity="0.6"/>
    </g></g>`;
}

// ── the Maestro (parametric robin conductor) ─────────────────────────────────
export type Pose = 'tap' | 'raise' | 'ask' | 'settle';
const POSES: Record<Pose, { tilt: number; bx: number; by: number; len: number; eye: string; glow: number; blush: number }> = {
  tap: { tilt: -2, bx: 214, by: 210, len: 1.0, eye: 'calm', glow: 0.0, blush: 1 },
  raise: { tilt: 8, bx: 236, by: 70, len: 1.15, eye: 'up', glow: 0.9, blush: 1 },
  ask: { tilt: 14, bx: 210, by: 150, len: 1.0, eye: 'ask', glow: 0.3, blush: 1 },
  settle: { tilt: 12, bx: 176, by: 300, len: 0.9, eye: 'soft', glow: 0.4, blush: 1 },
};

function eyes(kind: string): string {
  const L = 99, R = 149, y = 104;
  if (kind === 'soft') {
    return `<path d="M${L - 7} ${y} q7 6 14 0" stroke="${P.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
            <path d="M${R - 7} ${y} q7 6 14 0" stroke="${P.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  }
  const look = kind === 'up' ? -1.8 : 0;
  const dn = kind === 'ask' ? 1.6 : (kind === 'up' ? -1.6 : 0);
  const eye = (cx: number) => `<circle cx="${cx}" cy="${y}" r="7.1" fill="${P.creamHi}"/>
     <circle cx="${cx}" cy="${y}" r="7.1" fill="none" stroke="${P.ink2}" stroke-width="0.8" opacity="0.5"/>
     <circle cx="${cx + look}" cy="${y + dn}" r="3.5" fill="${P.ink}"/>
     <circle cx="${cx + look + 1.4}" cy="${y + dn - 1.8}" r="1.3" fill="#fff" opacity="0.95"/>`;
  return eye(L) + eye(R);
}

export function maestro(pose: Pose = 'tap', { x = 0, y = 0, scale = 1, podium = false } = {}): string {
  const p = POSES[pose] || POSES.tap;
  const sx = 168, sy = 196;
  const glowPool = p.glow > 0.5
    ? `<ellipse cx="125" cy="322" rx="${104 * p.glow}" ry="20" fill="url(#emberPool)" opacity="${0.5 * p.glow}"/>` : '';
  const pod = podium
    ? `<g filter="url(#drop2)"><rect x="70" y="322" width="110" height="16" rx="5" fill="${P.stage}"/></g>
       <rect x="118" y="336" width="14" height="10" fill="${P.stage2}"/>
       <rect x="96" y="346" width="58" height="8" rx="3" fill="${P.stage}"/>` : '';
  const foot = (fx: number) => `<line x1="${fx}" y1="308" x2="${fx}" y2="322" stroke="${P.ink}" stroke-width="3.4" stroke-linecap="round"/>
     <path d="M${fx} 322 l-7 6 M${fx} 322 l0 8 M${fx} 322 l7 6" stroke="${P.ink}" stroke-width="2.6" stroke-linecap="round"/>`;
  const body = `
    <g filter="url(#wob)"><path d="M150 250 q46 6 60 -30 q6 26 -8 46 q-20 18 -52 8 Z" fill="${P.ink}"/></g>
    <path d="M168 244 q30 0 46 -22 M170 258 q30 4 50 -8" stroke="${P.ink2}" stroke-width="1.5" opacity="0.4" fill="none"/>
    ${foot(108)}${foot(140)}
    <g filter="url(#wob2)"><path d="M124 60
        C 78 60, 52 104, 52 174
        C 52 250, 82 302, 124 302
        C 168 302, 198 250, 198 174
        C 198 104, 172 60, 124 60 Z" fill="${P.ink2}"/></g>
    <path d="M124 62 C 92 62, 68 96, 62 146 C 82 132, 104 126, 124 126 C 144 126, 166 132, 186 146 C 180 96, 156 62, 124 62 Z" fill="${P.ink}" opacity="0.55" filter="url(#wob)"/>
    <path d="M116 96
        C 92 98, 78 128, 76 176

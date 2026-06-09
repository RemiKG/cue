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
        C 74 230, 96 296, 124 296
        C 154 296, 168 250, 166 196
        C 165 140, 150 100, 116 96 Z" fill="url(#emberCap)" filter="url(#wob)"/>
    <path d="M118 150 c -12 24 -14 74 -4 112 M142 156 c 8 28 6 78 -6 108" stroke="${P.emberDp}" stroke-width="1.5" opacity="0.24" fill="none"/>
    <g filter="url(#wob)"><path d="M64 150 C 46 168, 44 214, 58 250 C 66 262, 78 258, 76 244 C 68 214, 70 180, 82 160 Z" fill="${P.ink}"/></g>
    <path d="M70 172 q-8 34 0 66 M80 176 q-8 30 -2 58" stroke="${P.ink2}" stroke-width="1.3" opacity="0.5" fill="none"/>
    <g filter="url(#wob)"><path d="M104 184 q20 -10 42 0 l-3 56 q-5 9 -18 9 q-13 0 -18 -9 Z" fill="${P.creamHi}"/></g>
    <path d="M104 184 q20 -10 42 0" stroke="${P.emberDp}" stroke-width="1.8" fill="none"/>
    <path d="M104 186 q-8 6 -7 16 M146 186 q8 6 7 16" stroke="${P.ember}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <line x1="109" y1="214" x2="141" y2="214" stroke="${P.ember}" stroke-width="2.4"/>
    <path d="M120 224 h10 v12 h-10 Z" fill="none" stroke="${P.emberDp}" stroke-width="1.2" opacity="0.55"/>
    <g transform="rotate(${p.tilt} 124 120)">
      <path d="M118 60 q4 -22 18 -26 q-2 14 -6 24" fill="${P.ink}" filter="url(#wob)"/>
      ${p.blush ? `<ellipse cx="92" cy="118" rx="10" ry="7" fill="${P.ember}" opacity="0.32"/><ellipse cx="156" cy="118" rx="10" ry="7" fill="${P.ember}" opacity="0.32"/>` : ''}
      ${eyes(p.eye)}
      <path d="M120 108 L96 116 L120 124 Z" fill="url(#brassCap)" stroke="${P.brassDp}" stroke-width="1"/>
      <path d="M96 116 L120 118 L120 124 Z" fill="${P.brassDp}" opacity="0.6"/>
    </g>`;
  const mx = (sx + p.bx) / 2, my = (sy + p.by) / 2;
  const nearWing = `
    <g filter="url(#wob)"><path d="M${sx - 14} ${sy - 16}
        Q ${mx + 8} ${my - 6} ${p.bx} ${p.by + 6}
        q 12 8 2 18
        Q ${mx - 2} ${my + 12} ${sx - 18} ${sy + 6} Z" fill="${P.ink}"/></g>
    <ellipse cx="${p.bx}" cy="${p.by + 10}" rx="8.5" ry="7.5" fill="${P.ink}"/>`;
  const askBubble = pose === 'ask'
    ? `<g filter="url(#drop)"><circle cx="204" cy="66" r="18" fill="${P.creamHi}"/></g>
       <path d="M190 78 l-8 10 l14 -4 Z" fill="${P.creamHi}"/>
       ${slab(204, 74, '?', { size: 26, w: 800, fill: P.emberDp, anchor: 'middle' })}` : '';
  const inner = `<g>${glowPool}${pod}${body}${nearWing}${spoon(p.bx, p.by + 6, p.bx + (p.bx > 125 ? 26 : -26), p.by - 40, { len: p.len })}${askBubble}</g>`;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
}

// ── wordmark: "Cue" — the C is an enamel pan from above + spoon-baton ─────────
export function wordmark(x: number, y: number, { scale = 1, plain = false, underline = true } = {}): string {
  const cx = 78, cy = 0, rO = 62, rI = 40;
  const a = (52 * Math.PI) / 180;
  const oe = (ang: number, r: number) => `${(cx + Math.cos(ang) * r).toFixed(1)} ${(cy + Math.sin(ang) * r).toFixed(1)}`;
  const ringPath = `M ${oe(-a, rO)} A ${rO} ${rO} 0 1 0 ${oe(a, rO)} L ${oe(a, rI)} A ${rI} ${rI} 0 1 1 ${oe(-a, rI)} Z`;
  const panHandle = `<rect x="${cx - rO - 24}" y="${cy - 8}" width="44" height="16" rx="8" fill="${P.ink}" transform="rotate(-6 ${cx - rO} ${cy})"/>`;
  const innerRim = `<circle cx="${cx}" cy="${cy}" r="${(rO + rI) / 2}" fill="none" stroke="${P.creamHi}" stroke-width="2.4" stroke-opacity="0.55"/>`;
  const C = plain
    ? slab(0, 44, 'C', { size: 170, w: 800 })
    : `${panHandle}<g filter="url(#wob)"><path d="${ringPath}" fill="${P.ink}" fill-rule="evenodd"/></g>${innerRim}
       ${spoon(cx - 40, cy + 40, cx + 34, cy - 40, { len: 1 })}`;
  const ue = `<text x="150" y="45" font-family="Rokkitt" font-weight="800" font-size="176" fill="${P.ink}" letter-spacing="-2">ue</text>`;
  const ul = underline ? `<rect x="6" y="86" width="300" height="5" rx="2.5" fill="${P.ember}"/>` : '';
  return `<g transform="translate(${x} ${y}) scale(${scale})">${C}${ue}${ul}</g>`;
}

// ── logomark: pan-ring + spoon in an enamel roundel ──────────────────────────
export function logomark(cx: number, cy: number, r: number, { badge = true } = {}): string {
  const rO = r * 0.62, rI = r * 0.4;
  const a = (54 * Math.PI) / 180;
  const oe = (ang: number, rr: number) => `${(cx + Math.cos(ang) * rr).toFixed(1)} ${(cy + Math.sin(ang) * rr).toFixed(1)}`;
  const ringPath = `M ${oe(-a, rO)} A ${rO} ${rO} 0 1 0 ${oe(a, rO)} L ${oe(a, rI)} A ${rI} ${rI} 0 1 1 ${oe(-a, rI)} Z`;
  const disc = badge
    ? `<g filter="url(#drop)"><g filter="url(#wob)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#panelV)"/></g></g>
       <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#sheen)" opacity="0.8"/>
       ${speckle(cx - r, cy - r, r * 2, r * 2, { r, op: 0.4 })}
       <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${P.rim}" stroke-width="2.4"/>` : '';
  const handle = `<rect x="${cx - rO - r * 0.22}" y="${cy - r * 0.075}" width="${r * 0.34}" height="${r * 0.15}" rx="${r * 0.075}" fill="${P.ink}" transform="rotate(-6 ${cx - rO} ${cy})"/>`;
  return `${disc}${handle}<g filter="url(#wob)"><path d="${ringPath}" fill="${P.ink}" fill-rule="evenodd"/></g>
    <circle cx="${cx}" cy="${cy}" r="${(rO + rI) / 2}" fill="none" stroke="${P.creamHi}" stroke-width="${r * 0.03}" stroke-opacity="0.5"/>
    ${spoon(cx - rO * 0.62, cy + rO * 0.62, cx + rO * 0.55, cy - rO * 0.6, { len: 1 })}`;
}

// ── steam / sizzle as linocut hatched curls ──────────────────────────────────
export function steam(x: number, y: number, { n = 3, h = 46, op = 0.5 } = {}): string {
  let o = '';
  for (let i = 0; i < n; i++) {
    const xx = x + (i - (n - 1) / 2) * 12;
    o += `<path d="M${xx} ${y} q-8 -${h * 0.32} 2 -${h * 0.5} q9 -${h * 0.18} 0 -${h * 0.34} q-8 -${h * 0.14} 1 -${h * 0.3}"
       fill="none" stroke="${P.ink2}" stroke-width="2.4" stroke-linecap="round" opacity="${op}"/>
       <path d="M${xx} ${y} q-8 -${h * 0.32} 2 -${h * 0.5}" fill="none" stroke="${P.creamHi}" stroke-width="1" opacity="${op * 0.7}"/>`;
  }
  return o;
}

// ── a pan/pot seen from a 3/4 angle, enamel + duotone contents ───────────────
export type PanKind = 'pot' | 'skillet' | 'pan' | 'sauce';
export function pan(cx: number, cy: number, rx: number, { kind = 'skillet' as PanKind, handle = 'right', hot = false } = {}): string {
  const ry = rx * 0.52;
  const depth = kind === 'pot' ? 30 : 14;
  const hx = handle === 'right' ? 1 : -1;
  const wall = `<path d="M${cx - rx} ${cy} a${rx} ${ry} 0 0 0 ${rx * 2} 0 l0 ${depth} a${rx} ${ry} 0 0 1 ${-rx * 2} 0 Z" fill="${P.ink2}"/>
    <path d="M${cx - rx} ${cy} a${rx} ${ry} 0 0 0 ${rx * 2} 0 l0 ${depth} a${rx} ${ry} 0 0 1 ${-rx * 2} 0 Z" fill="url(#sheen)" opacity="0.25"/>`;
  const hw = 46;
  const hxpos = hx > 0 ? cx + (rx - 2) : cx - (rx - 2) - hw;
  const handleEl = `<rect x="${hxpos}" y="${cy - 6}" width="${hw}" height="12" rx="6" fill="${P.ink}" transform="rotate(${hx * -4} ${cx + hx * rx} ${cy})"/>`;
  const rim = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.cream}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sheen)" opacity="0.6"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${P.ink}" stroke-width="3"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx - 5}" ry="${ry - 5}" fill="none" stroke="${P.rim}" stroke-width="1.4"/>`;
  const inD = `M${cx - rx + 6} ${cy} a${rx - 6} ${ry - 5} 0 1 0 0.1 0 Z`;
  let contents = '';
  if (kind === 'pot') {
    const cid = `pot${Math.floor(cx + cy)}_${_sk++}`;
    contents = `<clipPath id="${cid}"><path d="${inD}"/></clipPath><g clip-path="url(#${cid})"><rect x="${cx - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" fill="url(#stipple)"/></g>`
      + `<g>${Array.from({ length: 5 }, (_, i) => `<circle cx="${cx - 20 + i * 11}" cy="${cy - 4 + (i % 2) * 8}" r="3.2" fill="none" stroke="${P.ink2}" stroke-width="1.4" opacity="0.5"/>`).join('')}</g>`;
  } else if (kind === 'skillet') {
    contents = `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 8}" ry="${ry - 6}" fill="url(#emberPool)" opacity="0.7"/>
      <path d="M${cx - 26} ${cy} q26 -16 52 0 q-26 14 -52 0 Z" fill="${P.emberDp}"/>
      <path d="M${cx - 26} ${cy} q26 -16 52 0" fill="none" stroke="${P.deep}" stroke-width="1.4" opacity="0.6"/>
      <path d="M${cx - 14} ${cy - 4} h28 M${cx - 12} ${cy} h24" stroke="${P.emberHi}" stroke-width="1.2" opacity="0.5"/>`;
  } else if (kind === 'sauce') {
    contents = `<ellipse cx="${cx}" cy="${cy}" rx="${rx - 8}" ry="${ry - 6}" fill="${P.emberDp}" opacity="0.55"/>
      <path d="M${cx - 18} ${cy} q18 -10 36 0 q-18 10 -36 0" fill="none" stroke="${P.ember}" stroke-width="1.6" opacity="0.6"/>`;
  } else {
    contents = `<g>${Array.from({ length: 7 }, (_, i) => { const a = -0.5 + i * 0.16; return `<path d="M${cx - 24 + i * 8} ${cy + 6} q${Math.cos(a) * 10} ${-16 - (i % 3) * 3} ${Math.cos(a) * 4} -26" fill="none" stroke="${P.ink2}" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`; }).join('')}</g>`;
  }
  const sizzle = hot ? steam(cx, cy - ry - 4, { n: kind === 'pot' ? 3 : 2, h: 42, op: 0.5 }) : '';
  return `<g filter="url(#drop)">${wall}${handleEl}</g>${rim}${contents}${sizzle}`;
}

function dial(cx: number, cy: number, r: number, frac: number, { state = 'cook' as GaugeState, label = '', to = null as [number, number] | null } = {}): string {
  const leader = to ? `<line x1="${cx}" y1="${cy}" x2="${to[0]}" y2="${to[1]}" stroke="${P.ink3}" stroke-width="1.2" stroke-dasharray="2 3" opacity="0.6"/>` : '';
  return `${leader}<g filter="url(#drop)"><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="${P.creamHi}"/></g>${gauge(cx, cy, r, frac, { state, label })}`;
}

// ── the enamel STOVE FEED (privacy-as-art): cook-space + pans + board ─────────
// The user's real feed rendered as a warm illustrated diagram — never a raw camera.
// `pans` lets the app drive live doneness fracs/states from the on-device reflex.
export interface FeedPan { frac: number; state: GaugeState; label: string }
export function stoveFeed(
  x: number, y: number, w: number, h: number,
  { dim = 0, dials = true, calibrate = false, pans = null as FeedPan[] | null } = {},
): string {
  const id = `ff${_sk++}`;
  let s = `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20"/></clipPath><g clip-path="url(#${id})">`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#stageR)"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dotsInk)" opacity="0.05"/>`;
  const bxs = [x + w * 0.26, x + w * 0.56, x + w * 0.83];
  const by = y + h * 0.6;
  bxs.forEach((bx) => { s += `<ellipse cx="${bx}" cy="${by + 24}" rx="66" ry="22" fill="none" stroke="${P.stage2}" stroke-width="3"/><ellipse cx="${bx}" cy="${by + 24}" rx="40" ry="13" fill="none" stroke="${P.stage2}" stroke-width="2"/>`; });
  s += pan(bxs[0], by, 62, { kind: 'pot', handle: 'left', hot: true });
  s += pan(bxs[1], by, 58, { kind: 'skillet', handle: 'right', hot: true });
  s += pan(bxs[2], by, 50, { kind: 'pan', handle: 'right', hot: false });
  s += `<g filter="url(#drop)"><rect x="${x + 24}" y="${y + 26}" width="120" height="70" rx="12" fill="${P.panel}"/></g>
    <rect x="${x + 24}" y="${y + 26}" width="120" height="70" rx="12" fill="url(#sheen)" opacity="0.4"/>
    <line x1="${x + 40}" y1="${y + 52}" x2="${x + 128}" y2="${y + 52}" stroke="${P.ink3}" stroke-width="1.2" opacity="0.5"/>
    <path d="M${x + 44} ${y + 66} l24 0 M${x + 44} ${y + 74} l30 0" stroke="${P.ink3}" stroke-width="2" opacity="0.5"/>`;
  if (dim) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${P.stage}" opacity="${dim}"/>`;
  s += `</g>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="none" stroke="${P.ink}" stroke-width="2.5"/>`;
  if (dials) {
    const d = pans || [
      { frac: 0.35, state: 'cook' as GaugeState, label: 'RICE' },
      { frac: 0.6, state: 'cook' as GaugeState, label: 'SALMON' },
      { frac: 0.15, state: 'idle' as GaugeState, label: 'BEANS' },
    ];
    s += dial(bxs[0] - 8, by - 66, 20, d[0].frac, { state: d[0].state, label: d[0].label, to: [bxs[0], by] });
    s += dial(bxs[1] + 6, by - 70, 20, d[1].frac, { state: d[1].state, label: d[1].label, to: [bxs[1], by] });
    s += dial(bxs[2] + 8, by - 60, 18, d[2].frac, { state: d[2].state, label: d[2].label, to: [bxs[2], by] });
  }
  if (calibrate) {
    bxs.forEach((bx) => { s += `<circle cx="${bx}" cy="${by}" r="16" fill="none" stroke="${P.ember}" stroke-width="2" stroke-dasharray="3 4"/><circle cx="${bx}" cy="${by}" r="4" fill="${P.ember}"/>`; });
  }
  return s;
}

// ── shield glyph (privacy) ───────────────────────────────────────────────────
export function shield(cx: number, cy: number, r: number, { fill = P.ember } = {}): string {
  return `<path d="M${cx} ${cy - r} q${r} ${r * 0.3} ${r} ${r * 0.5} q0 ${r} ${-r} ${r * 1.1} q${-r} ${-r * 0.1} ${-r} ${-r * 1.1} q0 ${-r * 0.2} ${r} ${-r * 0.5} Z" fill="${fill}" opacity="0.9"/>
    <path d="M${cx - r * 0.32} ${cy} l${r * 0.22} ${r * 0.26} l${r * 0.44} ${-r * 0.5}" fill="none" stroke="${P.cream}" stroke-width="${r * 0.14}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

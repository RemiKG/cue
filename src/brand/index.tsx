// index.tsx — React wrappers around the hand-vector kit. <CueDefs/> injects the
// shared <defs> once at app root; filter refs (#wob, #emberPool, …) are then
// document-global and usable from every inline SVG.
import { memo } from 'react';
import { DEFS_INNER, maestro, wordmark, logomark, stoveFeed, type Pose, type FeedPan } from './svgKit';

export { type Pose, type FeedPan } from './svgKit';

/** Render once, high in the tree. Zero-size, absolutely positioned. */
export const CueDefs = memo(function CueDefs() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs dangerouslySetInnerHTML={{ __html: DEFS_INNER }} />
    </svg>
  );
});

interface RawSvgProps {
  content: string;
  viewBox: string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  role?: string;
  preserve?: string;
}
/** An inline SVG whose innards are a kit-generated string. */
export const RawSvg = memo(function RawSvg({ content, viewBox, className, style, title, role = 'img', preserve = 'xMidYMid meet' }: RawSvgProps) {
  return (
    <svg
      className={className}
      style={style}
      viewBox={viewBox}
      preserveAspectRatio={preserve}
      role={role}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
});

export function Maestro({ pose = 'tap', podium = false, className, style, title = 'The Maestro' }: { pose?: Pose; podium?: boolean; className?: string; style?: React.CSSProperties; title?: string }) {
  return (
    <RawSvg
      title={title}
      className={className}
      style={style}
      viewBox="-16 6 306 356"
      content={maestro(pose, { podium })}
    />
  );
}

export function Wordmark({ plain = false, underline = true, className, style, title = 'Cue' }: { plain?: boolean; underline?: boolean; className?: string; style?: React.CSSProperties; title?: string }) {
  return (
    <RawSvg
      title={title}
      className={className}
      style={style}
      viewBox="-16 -98 372 200"
      content={wordmark(0, 0, { plain, underline })}
    />
  );
}

export function Logomark({ size = 96, badge = true, className, style, title = 'Cue' }: { size?: number; badge?: boolean; className?: string; style?: React.CSSProperties; title?: string }) {
  const r = size * 0.44;
  const c = size / 2;
  return (
    <RawSvg
      title={title}
      className={className}
      style={{ width: size, height: size, ...style }}
      viewBox={`0 0 ${size} ${size}`}
      content={logomark(c, c, r, { badge })}
    />
  );
}

export function StoveFeed({
  w = 640,
  h = 460,
  dim = 0,
  dials = true,
  calibrate = false,
  pans = null,
  className,
  style,
  title = 'Stove — illustrated diagram, not a camera feed',
}: {
  w?: number;
  h?: number;
  dim?: number;
  dials?: boolean;
  calibrate?: boolean;
  pans?: FeedPan[] | null;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <RawSvg
      title={title}
      className={className}
      style={style}
      viewBox={`0 0 ${w} ${h}`}
      content={stoveFeed(0, 0, w, h, { dim, dials, calibrate, pans })}
    />
  );
}

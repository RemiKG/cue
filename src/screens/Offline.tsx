// Offline (screen 06) — graceful degradation, shown proudly and verifiable live. Cut
// the network mid-cook and Cue keeps conducting from the cached score; a boil-over
// trips an instant LOCAL alert (a soft wooden-spoon tap, no cloud, no siren); reconnect
// → re-optimize + back-fill. The airplane flip is a real toggle you can try.
import { useMemo } from 'react';
import { useCue, boilOverNow } from '../state/store';
import { Score as ScoreBoard } from '../brand/Score';
import { Gauge, Tag } from '../brand/widgets';
import { buildSpec } from '../engine/scoreSpec';

export function Offline() {
  const online = useCue((s) => s.online);
  const offlineForced = useCue((s) => s.offlineForced);
  const toggle = useCue((s) => s.toggleOffline);
  const schedule = useCue((s) => s.schedule);
  const nowSec = useCue((s) => s.nowSec);
  const queue = useCue((s) => s.queueDepth);

  const spec = useMemo(() => (schedule ? buildSpec(schedule, nowSec, null, true, false) : null), [schedule, nowSec]);

  return (
    <div className="screen">
      <div className={`enamel cuebanner ${online ? 'enamel--hi' : 'enamel--recessed'}`} style={!online ? { borderColor: 'var(--ember)' } : undefined}>
        <span className="cuebanner__icon" style={{ borderColor: online ? 'var(--emberDp)' : 'var(--emberDp)' }}>
          {online ? '✓' : (
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 12 a7 5 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" /><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg>
          )}
        </span>
        <span className="cuebanner__text">{online ? 'Online — conducting normally.' : 'Offline — I’ll keep your time.'}</span>
      </div>

      <button className={`chip ${online ? '' : 'chip--accent'} big-btn`} onClick={() => toggle()} style={{ fontSize: 17 }}>
        {online ? '✈  Cut the Wi-Fi (try it live)' : '↺  Reconnect'}
      </button>

      {spec && (
        <div className="enamel enamel--recessed score-wrap">
          <div className="score-header">
            <span className="mono score-hd">CONDUCTING FROM CACHE</span>
            <span className="mono score-hd">cached</span>
          </div>
          <ScoreBoard spec={spec} className="score" width={1000} />
        </div>
      )}

      {/* boil-over: local, instant, no cloud */}
      <div className="enamel card" style={{ borderColor: 'var(--ember)', background: 'linear-gradient(180deg,#fdf3e2,var(--panel))' }}>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <Gauge frac={0.98} state="hot" size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17.5, lineHeight: 1.4 }}>Pan 2’s boiling over — off the heat a moment.</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--emberDp)', marginTop: 3 }}>LOCAL · ~120 ms · no cloud round-trip</div>
          </div>
        </div>
        <button className="chip chip--ghost" style={{ marginTop: 10 }} onClick={() => boilOverNow()}>Hear the local alert →</button>
      </div>

      <div className="enamel enamel--recessed card">
        <div className="eyebrow">WHAT STILL WORKS, OFFLINE</div>
        <div className="checkline">conduct from the cached score <span className="tick">✓</span></div>
        <div className="checkline">instant local safety alerts <span className="tick">✓</span></div>
        <div className="checkline">take new doneness reads <span className="cross">✗ till reconnect</span></div>
      </div>

      <div className="tagrail">
        <Tag label="bytes → cloud" value={online ? '312 KB' : '0.0'} />
        <Tag label="offline queue" value={`${offlineForced ? Math.max(queue, 6) : queue} keyframes`} />
      </div>

      {online && (offlineForced || queue > 0) && (
        <div className="muted small" style={{ fontStyle: 'italic' }}>Back online → re-optimizing the rest, back-filling reads…</div>
      )}
    </div>
  );
}

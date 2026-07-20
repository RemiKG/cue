// Prop & perceive (screen 02) — the on-device reflex sensing the real stove, shown as
// a warm enamel duotone (never a raw feed). The privacy proof, made visible.
import { useEffect, useState } from 'react';
import { useCue, startLiveCapture } from '../state/store';
import { StoveFeed } from '../brand';
import { Tag } from '../brand/widgets';
import { fmtBytes } from '../perception/metrics';
import { cloudMeter } from '../cloud/qwen';

export function Perceive() {
  const mode = useCue((s) => s.mode);
  const pans = useCue((s) => s.pans);
  const fps = useCue((s) => s.fps);
  const audio = useCue((s) => s.audio);
  const capture = useCue((s) => s._capture);
  const meal = useCue((s) => s.meal);
  const buildScore = useCue((s) => s.buildScore);
  const [camErr, setCamErr] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'live' && !capture) {
      void startLiveCapture().then((r) => { if (!r.ok) setCamErr(r.error || 'camera-unavailable'); });
    }
  }, [mode, capture]);

  const watchingLocally = mode !== 'live' || !!capture;
  const bytes = mode === 'live' ? cloudMeter.bytes() : 0;
  const smoke = audio?.smokeAlarm ? 'yes' : 'no';

  return (
    <div className="screen">
      <div>
        <h1 style={{ fontSize: 25 }}>Prop me at the stove</h1>
        <div className="muted">Tap each pan to tell me its dish.</div>
      </div>

      <StoveFeed className="feed" pans={pans.slice(0, 3)} calibrate w={640} h={470} />

      {camErr && (
        <div className="enamel card--tight card small muted">
          Camera unavailable ({camErr}). That’s fine — you can still watch the illustrated demo or build the score; the reflex runs on-device when a camera is granted.
        </div>
      )}

      <div className="enamel enamel--hi card privacy-card">
        <span className="privacy-shield">
          <svg width="42" height="42" viewBox="0 0 42 42"><path d="M21 4 q13 4 13 6 q0 15 -13 24 q-13 -9 -13 -24 q0 -2 13 -6Z" fill="var(--ember)" opacity="0.92" /><path d="M14 20 l5 5 l10 -11" fill="none" stroke="var(--cream)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Even the picture stays home.</div>
          <div className="muted small">This is a drawing, not a camera feed.</div>
        </div>
      </div>

      <div className="tagrail">
        <Tag label={`bytes → cloud`} value={watchingLocally ? fmtBytes(bytes) : '0.0 KB'} />
        <Tag label="on-device fps" value={fps || (mode === 'live' && capture ? '…' : '—')} />
      </div>

      <div className="eyebrow">{capture ? 'REFLEX DETECTED · on the phone' : 'REFLEX WATCHES FOR · once a camera is granted'}</div>
      <div className="row row--wrap" style={{ gap: 8 }}>
        <span className="chip chip--mono" style={{ borderColor: 'var(--ember)', color: 'var(--emberDp)' }}>pan {capture ? '✓' : '—'}</span>
        <span className="chip chip--mono" style={{ borderColor: 'var(--ember)', color: 'var(--emberDp)' }}>pot {capture ? '✓' : '—'}</span>
        <span className="chip chip--mono" style={{ borderColor: 'var(--ember)', color: 'var(--emberDp)' }}>board {capture ? '✓' : '—'}</span>
        <span className="chip chip--mono" style={{ borderColor: 'var(--ember)', color: 'var(--emberDp)' }}>sizzle {capture && audio && audio.klass !== 'quiet' ? '✓' : '—'}</span>
        <span className="chip chip--mono">smoke: {capture ? smoke : '—'}</span>
      </div>

      <button className="chip chip--accent big-btn" disabled={!meal?.dishes.length} onClick={() => void buildScore()} style={{ marginTop: 6 }}>
        Build the score →
      </button>
    </div>
  );
}

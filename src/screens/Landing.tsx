// Landing (screen 00) — the URL a stranger lands on. Warm cookbook cover; get them
// propping a phone in ten seconds.
import { Wordmark, Maestro } from '../brand';
import { useCue } from '../state/store';

export function Landing() {
  const startLive = useCue((s) => s.startLive);
  const startDemo = useCue((s) => s.startDemo);
  return (
    <div className="screen screen--center" style={{ gap: 18, paddingTop: 'calc(28px + var(--safe-top))' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Wordmark underline style={{ width: 'min(72%, 300px)', height: 'auto' }} />
        <div style={{ fontFamily: 'var(--slab)', fontWeight: 700, fontSize: 26, color: 'var(--ink)', marginTop: -4 }}>Dinner, on cue.</div>
      </div>

      <div className="enamel enamel--hi card" style={{ marginTop: 6 }}>
        <div style={{ fontFamily: 'var(--slab)', fontWeight: 700, fontSize: 21, lineHeight: 1.5 }}>
          A recipe tells you what to do.
          <br />
          It never tells you <em style={{ color: 'var(--emberDp)', fontStyle: 'italic', fontWeight: 800 }}>when.</em>
        </div>
      </div>

      <div className="stack" style={{ marginTop: 6 }}>
        <button className="chip chip--accent big-btn" onClick={() => void startLive()}>Prop your phone at the stove</button>
        <button className="chip big-btn" style={{ fontSize: 17 }} onClick={() => startDemo()}>Watch the 60-second demo</button>
      </div>

      <div className="row" style={{ marginTop: 4, textAlign: 'left', gap: 12 }}>
        <span style={{ width: 34, height: 34, flex: 'none' }}>
          <svg width="34" height="34" viewBox="0 0 34 34"><path d="M17 3 q11 3 11 5 q0 12 -11 20 q-11 -8 -11 -20 q0 -2 11 -5Z" fill="var(--ember)" opacity="0.92" /><path d="M11 16 l4 4 l8 -9" fill="none" stroke="var(--cream)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16.5 }}>Runs on the phone you already have.</div>
          <div className="muted small">Not one frame of your kitchen leaves the room.</div>
        </div>
      </div>

      <div className="row row--wrap" style={{ justifyContent: 'center', gap: 8, marginTop: 2 }}>
        {['on-device reflex', 'Qwen Cloud', 'offline-safe', 'MIT'].map((t) => (
          <span key={t} className="chip chip--mono">{t}</span>
        ))}
      </div>

      <div style={{ display: 'grid', placeItems: 'center', marginTop: 4 }}>
        <Maestro pose="tap" style={{ width: 128, height: 150 }} />
      </div>
    </div>
  );
}

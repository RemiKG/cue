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


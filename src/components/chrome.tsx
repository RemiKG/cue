// chrome.tsx — persistent UI: the top bar, the navigation sheet, the cue banner, the
// tag rail, the Maestro corner, and the (never-red) safety banner.
import { useState } from 'react';
import { Logomark, Maestro } from '../brand';
import { useCue, type Screen } from '../state/store';
import { fmtClock } from '../engine/scheduler';
import type { DivergenceKind } from '../engine/types';

export function LivePill() {
  const online = useCue((s) => s.online);
  const running = useCue((s) => s.running);
  const mode = useCue((s) => s.mode);
  if (!online) return <span className="pill pill--offline"><span className="dot" />OFFLINE</span>;
  if (mode === 'idle' && !running) return <span className="pill">ready</span>;
  return <span className="pill pill--live"><span className="dot" />live</span>;
}

const NAV: { key: Screen; n: string; label: string }[] = [
  { key: 'score', n: '03', label: 'The Score' },
  { key: 'setmeal', n: '01', label: 'Set the meal' },
  { key: 'perceive', n: '02', label: 'Prop & perceive' },
  { key: 'ask', n: '05', label: 'Checks & safety' },
  { key: 'offline', n: '06', label: 'Offline' },
  { key: 'log', n: '07', label: 'Kitchen Score' },
  { key: 'settings', n: '08', label: 'Settings' },
  { key: 'engine', n: '09', label: 'Engine & limits' },
];

export function TopBar({ sub }: { sub?: string }) {
  const [menu, setMenu] = useState(false);
  const setScreen = useCue((s) => s.setScreen);
  const reset = useCue((s) => s.reset);
  const inject = useCue((s) => s.injectDivergence);
  const running = useCue((s) => s.running);
  const riceBrown = useCue((s) => s.riceBrown);
  const [disrupt, setDisrupt] = useState(false);

  const go = (k: Screen) => { setScreen(k); setMenu(false); };
  const breakPlan = (k: DivergenceKind) => { void inject(k); setDisrupt(false); setMenu(false); setScreen('score'); };

  return (
    <div className="topbar">
      <div className="topbar__brand">
        <Logomark size={30} />
        <span className="topbar__title">Cue</span>
        {sub && <span className="topbar__sub">· {sub}</span>}
      </div>
      <div className="topbar__actions">
        <LivePill />
        <button className="iconbtn" aria-label="Menu" onClick={() => setMenu(true)}>☰</button>
      </div>

      {menu && (
        <div className="scrim" onClick={() => setMenu(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>GO TO</div>
            {NAV.map((it) => (
              <button key={it.key} className="sheet-link" onClick={() => go(it.key)}>
                <span className="n">{it.n}</span>
                {it.label}
              </button>
            ))}
            <div style={{ height: 12 }} />
            {running && (
              <>
                <button className="sheet-link" onClick={() => setDisrupt((v) => !v)}>
                  <span className="n">★</span> Break the plan (money shot) {disrupt ? '▾' : '▸'}
                </button>
                {disrupt && (
                  <div className="stack" style={{ padding: '8px 8px 4px' }}>
                    {riceBrown ? null : (
                      <button className="chip chip--accent" onClick={() => breakPlan('ingredient-swap')}>It’s actually brown rice</button>
                    )}
                    <button className="chip" onClick={() => breakPlan('behind')}>I fell behind on the sear</button>
                    <button className="chip" onClick={() => breakPlan('ran-hot')}>A pan ran hot</button>
                  </div>
                )}
              </>
            )}
            <button className="sheet-link" onClick={() => { reset(); setMenu(false); }}>
              <span className="n">⌂</span> Restart · home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CueBanner({ text, offline = false }: { text: string; offline?: boolean }) {
  return (
    <div className="enamel enamel--hi cuebanner">
      <span className="cuebanner__icon">
        {offline ? (
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M3 12 a7 5 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" /><line x1="3" y1="17" x2="17" y2="3" stroke="currentColor" strokeWidth="2" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 10 l3 3 l7 -8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </span>
      <span className="cuebanner__text">{text}</span>
      {!offline && (
        <span className="cuebanner__wave" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.12}s`, height: 8 + (i % 3) * 7 }} />)}
        </span>
      )}
    </div>
  );
}

export function MaestroCorner() {
  const pose = useCue((s) => s.maestroPose);
  return (
    <div className="maestro-corner" aria-hidden>
      <Maestro pose={pose} />
    </div>
  );
}

export function SafetyBanner() {
  const safety = useCue((s) => s.safety);
  const clear = useCue((s) => s.clearSafety);
  if (!safety) return null;
  const still = safety.kind === 'thermometer';
  return (
    <div className={`safety-banner ${still ? 'still' : ''}`} role="alert" onClick={clear}>
      <div style={{ width: 34, height: 34, flex: 'none', display: 'grid', placeItems: 'center' }}>
        {still ? (
          <svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="13" fill="none" stroke="var(--still)" strokeWidth="2" /><line x1="15" y1="8" x2="15" y2="17" stroke="var(--still)" strokeWidth="2.4" strokeLinecap="round" /><circle cx="15" cy="22" r="1.6" fill="var(--still)" /></svg>
        ) : (
          <svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="12" fill="none" stroke="var(--ember)" strokeWidth="2.4" strokeDasharray="3 5" /><circle cx="17" cy="17" r="3" fill="var(--ember)" /></svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: 16.5 }}>{safety.text}</div>
        {safety.detail && <div className="mono" style={{ fontSize: 12, color: 'var(--emberDp)', marginTop: 2 }}>{safety.detail}</div>}
      </div>
    </div>
  );
}

export function DeadlinePill() {
  const sch = useCue((s) => s.schedule);
  if (!sch) return null;
  return <span className="mono" style={{ fontSize: 13, color: 'var(--ink2)', letterSpacing: 1 }}>DONE {fmtClock(sch.deadlineSec)}</span>;
}

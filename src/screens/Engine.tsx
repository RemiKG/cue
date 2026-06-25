// Engine & honest limits (screen 09) — the architecture IS the UI: the same
// perceive → reason → act → degrade picture. Doubles as the Architecture Diagram.
import { useCue } from '../state/store';

const STAGES = [
  { key: 'perceive', title: 'PERCEIVE', tag: 'on the phone', dark: false, items: ['object / doneness / audio reflex', 'pans · boil · brown · scorch · sizzle', 'emits tiny pan-state events', 'raw A/V never leaves'] },
  { key: 'reason', title: 'REASON', tag: 'Qwen Cloud', dark: true, items: ['qwen3-vl-plus · read doneness', 'qwen3.7-plus · plan the score', 'qwen3.7-max · conduct + re-plan', 'text-embedding-v4 · ground'] },
  { key: 'act', title: 'ACT', tag: 'on the phone', dark: false, items: ['qwen3-tts-flash · speak the cue', 'sweep the score → held chord', 'comms-MCP · ping the household', 'every cue → the Kitchen Score'] },
  { key: 'degrade', title: 'DEGRADE', tag: 'offline', dark: false, items: ['conduct from the cached score', 'queue keyframes to read', 'boil-over → LOCAL alert, ~120 ms', 'reconnect → re-optimize + back-fill'] },
];

const LIMITS = [
  'The reflex will mis-read a pan — that’s why the wow is the re-planning, and why it asks you.',
  'Never a food-safety authority — the high-harm read routes to a thermometer.',
  'Deep fryers & closed ovens read by proxy; it hedges.',
  'Offline = conduct-from-cache (no new reads until reconnect).',
  'Voice-clone, pings, pantry are optional extras — never the core.',
];

export function Engine() {
  const cloud = useCue((s) => s.cloud);
  return (
    <div className="screen">
      <div>
        <h1 style={{ fontSize: 24 }}>One loop, one score, one picture</h1>
        <div className="muted mono" style={{ fontSize: 13 }}>perceive → reason → act → degrade</div>
      </div>

      <div className="row row--wrap" style={{ gap: 12, alignItems: 'stretch' }}>
        {STAGES.map((st, i) => (
          <div key={st.key} className="enamel card" style={{ flex: '1 1 210px', minWidth: 210, background: st.dark ? 'linear-gradient(180deg,#3a2a22,#2a1d17)' : undefined, color: st.dark ? 'var(--cream)' : undefined, position: 'relative' }}>
            <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <span className="card-title" style={{ fontSize: 17, color: st.dark ? 'var(--emberHi)' : 'var(--ink)' }}>{st.title}</span>
              <span className="chip chip--mono" style={{ padding: '4px 10px', fontSize: 11, background: st.dark ? 'transparent' : 'var(--panel)', borderColor: st.dark ? 'var(--ember)' : 'var(--rim)', color: st.dark ? 'var(--emberHi)' : 'var(--ink2)' }}>{st.tag}</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {st.items.map((it) => <li key={it} style={{ fontSize: 13.5, color: st.dark ? '#e9ddcb' : 'var(--ink2)' }}>{it}</li>)}
            </ul>
            {i < STAGES.length - 1 && <span aria-hidden style={{ position: 'absolute', right: -13, top: '50%', color: 'var(--ember)', fontSize: 20, fontWeight: 800, zIndex: 2 }}>→</span>}
          </div>
        ))}
      </div>

      <div className="enamel card--tight card">
        <div className="row row--wrap" style={{ gap: 8, alignItems: 'center' }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>SKILLS</span>
          {['read-doneness', 'plan-meal', 'conduct-timeline', 'call-cue'].map((k) => <span key={k} className="chip chip--mono" style={{ borderColor: 'var(--ember)', color: 'var(--emberDp)', padding: '5px 11px' }}>{k}</span>)}
        </div>
        <div className="row row--wrap" style={{ gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>MCP</span>
          <span className="chip chip--mono" style={{ padding: '5px 11px' }}>comms-MCP (Telegram)</span>
          <span className="chip chip--mono" style={{ padding: '5px 11px' }}>pantry-MCP (opt-in)</span>
        </div>
        <div className="row row--wrap" style={{ gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>SAFETY</span>
          <span className="chip chip--mono" style={{ padding: '5px 11px' }}>LLM proposes · policy disposes · never certifies safe</span>
        </div>
      </div>

      <div className="enamel enamel--recessed card--tight card mono" style={{ fontSize: 12.5, letterSpacing: 0.3 }}>
        running live on Alibaba Cloud (ECS/SAS, Singapore) · <span style={{ color: 'var(--emberDp)' }}>{cloud.baseUrl}</span>
        <div style={{ marginTop: 4, color: cloud.available ? 'var(--emberDp)' : 'var(--inkSoft)' }}>
          Qwen Cloud: {cloud.available ? 'connected ✓' : 'no key — on-device deterministic planner active (degrades honestly)'}
        </div>
      </div>

      <div className="enamel card">
        <div className="eyebrow">WHAT CUE IS HONEST ABOUT</div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LIMITS.map((l) => <li key={l} style={{ fontSize: 14.5, color: 'var(--ink2)', lineHeight: 1.45 }}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
}

// The one question + safety (screen 05) — honest uncertainty and the hard safety gate
// as first-class UI. Cue hedges and asks; it NEVER certifies food safe (the high-harm
// read is routed to a thermometer, shown as the "cool and still" grey state).
import { useCue } from '../state/store';
import { Maestro } from '../brand';
import { recipeThermometer, NEVER_CERTIFY } from '../engine/safety';
import { getRecipe } from '../engine/retrieval';

export function AskSafety() {
  const ask = useCue((s) => s.ask);
  const answer = useCue((s) => s.answerAsk);
  const meal = useCue((s) => s.meal);

  const protein = meal?.dishes.find((d) => getRecipe(d.recipeId)?.highHarmProtein);
  const therm = protein ? recipeThermometer(protein.recipeId) : recipeThermometer('salmon');
  const conf = ask?.confidence ?? 0.58;

  return (
    <div className="screen">
      {/* the ask card */}
      <div className="enamel enamel--hi card" style={{ position: 'relative' }}>
        <div className="row spread">
          <div className="eyebrow">THE ONE QUESTION</div>
          <Maestro pose="ask" style={{ width: 74, height: 92, marginTop: -18, marginRight: -6 }} />
        </div>
        <div className="row" style={{ gap: 14, alignItems: 'center', marginTop: -8 }}>
          {/* illustrated pan close-up */}
          <svg width="140" height="96" viewBox="0 0 140 96" style={{ flex: 'none' }}>
            <g filter="url(#drop)">
              <ellipse cx="60" cy="58" rx="52" ry="24" fill="var(--ink2)" />
              <rect x="104" y="52" width="34" height="10" rx="5" fill="var(--ink)" transform="rotate(-4 104 57)" />
            </g>
            <ellipse cx="60" cy="52" rx="52" ry="23" fill="var(--cream)" />
            <ellipse cx="60" cy="52" rx="52" ry="23" fill="url(#sheen)" opacity="0.6" />
            <ellipse cx="60" cy="52" rx="52" ry="23" fill="none" stroke="var(--ink)" strokeWidth="3" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <path key={i} d={`M${40 + i * 8} 58 q2 -14 0 -22`} fill="none" stroke="var(--ink3)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
            ))}
            <g opacity="0.5"><path d="M60 20 q-6 -8 2 -14" fill="none" stroke="var(--ink2)" strokeWidth="2" strokeLinecap="round" /></g>
          </svg>
          <span className="pill" style={{ fontSize: 13 }}>VL: golden? {conf.toFixed(2)} — not sure</span>
        </div>
        <div style={{ fontFamily: 'var(--slab)', fontWeight: 700, fontSize: 19, lineHeight: 1.5, marginTop: 10 }}>
          {ask?.text || 'I think the garlic’s about there — does that look golden to you, or thirty more seconds?'}
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="chip chip--accent" onClick={() => answer(true)}>Looks golden</button>
          <button className="chip" onClick={() => answer(false)}>+30 s</button>
        </div>
        <div className="muted small" style={{ fontStyle: 'italic', marginTop: 10 }}>I’ll remember how your stove browns.</div>
      </div>

      {/* the safety card — the "still" state, cool grey, never red */}
      <div className="enamel enamel--recessed card" style={{ background: 'linear-gradient(180deg,#eeece6,var(--panel2))', borderColor: 'var(--rim)' }}>
        <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, flex: 'none', display: 'grid', placeItems: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="14" fill="none" stroke="var(--still)" strokeWidth="2.4" /><line x1="17" y1="9" x2="17" y2="19" stroke="var(--still)" strokeWidth="2.6" strokeLinecap="round" /><circle cx="17" cy="24" r="1.8" fill="var(--still)" /></svg>
          </span>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ color: 'var(--stillDp)' }}>SAFETY · GONE COOL AND STILL</div>
            <div style={{ fontFamily: 'var(--slab)', fontWeight: 700, fontSize: 18, lineHeight: 1.5, marginTop: 8 }}>
              That {(protein?.name || 'salmon').toLowerCase()} looks underdone to me. I won’t call it safe — check it with a thermometer{therm?.detail ? ` (${therm.detail.replace(/^Target:\s*/, '').replace(/\.$/, '')})` : ''}.
            </div>
            <div className="muted small" style={{ marginTop: 10, fontStyle: 'italic' }}>{NEVER_CERTIFY}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

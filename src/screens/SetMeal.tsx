// Set the meal (screen 01) — multi-modal, retrieval-grounded intake. Say / type /
// snap; dishes captured as editable chips grounded in the bundled recipe index; the
// one or two questions that change the timing.
import { useState } from 'react';
import { useCue } from '../state/store';
import { Maestro } from '../brand';
import { getRecipe, groundMeal, groundedCount, type GroundingNote } from '../engine/retrieval';
import type { DishInstance } from '../engine/types';

function dishTime(recipeId: string): string {
  const r = getRecipe(recipeId);
  if (!r) return '—';
  const sec = r.steps.filter((s) => s.kind !== 'plate').reduce((a, s) => a + s.durationSec, 0);
  const m = Math.round(sec / 60);
  return r.id === 'salmon' ? `${Math.round((r.steps.find((s) => s.id === 'sear')?.durationSec || 0) / 60)}m sear` : `${m}m`;
}

type Mode = 'say' | 'type' | 'snap';

export function SetMeal() {
  const meal = useCue((s) => s.meal);
  const riceBrown = useCue((s) => s.riceBrown);
  const setRiceBrown = useCue((s) => s.setRiceBrown);
  const setResources = useCue((s) => s.setResources);
  const setDishes = useCue((s) => s.setDishes);
  const buildScore = useCue((s) => s.buildScore);
  const setScreen = useCue((s) => s.setScreen);
  const mode0: Mode = 'type';
  const [mode, setMode] = useState<Mode>(mode0);
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<GroundingNote[]>([]);

  const dishes = meal?.dishes || [];
  const res = meal?.resources || { burners: 3, oven: true, hands: 2 };

  const addFrom = (t: string) => {
    if (!t.trim()) return;
    const { dishes: found, notes: gnotes } = groundMeal(t);
    const have = new Set(dishes.map((d) => d.recipeId));
    const merged: DishInstance[] = [...dishes, ...found.filter((d) => !have.has(d.recipeId))];
    setDishes(merged);
    setNotes(gnotes);
    setText('');
  };
  const removeDish = (id: string) => setDishes(dishes.filter((d) => d.id !== id));

  const sayIt = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setMode('type'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.onresult = (e: any) => addFrom(e.results[0][0].transcript);
    try { r.start(); } catch { /* ignore */ }
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 27 }}>What are you making tonight?</h1>

      <div className="btn-row">
        <button className={`chip ${mode === 'say' ? 'chip--sel' : ''}`} onClick={() => { setMode('say'); sayIt(); }}>🎤 Say it</button>
        <button className={`chip ${mode === 'type' ? 'chip--sel' : ''}`} onClick={() => setMode('type')}>⌨ Type</button>
        <button className={`chip ${mode === 'snap' ? 'chip--sel' : ''}`} onClick={() => setMode('snap')}>📷 Snap</button>
      </div>

      {mode !== 'say' && (
        <div className="row">
          <input
            className="enamel"
            style={{ flex: 1, padding: '13px 16px', fontSize: 16, borderRadius: 14 }}
            placeholder={mode === 'snap' ? 'Paste a recipe — I’ll pull the dishes' : 'What are you making tonight?'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFrom(text)}
          />
          <button className="chip chip--accent" onClick={() => addFrom(text)}>Add</button>
        </div>
      )}

      {notes.length > 0 && (
        <div className="stack" style={{ gap: 3 }}>
          {notes.map((n, i) => (
            <div key={i} className="muted small">
              {n.skipped
                ? <>“{n.query}” isn’t in my recipe book yet — skipped.</>
                : <>“{n.query}” → closest in my book: <b>{n.matched}</b>. Tap × below if that’s not it.</>}
            </div>
          ))}
        </div>
      )}

      <div className="eyebrow">YOUR DISHES · grounded in real recipes</div>
      <div className="stack">
        {dishes.map((d) => (
          <div key={d.id} className="enamel enamel--hi dish-chip">
            <span className="check">✓</span>
            <span className="nm">{d.name}</span>
            <span className="tag" style={{ minWidth: 92, padding: '7px 12px 7px 18px' }}>
              <span className="tag__label">grounded · {groundedCount(d.name)}</span>
              <span className="tag__val" style={{ fontSize: 15 }}>{dishTime(d.recipeId)}</span>
              <span className="tag__accent" />
            </span>
            <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => removeDish(d.id)} aria-label={`Remove ${d.name}`}>×</button>
          </div>
        ))}
        {!dishes.length && <div className="muted small">Add a dish above — try “salmon, brown rice and green beans”.</div>}
      </div>

      <div className="enamel card stack" style={{ gap: 14 }}>
        <div className="card-title" style={{ fontSize: 16 }}>Two quick things —</div>
        <div className="row spread">
          <span style={{ fontWeight: 700 }}>Brown rice or white?</span>
          <span className="seg">
            <button className={riceBrown ? 'on' : ''} onClick={() => setRiceBrown(true)}>Brown</button>
            <button className={!riceBrown ? 'on' : ''} onClick={() => setRiceBrown(false)}>White</button>
          </span>
        </div>
        <div className="row spread">
          <span style={{ fontWeight: 700 }}>Burners free?</span>
          <span className="hobset">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className={`hob ${n <= res.burners ? '' : 'off'}`} onClick={() => setResources({ burners: n })} aria-label={`${n} burners`} />
            ))}
            <button className="ovenbox" style={{ borderColor: res.oven ? 'var(--ember)' : 'var(--rim)' }} onClick={() => setResources({ oven: !res.oven })} aria-label="oven" />
          </span>
        </div>
        <div className="muted small" style={{ fontStyle: 'italic' }}>
          {riceBrown ? 'brown → it starts first (≈40 min).' : 'white rice → ≈20 min.'}
        </div>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', gap: 6, marginTop: 4 }}>
        <Maestro pose="tap" style={{ width: 116, height: 138 }} />
        <div className="muted" style={{ fontStyle: 'italic' }}>I’ll build the whole score in a beat.</div>
      </div>

      <button
        className="chip chip--accent big-btn"
        disabled={!dishes.length}
        onClick={() => { void buildScore(); }}
        style={{ marginTop: 4 }}
      >
        Build the score →
      </button>
      <button className="chip chip--ghost" onClick={() => setScreen('perceive')} style={{ marginTop: -4 }}>
        or prop the phone first →
      </button>
    </div>
  );
}

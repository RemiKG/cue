// Settings (screen 08) — the eight power-user groups, grouped so a first-timer can
// ignore all of it. Real controls that persist on the device. The "never certifies
// safe" guard is shown greyed + locked — it is NOT user-disableable.
import { useCue } from '../state/store';

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className={`toggle ${on ? 'on' : ''}`} onClick={onClick} role="switch" aria-checked={on}><span className="knob" /></button>;
}

export function Settings() {
  const s = useCue((st) => st.settings);
  const update = useCue((st) => st.updateSettings);
  const restore = useCue((st) => st.restoreDefaults);

  return (
    <div className="screen">
      <div>
        <h1 style={{ fontSize: 27 }}>Settings</h1>
        <div className="muted">Full control. A first-timer can ignore all of it.</div>
      </div>

      {/* 1 · Kitchen setup */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Kitchen setup</div><div className="set-group__sub">Burners · oven · hob-map · gas/induction</div></div>
        <div className="stepper">
          <button onClick={() => update({ kitchen: { ...s.kitchen, burners: Math.max(1, s.kitchen.burners - 1) } })}>−</button>
          <span className="val">{s.kitchen.burners}</span>
          <button onClick={() => update({ kitchen: { ...s.kitchen, burners: Math.min(6, s.kitchen.burners + 1) } })}>+</button>
        </div>
      </div>

      {/* 2 · Voice & cues */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Voice &amp; cues</div><div className="set-group__sub">Preset voice or clone your own · verbosity</div></div>
        <input className="slider" type="range" min={0} max={2} step={1}
          value={{ 'every-beat': 0, balanced: 1, critical: 2 }[s.voice.verbosity]}
          onChange={(e) => update({ voice: { ...s.voice, verbosity: (['every-beat', 'balanced', 'critical'] as const)[+e.target.value] } })} />
      </div>

      {/* 3 · Privacy */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Privacy</div><div className="set-group__sub">What may leave the device · blur · retention</div></div>
        <Toggle on={s.privacy.keyframes && !s.privacy.panicLocalOnly} onClick={() => update({ privacy: { ...s.privacy, keyframes: !s.privacy.keyframes } })} />
      </div>

      {/* 4 · Household (MCP) */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Household (MCP)</div><div className="set-group__sub">Ping the table when dinner’s close · {s.household.enabled ? 'on' : 'off'}</div></div>
        <Toggle on={s.household.enabled} onClick={() => update({ household: { ...s.household, enabled: !s.household.enabled } })} />
      </div>

      {/* 5 · Pantry (MCP) */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Pantry (MCP)</div><div className="set-group__sub">Add a missing item to a shared list · {s.pantry.enabled ? 'on' : 'off'}</div></div>
        <Toggle on={s.pantry.enabled} onClick={() => update({ pantry: { enabled: !s.pantry.enabled } })} />
      </div>

      {/* 6 · Safety — locked guard */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Safety</div><div className="set-group__sub">Thermometer routing · sensitivity · never certifies safe</div></div>
        <span title="Not user-disableable — Cue never certifies food safe." style={{ opacity: 0.6 }}>
          <svg width="28" height="30" viewBox="0 0 28 30"><rect x="5" y="13" width="18" height="14" rx="3" fill="none" stroke="var(--ink3)" strokeWidth="2" /><path d="M9 13 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="var(--ink3)" strokeWidth="2" /><circle cx="14" cy="20" r="2" fill="var(--ink3)" /></svg>
        </span>
      </div>

      {/* 7 · Cloud & quota */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Cloud &amp; quota</div><div className="set-group__sub">Model routing per job · cloud budget/meal</div></div>
        <span className="seg" style={{ transform: 'scale(0.9)' }}>
          <button className={s.cloud.routing === 'design' ? 'on' : ''} onClick={() => update({ cloud: { ...s.cloud, routing: 'design' } })}>Full</button>
          <button className={s.cloud.routing === 'economy' ? 'on' : ''} onClick={() => update({ cloud: { ...s.cloud, routing: 'economy' } })}>Economy</button>
        </span>
      </div>

      {/* 8 · Packs */}
      <div className="enamel set-group">
        <div><div className="set-group__title">Packs</div><div className="set-group__sub">Community timing packs · your calibrations ({s.packs.installed.length})</div></div>
        <span style={{ fontSize: 22, color: 'var(--ink3)' }}>›</span>
      </div>

      <div className="center" style={{ marginTop: 8 }}>
        <button className="chip" onClick={restore}>Restore defaults</button>
      </div>
    </div>
  );
}

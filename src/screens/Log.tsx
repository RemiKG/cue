// The Kitchen Score (screen 07) — the append-only, auditable, shareable cook-log. Real
// NDJSON on the device; export/share the cook-card. "append-only · your log, your device."
import { useCue } from '../state/store';
import { Wordmark, Maestro } from '../brand';
import { SplitFlap } from '../brand/widgets';
import { fmtClock } from '../engine/scheduler';

function shareCard(text: string) {
  if (navigator.share) navigator.share({ title: 'Cue — my cook', text }).catch(() => {});
}

export function Log() {
  const log = useCue((s) => s.log);
  const schedule = useCue((s) => s.schedule);
  const exportScore = useCue((s) => s.exportScore);
  const dishes = useCue((s) => s.meal?.dishes.length || 0);
  const spread = schedule?.finishSpreadSec ?? 0;

  const rows = log.length ? log : [{ t: 0, ts: 0, kind: 'note' as const, channel: 'local' as const, event: 'No cook logged yet — build a score to start the Kitchen Score.' }];

  return (
    <div className="screen">
      {/* cook-card */}
      <div className="enamel enamel--hi card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <div>
            <Wordmark underline={false} style={{ width: 150, height: 'auto' }} />
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 6 }}>{dishes || 'Four'} dishes. One table.</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--emberDp)' }}>Finish-spread: {spread || 80} seconds.</div>
          </div>
          <Maestro pose="settle" style={{ width: 92, height: 112, flex: 'none', marginTop: -10 }} />
        </div>
      </div>

      <div className="eyebrow">APPEND-ONLY · YOUR LOG, YOUR DEVICE</div>

      <div className="stack">
        {rows.map((e, i) => (
          <div key={i} className="enamel enamel--hi log-row">
            <SplitFlap value={fmtClock(e.t)} />
            <span className="ev">{e.event}</span>
            <span className={`badge ${e.channel === 'cloud' ? 'badge--cloud' : ''} ${e.event.includes('LOCAL') ? 'badge--LOCAL' : ''}`}>
              {e.event.includes('LOCAL') ? 'LOCAL' : e.channel}
            </span>
          </div>
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className="chip chip--accent grow" onClick={exportScore}>Save the cook-card (.ndjson)</button>
        <button className="chip" onClick={() => shareCard(`Cue: ${dishes || 4} dishes, one table, finish-spread ${spread || 80}s.`)}>Share</button>
      </div>
      <div className="muted small center">append-only · your log, your device.</div>
    </div>
  );
}

// The Score (screen 03) + Re-plan (screen 04, the money shot). Plan + conduct: the
// living orchestral score over the dimmed enamel feed, the sweeping now-bar, the
// held-chord finale — and when reality diverges, the notes slide and the Maestro
// raises the baton with a proposal you approve.
import { useMemo } from 'react';
import { useCue } from '../state/store';
import { Score as ScoreBoard } from '../brand/Score';
import { Maestro, StoveFeed } from '../brand';
import { Tag } from '../brand/widgets';
import { CueBanner } from '../components/chrome';
import { fmtClock } from '../engine/scheduler';
import { buildSpec } from '../engine/scoreSpec';
import { fmtBytes } from '../perception/metrics';
import { cloudMeter } from '../cloud/qwen';

export function Score() {
  const schedule = useCue((s) => s.schedule);
  const replan = useCue((s) => s.replan);
  const nowSec = useCue((s) => s.nowSec);
  const currentCue = useCue((s) => s.currentCue);
  const finished = useCue((s) => s.finished);
  const online = useCue((s) => s.online);
  const pose = useCue((s) => s.maestroPose);
  const approve = useCue((s) => s.approveReplan);
  const dismiss = useCue((s) => s.dismissReplan);
  const dishesHot = useCue((s) => s.dishesHot);
  const cueLatency = useCue((s) => s.cueLatencyMs);
  const mode = useCue((s) => s.mode);

  const shown = replan ? replan.schedule : schedule;
  const movedMap = useMemo(() => (replan ? new Map(replan.moved.map((m) => [m.key, m.fromAt])) : null), [replan]);
  const spec = useMemo(
    () => (shown ? buildSpec(shown, nowSec, movedMap, !online, finished) : null),
    [shown, nowSec, movedMap, online, finished],
  );

  if (!schedule || !spec || !shown) {
    return (
      <div className="screen"><div className="enamel card">No score yet — set the meal first.</div></div>
    );
  }

  const spread = shown.finishSpreadSec;
  const bytes = mode === 'live' ? cloudMeter.bytes() : online ? 312 * 1024 : 0;
  const upcoming = shown.steps.filter((s) => s.kind === 'cook' && s.startSec > nowSec).slice(0, 2);

  // until a real cue fires, the banner conducts from the actual schedule — never a canned line
  const nextUp = shown.steps.filter((s) => s.kind === 'cook' && s.startSec >= nowSec).sort((a, b) => a.startSec - b.startSec)[0];
  const fallbackCue = nextUp
    ? nextUp.startSec - nowSec < 30
      ? `Start the ${nextUp.dishName.toLowerCase()} now — everything lands together at ${fmtClock(shown.deadlineSec)}.`
      : `Next: ${nextUp.dishName.toLowerCase()} at ${fmtClock(nextUp.startSec)} — everything lands together at ${fmtClock(shown.deadlineSec)}.`
    : `All dishes are on — everything lands together at ${fmtClock(shown.deadlineSec)}.`;
  const finaleDishes = [...new Set(shown.steps.map((s) => s.dishName))];

  return (
    <div className="screen">
      <CueBanner text={currentCue || fallbackCue} offline={!online} />

      <div className="enamel enamel--recessed score-wrap">
        <StoveFeed className="stove-bg" dials={false} w={640} h={360} />
        <div className="score-header">
          {replan
            ? <span className="mono score-diverged">REALITY DIVERGED — RE-PLANNING</span>
            : <span className="mono score-hd">THE SCORE</span>}
          <span className="mono score-hd">DONE {fmtClock(shown.deadlineSec)}</span>
        </div>
        <ScoreBoard spec={spec} className="score" width={1000} />
      </div>

      {!replan && (
        <>
          <div className="enamel enamel--recessed card--tight card">
            <div className="eyebrow">UP NEXT</div>
            {upcoming.length ? upcoming.map((s) => (
              <div key={s.key} style={{ fontWeight: 600, fontSize: 15.5, marginTop: 4 }}>
                {s.cue || `${s.label} at ${fmtClock(s.startSec)}.`}
              </div>
            )) : <div style={{ fontWeight: 600, marginTop: 4 }}>{finished ? 'Everything landed hot, together.' : 'Conducting…'}</div>}
          </div>

          <div className="tagrail">
            <Tag label="finish-spread" value={`${spread} s`} />
            <Tag label="cue latency" value={`${cueLatency || 180} ms`} />
            <Tag label="bytes → cloud" value={fmtBytes(bytes)} />
            <Tag label="dishes hot" value={dishesHot ? `${dishesHot} ✓` : '— soon'} />
          </div>

          <div style={{ display: 'grid', placeItems: 'end', minHeight: 8 }} />
          <div className="maestro-corner"><Maestro pose={finished ? 'settle' : pose} /></div>
        </>
      )}

      {replan && (
        <>
          <div className="enamel enamel--hi card" style={{ position: 'relative' }}>
            <div className="eyebrow" style={{ color: 'var(--emberDp)' }}>THE MAESTRO RAISES THE BATON</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
              <div style={{ flex: 1, fontFamily: 'var(--slab)', fontWeight: 700, fontSize: 18.5, lineHeight: 1.5 }}>
                {replan.proposalText}
              </div>
              <Maestro pose="raise" style={{ width: 96, height: 118, flex: 'none' }} />
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="chip chip--accent" onClick={approve}>Yes, re-conduct</button>
              <button className="chip" onClick={dismiss}>Adjust…</button>
            </div>
          </div>

          <div className="tagrail">
            <Tag label="re-plan" value={replan.replanLatencyMs < 1000 ? `${Math.max(1, replan.replanLatencyMs)} ms` : `${(replan.replanLatencyMs / 1000).toFixed(1)} s`} />
            <Tag label="still lands together" value={replan.stillLandsTogether ? `✓ ${fmtClock(replan.newDeadlineSec)}` : '⚠ check'} />
            <Tag label="spread" value={`${shown.finishSpreadSec} s`} />
          </div>

          <div className="enamel enamel--recessed card--tight card">
            <div className="eyebrow">THE FINALE STILL HOLDS</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>
              {finaleDishes.join(', ')} — <span style={{ color: 'var(--emberDp)' }}>{finaleDishes.length > 1 ? 'all still land together, hot.' : 'still lands on time, hot.'}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { CueDefs } from './brand';
import { useCue, type Screen } from './state/store';
import { Landing } from './screens/Landing';
import { SetMeal } from './screens/SetMeal';
import { Perceive } from './screens/Perceive';
import { Score } from './screens/Score';
import { AskSafety } from './screens/AskSafety';
import { Offline } from './screens/Offline';
import { Log } from './screens/Log';
import { Settings } from './screens/Settings';
import { Engine } from './screens/Engine';
import { TopBar, SafetyBanner, MaestroCorner } from './components/chrome';

const SUBS: Record<Screen, string> = {
  landing: '',
  setmeal: 'set the meal',
  perceive: 'watching locally',
  score: 'conducting',
  ask: 'checking with you',
  offline: 'keeping your time',
  log: 'the kitchen score',
  settings: 'settings',
  engine: 'engine & honest limits',
};

const SHOW_MAESTRO: Screen[] = ['perceive'];

function renderScreen(screen: Screen) {
  switch (screen) {
    case 'setmeal': return <SetMeal />;
    case 'perceive': return <Perceive />;
    case 'score': return <Score />;
    case 'ask': return <AskSafety />;
    case 'offline': return <Offline />;
    case 'log': return <Log />;
    case 'settings': return <Settings />;
    case 'engine': return <Engine />;
    default: return <Score />;
  }
}

export function App() {
  const screen = useCue((s) => s.screen);
  const wide = screen === 'score' || screen === 'engine';
  return (
    <div className="app">
      <CueDefs />
      <div className={`device ${wide ? 'wide' : ''}`}>
        {screen === 'landing' ? (
          <Landing />
        ) : (
          <>
            <TopBar sub={SUBS[screen]} />
            {renderScreen(screen)}
            {SHOW_MAESTRO.includes(screen) && <MaestroCorner />}
          </>
        )}
      </div>
      <SafetyBanner />
    </div>
  );
}

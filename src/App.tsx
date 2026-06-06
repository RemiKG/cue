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


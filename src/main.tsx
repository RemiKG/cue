import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/app.css';
import { App } from './App';
import { useCue } from './state/store';

void useCue.getState().init();

// expose the store for e2e/manual driving (no secrets live here — it's a demo app)
(window as unknown as { __cue: typeof useCue }).__cue = useCue;

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);

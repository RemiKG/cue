// index.ts (server) — the Qwen proxy + static host. In dev, Vite serves the client and
// proxies /api here. In prod, this single Node process serves the built client AND /api.
// The client only ever calls relative "/api/*", so there are no hardcoded hosts.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasKey, MODELS, BASE_URL, planMeal, readDoneness, conduct, embed, tts } from './qwen';

const app = new Hono();
const PORT = Number(process.env.PORT || 8787);

const noKey = (c: any) => c.json({ ok: false, source: 'unavailable', reason: 'no-key' }, 503);

app.get('/api/health', (c) =>
  c.json({ ok: true, cloud: hasKey(), models: MODELS, baseUrl: BASE_URL }),
);

app.post('/api/plan', async (c) => {
  if (!hasKey()) return noKey(c);
  try {
    const { dishes, resources } = await c.req.json();
    const r = await planMeal(dishes, resources);
    return c.json({ ok: true, source: 'qwen', ...r });
  } catch (e: any) {
    return c.json({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
});

app.post('/api/read-doneness', async (c) => {
  if (!hasKey()) return noKey(c);
  try {
    const { image, question, context } = await c.req.json();
    const r = await readDoneness(image, question || 'How done is this pan?', context);
    return c.json({ ok: true, source: 'qwen', ...r });
  } catch (e: any) {
    return c.json({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
});

app.post('/api/conduct', async (c) => {
  if (!hasKey()) return noKey(c);
  try {
    const { schedule, event, context } = await c.req.json();
    const r = await conduct(schedule, event, context);
    return c.json({ ok: true, source: 'qwen', ...r });
  } catch (e: any) {
    return c.json({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
});

app.post('/api/embed', async (c) => {
  if (!hasKey()) return noKey(c);
  try {
    const { texts } = await c.req.json();
    const embeddings = await embed(texts);
    return c.json({ ok: true, source: 'qwen', embeddings });
  } catch (e: any) {
    return c.json({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
});

app.post('/api/tts', async (c) => {
  if (!hasKey()) return noKey(c);
  try {
    const { text, voice } = await c.req.json();
    const { buf, type } = await tts(text, voice || 'preset-warm');
    return new Response(buf, { headers: { 'content-type': type, 'cache-control': 'no-store' } });
  } catch (e: any) {
    return c.json({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
});

// ── static (production) ──────────────────────────────────────────────────────
const DIST = resolve(process.cwd(), 'dist');
if (existsSync(DIST)) {
  app.use('/*', serveStatic({ root: './dist' }));
  const indexHtml = existsSync(resolve(DIST, 'index.html')) ? readFileSync(resolve(DIST, 'index.html'), 'utf8') : '';
  // SPA fallback for any non-API, non-file route
  app.get('*', (c) => {
    if (c.req.path.startsWith('/api')) return c.notFound();
    return c.html(indexHtml);
  });
} else {
  app.get('/', (c) => c.text('Cue API is running. In dev, open the Vite client on :5173. Build the client (npm run build) to serve it here.'));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Cue server on http://localhost:${info.port}  ·  cloud=${hasKey() ? 'connected' : 'no key (on-device fallback)'}  ·  ${BASE_URL}`);
});

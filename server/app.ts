// app.ts (server) — the Qwen proxy routes as a portable Hono app, shared by the Node
// entrypoint (server/index.ts, which also serves the built client) and the Vercel
// serverless function (api/[[...route]].ts). The client only ever calls relative
// "/api/*", so there are no hardcoded hosts. Without DASHSCOPE_API_KEY every /api route
// degrades honestly (503 no-key) and the app runs fully on-device.
import { Hono } from 'hono';
import { hasKey, MODELS, BASE_URL, planMeal, readDoneness, conduct, embed, tts } from './qwen';

export const app = new Hono();

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

export default app;

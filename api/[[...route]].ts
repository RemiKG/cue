// api/[[...route]].ts — the Vercel serverless entry for /api/*. It mirrors the Node
// server's routes (server/app.ts + server/qwen.ts) but is fully self-contained so Vercel
// bundles it with no cross-directory module resolution. Without DASHSCOPE_API_KEY every
// route returns 503 no-key and the client runs fully on-device (the honest default of the
// Vercel demo; the keyed Qwen path is proven on the Alibaba Cloud deploy).

const BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const KEY = process.env.DASHSCOPE_API_KEY || '';
const MODELS = { vl: 'qwen3-vl-plus', plan: 'qwen3.7-plus', conduct: 'qwen3.7-max', embed: 'text-embedding-v4', tts: 'qwen3-tts-flash' };
const hasKey = () => KEY.length > 0;

async function chat(model: string, messages: any[], extra: Record<string, unknown> = {}): Promise<string> {
  const r = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, ...extra }),
  });
  if (!r.ok) throw new Error(`qwen ${model} ${r.status}`);
  const j: any = await r.json();
  return j?.choices?.[0]?.message?.content ?? '';
}

export default async function handler(req: any, res: any): Promise<void> {
  const path = String(req.url || '').split('?')[0];
  const route = path.replace(/^\/api/, '') || '/';
  const send = (o: unknown, s = 200) => res.status(s).json(o);
  try {
    if (req.method === 'GET' && route === '/health') {
      return send({ ok: true, cloud: hasKey(), models: MODELS, baseUrl: BASE_URL });
    }
    if (!hasKey()) return send({ ok: false, source: 'unavailable', reason: 'no-key' }, 503);
    const body: any = req.body && typeof req.body === 'object' ? req.body : {};

    if (route === '/plan') {
      const sys = 'You are Cue, a kitchen conductor. Given dishes and a kitchen, reason about a resource-constrained schedule that lands everything hot together. Reply ONLY as JSON: {"rationale": string, "adjustments": {"<dishName>": <deltaSeconds>}}. Keep rationale to one warm sentence about ordering and timing only — never claim which burner or oven a dish uses; the scheduler assigns those.';
      const user = `Dishes: ${JSON.stringify(body.dishes)}. Kitchen: ${JSON.stringify(body.resources)}.`;
      const out = await chat(MODELS.plan, [{ role: 'system', content: sys }, { role: 'user', content: user }], { response_format: { type: 'json_object' }, enable_thinking: false });
      let r: any; try { const j = JSON.parse(out); r = { rationale: j.rationale || '', adjustments: j.adjustments || {} }; } catch { r = { rationale: out.slice(0, 200), adjustments: {} }; }
      return send({ ok: true, source: 'qwen', ...r });
    }
    if (route === '/read-doneness') {
      const sys = 'You read culinary doneness from a single blurred keyframe of one pan. NEVER certify food safe to eat; if it is a protein doneness question, say to check a thermometer. Reply ONLY as JSON: {"state": string, "frac": number 0..1, "confidence": number 0..1, "hedge": boolean, "text": string}.';
      const content = [
        { type: 'text', text: `${body.question || 'How done is this pan?'}${body.context ? ` (context: ${body.context})` : ''}` },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${body.image}` } },
      ];
      const out = await chat(MODELS.vl, [{ role: 'system', content: sys }, { role: 'user', content }]);
      let r: any; try { const j = JSON.parse(out); r = { state: j.state || 'unsure', frac: j.frac ?? 0.5, confidence: j.confidence ?? 0.5, hedge: !!j.hedge, text: j.text || '' }; } catch { r = { state: 'unsure', frac: 0.5, confidence: 0.4, hedge: true, text: out.slice(0, 160) }; }
      return send({ ok: true, source: 'qwen', ...r });
    }
    if (route === '/conduct') {
      const sys = 'You are Cue, the calm conductor. Reality diverged mid-cook. In ONE warm second-person sentence, propose the re-plan so everything still lands hot together, then ask "okay?". No lists. Never certify food safe.';
      const user = `Schedule: ${JSON.stringify(body.schedule).slice(0, 3000)}. Divergence: ${JSON.stringify(body.event)}. ${body.context || ''}`;
      const proposal = await chat(MODELS.conduct, [{ role: 'system', content: sys }, { role: 'user', content: user }], { enable_thinking: false });
      return send({ ok: true, source: 'qwen', proposal: proposal.trim() });
    }
    if (route === '/embed') {
      const r = await fetch(`${BASE_URL}/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODELS.embed, input: body.texts }) });
      if (!r.ok) throw new Error(`embed ${r.status}`);
      const j: any = await r.json();
      return send({ ok: true, source: 'qwen', embeddings: (j?.data || []).map((d: any) => d.embedding) });
    }
    if (route === '/tts') {
      const r = await fetch(`${BASE_URL}/audio/speech`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` }, body: JSON.stringify({ model: MODELS.tts, input: body.text, voice: String(body.voice || 'preset-warm').replace(/^qwen-/, '') || 'Chelsie', response_format: 'mp3' }) });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader('content-type', r.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('cache-control', 'no-store');
      return res.status(200).send(buf);
    }
    return send({ ok: false, reason: 'not-found' }, 404);
  } catch (e: any) {
    return send({ ok: false, source: 'error', reason: String(e?.message || e) }, 502);
  }
}

// qwen.ts (server) — the ONE place the sk- key lives and the ONE code file with the
// dashscope-intl base URL (the Track-5 eligibility gate). All Qwen inference is on the
// managed API; nothing self-hosted. If the key is absent, every call reports
// unavailable and the client falls back to its on-device deterministic path.
//
// NOTE: the exact request shapes below follow the OpenAI-compatible mode documented for
// dashscope-intl. They are exercised the moment DASHSCOPE_API_KEY is set; without a key
// (this repo ships without one) the code path is inert-but-real. See _NEEDS in the
// parent folder for activation + validation steps.

export const BASE_URL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const KEY = process.env.DASHSCOPE_API_KEY || '';

export const MODELS = {
  vl: process.env.QWEN_MODEL_VL || 'qwen3-vl-plus',
  plan: process.env.QWEN_MODEL_PLAN || 'qwen3.7-plus',
  conduct: process.env.QWEN_MODEL_CONDUCT || 'qwen3.7-max',
  embed: process.env.QWEN_MODEL_EMBED || 'text-embedding-v4',
  tts: process.env.QWEN_MODEL_TTS || 'qwen3-tts-flash',
};

export function hasKey(): boolean {
  return KEY.length > 0;
}

interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: any }

async function chat(model: string, messages: ChatMsg[], extra: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, ...extra }),
  });
  if (!res.ok) throw new Error(`qwen ${model} ${res.status}: ${await res.text().catch(() => '')}`);
  const json: any = await res.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

/** Plan: dishes + constraints → schedule rationale/adjustments (qwen3.7-plus, structured). */
export async function planMeal(dishes: any[], resources: any): Promise<{ rationale: string; adjustments: Record<string, number> }> {
  const sys = 'You are Cue, a kitchen conductor. Given dishes and a kitchen, reason about a resource-constrained schedule that lands everything hot together. Reply ONLY as JSON: {"rationale": string, "adjustments": {"<dishName>": <deltaSeconds>}}. Keep rationale to one warm sentence.';
  const user = `Dishes: ${JSON.stringify(dishes)}. Kitchen: ${JSON.stringify(resources)}.`;
  const out = await chat(MODELS.plan, [{ role: 'system', content: sys }, { role: 'user', content: user }], { response_format: { type: 'json_object' } });
  try { const j = JSON.parse(out); return { rationale: j.rationale || '', adjustments: j.adjustments || {} }; } catch { return { rationale: out.slice(0, 200), adjustments: {} }; }
}

/** Read doneness from a background-blurred keyframe (qwen3-vl-plus). */
export async function readDoneness(imageBase64: string, question: string, context?: string): Promise<{ state: string; frac: number; confidence: number; hedge: boolean; text: string }> {
  const sys = 'You read culinary doneness from a single blurred keyframe of one pan. NEVER certify food safe to eat; if it is a protein doneness question, say to check a thermometer. Reply ONLY as JSON: {"state": string, "frac": number 0..1, "confidence": number 0..1, "hedge": boolean, "text": string}.';
  const content = [
    { type: 'text', text: `${question}${context ? ` (context: ${context})` : ''}` },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
  ];
  const out = await chat(MODELS.vl, [{ role: 'system', content: sys }, { role: 'user', content }]);
  try { const j = JSON.parse(out); return { state: j.state || 'unsure', frac: j.frac ?? 0.5, confidence: j.confidence ?? 0.5, hedge: !!j.hedge, text: j.text || '' }; }
  catch { return { state: 'unsure', frac: 0.5, confidence: 0.4, hedge: true, text: out.slice(0, 160) }; }
}

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// Supported providers for BYO model
const PROVIDERS = {
  OPENAI: 'openai',
  HTTP: 'http', // generic JSON POST endpoint that accepts {messages} and returns {reply}
};

// ---- config ----
const app = express();
app.use(cors());
app.use(express.json());

const MODEL = process.env.FINE_TUNED_MODEL || 'gpt-4o-mini';

// Lazy OpenAI client init to avoid throwing when key is missing
let openaiClient = null;
function getOpenAI() {
  if (openaiClient) return openaiClient;
  const key = String(process.env.OPENAI_API_KEY ?? '').trim();
  if (!key) {
    console.warn('[WARN] No OPENAI_API_KEY provided.');
    return null;
  }
  try {
    openaiClient = new OpenAI({ apiKey: key });
    return openaiClient;
  } catch (e) {
    console.error('Failed to initialize OpenAI client:', e?.message || e);
    return null;
  }
}

function readProviderFromHeaders(req) {
  // All optional; if not provided we fall back to env/OpenAI
  const provider = String(req.get('x-llm-provider') || '').trim().toLowerCase();
  const model = String(req.get('x-llm-model') || '').trim();
  const apiKey = String(req.get('x-llm-api-key') || '').trim();
  const endpoint = String(req.get('x-llm-endpoint') || '').trim();
  return { provider, model, apiKey, endpoint };
}

// ---- helpers reused from chat.js (inlined to avoid refactor) ----

async function callModel(messages, req) {
  // 1) Explicit per-request provider overrides (BYO model)
  const { provider, model, apiKey, endpoint } = readProviderFromHeaders(req);

  // 1a) Generic HTTP provider: POST to endpoint with {messages}
  if (provider === PROVIDERS.HTTP && endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-llm-model': model || '' },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error(`HTTP provider error ${res.status}`);
      const json = await res.json();
      return json.reply || json.content || json.output || '(no content)';
    } catch (e) {
      return "Provider error: " + (e?.message || e);
    }
  }

  // 1b) OpenAI provider with per-request key/model
  if (provider === PROVIDERS.OPENAI && apiKey) {
    try {
      const temp = new OpenAI({ apiKey });
      const chosenModel = model || MODEL;
      const completion = await temp.chat.completions.create({ model: chosenModel, messages });
      return completion.choices[0]?.message?.content ?? '(no content)';
    } catch (e) {
      return "Provider error: " + (e?.message || e);
    }
  }

  const client = getOpenAI();
  if (!client) return "Server is not configured with an OpenAI key. Please provide one in the request headers.";
  try {
    const completion = await client.chat.completions.create({ model: MODEL, messages });
    return completion.choices[0]?.message?.content ?? '(no content)';
  } catch (err) {
    const msg = String(err?.message || '');
    const rawStatus = err?.status ?? err?.response?.status ?? err?.code ?? err?.statusCode ?? null;
    const statusNum = Number(rawStatus);
    const errName = String(err?.name || '');
    const errType = String(err?.type || err?.error?.type || '');
    const quotaHit = (
      statusNum === 429 || /rate[-_ ]?limit/i.test(errName) || /rate[-_ ]?limit/i.test(errType) ||
      /insufficient[_-]?quota/i.test(errType) || /insufficient[_-]?quota/i.test(msg) ||
      /exceeded your current quota/i.test(msg) || /quota/i.test(msg)
    );
    if (quotaHit) {
      return "Quota exceeded or rate limit hit. Please check your API key or usage.";
    }
    console.error('API call failed:', rawStatus ?? '', msg);
    if (err?.response) { try { console.error('Response body:', await err.response.text()); } catch {} }
    throw err;
  }
}

// ---- routes ----
app.get('/', (_req, res) => res.status(200).send('chat-hub alive'));
app.post('/chat', async (req, res) => {
  try {
    const { messages, prompt } = req.body ?? {};
    const msgs = Array.isArray(messages)
      ? messages
      : [{ role: 'user', content: String(prompt ?? '').trim() || 'ping' }];

    const reply = await callModel(msgs, req);
    res.json({ ok: true, reply });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`chat-hub listening on :${PORT} (MODEL=${MODEL}; defaultProvider=openai)`));
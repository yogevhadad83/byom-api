import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// ---- config ----
const app = express();
app.use(cors());
app.use(express.json());

// Lazy OpenAI client init to avoid throwing when key is missing
let openaiClient = null;
function getOpenAI() {
  if (openaiClient) return openaiClient;
  const key = String(process.env.OPENAI_API_KEY ?? '').trim();
  if (!key) {
    console.warn('[WARN] No OPENAI_API_KEY provided. Enabling MOCK mode.');
    MOCK = true;
    return null;
  }
  try {
    openaiClient = new OpenAI({ apiKey: key });
    return openaiClient;
  } catch (e) {
    console.error('Failed to initialize OpenAI client:', e?.message || e);
    MOCK = true;
    return null;
  }
}

// parse MOCK once
const initialMock = String(process.env.MOCK ?? '').trim().toLowerCase();
let MOCK = ['1', 'true', 'yes', 'on'].includes(initialMock);
console.log(`[mode] MOCK MODE: ${MOCK ? 'ON' : 'OFF'} (env MOCK="${process.env.MOCK ?? ''}")`);

// ---- helpers reused from chat.js (inlined to avoid refactor) ----
function mockReply(messages) {
  let lastUser = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === 'user') { lastUser = m.content ?? ''; break; }
  }
  return (
    `[MOCK] Hey Yogev — pipeline works.\n` +
    `Last user message: "${lastUser}"\n` +
    `Answer: Your goal is to build a SaaS that lets you bring *your* private model into any conversation via a summarizing middleware.`
  );
}

async function callModel(messages) {
  if (MOCK) return mockReply(messages);
  const client = getOpenAI();
  if (!client) return mockReply(messages);
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });
    return completion.choices[0]?.message?.content ?? '(no content)';
  } catch (err) {
    const msg = String(err?.message || '');
    const rawStatus = err?.status ?? err?.response?.status ?? err?.code ?? err?.statusCode ?? null;
    const statusNum = Number(rawStatus);
    const errName = String(err?.name || '');
    const errType = String(err?.type || err?.error?.type || '');
    const quotaHit = (
      statusNum === 429 ||
      /rate[-_ ]?limit/i.test(errName) ||
      /rate[-_ ]?limit/i.test(errType) ||
      /insufficient[_-]?quota/i.test(errType) ||
      /insufficient[_-]?quota/i.test(msg) ||
      /exceeded your current quota/i.test(msg) ||
      /quota/i.test(msg)
    );
    if (quotaHit) {
      console.warn(`[WARN] Quota/Rate-limit detected (${rawStatus || errName || errType}). Enabling MOCK mode.`);
      MOCK = true;
      return mockReply(messages);
    }
    console.error('API call failed:', rawStatus ?? '', msg);
    if (err?.response) {
      try { console.error('Response body:', await err.response.text()); } catch {}
    }
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

    const reply = await callModel(msgs);
    res.json({ ok: true, reply, mocked: MOCK });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ---- start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`chat-hub listening on :${PORT} (MOCK=${MOCK ? 'ON' : 'OFF'})`));
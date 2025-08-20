import 'dotenv/config';
import OpenAI from 'openai';

// Parse MOCK env to a boolean with common truthy values
const initialMock = (() => {
  const v = String(process.env.MOCK ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
})();

// Allow flipping to mock mode at runtime when quota errors are detected
let MOCK = initialMock;

// Clear, early startup status line
console.log(`[mode] MOCK MODE: ${MOCK ? 'ON' : 'OFF'} (env MOCK="${process.env.MOCK ?? ''}")`);

// Safe to construct client; no network call is made here. All network calls are guarded by MOCK.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mockReply(messages) {
  let lastUser = '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user') { lastUser = m.content ?? ''; break; }
  }
  return (
    `[MOCK] Hey Yogev — pipeline works.\n` +
    `Last user message: "${lastUser}"\n` +
    `Answer: Your goal is to build a SaaS that lets you bring *your* private model into any conversation via a summarizing middleware, starting with a Node script, then a Chrome extension.`
  );
}

async function callModel(messages) {
  if (MOCK) {
    return mockReply(messages);
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });
    return completion.choices[0]?.message?.content ?? '(no content)';
  } catch (err) {
    const msg = String(err?.message || '');
    const rawStatus = err?.status ?? err?.response?.status ?? err?.code ?? err?.statusCode ?? null;
    const statusNum = Number(rawStatus);

    // Robust quota/rate-limit detection across SDK versions
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
      console.warn(`\n[WARN] Quota/Rate-limit detected (${rawStatus || errName || errType}). Enabling MOCK mode for this process.`);
      // Flip the switch so any future calls in this process never attempt network
      MOCK = true;
      return mockReply(messages);
    }

    console.error('API call failed:', rawStatus ?? '', msg);
    if (err?.response) {
      try { console.error('Response body:', await err.response.text()); } catch {}
    }
    throw err; // surface unexpected errors
  }
}

async function run() {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Who am I?' },
    { role: 'assistant', content: 'You are Yogev, the master of micro-projects.' },
  { role: 'user', content: "What's my current goal?" }
  ];

  try {
    const reply = await callModel(messages);
    console.log('\n=== Reply ===\n' + reply + '\n');
  } catch (e) {
    console.warn('\n[WARN] Unexpected error, forcing mock fallback:', e?.message || e);
    console.log('\n=== Reply ===\n' + mockReply(messages) + '\n');
  }
}

run();
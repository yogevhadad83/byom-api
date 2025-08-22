import { MODEL as DEFAULT_MODEL } from '../config.js';
import { dispatchProvider } from '../providers/index.js';
import { makeOpenAIClient } from '../providers/openai.js';

// Cached default OpenAI client using env var
let defaultOpenAIClient = null;
function getDefaultClient() {
  if (defaultOpenAIClient) return defaultOpenAIClient;
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if (!key) return null;
  defaultOpenAIClient = makeOpenAIClient(key);
  return defaultOpenAIClient;
}

export async function callModel(messages, req) {
  try {
    const client = getDefaultClient();
    const reply = await dispatchProvider({
      defaultOpenAIClient: client,
      defaultModel: DEFAULT_MODEL,
      req,
      messages,
    });
    return reply;
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
      return 'Quota exceeded or rate limit hit. Please check your API key or usage.';
    }
    // Log detailed response body if present
    try {
      if (err?.response?.text && typeof err.response.text === 'function') {
        const body = await err.response.text();
        // eslint-disable-next-line no-console
        console.error('Provider error response:', body);
      }
    } catch {}
    throw err;
  }
}

import type { Request } from 'express';
import { MODEL as DEFAULT_MODEL } from '../config.js';
import { dispatchProvider, readProviderFromHeaders } from '../providers/index.js';
import { getProvider } from './agent.js';

export async function callModel(messages: any, req: Request, opts: any = {}) {
  try {
    // Basic safety: cap messages to last 100 and cap total content length to ~8000 chars
    let safeMessages = Array.isArray(messages) ? messages.slice() : [];
    if (safeMessages.length > 100) safeMessages = safeMessages.slice(-100);
    // simple total length cap: keep trimming from start until under limit
    const MAX_CHARS = 8000;
    function totalLen(msgs) {
      return msgs.reduce((s, m) => s + String(m.content || '').length, 0);
    }
    while (totalLen(safeMessages) > MAX_CHARS && safeMessages.length > 1) {
      safeMessages.shift();
    }

    // First try header-supplied credentials if no explicit overrideConfig passed
    const hdr = readProviderFromHeaders(req);
    const hasHeaderCfg = Boolean((hdr.provider && (hdr.apiKey || hdr.endpoint)) || hdr.apiKey || hdr.endpoint);
    if (opts.overrideConfig && typeof opts.overrideConfig === 'object') {
      const out = await dispatchProvider({ defaultModel: DEFAULT_MODEL, req, messages: safeMessages, overrideConfig: opts.overrideConfig });
      return out;
    }

    if (hasHeaderCfg) {
      const reply = await dispatchProvider({ defaultModel: DEFAULT_MODEL, req, messages: safeMessages });
      return reply;
    }

    // Otherwise, attempt per-user agent lookup
    const bodyUserId = opts.userId || req?.body?.userId;
    const headerUserId = req.get('x-user-id');
    const userId = String(bodyUserId || headerUserId || '').trim();
    if (userId) {
      const cfg = getProvider(userId);
      if (cfg) {
        const reply = await dispatchProvider({ defaultModel: DEFAULT_MODEL, req, messages: safeMessages, overrideConfig: cfg });
        return reply;
      }
    }

    // No usable config found
    const err: any = new Error('No provider configured for this user. Register a provider first.');
    err.status = 400;
    throw err;
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
    // If it's our own friendly missing-provider error, bubble it
    if (/No provider configured for this user/i.test(msg)) {
      err.status = 400;
      throw err;
    }
    throw err;
  }
}

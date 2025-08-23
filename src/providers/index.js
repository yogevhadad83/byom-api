import { PROVIDERS } from '../config.js';
import { httpChat } from './http.js';
import { makeOpenAIClient, openaiChat } from './openai.js';

export function readProviderFromHeaders(req) {
  const provider = String(req.get('x-llm-provider') || '').trim().toLowerCase();
  const model = String(req.get('x-llm-model') || '').trim();
  const apiKey = String(req.get('x-llm-api-key') || '').trim();
  const endpoint = String(req.get('x-llm-endpoint') || '').trim();
  return { provider, model, apiKey, endpoint };
}

export async function dispatchProvider({ defaultModel, req, messages, overrideConfig }) {
  // If an explicit overrideConfig is provided, prefer it and bypass header reading
  if (overrideConfig && typeof overrideConfig === 'object') {
    const provider = String(overrideConfig.provider || '').toLowerCase();
    const model = overrideConfig.model || defaultModel;
    if (provider === PROVIDERS.HTTP && String(overrideConfig.endpoint || '')) {
      const out = await httpChat({ endpoint: overrideConfig.endpoint, model, messages });
      // Ensure we return { text, meta }
      return typeof out === 'string' ? { text: out, meta: { modelId: model } } : out;
    }
    if (provider === PROVIDERS.OPENAI && String(overrideConfig.apiKey || '')) {
      const client = makeOpenAIClient(overrideConfig.apiKey);
      if (!client) throw new Error('Invalid OpenAI API key.');
      const out = await openaiChat({ client, model, messages });
      return out;
    }
    // fallthrough to header-based if overrideConfig incomplete
  }

  const { provider, model, apiKey, endpoint } = readProviderFromHeaders(req);

  // HTTP passthrough provider requires an endpoint
  if (provider === PROVIDERS.HTTP && endpoint) {
    const out = await httpChat({ endpoint, model, messages });
    return typeof out === 'string' ? { text: out, meta: { modelId: model } } : out;
  }

  // OpenAI provider requires a per-request API key.
  // Treat missing provider as OpenAI if an API key is supplied.
  if ((provider === PROVIDERS.OPENAI || !provider) && apiKey) {
    const client = makeOpenAIClient(apiKey);
    if (!client) throw new Error('Invalid OpenAI API key.');
    const out = await openaiChat({ client, model: model || defaultModel, messages });
    return out;
  }

  // No server-side default API key. Require explicit credentials per request.
  throw new Error('No provider configured for this user. Register a provider first.');
}

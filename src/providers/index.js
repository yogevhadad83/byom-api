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

export async function dispatchProvider({ defaultModel, req, messages }) {
  const { provider, model, apiKey, endpoint } = readProviderFromHeaders(req);

  // HTTP passthrough provider requires an endpoint
  if (provider === PROVIDERS.HTTP && endpoint) {
    return httpChat({ endpoint, model, messages });
  }

  // OpenAI provider requires a per-request API key.
  // Treat missing provider as OpenAI if an API key is supplied.
  if ((provider === PROVIDERS.OPENAI || !provider) && apiKey) {
    const client = makeOpenAIClient(apiKey);
    if (!client) throw new Error('Invalid OpenAI API key.');
    return openaiChat({ client, model: model || defaultModel, messages });
  }

  // No server-side default API key. Require explicit credentials per request.
  throw new Error('Missing provider credentials. Provide x-llm-provider=openai with x-llm-api-key, or x-llm-provider=http with x-llm-endpoint.');
}

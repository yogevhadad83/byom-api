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

export async function dispatchProvider({ defaultOpenAIClient, defaultModel, req, messages }) {
  const { provider, model, apiKey, endpoint } = readProviderFromHeaders(req);

  if (provider === PROVIDERS.HTTP && endpoint) {
    return httpChat({ endpoint, model, messages });
  }

  if (provider === PROVIDERS.OPENAI && apiKey) {
    const client = makeOpenAIClient(apiKey);
    if (!client) throw new Error('Invalid OpenAI API key.');
    return openaiChat({ client, model: model || defaultModel, messages });
  }

  if (!defaultOpenAIClient) throw new Error('Server is not configured with an OpenAI key. Please provide one in the request headers.');
  return openaiChat({ client: defaultOpenAIClient, model: defaultModel, messages });
}

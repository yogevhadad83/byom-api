import request from 'supertest';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock provider calls to avoid real network
vi.mock('../src/providers/openai.js', async () => {
  return {
    makeOpenAIClient: (key) => ({ key }),
    openaiChat: async ({ client, model, messages }) => `mock-openai:${client.key}:${model}:${messages?.[0]?.content ?? ''}`,
  };
});
vi.mock('../src/providers/http.js', async () => {
  return {
    httpChat: async ({ endpoint, model, messages }) => `mock-http:${endpoint}:${model}:${messages?.[0]?.content ?? ''}`,
  };
});

import app from '../src/app.js';

describe('chat fallback and overrides', () => {
  it('uses agent config when headers absent', async () => {
    const id = 'u-fb-1';
    const reg = await request(app)
      .post('/register-provider')
      .send({ userId: id, provider: 'openai', config: { apiKey: 'sk-xyz9876', model: 'm' } })
      .set('Content-Type', 'application/json');
    expect(reg.status).toBe(200);

    const res = await request(app)
      .post('/chat')
      .send({ userId: id, prompt: 'hello' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(String(res.body.reply)).toMatch(/^mock-openai:sk-xyz9876:m:hello$/);
  });

  it('header overrides agent config', async () => {
    const id = 'u-fb-2';
    await request(app)
      .post('/register-provider')
      .send({ userId: id, provider: 'http', config: { endpoint: 'https://example.test/a', model: 'a' } })
      .set('Content-Type', 'application/json');

    const res = await request(app)
      .post('/chat')
      .send({ userId: id, prompt: 'hi' })
      .set('x-llm-provider', 'http')
      .set('x-llm-endpoint', 'https://example.test/b')
      .set('x-llm-model', 'b')
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(String(res.body.reply)).toMatch(/^mock-http:https:\/\/example.test\/b:b:hi$/);
  });
});

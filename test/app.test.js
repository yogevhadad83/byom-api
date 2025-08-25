import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/app.js';

// Helper: small sleep
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('byom-api basic', () => {
  it('health endpoint works', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  expect(res.text).toContain('byom-api alive');
  });

  it('register-provider validation', async () => {
    const res = await request(app)
      .post('/register-provider')
      .send({ userId: 'u-test', provider: 'openai', config: {} })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('register, fetch masked, delete', async () => {
    const id = 'u-mask1';
    const reg = await request(app)
      .post('/register-provider')
      .send({ userId: id, provider: 'openai', config: { apiKey: 'sk-test-1234', model: 'gpt-4o-mini' } })
      .set('Content-Type', 'application/json');
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);

    const get = await request(app)
      .get('/provider')
      .send({ userId: id })
      .set('Content-Type', 'application/json');
    expect(get.status).toBe(200);
    expect(get.body.ok).toBe(true);
    expect(get.body.provider.apiKey).toMatch(/^sk-\*\*\*\*[a-zA-Z0-9]{4}$/);

    const del = await request(app)
      .delete('/provider')
      .send({ userId: id })
      .set('Content-Type', 'application/json');
    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);
    expect(typeof del.body.deleted).toBe('boolean');
  });

  it('chat returns friendly 400 when no config present and no headers', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ userId: 'no-such-user', prompt: 'hello' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error)).toMatch(/No provider configured/i);
  });

  it('chat by headers succeeds plumbing path (will 401 with fake key)', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ prompt: 'hello' })
      .set('x-llm-provider', 'openai')
      .set('x-llm-api-key', 'sk-bogus')
      .set('Content-Type', 'application/json');
    // Could be 401 or similar from provider; just assert it returns JSON shape
    expect([200, 400, 401, 403, 429, 500]).toContain(res.status);
    expect(typeof res.body.ok).toBe('boolean');
  });
});

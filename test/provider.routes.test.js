import request from 'supertest';
import { describe, it, expect } from 'vitest';
import app from '../src/app.js';

describe('provider routes', () => {
  it('returns 404 for unknown user provider', async () => {
    const res = await request(app).get('/provider/nope-user');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('register http provider, fetch masked, delete unknown idempotently', async () => {
    const id = 'u-http-1';
    const reg = await request(app)
      .post('/register-provider')
      .send({ userId: id, provider: 'http', config: { endpoint: 'https://example.test/llm', model: 'dummy' } })
      .set('Content-Type', 'application/json');
    expect(reg.status).toBe(200);

    const get = await request(app).get(`/provider/${id}`);
    expect(get.status).toBe(200);
    expect(get.body.ok).toBe(true);
    expect(get.body.provider.provider).toBe('http');
    expect(get.body.provider.endpoint).toContain('example.test');
    expect(get.body.provider.apiKey).toBe('');

    const delMissing = await request(app)
      .delete('/provider')
      .send({ userId: 'does-not-exist' })
      .set('Content-Type', 'application/json');
    expect(delMissing.status).toBe(200);
    expect(delMissing.body.ok).toBe(true);
    expect(delMissing.body.deleted).toBe(false);

    const del = await request(app)
      .delete('/provider')
      .send({ userId: id })
      .set('Content-Type', 'application/json');
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);
  });
});

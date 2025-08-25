import { describe, it, expect } from 'vitest';
import * as agent from '../src/services/agent.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

describe('agent store', () => {
  it('masks apiKey, allows set/get/delete, respects TTL', async () => {
    const userId = 'ttl-user-1';
    agent.setProvider(userId, { provider: 'openai', apiKey: 'sk-abcdef1234', model: 'foo' }, 50);
    const cfg = agent.getProvider(userId);
    expect(cfg).toBeTruthy();
    const masked = agent.mask(cfg);
    expect(masked.apiKey).toMatch(/^sk-\*\*\*\*1234$/);

    await sleep(80);
    const after = agent.getProvider(userId);
    expect(after).toBeNull();

    const deleted = agent.deleteProvider(userId);
    expect(deleted).toBe(false);
  });

  it('validates config before set', () => {
    expect(() => agent.setProvider('u', { provider: 'openai' })).toThrow();
    expect(() => agent.setProvider('u', { provider: 'http' })).toThrow();
    expect(() => agent.setProvider('u', { provider: 'http', endpoint: 'https://ok' })).not.toThrow();
  });
});

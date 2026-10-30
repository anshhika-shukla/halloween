// apps/api/tests/health.test.ts - Automated test for GET /api/health
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';

describe('T0.2: GET /api/health', () => {
  it('returns 200 with keys status, provider, offlineMode, ollama.reachable, sandbox.mode', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('provider');
    expect(res.body).toHaveProperty('offlineMode');
    expect(res.body).toHaveProperty('ollama');
    expect(res.body.ollama).toHaveProperty('reachable');
    expect(res.body).toHaveProperty('sandbox');
    expect(res.body.sandbox).toHaveProperty('mode');

    // When Ollama is absent or on test runner, ollama.reachable is false
    expect(typeof res.body.ollama.reachable).toBe('boolean');
  });
});

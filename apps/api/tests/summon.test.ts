// apps/api/tests/summon.test.ts - Automated tests T1.3, T1.4, T1.6 for repository summoning
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/server.js';
import { jobManager } from '../src/ingest/jobs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');

describe('Summon API Tests (T1.3, T1.4, T1.6)', () => {
  let server: http.Server;
  let port: number;
  const app = createApp();

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('T1.3: Rejects invalid, malicious, or out-of-bounds sources, and accepts valid fixture path', async () => {
    const invalidSources = [
      'http://evil.com/x',
      'file:///etc/passwd',
      'https://github.com/a/b;rm -rf /',
      '../../etc',
      'C:\\Windows\\System32', // Outside fixtures / data
      '/etc/passwd',
    ];

    for (const source of invalidSources) {
      const res = await request(app)
        .post('/api/summon')
        .send({ source });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
    }

    // Accepts valid fixture path
    const validRes = await request(app)
      .post('/api/summon')
      .send({ source: './fixtures/haunted-todo' });

    expect(validRes.status).toBe(202);
    expect(validRes.body).toHaveProperty('jobId');
    expect(validRes.body.jobId).toMatch(/^job-/);
  });

  it('T1.4: Subscribing to SSE yields stages [clone, walk, history, issues, ready], and completes overview', async () => {
    const summonRes = await request(app)
      .post('/api/summon')
      .send({ source: './fixtures/haunted-todo' });

    expect(summonRes.status).toBe(202);
    const jobId = summonRes.body.jobId;

    // Connect to SSE stream
    const eventsRes = await fetch(`http://127.0.0.1:${port}/api/jobs/${jobId}/events`);
    expect(eventsRes.ok).toBe(true);

    const stagesReceived: string[] = [];
    const reader = eventsRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';

      for (const frame of frames) {
        const lines = frame.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            try {
              const event = JSON.parse(jsonStr);
              if (event.stage && !stagesReceived.includes(event.stage)) {
                stagesReceived.push(event.stage);
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      if (stagesReceived.includes('ready')) {
        break;
      }
    }

    // Assert stages in order (Phase 2 includes embed stage)
    expect(stagesReceived).toEqual(['clone', 'walk', 'history', 'issues', 'embed', 'ready']);

    // Job state check
    const jobRes = await request(app).get(`/api/jobs/${jobId}`);
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.status).toBe('completed');
    expect(jobRes.body.stage).toBe('ready');
    const repoId = jobRes.body.repoId;
    expect(repoId).toBeDefined();

    // Repo overview check
    const repoRes = await request(app).get(`/api/repos/${repoId}`);
    expect(repoRes.status).toBe(200);
    expect(repoRes.body.commitCount).toBe(8);
    expect(repoRes.body.readmeExcerpt).toContain('haunted-todo');
    expect(repoRes.body.fileCount).toBeGreaterThanOrEqual(5);
    expect(repoRes.body.chunksIndexed).toBeGreaterThan(0);
  });

  it('T1.6: Summoning the same source twice reuses the same repoId and does not duplicate data', async () => {
    const res1 = await request(app)
      .post('/api/summon')
      .send({ source: './fixtures/haunted-todo' });
    expect(res1.status).toBe(202);

    // Wait until completed
    let job1 = jobManager.getJob(res1.body.jobId);
    while (job1 && job1.status !== 'completed' && job1.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 100));
      job1 = jobManager.getJob(res1.body.jobId);
    }
    const repoId1 = job1?.repoId;

    const res2 = await request(app)
      .post('/api/summon')
      .send({ source: './fixtures/haunted-todo' });
    expect(res2.status).toBe(202);

    let job2 = jobManager.getJob(res2.body.jobId);
    while (job2 && job2.status !== 'completed' && job2.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 100));
      job2 = jobManager.getJob(res2.body.jobId);
    }
    const repoId2 = job2?.repoId;

    expect(repoId1).toBe(repoId2);

    // Check repo count does not duplicate
    const listRes = await request(app).get('/api/repos');
    expect(listRes.status).toBe(200);
    const matches = listRes.body.filter((r: any) => r.id === repoId1);
    expect(matches.length).toBe(1);
  });
});

// apps/api/tests/chat.test.ts - Automated tests T3.3, T3.4, T3.5, T3.6, T3.7, T3.9 for Ghost Chat
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { app } from '../src/server.js';
import { jobManager } from '../src/ingest/jobs.js';
import { mockProvider } from '../src/llm/mock.js';
import { getWorkspaceRoot } from '../src/ingest/sourceValidator.js';
import { config } from '../src/config.js';

describe('Ghost Chat Endpoints (T3.3, T3.4, T3.5, T3.6, T3.7, T3.9)', () => {
  let repoId: string;
  let repoCloneDir: string;

  beforeAll(async () => {
    const root = getWorkspaceRoot();
    const job = jobManager.createJob('./fixtures/haunted-todo', root);
    repoId = job.repoId;
    repoCloneDir = path.resolve(root, config.DATA_DIR, 'repos', repoId, 'repo');

    // Wait for job completion
    while (true) {
      const s = jobManager.getJob(job.jobId);
      if (!s || s.status === 'completed' || s.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  it('T3.3: "What does this project do?" returns 200, grounded=true, valid citations resolving to real files/commits', async () => {
    const res = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({ message: 'What does this project do?' });

    expect(res.status).toBe(200);
    expect(res.body.grounded).toBe(true);
    expect(res.body.citations.length).toBeGreaterThan(0);

    for (const cit of res.body.citations) {
      if (cit.kind === 'file') {
        const filePath = cit.label.split(':')[0];
        const fullPath = path.join(repoCloneDir, filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      } else if (cit.kind === 'commit') {
        const shortSha = cit.label.replace('commit ', '').trim();
        const gitCheck = execSync(`git cat-file -e ${shortSha}^{commit}`, {
          cwd: repoCloneDir,
          stdio: 'pipe',
        });
        expect(gitCheck).toBeDefined();
      }
    }
  });

  it('T3.4: "What is the weather in Jaipur today?" returns refusal, grounded=false, zero citations, and mock.calls.chat === 0', async () => {
    mockProvider.calls.reset();
    const res = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({ message: 'What is the weather in Jaipur today?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBe('The ghost finds no record of that in this repository.');
    expect(res.body.grounded).toBe(false);
    expect(res.body.citations.length).toBe(0);
    expect(mockProvider.calls.chat).toBe(0);
  });

  it('T3.5: With MOCK_CHAT_MODE=invent the invented [E99] is stripped and grounded=false', async () => {
    process.env.MOCK_CHAT_MODE = 'invent';
    try {
      const res = await request(app)
        .post(`/api/repos/${repoId}/chat`)
        .send({ message: 'What does this project do?' });

      expect(res.status).toBe(200);
      expect(res.body.grounded).toBe(false);
      expect(res.body.citations.some((c: any) => c.eid === 'E99')).toBe(false);
    } finally {
      delete process.env.MOCK_CHAT_MODE;
    }
  });

  it('T3.6: seance=true returns mode "seance", valid citations, and disclaimer present in both modes', async () => {
    const plainRes = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({ message: 'What does this project do?', seance: false });

    expect(plainRes.status).toBe(200);
    expect(plainRes.body.mode).toBe('plain');
    expect(plainRes.body.disclaimer).toContain('The ghost is a fictional AI persona.');

    const seanceRes = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({ message: 'What does this project do?', seance: true });

    expect(seanceRes.status).toBe(200);
    expect(seanceRes.body.mode).toBe('seance');
    expect(seanceRes.body.citations.length).toBeGreaterThan(0);
    expect(seanceRes.body.disclaimer).toContain('The ghost is a fictional AI persona.');
  });

  it('T3.7: History is respected: follow-up "and who changed it?" retrieves evidence from todo.js history', async () => {
    const res = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({
        message: 'and who changed it?',
        history: [
          { role: 'user', content: 'What is in src/todo.js?' },
          { role: 'assistant', content: 'It contains the todo functions.' },
        ],
      });

    expect(res.status).toBe(200);
    const hasTodoOrCommit = res.body.citations.some(
      (c: any) => c.label.includes('todo.js') || c.kind === 'commit'
    );
    expect(hasTodoOrCommit).toBe(true);
  });

  it('T3.9: GET /api/repos/:id/chunks/:chunkId returns full text for citation ref and 404 for unknown id', async () => {
    const chatRes = await request(app)
      .post(`/api/repos/${repoId}/chat`)
      .send({ message: 'What does this project do?' });

    const firstCitation = chatRes.body.citations[0];
    expect(firstCitation).toBeDefined();

    const chunkRes = await request(app).get(`/api/repos/${repoId}/chunks/${firstCitation.ref}`);
    expect(chunkRes.status).toBe(200);
    expect(chunkRes.body.id).toBe(firstCitation.ref);
    expect(typeof chunkRes.body.text).toBe('string');
    expect(chunkRes.body.text.length).toBeGreaterThan(0);

    const notFoundRes = await request(app).get(`/api/repos/${repoId}/chunks/non-existent-chunk-9999`);
    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error).toBeDefined();
    expect(notFoundRes.body.error.code).toBe('chunk_not_found');
  });
});

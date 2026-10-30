// apps/api/tests/index/retrieve.test.ts - Automated tests T2.2 & T2.3 for hybrid retrieval
import { describe, it, expect, beforeAll } from 'vitest';
import { jobManager } from '../../src/ingest/jobs.js';
import { retrieve } from '../../src/index/retrieve.js';
import { config } from '../../src/config.js';

describe('T2.2 & T2.3: Hybrid Retrieval (haunted-todo fixture with mock provider)', () => {
  let repoId: string;

  beforeAll(async () => {
    const job = jobManager.createJob('./fixtures/haunted-todo');
    repoId = job.repoId;

    // Wait for job to complete
    let state = jobManager.getJob(job.jobId);
    while (state && state.status !== 'completed' && state.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 100));
      state = jobManager.getJob(job.jobId);
    }
    expect(state?.status).toBe('completed');
  });

  it('T2.2: Query "why json file storage" returns docs/DESIGN.md or the JSON commit in top 3', async () => {
    const results = await retrieve(repoId, 'why json file storage', 8);

    expect(results.length).toBeGreaterThan(0);

    // E1..Ek in order
    for (let i = 0; i < results.length; i++) {
      expect(results[i].eid).toBe(`E${i + 1}`);
    }

    // Scores are non-increasing
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }

    // Top 3 contains either docs/DESIGN.md or the commit 'Add JSON file storage...'
    const top3 = results.slice(0, 3);
    const hasDesignDocOrCommit = top3.some((e) => {
      const matchDoc = e.path === 'docs/DESIGN.md' || (e.title && e.title.includes('DESIGN.md'));
      const matchCommit = e.kind === 'commit' && e.title.toLowerCase().includes('json file storage');
      return matchDoc || matchCommit;
    });

    expect(hasDesignDocOrCommit).toBe(true);
  });

  it('T2.2: Query "pendingCount" returns src/todo.js in top 3', async () => {
    const results = await retrieve(repoId, 'pendingCount', 8);

    expect(results.length).toBeGreaterThan(0);
    const top3 = results.slice(0, 3);
    const hasTodoFile = top3.some((e) => e.path === 'src/todo.js');
    expect(hasTodoFile).toBe(true);
  });

  it('T2.3: Query with no overlap returns top score below MIN_EVIDENCE_SCORE', async () => {
    const results = await retrieve(repoId, 'weather jaipur today', 8);

    const topScore = results[0]?.score || 0;
    expect(topScore).toBeLessThan(config.MIN_EVIDENCE_SCORE);
  });
});

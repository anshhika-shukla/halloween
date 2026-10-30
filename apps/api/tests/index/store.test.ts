// apps/api/tests/index/store.test.ts - Automated test T2.4 for vector caching
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { jobManager } from '../../src/ingest/jobs.js';
import { mockProvider } from '../../src/llm/mock.js';
import { loadIndex } from '../../src/index/store.js';
import { config } from '../../src/config.js';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';

describe('T2.4: Vector Store & Index Caching', () => {
  it('re-summoning an unchanged repo does not call embed and loads vectors from disk', async () => {
    // 1. Initial ingestion
    const job1 = jobManager.createJob('./fixtures/haunted-todo');
    let state1 = jobManager.getJob(job1.jobId);
    while (state1 && state1.status !== 'completed' && state1.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 100));
      state1 = jobManager.getJob(job1.jobId);
    }
    expect(state1?.status).toBe('completed');

    // 2. Reset mock provider call counter
    mockProvider.calls.reset();
    expect(mockProvider.calls.embed).toBe(0);

    // 3. Re-summon same unchanged repo
    const job2 = jobManager.createJob('./fixtures/haunted-todo');
    let state2 = jobManager.getJob(job2.jobId);
    while (state2 && state2.status !== 'completed' && state2.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 100));
      state2 = jobManager.getJob(job2.jobId);
    }
    expect(state2?.status).toBe('completed');

    // 4. Assert embed was NOT called during re-summoning
    expect(mockProvider.calls.embed).toBe(0);

    // 5. Assert vectors and chunks are present on disk
    const root = getWorkspaceRoot();
    const repoManagedDir = path.resolve(root, config.DATA_DIR, 'repos', job1.repoId);
    const loaded = loadIndex(repoManagedDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.chunks.length).toBeGreaterThan(0);
    expect(loaded!.vectors.length).toBeGreaterThan(0);
  });
});

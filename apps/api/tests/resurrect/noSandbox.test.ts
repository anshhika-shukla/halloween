// apps/api/tests/resurrect/noSandbox.test.ts - T5.8: SANDBOX=off results in unverified status
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { app } from '../../src/server.js';
import { jobManager } from '../../src/ingest/jobs.js';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import { config } from '../../src/config.js';
import { detectFindings } from '../../src/resurrect/detect.js';

describe('Phase 5: Disabled Sandbox Mode (T5.8)', () => {
  let repoId: string;
  let findingId: string;
  const originalSandbox = config.SANDBOX;

  beforeAll(async () => {
    const root = getWorkspaceRoot();
    const job = jobManager.createJob('./fixtures/haunted-todo', root);
    repoId = job.repoId;

    while (true) {
      const s = jobManager.getJob(job.jobId);
      if (!s || s.status === 'completed' || s.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 100));
    }

    const repoCloneDir = path.resolve(root, config.DATA_DIR, 'repos', repoId, 'repo');
    try {
      execSync('git checkout main', { cwd: repoCloneDir, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      // ignore
    }

    const { findings } = await detectFindings(repoId, { workspaceRoot: root });
    // Pick first finding
    expect(findings.length).toBeGreaterThan(0);
    findingId = findings[0].id;
  });

  it('proposes patch with unverified status when SANDBOX=off', async () => {
    (config as any).SANDBOX = 'off';

    try {
      const res = await request(app)
        .post(`/api/repos/${repoId}/resurrection/propose`)
        .send({ findingId });

      expect(res.status).toBe(200);
      expect(res.body.verification.status).toBe('unverified');
      expect(res.body.verification.reason).toMatch(/sandbox/i);
    } finally {
      (config as any).SANDBOX = originalSandbox;
    }
  });
});

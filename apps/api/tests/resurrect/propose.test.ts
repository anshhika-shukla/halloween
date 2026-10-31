// apps/api/tests/resurrect/propose.test.ts - Automated tests T5.4, T5.5, T5.6 for patch proposal & sandbox verification
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { app } from '../../src/server.js';
import { jobManager } from '../../src/ingest/jobs.js';
import { mockProvider } from '../../src/llm/mock.js';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import { config } from '../../src/config.js';
import { detectFindings } from '../../src/resurrect/detect.js';
import { activeProposals } from '../../src/resurrect/propose.js';
import { UnsafeLocalRunner } from '../../src/resurrect/sandbox.js';

describe('Patch Proposal & Sandbox Verification (T5.4, T5.5, T5.6)', () => {
  let repoId: string;
  let repoCloneDir: string;
  let failingFindingId: string;

  const originalSandbox = config.SANDBOX;

  beforeAll(async () => {
    (config as any).SANDBOX = 'unsafe-local';
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

    // Ensure clean main branch
    try {
      execSync('git checkout main', { cwd: repoCloneDir, stdio: ['pipe', 'pipe', 'pipe'] });
      execSync('git reset --hard HEAD', { cwd: repoCloneDir, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      // ignore
    }

    // Detect findings
    const { findings } = await detectFindings(repoId, {
      workspaceRoot: root,
      forceRefresh: true,
      runner: new UnsafeLocalRunner(),
    });
    const failing = findings.find((f) => f.kind === 'failing-test');
    expect(failing).toBeDefined();
    failingFindingId = failing!.id;
  });

  afterEach(() => {
    delete process.env.MOCK_PATCH_MODE;
    mockProvider.resetPatchAttempts();
    activeProposals.clear();
  });

  afterAll(() => {
    (config as any).SANDBOX = originalSandbox;
  });

  it('T5.4: Generates verified patch with before/after test runs, cited explanation, and clean repo status', async () => {
    const res = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId: failingFindingId });

    expect(res.status).toBe(200);
    const patch = res.body;

    expect(patch.id).toMatch(/^patch-/);
    expect(patch.findingId).toBe(failingFindingId);
    expect(patch.state).toBe('proposed');
    expect(patch.attempts).toBe(1);

    // Verification
    expect(patch.verification.status).toBe('verified');
    expect(patch.verification.before?.failed).toBe(1);
    expect(patch.verification.after?.failed).toBe(0);
    expect(patch.verification.after?.passed).toBe(3);

    // Explanation & Citations
    expect(patch.explanation.length).toBeGreaterThan(0);
    expect(patch.citations.length).toBeGreaterThan(0);

    // Managed clone git status must remain completely clean
    const status = execSync('git status --porcelain', {
      cwd: repoCloneDir,
      encoding: 'utf8',
    }).trim();
    expect(status).toBe('');
  });

  it('T5.5: Retry loop succeeds on second attempt when first attempt produces garbage (garbage-then-valid)', async () => {
    process.env.MOCK_PATCH_MODE = 'garbage-then-valid';
    mockProvider.resetPatchAttempts();

    const res = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId: failingFindingId });

    expect(res.status).toBe(200);
    expect(res.body.attempts).toBe(2);
    expect(res.body.verification.status).toBe('verified');
  });

  it('T5.6: Fails with 422 patch_invalid after 3 failed attempts (MOCK_PATCH_MODE=garbage)', async () => {
    process.env.MOCK_PATCH_MODE = 'garbage';

    const res = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId: failingFindingId });

    expect(res.status).toBe(422);
    const errorMsg = res.body.error?.message || res.body.error;
    expect(errorMsg).toMatch(/Failed to generate a valid patch after 3 attempts/i);
  });

  it('Returns 409 conflict when a patch proposal is already active for this repo', async () => {
    activeProposals.add(repoId);

    const res = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId: failingFindingId });

    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('concurrency_conflict');
  });
});

// apps/api/tests/resurrect/approve.test.ts - T5.7: Approve, reject, and patch download
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { app } from '../../src/server.js';
import { jobManager } from '../../src/ingest/jobs.js';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import { config } from '../../src/config.js';
import { detectFindings } from '../../src/resurrect/detect.js';
import { UnsafeLocalRunner } from '../../src/resurrect/sandbox.js';

describe('Phase 5: Patch Approval & Rejection (T5.7)', () => {
  let repoId: string;
  let repoCloneDir: string;
  let patchId: string;
  let findingId: string;
  const originalSandbox = config.SANDBOX;

  afterAll(() => {
    (config as any).SANDBOX = originalSandbox;
  });

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
    const failing = findings.find((f) => f.kind === 'failing-test')!;
    findingId = failing.id;

    // Propose a patch
    const res = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId });
    expect(res.status).toBe(200);
    patchId = res.body.id;
  });

  it('downloads patch file with correct headers and diff content', async () => {
    const res = await request(app).get(`/api/patches/${patchId}/download`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/x-diff');
    expect(res.headers['content-disposition']).toContain(`fix-${findingId}.patch`);
    expect(res.text).toContain('diff --git');
    expect(res.text).toContain('pendingCount');
  });

  it('approves patch, creates branch, commits fix, and tests pass on branch', async () => {
    const res = await request(app).post(`/api/patches/${patchId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('approved');
    expect(res.body.branch).toBe(`reporevenant/fix-${findingId}`);

    // Check git branch in managed clone
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: repoCloneDir,
      encoding: 'utf8',
    }).trim();
    expect(currentBranch).toBe(`reporevenant/fix-${findingId}`);

    // Verify git log has commit referencing finding
    const lastCommitMsg = execSync('git log -1 --pretty=%B', {
      cwd: repoCloneDir,
      encoding: 'utf8',
    }).trim();
    expect(lastCommitMsg).toContain(`Resolves finding ${findingId}`);

    // Run tests on the fixed branch: all tests now pass!
    const testResult = execSync('node --test', {
      cwd: repoCloneDir,
      encoding: 'utf8',
    });
    expect(testResult).toContain('pass');
  });

  it('returns 409 when attempting to re-approve an already approved patch', async () => {
    const res = await request(app).post(`/api/patches/${patchId}/approve`);
    expect(res.status).toBe(409);
    expect(res.body.error?.code || res.body.code).toBe('patch_already_approved');
  });

  it('rejects a newly proposed patch and marks it rejected', async () => {
    // Switch back to main branch
    execSync('git checkout main', { cwd: repoCloneDir });

    // Propose a second patch
    const proposeRes = await request(app)
      .post(`/api/repos/${repoId}/resurrection/propose`)
      .send({ findingId });
    expect(proposeRes.status).toBe(200);
    const secondPatchId = proposeRes.body.id;

    const rejectRes = await request(app).post(`/api/patches/${secondPatchId}/reject`);
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.state).toBe('rejected');

    // Return to main
    execSync('git checkout main', { cwd: repoCloneDir });
  });
});

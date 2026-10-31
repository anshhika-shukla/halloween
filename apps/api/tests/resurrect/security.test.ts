// apps/api/tests/resurrect/security.test.ts - Security & Edge Cases for Resurrection Endpoints
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';
import { findPatchById } from '../../src/resurrect/propose.js';

describe('Security & Error Handling: Resurrection API', () => {
  it('returns 404 repo_not_found for non-existent repo in resurrection query', async () => {
    const res = await request(app).get('/api/repos/non-existent-repo-9999/resurrection');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('repo_not_found');
  });

  it('rejects path traversal in repo ID for resurrection query', async () => {
    const res = await request(app).get('/api/repos/..%2F..%2Fpackage.json/resurrection');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('repo_not_found');
  });

  it('returns 404 repo_not_found when proposing patch for non-existent repo', async () => {
    const res = await request(app)
      .post('/api/repos/non-existent-repo-9999/resurrection/propose')
      .send({ findingId: 'any-finding-id' });
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('repo_not_found');
  });

  it('returns null when finding patch with path traversal in patchId', () => {
    const patch = findPatchById('../../malicious-patch');
    expect(patch).toBeNull();
  });

  it('returns 404 patch_not_found when approving non-existent patch', async () => {
    const res = await request(app).post('/api/patches/ghost-patch-non-existent/approve');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('patch_not_found');
  });

  it('returns 404 patch_not_found when rejecting non-existent patch', async () => {
    const res = await request(app).post('/api/patches/ghost-patch-non-existent/reject');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('patch_not_found');
  });

  it('returns 404 patch_not_found when downloading non-existent patch', async () => {
    const res = await request(app).get('/api/patches/ghost-patch-non-existent/download');
    expect(res.status).toBe(404);
    expect(res.body.error?.code).toBe('patch_not_found');
  });
});

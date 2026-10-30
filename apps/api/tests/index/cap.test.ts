// apps/api/tests/index/cap.test.ts - Automated test T2.6 for chunk prioritization cap
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { walkRepository } from '../../src/ingest/walk.js';
import { parseGitHistory } from '../../src/ingest/gitlog.js';
import { chunkFiles, chunkCommits, capChunks } from '../../src/ingest/chunk.js';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';

describe('T2.6: Chunk Priority Capping (MAX_CHUNKS=10)', () => {
  it('keeps README.md and docs/DESIGN.md chunks and limits total to at most 10', async () => {
    const root = getWorkspaceRoot();
    const fixtureDir = path.join(root, 'fixtures/haunted-todo');

    const walkResult = walkRepository(fixtureDir);
    const gitSummary = await parseGitHistory(fixtureDir);

    const fileChunks = chunkFiles(walkResult.files, fixtureDir);
    const commitChunks = chunkCommits(gitSummary.commits);

    const allChunks = [...fileChunks, ...commitChunks];
    expect(allChunks.length).toBeGreaterThanOrEqual(10);

    const capped = capChunks(allChunks, 10);

    expect(capped.length).toBeLessThanOrEqual(10);

    const hasReadme = capped.some((c) => c.path && c.path.toLowerCase().includes('readme.md'));
    const hasDesign = capped.some((c) => c.path && c.path.includes('DESIGN.md'));

    expect(hasReadme).toBe(true);
    expect(hasDesign).toBe(true);

    // Also verify strict capping when chunks exceed limit
    const cappedFive = capChunks(allChunks, 5);
    expect(cappedFive.length).toBe(5);
    expect(cappedFive.some((c) => c.path && c.path.toLowerCase().includes('readme.md'))).toBe(true);
    expect(cappedFive.some((c) => c.path && c.path.includes('DESIGN.md'))).toBe(true);
  });
});

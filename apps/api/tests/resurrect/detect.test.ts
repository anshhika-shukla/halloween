// apps/api/tests/resurrect/detect.test.ts - T5.1: Finding detection tests
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import { detectFindings, computeFindingId } from '../../src/resurrect/detect.js';
import { UnsafeLocalRunner } from '../../src/resurrect/sandbox.js';

describe('Phase 5: Finding Detection (T5.1)', () => {
  const workspaceRoot = getWorkspaceRoot();
  const fixturePath = path.resolve(workspaceRoot, 'fixtures', 'haunted-todo');

  it('detects 1 failing test and 2 TODO findings in haunted-todo fixture with deterministic IDs', async () => {
    const runner = new UnsafeLocalRunner();

    const { findings, cached } = await detectFindings('fixtures/haunted-todo', {
      workspaceRoot,
      forceRefresh: true,
      runner,
    });

    expect(cached).toBe(false);

    // 1 failing test: pendingCount
    const failingTests = findings.filter((f) => f.kind === 'failing-test');
    expect(failingTests.length).toBe(1);
    expect(failingTests[0].title).toMatch(/pendingCount/i);
    expect(failingTests[0].difficulty).toBe('easy');
    expect(failingTests[0].evidence.length).toBeGreaterThan(0);

    // 2 TODO findings in src/storage.js
    const todos = findings.filter((f) => f.kind === 'todo');
    expect(todos.length).toBe(2);

    const todo1 = todos.find((t) => t.title.includes('dedupe ids'));
    expect(todo1).toBeDefined();
    expect(todo1?.evidence[0]).toMatch(/src\/storage\.js:12/);
    expect(todo1?.difficulty).toBe('easy');

    const todo2 = todos.find((t) => t.title.includes('concurrent writes'));
    expect(todo2).toBeDefined();
    expect(todo2?.evidence[0]).toMatch(/src\/storage\.js:13/);
    expect(todo2?.difficulty).toBe('medium');

    // Deterministic IDs: running detection again computes identical IDs
    const secondRun = await detectFindings('fixtures/haunted-todo', {
      workspaceRoot,
      forceRefresh: true,
      runner,
    });

    expect(secondRun.findings.map((f) => f.id)).toEqual(findings.map((f) => f.id));

    // Verify formula
    const expectedId = computeFindingId('failing-test', failingTests[0].title, failingTests[0].evidence[0]);
    expect(failingTests[0].id).toBe(expectedId);
  });

  it('uses cached findings when headSha is unchanged', async () => {
    const runner = new UnsafeLocalRunner();

    const first = await detectFindings('fixtures/haunted-todo', {
      workspaceRoot,
      runner,
    });

    const second = await detectFindings('fixtures/haunted-todo', {
      workspaceRoot,
      runner,
    });

    expect(second.cached).toBe(true);
    expect(second.findings).toEqual(first.findings);
  });
});

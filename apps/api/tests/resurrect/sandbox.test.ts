// apps/api/tests/resurrect/sandbox.test.ts - T5.2: Sandbox runner tests & Safety Rule 5
import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import {
  DisabledRunner,
  UnsafeLocalRunner,
  DockerRunner,
  parseTestOutput,
} from '../../src/resurrect/sandbox.js';

describe('Phase 5: Sandbox Runners (T5.2)', () => {
  const workspaceRoot = getWorkspaceRoot();
  const fixturePath = path.resolve(workspaceRoot, 'fixtures', 'haunted-todo');

  describe('DisabledRunner', () => {
    it('reports unavailable and fails test execution gracefully', async () => {
      const runner = new DisabledRunner('Manual disable');
      expect(runner.isAvailable()).toBe(false);

      const result = await runner.run();
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.output).toContain('[SANDBOX UNAVAILABLE] Manual disable');
    });
  });

  describe('UnsafeLocalRunner', () => {
    it('executes tests inside ./fixtures successfully', async () => {
      const runner = new UnsafeLocalRunner();
      expect(runner.isAvailable()).toBe(true);

      const result = await runner.run(fixturePath, 'node --test');
      expect(result.output.length).toBeGreaterThan(0);
      expect(result.output.length).toBeLessThanOrEqual(8192);
      expect(result.failed).toBe(1); // pendingCount test is failing
      expect(result.passed).toBe(2);
      expect(result.exitCode).not.toBe(0);
    });

    it('enforces Safety Rule 5: strictly rejects paths outside ./fixtures', async () => {
      const runner = new UnsafeLocalRunner();
      const tmpDir = os.tmpdir();

      await expect(runner.run(tmpDir, 'node --version')).rejects.toThrow(
        /Unsafe local sandbox is strictly restricted to repositories inside \.\/fixtures/
      );
    });
  });

  describe('DockerRunner', () => {
    it('reports availability based on host docker state', () => {
      const runner = new DockerRunner();
      expect(typeof runner.isAvailable()).toBe('boolean');
    });
  });

  describe('parseTestOutput', () => {
    it('parses Node.js tap and spec output correctly', () => {
      const tapOutput = `TAP version 13
ok 1 - test one
ok 2 - test two
not ok 3 - test three`;
      const parsedTap = parseTestOutput(tapOutput, 1);
      expect(parsedTap.passed).toBe(2);
      expect(parsedTap.failed).toBe(1);

      const passSummaryOutput = `ℹ tests 4
ℹ pass 3
ℹ fail 1`;
      const parsedSummary = parseTestOutput(passSummaryOutput, 1);
      expect(parsedSummary.passed).toBe(3);
      expect(parsedSummary.failed).toBe(1);
    });
  });
});

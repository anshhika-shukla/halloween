// apps/api/tests/fixture.test.ts - Verification of haunted-todo fixture repository (T0.5)
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANNED_FIX_DIFF } from '../src/llm/mock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const fixtureDir = path.join(rootDir, 'fixtures/haunted-todo');

describe('T0.5: Fixture Repository Verification (haunted-todo)', () => {
  it('builds and matches all deterministic fixture rules', () => {
    // 1. Run make-fixture.sh
    execSync('bash scripts/make-fixture.sh', {
      cwd: rootDir,
      stdio: 'pipe',
      windowsHide: true,
    });

    // 2. git rev-list --count HEAD equals 8
    const revCount = execSync('git rev-list --count HEAD', {
      cwd: fixtureDir,
      encoding: 'utf8',
    }).trim();
    expect(revCount).toBe('8');

    // 3. Newest commit message is 'Last commit before life got busy'
    const lastCommitMsg = execSync('git log -1 --pretty=%B', {
      cwd: fixtureDir,
      encoding: 'utf8',
    }).trim();
    expect(lastCommitMsg).toBe('Last commit before life got busy');

    // 4. npm test exits non-zero with exactly 1 failing test (pendingCount)
    let testFailed = false;
    let failureOutput = '';
    try {
      execSync('npm test', {
        cwd: fixtureDir,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err: any) {
      testFailed = true;
      failureOutput = (err.stdout || '') + (err.stderr || '');
    }
    expect(testFailed).toBe(true);
    expect(failureOutput).toContain('pendingCount');

    // 5. git apply of canned diff succeeds and npm test then exits 0
    execSync('git apply', {
      cwd: fixtureDir,
      input: CANNED_FIX_DIFF,
      stdio: 'pipe',
    });

    // Now npm test should exit 0
    const fixedRun = execSync('npm test', {
      cwd: fixtureDir,
      encoding: 'utf8',
    });
    expect(fixedRun).toBeDefined();

    // Reset fixture back to HEAD so working copy remains clean
    execSync('git reset --hard HEAD', {
      cwd: fixtureDir,
      stdio: 'pipe',
    });
  });
});

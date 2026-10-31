// apps/api/tests/resurrect/diffGuard.test.ts - T5.3: Patch guard and security constraints
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { getWorkspaceRoot } from '../../src/ingest/sourceValidator.js';
import { validatePatch } from '../../src/resurrect/diffGuard.js';
import { CANNED_FIX_DIFF } from '../../src/llm/mock.js';

describe('Phase 5: Diff Guard (T5.3)', () => {
  const workspaceRoot = getWorkspaceRoot();
  const repoDir = path.resolve(workspaceRoot, 'fixtures', 'haunted-todo');

  it('accepts the canonical canned fix diff', () => {
    const result = validatePatch(CANNED_FIX_DIFF, repoDir);
    expect(result.valid).toBe(true);
    expect(result.cleanDiff).toContain('return list.filter((t) => (t.done === false)).length;');
  });

  it('strips markdown code block fences', () => {
    const fenced = `\`\`\`diff\n${CANNED_FIX_DIFF}\n\`\`\``;
    const result = validatePatch(fenced, repoDir);
    expect(result.valid).toBe(true);
    expect(result.cleanDiff).not.toContain('```');
    expect(result.cleanDiff).toContain('diff --git');
  });

  it('rejects diff touching .git directory', () => {
    const badDiff = `--- a/.git/config
+++ b/.git/config
@@ -1,1 +1,1 @@
-safe
+unsafe
`;
    const result = validatePatch(badDiff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/\.git/i);
  });

  it('rejects diff touching .github workflows directory', () => {
    const badDiff = `--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,1 +1,1 @@
-run: test
+run: pwn
`;
    const result = validatePatch(badDiff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/\.github/i);
  });

  it('rejects path traversal (..)', () => {
    const badDiff = `--- a/src/../../etc/passwd
+++ b/src/../../etc/passwd
@@ -1,1 +1,1 @@
-root
+pwned
`;
    const result = validatePatch(badDiff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/path traversal/i);
  });

  it('rejects binary patches', () => {
    const binaryDiff = `diff --git a/logo.png b/logo.png
GIT binary patch
literal 1024
zc$@)z...`;
    const result = validatePatch(binaryDiff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/binary/i);
  });

  it('rejects patches touching lockfiles unless outdated-dep', () => {
    const lockDiff = `--- a/package-lock.json
+++ b/package-lock.json
@@ -1,2 +1,2 @@
-"version": "1.0.0"
+"version": "2.0.0"
`;
    // For standard bug fix
    const rejected = validatePatch(lockDiff, repoDir, 'failing-test');
    expect(rejected.valid).toBe(false);
    expect(rejected.error).toMatch(/lockfile/i);

    // Permitted if outdated-dep
    // (Notice package-lock.json does not exist in haunted-todo, so existence check will fail,
    // but lockfile check should not trigger error)
    const allowed = validatePatch(lockDiff, repoDir, 'outdated-dep');
    expect(allowed.error).not.toMatch(/lockfile/i);
  });

  it('rejects patches modifying more than 5 files', () => {
    let diff = '';
    for (let i = 1; i <= 6; i++) {
      diff += `--- a/src/file${i}.js
+++ b/src/file${i}.js
@@ -1,1 +1,1 @@
-old
+new
`;
    }
    const result = validatePatch(diff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/more than 5 files/i);
  });

  it('rejects patches exceeding 200 lines modified', () => {
    let diff = `--- a/src/todo.js
+++ b/src/todo.js
@@ -1,1 +1,202 @@
`;
    for (let i = 0; i < 205; i++) {
      diff += `+console.log(${i});\n`;
    }
    const result = validatePatch(diff, repoDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/200 lines/i);
  });
});

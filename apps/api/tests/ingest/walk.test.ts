// apps/api/tests/ingest/walk.test.ts - Automated test T1.1 for file walker
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { walkRepository } from '../../src/ingest/walk.js';

describe('T1.1: Repository File Walker', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporevenant-walk-test-'));

    // Create directories
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'node_modules', 'dep'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.git', 'objects'), { recursive: true });

    // 1. Included files
    fs.writeFileSync(path.join(tempDir, 'src', 'index.js'), 'console.log("hello");', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Project\nSample text.', 'utf8');

    // 2. Excluded: node_modules
    fs.writeFileSync(path.join(tempDir, 'node_modules', 'dep', 'index.js'), 'module.exports = {};', 'utf8');

    // 3. Excluded: .git
    fs.writeFileSync(path.join(tempDir, '.git', 'config'), '[core]\nrepositoryformatversion = 0', 'utf8');

    // 4. Excluded: binary file (containing null byte 0x00)
    const binaryBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
    fs.writeFileSync(path.join(tempDir, 'image.png'), binaryBuf);

    // 5. Excluded: file over MAX_FILE_BYTES (e.g. 500 bytes for this test)
    const largeContent = 'A'.repeat(1000);
    fs.writeFileSync(path.join(tempDir, 'large.txt'), largeContent, 'utf8');

    // 6. Lockfile: package-lock.json (should be excluded from files list, recorded in lockfiles)
    fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{"lockfileVersion": 3}', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('excludes node_modules, .git, a binary file, a file over MAX_FILE_BYTES, and lockfiles from files list', () => {
    const result = walkRepository(tempDir, 500);

    const relativePaths = result.files.map((f) => f.relativePath);

    // Includes
    expect(relativePaths).toContain('src/index.js');
    expect(relativePaths).toContain('README.md');

    // Excludes
    expect(relativePaths.some((p) => p.includes('node_modules'))).toBe(false);
    expect(relativePaths.some((p) => p.includes('.git'))).toBe(false);
    expect(relativePaths).not.toContain('image.png');
    expect(relativePaths).not.toContain('large.txt');
    expect(relativePaths).not.toContain('package-lock.json');

    // Lockfiles recorded separately
    expect(result.lockfiles).toContain('package-lock.json');
  });
});

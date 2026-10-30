// apps/api/tests/ingest/gitlog.test.ts - Automated test T1.2 for git log parsing on fixture
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGitHistory } from '../../src/ingest/gitlog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(__dirname, '../../../../fixtures/haunted-todo');

describe('T1.2: Git Log Parser (haunted-todo fixture)', () => {
  it('parses 8 commits, newest first, author Ada Hollow, 2021/2022 dates, deadForDays > 1000', async () => {
    const summary = await parseGitHistory(fixtureDir, 500);

    expect(summary.commits.length).toBe(8);
    expect(summary.commitCount).toBe(8);

    // Newest first: commit 8 subject
    expect(summary.commits[0].subject).toBe('Last commit before life got busy');
    // Oldest last: commit 1 subject
    expect(summary.commits[7].subject).toBe('Initial commit: todo list core');

    // Author for all commits is Ada Hollow
    for (const commit of summary.commits) {
      expect(commit.author).toBe('Ada Hollow');
      expect(commit.email).toBe('ada@example.invalid');

      // All dates in 2021 or 2022
      const year = new Date(commit.date).getFullYear();
      expect([2021, 2022]).toContain(year);

      // Subject non-empty
      expect(commit.subject.length).toBeGreaterThan(0);
    }

    // deadForDays is relative to now (last commit was 2022-02-20, so > 1000 days ago)
    expect(summary.deadForDays).toBeGreaterThan(1000);
  });
});

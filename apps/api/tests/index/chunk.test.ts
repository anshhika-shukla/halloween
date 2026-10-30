// apps/api/tests/index/chunk.test.ts - Automated test T2.1 for chunking
import { describe, it, expect } from 'vitest';
import { chunkCodeFile, chunkMarkdownFile, chunkCommits } from '../../src/ingest/chunk.js';

describe('T2.1: Chunking Logic', () => {
  it('chunks a 200-line code file into windows with correct overlap, line ranges, and length limit', () => {
    // Create a 200-line file
    const lines = Array.from({ length: 200 }, (_, i) => `const line${i + 1} = ${i + 1};`);
    const content = lines.join('\n');

    const chunks = chunkCodeFile('src/sample.js', content, 'JavaScript');

    // Expected 4 windows: 1..60, 51..110, 101..160, 151..200
    expect(chunks.length).toBe(4);

    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(60);

    expect(chunks[1].startLine).toBe(51);
    expect(chunks[1].endLine).toBe(110);

    expect(chunks[2].startLine).toBe(101);
    expect(chunks[2].endLine).toBe(160);

    expect(chunks[3].startLine).toBe(151);
    expect(chunks[3].endLine).toBe(200);

    // Overlap checks: 10 lines overlap between consecutive windows
    expect(chunks[0].endLine! - chunks[1].startLine! + 1).toBe(10);
    expect(chunks[1].endLine! - chunks[2].startLine! + 1).toBe(10);
    expect(chunks[2].endLine! - chunks[3].startLine! + 1).toBe(10);

    // None over 3000 chars
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(3000);
      expect(chunk.path).toBe('src/sample.js');
      expect(chunk.kind).toBe('file');
    }
  });

  it('splits markdown files by headings', () => {
    const md = `# Title\n\nIntro text.\n\n## Section 1\n\nContent for section 1.\n\n### Subsection\n\nMore details.`;
    const chunks = chunkMarkdownFile('docs/guide.md', md);

    expect(chunks.length).toBe(3);
    expect(chunks[0].title).toContain('Title');
    expect(chunks[1].title).toContain('Section 1');
    expect(chunks[2].title).toContain('Subsection');

    for (const chunk of chunks) {
      expect(chunk.kind).toBe('file');
      expect(chunk.path).toBe('docs/guide.md');
      expect(chunk.text.length).toBeLessThanOrEqual(3000);
    }
  });

  it('generates commit chunks with sha and subject', () => {
    const commits = [
      {
        sha: 'abc1234567890abcdef',
        author: 'Ada Hollow',
        email: 'ada@example.invalid',
        date: '2021-03-02T10:00:00Z',
        subject: 'Initial commit: todo list core',
        body: 'Core functionality for todos.',
        filesChanged: ['src/todo.js', 'package.json'],
      },
    ];

    const chunks = chunkCommits(commits);
    expect(chunks.length).toBe(1);
    expect(chunks[0].kind).toBe('commit');
    expect(chunks[0].sha).toBe('abc1234567890abcdef');
    expect(chunks[0].title).toContain('abc1234');
    expect(chunks[0].title).toContain('Initial commit: todo list core');
    expect(chunks[0].text).toContain('Ada Hollow');
    expect(chunks[0].text).toContain('src/todo.js');
  });
});

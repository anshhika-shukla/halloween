// apps/api/tests/ghost/citations.test.ts - Automated test T3.2 for citation parsing and verification
import { describe, it, expect } from 'vitest';
import { parseCitations } from '../../src/ghost/citations.js';
import type { Evidence } from '../../src/types.js';

describe('T3.2: Citation Parsing and Verification', () => {
  const mockEvidence: Evidence[] = [
    {
      id: 'file-src_todo_js-10-14',
      eid: 'E1',
      kind: 'file',
      path: 'src/todo.js',
      startLine: 10,
      endLine: 14,
      title: 'src/todo.js:10-14',
      text: 'function pendingCount() { return 0; }',
      score: 0.9,
    },
    {
      id: 'commit-a1b2c3d',
      eid: 'E2',
      kind: 'commit',
      sha: 'a1b2c3d4e5f6',
      title: 'commit a1b2c3d: Add pendingCount helper',
      text: 'commit a1b2c3d by Ada',
      score: 0.8,
    },
    {
      id: 'file-docs_DESIGN_md-1-5',
      eid: 'E3',
      kind: 'file',
      path: 'docs/DESIGN.md',
      startLine: 1,
      endLine: 5,
      title: 'docs/DESIGN.md: Why JSON?',
      text: 'Flat JSON storage design notes',
      score: 0.7,
    },
  ];

  it('"Foo [E1] bar [E3]." gives 2 valid citations', () => {
    const rawAnswer = 'Foo [E1] bar [E3].';
    const result = parseCitations(rawAnswer, mockEvidence);

    expect(result.citations.length).toBe(2);
    expect(result.citations[0].eid).toBe('E1');
    expect(result.citations[0].label).toBe('src/todo.js:10-14');
    expect(result.citations[1].eid).toBe('E3');
    expect(result.citations[1].label).toBe('docs/DESIGN.md:1-5');
    expect(result.invalidMarkers.length).toBe(0);
    expect(result.grounded).toBe(true);
  });

  it('[E9] not in the set is stripped and reported invalid', () => {
    const rawAnswer = 'This cites valid [E1] and invalid [E9].';
    const result = parseCitations(rawAnswer, mockEvidence);

    expect(result.citations.length).toBe(1);
    expect(result.citations[0].eid).toBe('E1');
    expect(result.invalidMarkers).toContain('[E9]');
    expect(result.cleanAnswer).not.toContain('[E9]');
    expect(result.grounded).toBe(false); // Invalid markers invalidate groundedness
  });

  it('[E1][E2] adjacent both parse', () => {
    const rawAnswer = 'Joint evidence [E1][E2] supports this claim.';
    const result = parseCitations(rawAnswer, mockEvidence);

    expect(result.citations.length).toBe(2);
    expect(result.citations.map((c) => c.eid)).toEqual(['E1', 'E2']);
    expect(result.grounded).toBe(true);
  });

  it('a sentence without a marker appears in flaggedSentences', () => {
    const rawAnswer = 'First sentence has evidence [E1]. Second sentence has no evidence at all. Third sentence cites [E2].';
    const result = parseCitations(rawAnswer, mockEvidence);

    // Sentence 0: has [E1]
    // Sentence 1: has no marker -> flagged
    // Sentence 2: has [E2]
    expect(result.flaggedSentences).toContain(1);
    expect(result.flaggedSentences).not.toContain(0);
    expect(result.flaggedSentences).not.toContain(2);
  });
});

// apps/api/tests/mock.test.ts - Automated test for Mock LLM Provider
import { describe, it, expect, beforeEach } from 'vitest';
import { MockProvider, CANNED_FIX_DIFF } from '../src/llm/mock.js';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
  }
  return dot;
}

describe('T0.4: Mock LLM Provider', () => {
  let mock: MockProvider;

  beforeEach(() => {
    mock = new MockProvider();
    mock.calls.reset();
  });

  it('embed is deterministic and produces vectors of unit length (256-dim)', async () => {
    const [vec1] = await mock.embed(['Hello world, testing 123']);
    const [vec2] = await mock.embed(['Hello world, testing 123']);

    expect(vec1.length).toBe(256);
    expect(vec1).toEqual(vec2);

    const length = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    expect(Math.abs(length - 1.0)).toBeLessThan(1e-5);
  });

  it('identical text gives cosine 1.0 and unrelated text gives lower cosine', async () => {
    const [v1, v2, v3] = await mock.embed([
      'quantum physics entanglement and particles',
      'quantum physics entanglement and particles',
      'chocolate cake recipe with frosting',
    ]);

    const simIdentical = cosineSimilarity(v1, v2);
    expect(Math.abs(simIdentical - 1.0)).toBeLessThan(1e-5);

    const simUnrelated = cosineSimilarity(v1, v3);
    expect(simUnrelated).toBeLessThan(0.7);
  });

  it('ignores English stopwords', async () => {
    const [vecWithoutStopwords] = await mock.embed(['database query optimization']);
    const [vecWithStopwords] = await mock.embed(['the database and an query for the optimization']);

    const sim = cosineSimilarity(vecWithoutStopwords, vecWithStopwords);
    expect(Math.abs(sim - 1.0)).toBeLessThan(1e-5);
  });

  it('returns canned diff only when UNIFIED DIFF marker is present', async () => {
    // Without UNIFIED DIFF
    const normalRes = await mock.chat({
      system: 'You are a helpful ghost',
      messages: [{ role: 'user', content: '[E1] file src/todo.js\nWhat is this?' }],
    });
    expect(normalRes.text).toContain('[E1]');
    expect(normalRes.text).not.toContain('diff --git');

    // With UNIFIED DIFF
    const patchRes = await mock.chat({
      system: 'Fix bug. Return ONLY a UNIFIED DIFF in git apply format.',
      messages: [{ role: 'user', content: 'PROBLEM: test failure\nRELEVANT FILES:\nsrc/todo.js' }],
    });
    expect(patchRes.text).toContain('diff --git a/src/todo.js b/src/todo.js');
    expect(patchRes.text).toContain('(t.done === false)');
    expect(patchRes.text.trim()).toBe(CANNED_FIX_DIFF.trim());
  });

  it('tracks mock.calls counter and resets properly', async () => {
    expect(mock.calls.chat).toBe(0);
    expect(mock.calls.embed).toBe(0);

    await mock.embed(['foo']);
    expect(mock.calls.embed).toBe(1);

    await mock.chat({ system: '', messages: [{ role: 'user', content: 'hi' }] });
    expect(mock.calls.chat).toBe(1);

    mock.calls.reset();
    expect(mock.calls.chat).toBe(0);
    expect(mock.calls.embed).toBe(0);
  });
});

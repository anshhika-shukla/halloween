// apps/api/tests/scripts.test.ts - Automated test T3.8 for chat evaluation script
import { describe, it, expect } from 'vitest';
import { runChatEval, printEvalTable } from '../../../scripts/chat-eval.js';
import { getWorkspaceRoot } from '../src/ingest/sourceValidator.js';

describe('T3.8: Chat Evaluation Script (chat-eval.ts)', () => {
  it('chat-eval runs against the fixture with the mock provider and prints a table with 5 rows', async () => {
    const root = getWorkspaceRoot();
    const result = await runChatEval('./fixtures/haunted-todo', root);

    expect(result.rows.length).toBe(5);
    expect(result.total).toBe(5);

    // Verify row numbers 1 to 5
    expect(result.rows.map((r) => r.num)).toEqual([1, 2, 3, 4, 5]);

    // Smoke test table print
    printEvalTable(result);
  });
});

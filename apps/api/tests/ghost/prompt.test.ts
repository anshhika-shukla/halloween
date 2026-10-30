// apps/api/tests/ghost/prompt.test.ts - Automated test T3.1 for prompt construction
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildSystemPrompt, buildUserMessage } from '../../src/ghost/prompt.js';
import type { Evidence } from '../../src/types.js';

describe('T3.1: Ghost Prompt Construction', () => {
  const dummyEvidence: Evidence[] = [
    {
      id: 'file-src_todo_js-1-10',
      eid: 'E1',
      kind: 'file',
      path: 'src/todo.js',
      startLine: 1,
      endLine: 10,
      title: 'src/todo.js:1-10',
      text: 'function addTodo() {}',
      score: 0.8,
    },
    {
      id: 'commit-1234567',
      eid: 'E2',
      kind: 'commit',
      sha: '1234567890abcdef',
      title: 'commit 1234567: Add initial todo core',
      text: 'commit 1234567 by Ada Hollow',
      score: 0.7,
    },
  ];

  it('built prompt contains every evidence id and the rules', () => {
    const userMsg = buildUserMessage(dummyEvidence, 'How do I add a todo?');
    expect(userMsg).toContain('[E1]');
    expect(userMsg).toContain('[E2]');
    expect(userMsg).toContain('src/todo.js');
    expect(userMsg).toContain('commit 1234567: Add initial todo core');
    expect(userMsg).toContain('QUESTION\nHow do I add a todo?');

    const systemPrompt = buildSystemPrompt({ repoName: 'haunted-todo', seance: false });
    expect(systemPrompt).toContain('The Ghost of haunted-todo');
    expect(systemPrompt).toContain('Rules:');
    expect(systemPrompt).toContain('The ghost finds no record of that in this repository.');
  });

  it('evidence is truncated to the cap', () => {
    const hugeEvidence: Evidence[] = [
      {
        id: 'chunk-large',
        eid: 'E1',
        kind: 'file',
        path: 'large.txt',
        title: 'large.txt:1-500',
        text: 'A'.repeat(15000),
        score: 0.9,
      },
    ];

    const userMsg = buildUserMessage(hugeEvidence, 'summarize', 1000);
    expect(userMsg.length).toBeLessThan(1200);
  });

  it('editing a prompt file in a temp PROMPTS_DIR changes the next prompt with no restart', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporevenant-prompts-'));
    try {
      const customPromptPath = path.join(tempDir, 'ghost.system.txt');
      fs.writeFileSync(customPromptPath, 'Version 1 Prompt for {repoName}: {personaLine}', 'utf8');

      const p1 = buildSystemPrompt({ repoName: 'test-repo', promptsDir: tempDir });
      expect(p1).toBe('Version 1 Prompt for test-repo: Be direct and technical.');

      // Edit without restart
      fs.writeFileSync(customPromptPath, 'Version 2 Modified Spirit of {repoName}!', 'utf8');
      const p2 = buildSystemPrompt({ repoName: 'test-repo', promptsDir: tempDir });
      expect(p2).toBe('Version 2 Modified Spirit of test-repo!');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('seance prompt contains "fictional" and the citation rule', () => {
    const seancePrompt = buildSystemPrompt({ repoName: 'haunted-todo', seance: true });
    expect(seancePrompt.toLowerCase()).toContain('fictional');
    expect(seancePrompt).toContain('[E2] or [E1][E4]');
    expect(seancePrompt).toContain('Speak in a calm, eerie voice');
  });
});

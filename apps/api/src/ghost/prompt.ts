// apps/api/src/ghost/prompt.ts - Prompt loading and construction for Ghost Chat
import path from 'node:path';
import fs from 'node:fs';
import type { Evidence } from '../types.js';
import { config } from '../config.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';

export interface PromptOptions {
  repoName?: string;
  seance?: boolean;
  promptsDir?: string;
}

export function getPromptsDirectory(customDir?: string): string {
  if (customDir) {
    return path.isAbsolute(customDir) ? customDir : path.resolve(getWorkspaceRoot(), customDir);
  }
  return path.isAbsolute(config.PROMPTS_DIR) ? config.PROMPTS_DIR : path.resolve(getWorkspaceRoot(), config.PROMPTS_DIR);
}

export function buildSystemPrompt(options: PromptOptions = {}): string {
  const { repoName = 'this repository', seance = false, promptsDir } = options;
  const dir = getPromptsDirectory(promptsDir);

  const filename = seance ? 'ghost.seance.txt' : 'ghost.system.txt';
  const filePath = path.join(dir, filename);

  let template: string;
  if (fs.existsSync(filePath)) {
    template = fs.readFileSync(filePath, 'utf8');
  } else {
    // Fallback if seance file is missing
    const fallbackPath = path.join(dir, 'ghost.system.txt');
    if (fs.existsSync(fallbackPath)) {
      template = fs.readFileSync(fallbackPath, 'utf8');
    } else {
      throw new Error(`Prompt template not found at ${filePath}`);
    }
  }

  const personaLine = seance
    ? 'Speak in a calm, eerie voice. You may add one short spooky flourish at the start or the end. Flourishes contain no factual claims.'
    : 'Be direct and technical.';

  return template
    .replace(/\{repoName\}/g, repoName)
    .replace(/\{personaLine\}/g, personaLine);
}

export function formatEvidenceBlock(e: Evidence): string {
  let header = '';
  if (e.kind === 'file') {
    const lines = e.startLine && e.endLine ? ` lines ${e.startLine}-${e.endLine}` : '';
    header = `[${e.eid}] file ${e.path || 'unknown'}${lines}`;
  } else if (e.kind === 'commit') {
    header = `[${e.eid}] ${e.title}`;
  } else if (e.kind === 'issue') {
    header = `[${e.eid}] ${e.title}`;
  } else {
    header = `[${e.eid}] ${e.title}`;
  }

  return `${header}\n${e.text}`;
}

export function buildUserMessage(evidence: Evidence[], message: string, maxEvidenceChars = 12000): string {
  const blocks: string[] = [];
  let currentLength = 0;

  for (const e of evidence) {
    const block = formatEvidenceBlock(e);
    if (currentLength + block.length + 2 <= maxEvidenceChars) {
      blocks.push(block);
      currentLength += block.length + 2;
    } else {
      // Partial truncation if needed to fill remaining budget
      const remaining = maxEvidenceChars - currentLength;
      if (remaining > 20) {
        blocks.push(block.slice(0, remaining));
      }
      break;
    }
  }

  const evidenceSection = blocks.length > 0 ? `EVIDENCE\n${blocks.join('\n\n')}\n\n` : '';
  return `${evidenceSection}QUESTION\n${message}`;
}

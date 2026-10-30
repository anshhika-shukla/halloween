// apps/api/src/ingest/chunk.ts - Chunks repository source files, commits, and issues
import path from 'node:path';
import fs from 'node:fs';
import type { Chunk } from '../types.js';
import type { WalkedFile } from './walk.js';
import type { ParsedCommit, IngestedIssue } from './types.js';
import { config } from '../config.js';

const MAX_CHUNK_CHARS = 3000;
const WINDOW_LINES = 60;
const OVERLAP_LINES = 10;
const STEP_LINES = WINDOW_LINES - OVERLAP_LINES; // 50

export function chunkCodeFile(filePath: string, content: string, language?: string): Chunk[] {
  const lines = content.split(/\r?\n/);
  const chunks: Chunk[] = [];

  if (lines.length === 0 || (lines.length === 1 && lines[0].trim().length === 0)) {
    return [];
  }

  // If file has 60 lines or fewer, single chunk
  if (lines.length <= WINDOW_LINES) {
    const text = lines.join('\n').slice(0, MAX_CHUNK_CHARS);
    const chunkId = `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}-1-${lines.length}`;
    chunks.push({
      id: chunkId,
      kind: 'file',
      path: filePath,
      startLine: 1,
      endLine: lines.length,
      title: `${filePath}:1-${lines.length}`,
      text,
    });
    return chunks;
  }

  for (let start = 0; start < lines.length; start += STEP_LINES) {
    const end = Math.min(start + WINDOW_LINES, lines.length);
    const sliceLines = lines.slice(start, end);
    const text = sliceLines.join('\n').slice(0, MAX_CHUNK_CHARS);
    const startLine = start + 1;
    const endLine = end;
    const chunkId = `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}-${startLine}-${endLine}`;

    chunks.push({
      id: chunkId,
      kind: 'file',
      path: filePath,
      startLine,
      endLine,
      title: `${filePath}:${startLine}-${endLine}`,
      text,
    });

    if (end >= lines.length) {
      break;
    }
  }

  return chunks;
}

export function chunkMarkdownFile(filePath: string, content: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = content.split(/\r?\n/);

  // Group by markdown headings (# Heading)
  const sections: Array<{ heading: string; lines: string[]; startLine: number }> = [];
  let currentHeading = 'Overview';
  let currentLines: string[] = [];
  let currentStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);

    if (headingMatch && currentLines.length > 0) {
      sections.push({
        heading: currentHeading,
        lines: currentLines,
        startLine: currentStart,
      });
      currentHeading = headingMatch[1].trim();
      currentLines = [line];
      currentStart = i + 1;
    } else {
      if (headingMatch && currentLines.length === 0) {
        currentHeading = headingMatch[1].trim();
        currentStart = i + 1;
      }
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      lines: currentLines,
      startLine: currentStart,
    });
  }

  let sectionIdx = 1;
  for (const sec of sections) {
    const endLine = sec.startLine + sec.lines.length - 1;
    const text = sec.lines.join('\n').slice(0, MAX_CHUNK_CHARS);
    const chunkId = `file-${filePath.replace(/[^a-zA-Z0-9_-]/g, '_')}-${sec.startLine}-${endLine}`;

    chunks.push({
      id: chunkId,
      kind: 'file',
      path: filePath,
      startLine: sec.startLine,
      endLine,
      title: `${filePath}: ${sec.heading}`,
      text,
    });
    sectionIdx++;
  }

  return chunks;
}

export function chunkFiles(files: WalkedFile[], repoDir: string): Chunk[] {
  const chunks: Chunk[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.absolutePath, 'utf8');
      const ext = path.extname(file.relativePath).toLowerCase();

      if (ext === '.md' || ext === '.markdown') {
        chunks.push(...chunkMarkdownFile(file.relativePath, content));
      } else {
        chunks.push(...chunkCodeFile(file.relativePath, content, file.language));
      }
    } catch {
      // Ignore read errors
    }
  }

  return chunks;
}

export function chunkCommits(commits: ParsedCommit[]): Chunk[] {
  return commits.map((c) => {
    const shortSha = c.sha.slice(0, 7);
    const chunkId = `commit-${shortSha}`;
    const title = `commit ${shortSha}: ${c.subject}`;
    const text = `commit ${c.sha} by ${c.author} on ${c.date}\nSubject: ${c.subject}\n\n${c.body}\nFiles changed: ${c.filesChanged.join(', ')}`.slice(0, MAX_CHUNK_CHARS);

    return {
      id: chunkId,
      kind: 'commit',
      sha: c.sha,
      title,
      text,
    };
  });
}

export function chunkIssues(issues: IngestedIssue[]): Chunk[] {
  return issues.map((issue) => {
    const chunkId = `issue-${issue.number}`;
    const title = `issue #${issue.number}: ${issue.title}`;
    const labelsStr = issue.labels.length > 0 ? `Labels: ${issue.labels.join(', ')}\n` : '';
    const text = `Issue #${issue.number}: ${issue.title}\n${labelsStr}\n${issue.body}`.slice(0, MAX_CHUNK_CHARS);

    return {
      id: chunkId,
      kind: 'issue',
      number: issue.number,
      title,
      text,
    };
  });
}

export function capChunks(allChunks: Chunk[], maxChunks = config.MAX_CHUNKS): Chunk[] {
  if (allChunks.length <= maxChunks) {
    return allChunks;
  }

  // Priority order per spec:
  // 1. README and docs
  // 2. Top-level and src files
  // 3. Commits
  // 4. The rest
  const priority1: Chunk[] = [];
  const priority2: Chunk[] = [];
  const priority3: Chunk[] = [];
  const priority4: Chunk[] = [];

  for (const c of allChunks) {
    if (c.kind === 'file' && c.path) {
      const lower = c.path.toLowerCase();
      if (lower.includes('readme') || lower.startsWith('docs/')) {
        priority1.push(c);
      } else if (lower.startsWith('src/') || !c.path.includes('/')) {
        priority2.push(c);
      } else {
        priority4.push(c);
      }
    } else if (c.kind === 'commit') {
      priority3.push(c);
    } else {
      priority4.push(c);
    }
  }

  const result: Chunk[] = [];

  for (const list of [priority1, priority2, priority3, priority4]) {
    for (const chunk of list) {
      if (result.length < maxChunks) {
        result.push(chunk);
      } else {
        break;
      }
    }
    if (result.length >= maxChunks) break;
  }

  return result;
}

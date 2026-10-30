// apps/api/src/ingest/metadata.ts - Extracts README excerpt, dependencies, and repo overview
import path from 'node:path';
import fs from 'node:fs';
import type { Repo } from '../types.js';
import type { ValidatedSource } from './sourceValidator.js';
import type { WalkResult } from './walk.js';
import type { GitLogSummary } from './gitlog.js';

export function extractReadmeExcerpt(repoDir: string): string {
  const possibleNames = ['README.md', 'readme.md', 'README', 'README.markdown', 'readme.txt'];
  for (const name of possibleNames) {
    const fullPath = path.join(repoDir, name);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        return content.slice(0, 1500).trim();
      } catch {
        // Continue checking
      }
    }
  }
  return '';
}

export function extractDependencies(repoDir: string): string[] {
  const deps = new Set<string>();

  // 1. package.json
  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies && typeof pkg.dependencies === 'object') {
        for (const dep of Object.keys(pkg.dependencies)) {
          deps.add(dep);
        }
      }
    } catch {
      // Ignore parse failure
    }
  }

  // 2. requirements.txt
  const reqPath = path.join(repoDir, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const lines = fs.readFileSync(reqPath, 'utf8').split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([a-zA-Z0-9_.-]+)/);
          if (match) {
            deps.add(match[1]);
          }
        }
      }
    } catch {
      // Ignore read failure
    }
  }

  return Array.from(deps);
}

export function buildRepoOverview(
  validatedSource: ValidatedSource,
  walkResult: WalkResult,
  gitSummary: GitLogSummary,
  readmeExcerpt: string,
  dependencies: string[],
  warnings: string[]
): Repo {
  return {
    id: validatedSource.repoId,
    name: validatedSource.name,
    source: validatedSource.source,
    defaultBranch: gitSummary.defaultBranch,
    lastCommitAt: gitSummary.lastCommitAt,
    deadForDays: gitSummary.deadForDays,
    commitCount: gitSummary.commitCount,
    languages: walkResult.languages,
    fileCount: walkResult.fileCount,
    chunksIndexed: null, // Populated in Phase 2
    readmeExcerpt,
    dependencies,
    warnings,
  };
}

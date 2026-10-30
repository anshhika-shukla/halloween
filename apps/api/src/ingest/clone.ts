// apps/api/src/ingest/clone.ts - Safe repository cloning into managed data directory
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ValidatedSource } from './sourceValidator.js';
import { AppError } from '../errors.js';

const execFileAsync = promisify(execFile);
const MAX_REPO_BYTES = 300 * 1024 * 1024; // 300 MB

function getDirectorySize(dir: string): number {
  let size = 0;
  if (!fs.existsSync(dir)) return 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        size += getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      }
    } catch {
      // Ignore read errors
    }
  }
  return size;
}

export async function cloneRepository(
  validatedSource: ValidatedSource,
  targetRepoDir: string
): Promise<{ repoDir: string; reused: boolean }> {
  // If already cloned and valid git repository with commits, reuse it
  if (fs.existsSync(path.join(targetRepoDir, '.git'))) {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: targetRepoDir,
        timeout: 5000,
        windowsHide: true,
      });
      return { repoDir: targetRepoDir, reused: true };
    } catch {
      // If corrupted or uncommitted, clean and re-clone
      fs.rmSync(targetRepoDir, { recursive: true, force: true });
    }
  }

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(targetRepoDir), { recursive: true });

  const args: string[] = ['clone'];

  if (validatedSource.type === 'local') {
    args.push('--local', validatedSource.resolvedLocalPath!, targetRepoDir);
  } else {
    args.push(
      '--depth',
      '500',
      '--no-tags',
      '--single-branch',
      validatedSource.source,
      targetRepoDir
    );
  }

  try {
    await execFileAsync('git', args, {
      timeout: 120_000, // 120s timeout per spec
      windowsHide: true,
    });
  } catch (err: any) {
    if (err.killed) {
      throw new AppError('clone_timeout', 'Repository cloning timed out after 120s', 408);
    }
    throw new AppError('clone_failed', `Failed to clone repository: ${err.message}`, 400);
  }

  // Check repo size limit (300 MB)
  const repoSize = getDirectorySize(targetRepoDir);
  if (repoSize > MAX_REPO_BYTES) {
    fs.rmSync(targetRepoDir, { recursive: true, force: true });
    throw new AppError('repo_too_large', 'Repository exceeds the 300MB limit', 400);
  }

  return { repoDir: targetRepoDir, reused: false };
}

// apps/api/src/ingest/gitlog.ts - Parses git commit history with custom delimiter format
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ParsedCommit } from './types.js';

const execFileAsync = promisify(execFile);

export interface GitLogSummary {
  commits: ParsedCommit[];
  commitCount: number;
  lastCommitAt: string;
  deadForDays: number;
  defaultBranch: string;
}

const COMMIT_DELIMITER = '@@__COMMIT_START__@@';
const FIELD_DELIMITER = '\x1f';

export async function parseGitHistory(repoDir: string, maxCommits = 500): Promise<GitLogSummary> {
  // 1. Get default/current branch
  let defaultBranch = 'main';
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: repoDir,
      windowsHide: true,
    });
    defaultBranch = stdout.trim() || 'main';
  } catch {
    defaultBranch = 'main';
  }

  // 2. Total commit count
  let commitCount = 0;
  try {
    const { stdout } = await execFileAsync('git', ['rev-list', '--count', 'HEAD'], {
      cwd: repoDir,
      windowsHide: true,
    });
    commitCount = parseInt(stdout.trim(), 10) || 0;
  } catch {
    commitCount = 0;
  }

  // 3. Format: delimiter + sha, author, email, isoDate, subject, body
  // Followed by changed file paths via --name-only
  const formatStr = `${COMMIT_DELIMITER}%n%H${FIELD_DELIMITER}%an${FIELD_DELIMITER}%ae${FIELD_DELIMITER}%aI${FIELD_DELIMITER}%s${FIELD_DELIMITER}%b`;

  const { stdout } = await execFileAsync(
    'git',
    ['log', `-n`, String(maxCommits), `--format=${formatStr}`, '--name-only'],
    {
      cwd: repoDir,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    }
  );

  const rawBlocks = stdout.split(COMMIT_DELIMITER).filter((b) => b.trim().length > 0);
  const commits: ParsedCommit[] = [];

  for (const block of rawBlocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    const header = lines[0];
    const parts = header.split(FIELD_DELIMITER);
    if (parts.length < 5) continue;

    const [sha, author, email, date, subject, ...bodyParts] = parts;
    const body = bodyParts.join(FIELD_DELIMITER).trim();
    const filesChanged = lines.slice(1).map((f) => f.trim()).filter((f) => f.length > 0);

    commits.push({
      sha: sha.trim(),
      author: author.trim(),
      email: email.trim(),
      date: date.trim(),
      subject: subject.trim(),
      body,
      filesChanged,
    });
  }

  if (commitCount === 0) {
    commitCount = commits.length;
  }

  const lastCommitAt = commits[0]?.date || new Date().toISOString();
  const lastCommitTime = new Date(lastCommitAt).getTime();
  const deadForDays = Math.max(0, Math.floor((Date.now() - lastCommitTime) / (1000 * 60 * 60 * 24)));

  return {
    commits,
    commitCount,
    lastCommitAt,
    deadForDays,
    defaultBranch,
  };
}

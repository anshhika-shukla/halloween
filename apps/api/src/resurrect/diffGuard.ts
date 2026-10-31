// apps/api/src/resurrect/diffGuard.ts - Security & validity guard for proposed patches
import fs from 'node:fs';
import path from 'node:path';

export interface DiffValidationResult {
  valid: boolean;
  error?: string;
  cleanDiff: string;
}

const LOCKFILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'pipfile.lock',
  'cargo.lock',
  'composer.lock',
  'gemfile.lock',
]);

export function validatePatch(
  diff: string,
  repoDir: string,
  findingKind?: string
): DiffValidationResult {
  if (!diff || typeof diff !== 'string' || !diff.trim()) {
    return { valid: false, error: 'Empty or missing patch', cleanDiff: '' };
  }

  // 1. Strip markdown fences if present
  let cleanDiff = diff.trim();
  const fenceMatch = cleanDiff.match(/```(?:diff|patch)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    cleanDiff = fenceMatch[1];
  } else {
    cleanDiff = cleanDiff.replace(/^```(?:diff|patch)?\s*\n?/im, '').replace(/\n?```\s*$/im, '');
  }

  // 2. Normalize line endings to LF
  cleanDiff = cleanDiff.replace(/\r\n/g, '\n').trim() + '\n';

  // 3. Reject binary patches
  if (
    cleanDiff.includes('GIT binary patch') ||
    cleanDiff.includes('Binary files ') ||
    cleanDiff.includes('\0')
  ) {
    return { valid: false, error: 'Binary patches are not permitted', cleanDiff };
  }

  // 4. Check unified diff structure
  if (!cleanDiff.includes('--- ') || !cleanDiff.includes('+++ ') || !cleanDiff.includes('@@')) {
    return {
      valid: false,
      error: 'Patch is not a valid unified diff (missing ---, +++, or @@ markers)',
      cleanDiff,
    };
  }

  // 5. Parse file headers and count changed lines
  const modifiedFiles = new Set<string>();
  const lines = cleanDiff.split('\n');
  let changedLinesCount = 0;

  for (const line of lines) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const match = line.match(/^(?:\+\+\+|---)\s+(?:[ab]\/)?(\S+)/);
      if (match && match[1] && match[1] !== '/dev/null') {
        const rawPath = match[1].replace(/\\/g, '/');

        // Check path traversal
        if (rawPath.includes('..') || rawPath.startsWith('/')) {
          return {
            valid: false,
            error: `Path traversal or absolute path detected: ${rawPath}`,
            cleanDiff,
          };
        }

        // Check forbidden directories (.git, .github)
        const parts = rawPath.split('/');
        if (parts.includes('.git')) {
          return {
            valid: false,
            error: 'Modifying .git directory is forbidden',
            cleanDiff,
          };
        }
        if (parts.includes('.github')) {
          return {
            valid: false,
            error: 'Modifying .github directory is forbidden',
            cleanDiff,
          };
        }

        // Check lockfiles unless outdated-dep
        const fileName = parts[parts.length - 1].toLowerCase();
        if (LOCKFILES.has(fileName) && findingKind !== 'outdated-dep') {
          return {
            valid: false,
            error: `Modifying lockfile (${fileName}) is forbidden`,
            cleanDiff,
          };
        }

        if (line.startsWith('+++ ')) {
          modifiedFiles.add(rawPath);
        }
      }
    } else if (line.startsWith('+') || line.startsWith('-')) {
      changedLinesCount++;
    }
  }

  // 6. Max 5 files modified
  if (modifiedFiles.size > 5) {
    return {
      valid: false,
      error: `Patch modifies more than 5 files (${modifiedFiles.size} files, maximum permitted: 5)`,
      cleanDiff,
    };
  }

  // 7. Max 200 lines modified
  if (changedLinesCount > 200) {
    return {
      valid: false,
      error: `Patch modifies more than 200 lines (${changedLinesCount} lines, maximum permitted: 200 lines)`,
      cleanDiff,
    };
  }

  // 8. Every modified file must exist in the repository clone
  for (const file of modifiedFiles) {
    const fullPath = path.join(repoDir, file);
    if (!fs.existsSync(fullPath)) {
      return {
        valid: false,
        error: `Modified file does not exist in repository: ${file}`,
        cleanDiff,
      };
    }
  }

  return { valid: true, cleanDiff };
}

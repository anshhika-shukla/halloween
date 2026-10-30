// apps/api/src/ingest/walk.ts - Filesystem walker with binary, size, and lockfile filtering
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.js';

export interface WalkedFile {
  relativePath: string;
  absolutePath: string;
  size: number;
  language?: string;
}

export interface WalkResult {
  files: WalkedFile[];
  fileCount: number;
  languages: Record<string, number>;
  ignoredFilesCount: number;
  lockfiles: string[];
}

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  '.next',
  'out',
  'target',
  '__pycache__',
]);

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Pipfile.lock',
  'poetry.lock',
  'Cargo.lock',
  'composer.lock',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svgz',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
  '.wasm', '.class', '.pyc', '.pyd', '.o', '.a',
  '.mp3', '.mp4', '.wav', '.mov', '.avi',
  '.woff', '.woff2', '.ttf', '.eot',
]);

const EXT_TO_LANG: Record<string, string> = {
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.rb': 'Ruby',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.h': 'C/C++ Header',
  '.hpp': 'C/C++ Header',
  '.cs': 'C#',
  '.php': 'PHP',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.markdown': 'Markdown',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.sql': 'SQL',
};

export function isBinaryFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);

    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) {
        return true;
      }
    }
  } catch {
    // If open fails, treat safely
    return false;
  }
  return false;
}

export function walkRepository(
  repoDir: string,
  maxFileBytes = config.MAX_FILE_BYTES
): WalkResult {
  const files: WalkedFile[] = [];
  const languages: Record<string, number> = {};
  const lockfiles: string[] = [];
  let ignoredFilesCount = 0;

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(repoDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          ignoredFilesCount++;
          continue;
        }
        traverse(fullPath);
      } else if (entry.isFile()) {
        // Check lockfiles: summarize them separately and exclude from source files
        if (LOCKFILE_NAMES.has(entry.name)) {
          lockfiles.push(relPath);
          continue;
        }

        // Check file size
        const stat = fs.statSync(fullPath);
        if (stat.size > maxFileBytes) {
          ignoredFilesCount++;
          continue;
        }

        // Check if binary (via extension or null-byte sniff)
        if (isBinaryFile(fullPath)) {
          ignoredFilesCount++;
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        const lang = EXT_TO_LANG[ext] || 'Other';
        languages[lang] = (languages[lang] || 0) + 1;

        files.push({
          relativePath: relPath,
          absolutePath: fullPath,
          size: stat.size,
          language: lang,
        });
      }
    }
  }

  traverse(repoDir);

  return {
    files,
    fileCount: files.length,
    languages,
    ignoredFilesCount,
    lockfiles,
  };
}

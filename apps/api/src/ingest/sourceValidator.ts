// apps/api/src/ingest/sourceValidator.ts - Validates repository sources according to safety rules
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../errors.js';

export interface ValidatedSource {
  type: 'remote' | 'local';
  source: string;
  repoId: string;
  name: string;
  resolvedLocalPath?: string;
  owner?: string;
  repo?: string;
}

const GITHUB_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(\.git)?\/?$/;
const SHELL_METACHARS = /[;&|`$><\n\r]/;

export function getWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'fixtures')) && fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function computeRepoId(baseName: string, sourceStr: string): string {
  const slug = slugify(baseName);
  const hash = crypto.createHash('sha1').update(sourceStr).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

export function validateSource(source: string, workspaceRoot = getWorkspaceRoot()): ValidatedSource {
  if (!source || typeof source !== 'string' || !source.trim()) {
    throw new AppError('invalid_source', 'Source repository cannot be empty', 400);
  }

  const trimmed = source.trim();

  // Reject shell metacharacters
  if (SHELL_METACHARS.test(trimmed)) {
    throw new AppError('invalid_source', 'Source contains invalid or unsafe characters', 400);
  }

  // Reject unauthorized schemes
  if (
    trimmed.startsWith('file://') ||
    trimmed.startsWith('ssh://') ||
    trimmed.startsWith('http://')
  ) {
    throw new AppError('invalid_source', 'Invalid source protocol. Only https://github.com/ or local paths are allowed', 400);
  }

  // Check remote GitHub source
  const remoteMatch = trimmed.match(GITHUB_REGEX);
  if (remoteMatch) {
    const owner = remoteMatch[1];
    const repo = remoteMatch[2];
    const name = `${owner}/${repo}`;
    const repoId = computeRepoId(`${owner}-${repo}`, trimmed);

    return {
      type: 'remote',
      source: trimmed,
      repoId,
      name,
      owner,
      repo,
    };
  }

  // If starts with https:// but not github.com
  if (trimmed.startsWith('https://')) {
    throw new AppError('invalid_source', 'Remote source must be a valid GitHub HTTPS URL', 400);
  }

  // Check local source permissions
  if (!config.ALLOW_LOCAL_SOURCES) {
    throw new AppError('local_sources_forbidden', 'Local repository sources are disabled', 403);
  }

  // Resolve local path
  const resolvedPath = path.resolve(workspaceRoot, trimmed);
  const resolvedFixtures = path.resolve(workspaceRoot, 'fixtures');
  const resolvedData = path.resolve(workspaceRoot, config.DATA_DIR);

  // Check that real/resolved path is strictly inside fixtures or data directory
  const isInsideFixtures = resolvedPath === resolvedFixtures || resolvedPath.startsWith(resolvedFixtures + path.sep);
  const isInsideData = resolvedPath === resolvedData || resolvedPath.startsWith(resolvedData + path.sep);

  if (!isInsideFixtures && !isInsideData) {
    throw new AppError('invalid_source', 'Local paths must be inside ./fixtures or DATA_DIR', 400);
  }

  // Check existence
  if (!fs.existsSync(resolvedPath)) {
    throw new AppError('source_not_found', `Local source does not exist: ${trimmed}`, 404);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new AppError('invalid_source', 'Local source must be a directory', 400);
  }

  // If symlink, also verify realpath
  const real = fs.realpathSync(resolvedPath);
  const realFixtures = fs.existsSync(resolvedFixtures) ? fs.realpathSync(resolvedFixtures) : resolvedFixtures;
  const realData = fs.existsSync(resolvedData) ? fs.realpathSync(resolvedData) : resolvedData;
  const realInsideFixtures = real === realFixtures || real.startsWith(realFixtures + path.sep);
  const realInsideData = real === realData || real.startsWith(realData + path.sep);

  if (!realInsideFixtures && !realInsideData) {
    throw new AppError('invalid_source', 'Resolved symlink escapes allowed directories', 400);
  }

  const folderName = path.basename(resolvedPath);
  const repoId = computeRepoId(folderName, trimmed);

  return {
    type: 'local',
    source: trimmed,
    repoId,
    name: folderName,
    resolvedLocalPath: resolvedPath,
  };
}

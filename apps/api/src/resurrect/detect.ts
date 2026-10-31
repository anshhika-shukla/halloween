// apps/api/src/resurrect/detect.ts - Finding detection for failing tests, TODOs, and diagnostics
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';
import { getSandboxRunner } from './sandbox.js';
import type { Finding, TestRun } from '../types.js';

export function computeFindingId(
  kind: Finding['kind'],
  title: string,
  firstEvidence: string = ''
): string {
  return crypto
    .createHash('sha1')
    .update(`${kind}:${title}:${firstEvidence}`)
    .digest('hex')
    .slice(0, 10);
}

export function detectTestCommand(repoDir: string): string | null {
  const pkgPath = path.join(repoDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.scripts && pkg.scripts.test) {
        return 'npm test';
      }
    } catch {
      // ignore parse error
    }
  }

  if (
    fs.existsSync(path.join(repoDir, 'pytest.ini')) ||
    fs.existsSync(path.join(repoDir, 'setup.cfg')) ||
    fs.existsSync(path.join(repoDir, 'pyproject.toml'))
  ) {
    return 'python -m pytest';
  }

  return null;
}

export function getRepoHeadSha(repoDir: string): string {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: repoDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return 'unknown-sha';
  }
}

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
]);

const TEXT_EXTS = new Set([
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.java',
  '.cs',
  '.php',
  '.html',
  '.css',
  '.md',
  '.txt',
]);

function walkTextFiles(dir: string, baseDir: string = dir): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue;
    if (IGNORE_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTextFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

export function scanTodoFindings(repoDir: string): Finding[] {
  const findings: Finding[] = [];
  const files = walkTextFiles(repoDir);

  const todoRegex = /(?:^|\s|\/\/|\/\*|#|\*)\s*\b(TODO|FIXME|HACK|XXX)\b:?\s+(.+)$/i;

  for (const filePath of files) {
    const relPath = path.relative(repoDir, filePath).replace(/\\/g, '/');
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(todoRegex);
      if (match) {
        const marker = match[1].toUpperCase();
        const text = match[2].trim();
        const title = `${marker}: ${text}`;
        const evidenceStr = `${relPath}:${i + 1}: ${line.trim()}`;
        const evidence = [evidenceStr];
        const difficulty = marker === 'TODO' ? 'easy' : 'medium';
        const id = computeFindingId('todo', title, evidence[0]);

        findings.push({
          id,
          kind: 'todo',
          title,
          evidence,
          difficulty,
        });
      }
    }
  }

  return findings;
}

export async function detectFailingTests(
  repoDir: string,
  testCommand: string,
  runner = getSandboxRunner()
): Promise<{ findings: Finding[]; testRun?: TestRun }> {
  if (!runner.isAvailable()) {
    return { findings: [] };
  }

  let testRun: TestRun;
  try {
    testRun = await runner.run(repoDir, testCommand);
  } catch (err: any) {
    testRun = {
      exitCode: 1,
      passed: 0,
      failed: 1,
      output: err?.message || 'Failed to execute test suite in sandbox',
    };
  }

  if (testRun.exitCode === 0 && testRun.failed === 0) {
    return { findings: [], testRun };
  }

  const findings: Finding[] = [];
  const output = testRun.output;

  // Extract failing test titles from TAP or spec output
  const tapMatches = [...output.matchAll(/^not ok\s+\d+\s*-\s*([^\r\n]+)/gim)];
  const checkMatches = [...output.matchAll(/[✖✕]\s*([^\r\n(]+)/g)];

  const foundTitles = new Set<string>();

  for (const m of tapMatches) {
    const title = m[1].trim();
    if (
      title &&
      !title.toLowerCase().startsWith('failing test') &&
      !foundTitles.has(title)
    ) {
      foundTitles.add(title);
    }
  }

  for (const m of checkMatches) {
    const title = m[1].trim();
    if (
      title &&
      !title.toLowerCase().startsWith('failing test') &&
      !foundTitles.has(title)
    ) {
      foundTitles.add(title);
    }
  }

  if (foundTitles.size > 0) {
    for (const title of foundTitles) {
      // Find relevant evidence line in output and strip dynamic timing (e.g. 1.23ms)
      const rawLine = output.split('\n').find((l) => l.includes(title))?.trim() || title;
      const cleanEvidence = rawLine.replace(/\s*\(\d+(?:\.\d+)?m?s\)/g, '').trim();
      const evidence = [cleanEvidence];
      const id = computeFindingId('failing-test', title, evidence[0]);
      findings.push({
        id,
        kind: 'failing-test',
        title,
        evidence,
        difficulty: 'easy',
      });
    }
  } else {
    // Fallback: general failing test suite finding
    const title = 'Failing test suite';
    const evidence = [output.split('\n')[0] || 'Tests exited with failure'];
    const id = computeFindingId('failing-test', title, evidence[0]);
    findings.push({
      id,
      kind: 'failing-test',
      title,
      evidence,
      difficulty: 'medium',
    });
  }

  return { findings, testRun };
}

export async function detectFindings(
  target: string,
  options?: {
    workspaceRoot?: string;
    forceRefresh?: boolean;
    runner?: ReturnType<typeof getSandboxRunner>;
  }
): Promise<{
  findings: Finding[];
  headSha: string;
  cached: boolean;
  initialTestRun?: TestRun;
}> {
  const workspaceRoot = options?.workspaceRoot || getWorkspaceRoot();
  const baseDataDir = path.resolve(workspaceRoot, config.DATA_DIR);
  const repoManagedDir = path.join(baseDataDir, 'repos', target);

  let repoDir = '';
  let cacheDir = '';

  if (fs.existsSync(repoManagedDir)) {
    repoDir = path.join(repoManagedDir, 'repo');
    cacheDir = repoManagedDir;
  } else {
    repoDir = path.isAbsolute(target) ? target : path.resolve(workspaceRoot, target);
    cacheDir = repoDir;
  }

  let headSha = getRepoHeadSha(repoDir);

  // Check meta.json for headSha if available
  const metaPath = path.join(cacheDir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.headSha) {
        headSha = meta.headSha;
      }
    } catch {
      // ignore
    }
  }

  const cacheFile = path.join(cacheDir, 'findings.json');
  if (!options?.forceRefresh && fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.headSha === headSha && Array.isArray(cached.findings)) {
        return { findings: cached.findings, headSha, cached: true };
      }
    } catch {
      // ignore corrupt cache
    }
  }

  const findings: Finding[] = [];
  let initialTestRun: TestRun | undefined;

  // 1. Failing tests
  const testCmd = detectTestCommand(repoDir);
  if (testCmd) {
    const runner = options?.runner || getSandboxRunner();
    const testResult = await detectFailingTests(repoDir, testCmd, runner);
    findings.push(...testResult.findings);
    initialTestRun = testResult.testRun;
  }

  // 2. Scan TODO / FIXME / HACK / XXX findings
  const todoFindings = scanTodoFindings(repoDir);
  findings.push(...todoFindings);

  // Cache to findings.json
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      cacheFile,
      JSON.stringify({ headSha, findings, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch {
    // ignore write errors if dir is read-only
  }

  return { findings, headSha, cached: false, initialTestRun };
}

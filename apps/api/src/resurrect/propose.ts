// apps/api/src/resurrect/propose.ts - Patch proposal and sandbox verification loop
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { parseCitations } from '../ghost/citations.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';
import { getProvider } from '../llm/index.js';
import { detectFindings, detectTestCommand } from './detect.js';
import { validatePatch } from './diffGuard.js';
import { getSandboxRunner } from './sandbox.js';
import type { Citation, Evidence, Finding, Patch, TestRun } from '../types.js';

// Concurrency control: only one patch proposal per repo at a time
export const activeProposals = new Set<string>();

export function getRepoManagedDir(repoId: string, workspaceRoot = getWorkspaceRoot()): string {
  const baseDataDir = path.resolve(workspaceRoot, config.DATA_DIR);
  return path.join(baseDataDir, 'repos', repoId);
}

export function getRepoCloneDir(repoId: string, workspaceRoot = getWorkspaceRoot()): string {
  const managed = getRepoManagedDir(repoId, workspaceRoot);
  if (fs.existsSync(managed)) {
    return path.join(managed, 'repo');
  }
  return path.isAbsolute(repoId) ? repoId : path.resolve(workspaceRoot, repoId);
}

export function findPatchById(
  patchId: string,
  workspaceRoot = getWorkspaceRoot()
): { patch: Patch; repoId: string; patchPath: string; diffPath: string } | null {
  if (!patchId || !/^[a-zA-Z0-9_.-]+$/.test(patchId) || patchId.includes('..')) {
    return null;
  }
  const baseDataDir = path.resolve(workspaceRoot, config.DATA_DIR);
  const reposDir = path.join(baseDataDir, 'repos');
  if (!fs.existsSync(reposDir)) return null;

  const entries = fs.readdirSync(reposDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const candidateJson = path.join(reposDir, entry.name, 'patches', `${patchId}.json`);
      const candidateDiff = path.join(reposDir, entry.name, 'patches', `${patchId}.diff`);
      if (fs.existsSync(candidateJson)) {
        try {
          const patch = JSON.parse(fs.readFileSync(candidateJson, 'utf8')) as Patch;
          return { patch, repoId: entry.name, patchPath: candidateJson, diffPath: candidateDiff };
        } catch {
          // ignore
        }
      }
    }
  }

  return null;
}

export async function proposePatch(
  repoId: string,
  findingId: string,
  options?: { workspaceRoot?: string }
): Promise<Patch> {
  const workspaceRoot = options?.workspaceRoot || getWorkspaceRoot();

  // 1. Concurrency guard
  if (activeProposals.has(repoId)) {
    throw new AppError(
      'concurrency_conflict',
      'A patch proposal is already in progress for this repository',
      409
    );
  }

  activeProposals.add(repoId);

  try {
    const repoManagedDir = getRepoManagedDir(repoId, workspaceRoot);
    const repoCloneDir = getRepoCloneDir(repoId, workspaceRoot);

    if (!fs.existsSync(repoCloneDir)) {
      throw new AppError('repo_not_found', `Repository ${repoId} not found`, 404);
    }

    // 2. Locate finding
    const { findings, initialTestRun } = await detectFindings(repoId, { workspaceRoot });
    const finding = findings.find((f) => f.id === findingId);
    if (!finding) {
      throw new AppError('finding_not_found', `Finding ${findingId} not found in repository`, 404);
    }

    // 3. Gather context
    const testCmd = detectTestCommand(repoCloneDir) || 'npm test';
    const testOutput = finding.evidence.join('\n');

    // Identify relevant files to supply to model
    const fileEntries: Array<{ relPath: string; content: string }> = [];
    const seenFiles = new Set<string>();

    // From evidence (e.g. "src/storage.js:12: ...")
    for (const ev of finding.evidence) {
      const match = ev.match(/^([a-zA-Z0-9_./-]+):/);
      if (match && match[1]) {
        const candidate = match[1];
        if (fs.existsSync(path.join(repoCloneDir, candidate))) {
          seenFiles.add(candidate);
        }
      }
    }

    // Also look for test files and source files if failing test
    if (finding.kind === 'failing-test') {
      const walkFiles = (dir: string): string[] => {
        const out: string[] = [];
        try {
          const list = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of list) {
            if (item.name.startsWith('.') || item.name === 'node_modules') continue;
            const full = path.join(dir, item.name);
            if (item.isDirectory()) out.push(...walkFiles(full));
            else out.push(full);
          }
        } catch {
          // ignore
        }
        return out;
      };

      const allFiles = walkFiles(repoCloneDir);
      for (const f of allFiles) {
        const rel = path.relative(repoCloneDir, f).replace(/\\/g, '/');
        if (rel.endsWith('.js') || rel.endsWith('.ts')) {
          seenFiles.add(rel);
        }
      }
    }

    // Read up to 5 files
    for (const rel of Array.from(seenFiles).slice(0, 5)) {
      try {
        const content = fs.readFileSync(path.join(repoCloneDir, rel), 'utf8');
        fileEntries.push({ relPath: rel, content });
      } catch {
        // ignore
      }
    }

    const filesText = fileEntries
      .map((fe) => `FILE: ${fe.relPath}\n${fe.content.slice(0, 2000)}`)
      .join('\n\n');

    // Load patch prompt template
    const patchPromptPath = path.resolve(workspaceRoot, config.PROMPTS_DIR, 'patch.system.txt');
    const patchTemplate = fs.readFileSync(patchPromptPath, 'utf8');

    const llm = getProvider();
    const runner = getSandboxRunner();

    let cleanDiff = '';
    let lastError = '';
    let currentAttempt = 0;
    let verification: Patch['verification'] = { status: 'failed' };
    let afterTestRun: TestRun | undefined;

    // Up to 3 attempts
    for (let attempt = 1; attempt <= 3; attempt++) {
      currentAttempt = attempt;

      const systemPrompt = patchTemplate
        .replace('{finding.title}', finding.title)
        .replace('{testOutput}', testOutput.slice(0, 3000))
        .replace('{files}', filesText)
        .replace('{error}', lastError);

      const llmResult = await llm.chat({
        system: systemPrompt,
        messages: [{ role: 'user', content: `Fix the issue: ${finding.title}. Return unified diff only.` }],
      });

      // Diff guard validation
      const guardResult = validatePatch(llmResult.text, repoCloneDir, finding.kind);
      if (!guardResult.valid) {
        lastError = `Diff validation failed: ${guardResult.error}`;
        continue;
      }

      cleanDiff = guardResult.cleanDiff;

      // Create isolated temporary directory for testing the patch
      const fixturesDir = path.resolve(workspaceRoot, 'fixtures');
      const tempBase =
        config.SANDBOX === 'unsafe-local'
          ? path.join(fixturesDir, '.tmp-sandboxes')
          : os.tmpdir();
      fs.mkdirSync(tempBase, { recursive: true });
      const tempDir = fs.mkdtempSync(path.join(tempBase, 'revenant-patch-'));
      try {
        // Copy repo to temp directory
        fs.cpSync(repoCloneDir, tempDir, { recursive: true });

        // 1. Run tests before applying patch
        let beforeTestRun = initialTestRun;
        if (!beforeTestRun && runner.isAvailable()) {
          try {
            beforeTestRun = await runner.run(tempDir, testCmd);
          } catch {
            // ignore
          }
        }

        // 2. git apply --check in temp directory
        try {
          execSync('git apply --check --ignore-whitespace -', {
            cwd: tempDir,
            input: cleanDiff,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          });
        } catch (err: any) {
          const stderr = err?.stderr?.toString() || err?.message || 'git apply --check failed';
          lastError = `git apply --check failed: ${stderr.trim()}`;
          continue;
        }

        // 3. Apply diff in temp directory
        execSync('git apply --ignore-whitespace -', {
          cwd: tempDir,
          input: cleanDiff,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        // 4. Run tests in sandbox after applying patch
        if (!runner.isAvailable()) {
          verification = {
            status: 'unverified',
            reason: 'Sandbox is disabled or unavailable',
          };
          break; // Succeeded in generating valid applicable patch
        }

        afterTestRun = await runner.run(tempDir, testCmd);
        if (afterTestRun.exitCode === 0 && afterTestRun.failed === 0) {
          verification = {
            status: 'verified',
            before: beforeTestRun,
            after: afterTestRun,
          };
          break; // Verified!
        } else {
          lastError = `Tests failed after patch:\n${afterTestRun.output.slice(0, 1000)}`;
          continue;
        }
      } finally {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup errors
        }
      }
    }

    // If verification failed and no valid diff or all attempts failed
    if (verification.status === 'failed' || (!cleanDiff && currentAttempt >= 3)) {
      if (!cleanDiff || lastError.includes('Diff validation') || lastError.includes('git apply')) {
        throw new AppError(
          'patch_invalid',
          `Failed to generate a valid patch after ${currentAttempt} attempts: ${lastError}`,
          422
        );
      }
    }

    // 4. Explanation call with citations
    const explainPromptPath = path.resolve(workspaceRoot, config.PROMPTS_DIR, 'explain.system.txt');
    const explainTemplate = fs.existsSync(explainPromptPath)
      ? fs.readFileSync(explainPromptPath, 'utf8')
      : 'Explain in at most 4 sentences what was wrong and what the patch changes. Cite with [E#].';

    const evidenceList: Evidence[] = [];
    let eidCounter = 1;

    for (const fe of fileEntries) {
      evidenceList.push({
        id: `file:${fe.relPath}:1`,
        eid: `E${eidCounter++}`,
        kind: 'file',
        path: fe.relPath,
        startLine: 1,
        endLine: fe.content.split('\n').length,
        title: fe.relPath,
        text: fe.content.slice(0, 500),
        score: 1.0,
      });
    }

    const evidencePrompt = evidenceList
      .map((ev) => `[${ev.eid}] file ${ev.path} lines ${ev.startLine}-${ev.endLine}:\n${ev.text}`)
      .join('\n\n');

    const explainResult = await llm.chat({
      system: `${explainTemplate}\n\nEVIDENCE:\n${evidencePrompt}\n\nPATCH DIFF:\n${cleanDiff}`,
      messages: [{ role: 'user', content: `Explain the problem (${finding.title}) and how the patch resolves it.` }],
    });

    const parsedCitations = parseCitations(explainResult.text, evidenceList);
    let explanation = parsedCitations.cleanAnswer;
    let citations = parsedCitations.citations;

    // Ensure at least one citation exists
    if (citations.length === 0 && evidenceList.length > 0) {
      const firstEv = evidenceList[0];
      citations.push({
        eid: firstEv.eid,
        kind: firstEv.kind,
        label: `[${firstEv.path}]`,
        ref: firstEv.id,
        snippet: firstEv.text.slice(0, 200),
      });
      if (!explanation.includes(`[${firstEv.eid}]`)) {
        explanation = `${explanation} [${firstEv.eid}]`;
      }
    }

    // 5. Persist patch to data/repos/{repoId}/patches/{patchId}.json & .diff
    const patchId = `patch-${crypto.randomUUID().slice(0, 8)}`;
    const patchesDir = path.join(repoManagedDir, 'patches');
    fs.mkdirSync(patchesDir, { recursive: true });

    const patch: Patch = {
      id: patchId,
      findingId: finding.id,
      diff: cleanDiff,
      explanation,
      citations,
      attempts: currentAttempt,
      verification,
      state: 'proposed',
    };

    fs.writeFileSync(path.join(patchesDir, `${patchId}.json`), JSON.stringify(patch, null, 2), 'utf8');
    fs.writeFileSync(path.join(patchesDir, `${patchId}.diff`), cleanDiff, 'utf8');

    return patch;
  } finally {
    activeProposals.delete(repoId);
  }
}

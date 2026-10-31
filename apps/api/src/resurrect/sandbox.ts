// apps/api/src/resurrect/sandbox.ts - Isolated and local test execution runners
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getWorkspaceRoot } from '../ingest/sourceValidator.js';
import { checkDockerAvailable } from '../routes/health.js';
import type { TestRun } from '../types.js';

export interface SandboxRunner {
  run(repoDir: string, command: string): Promise<TestRun>;
  isAvailable(): boolean;
}

export function parseTestOutput(output: string, exitCode: number): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  // 1. Look for Node test runner summary: "ℹ pass 2", "ℹ fail 1", "pass 2", "fail 1"
  const passMatch = output.match(/(?:ℹ\s*)?pass(?:ed)?\s*[:\s]\s*(\d+)/i);
  const failMatch = output.match(/(?:ℹ\s*)?fail(?:ed)?\s*[:\s]\s*(\d+)/i);

  if (passMatch || failMatch) {
    if (passMatch) passed = parseInt(passMatch[1], 10);
    if (failMatch) failed = parseInt(failMatch[1], 10);
  } else {
    // 2. Count TAP lines: "ok <N>" and "not ok <N>"
    const tapNotOk = (output.match(/^not ok\s+\d+/gm) || []).length;
    const tapOk = (output.match(/^ok\s+\d+/gm) || []).length;

    if (tapNotOk > 0 || tapOk > 0) {
      failed = tapNotOk;
      passed = tapOk;
    } else {
      // 3. Check for checkmarks and crosses
      const checks = (output.match(/✓|√/g) || []).length;
      const crosses = (output.match(/✖|✕|×/g) || []).length;

      if (checks > 0 || crosses > 0) {
        passed = checks;
        failed = crosses;
      }
    }
  }

  // Fallbacks if no explicit count was parsed
  if (exitCode === 0) {
    if (passed === 0 && failed === 0) passed = 1;
  } else {
    if (failed === 0) failed = 1;
  }

  return { passed, failed };
}

export class UnsafeLocalRunner implements SandboxRunner {
  isAvailable(): boolean {
    return true;
  }

  async run(repoDir: string, command: string): Promise<TestRun> {
    // Safety Rule 5: Untrusted repository code MUST NEVER be run directly on the host machine.
    // SANDBOX=unsafe-local is strictly permitted ONLY if repo is inside ./fixtures.
    const resolvedDir = path.resolve(repoDir);
    let realDir = resolvedDir;
    try {
      if (fs.existsSync(resolvedDir)) {
        realDir = fs.realpathSync(resolvedDir);
      }
    } catch {
      // fallback to resolvedDir
    }

    const fixturesDir = path.resolve(getWorkspaceRoot(), 'fixtures');
    let realFixturesDir = fixturesDir;
    try {
      if (fs.existsSync(fixturesDir)) {
        realFixturesDir = fs.realpathSync(fixturesDir);
      }
    } catch {
      // fallback
    }

    const isInsideFixtures =
      realDir === realFixturesDir ||
      realDir.startsWith(realFixturesDir + path.sep);

    if (!isInsideFixtures) {
      throw new AppError(
        'unsafe_sandbox_violation',
        'Unsafe local sandbox is strictly restricted to repositories inside ./fixtures',
        403
      );
    }

    return new Promise<TestRun>((resolve) => {
      exec(
        command,
        {
          cwd: repoDir,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (err, stdout, stderr) => {
          const rawOutput = (stdout || '') + (stderr ? '\n' + stderr : '');
          const output = rawOutput.length > 8192 ? rawOutput.slice(0, 8192) : rawOutput;
          const exitCode =
            err && typeof err.code === 'number'
              ? err.code
              : err
              ? 1
              : 0;
          const { passed, failed } = parseTestOutput(output, exitCode);
          resolve({ exitCode, passed, failed, output });
        }
      );
    });
  }
}

export class DockerRunner implements SandboxRunner {
  isAvailable(): boolean {
    return checkDockerAvailable();
  }

  async run(repoDir: string, command: string): Promise<TestRun> {
    if (!this.isAvailable()) {
      return {
        exitCode: 1,
        passed: 0,
        failed: 0,
        output: '[SANDBOX UNAVAILABLE] Docker is not available on this host',
      };
    }

    const absPath = path.resolve(repoDir).replace(/\\/g, '/');
    const dockerCmd = `docker run --rm --network none --memory 512m --cpus 1 --pids-limit 256 -v "${absPath}:/work" -w /work node:22-alpine sh -c "${command.replace(/"/g, '\\"')}"`;

    return new Promise<TestRun>((resolve) => {
      exec(
        dockerCmd,
        {
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (err, stdout, stderr) => {
          const rawOutput = (stdout || '') + (stderr ? '\n' + stderr : '');
          const output = rawOutput.length > 8192 ? rawOutput.slice(0, 8192) : rawOutput;
          const exitCode =
            err && typeof err.code === 'number'
              ? err.code
              : err
              ? 1
              : 0;
          const { passed, failed } = parseTestOutput(output, exitCode);
          resolve({ exitCode, passed, failed, output });
        }
      );
    });
  }
}

export class DisabledRunner implements SandboxRunner {
  constructor(public readonly reason: string = 'Sandbox is disabled') {}

  isAvailable(): boolean {
    return false;
  }

  async run(): Promise<TestRun> {
    return {
      exitCode: 1,
      passed: 0,
      failed: 0,
      output: `[SANDBOX UNAVAILABLE] ${this.reason}`,
    };
  }
}

export function getSandboxRunner(mode = config.SANDBOX): SandboxRunner {
  if (mode === 'off') {
    return new DisabledRunner('Sandbox execution is disabled (SANDBOX=off)');
  }
  if (mode === 'unsafe-local') {
    return new UnsafeLocalRunner();
  }
  if (mode === 'docker') {
    if (!checkDockerAvailable()) {
      return new DisabledRunner('Docker is not available on this host');
    }
    return new DockerRunner();
  }
  return new DisabledRunner(`Unknown sandbox mode: ${mode}`);
}

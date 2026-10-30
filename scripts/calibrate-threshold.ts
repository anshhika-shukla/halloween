// scripts/calibrate-threshold.ts - Calibrates MIN_EVIDENCE_SCORE threshold
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobManager } from '../apps/api/src/ingest/jobs.js';
import { retrieve } from '../apps/api/src/index/retrieve.js';
import { getWorkspaceRoot } from '../apps/api/src/ingest/sourceValidator.js';

export const IN_SCOPE_QUESTIONS = [
  'What does this project do?',
  'Why does storage use a JSON file?',
  'Is anything broken?',
  'Who wrote this and when was the last change?',
];

export const OUT_OF_SCOPE_QUESTIONS = [
  'What is the weather in Jaipur today?',
  'What is the capital of France?',
  'Who won the 2022 World Cup?',
];

export async function calibrateThreshold(
  source = './fixtures/haunted-todo',
  workspaceRoot = getWorkspaceRoot()
) {
  const job = jobManager.createJob(source, workspaceRoot);
  while (true) {
    const s = jobManager.getJob(job.jobId);
    if (!s || s.status === 'completed' || s.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log('=== Calibrating Evidence Threshold ===\n');

  console.log('In-Scope Questions:');
  const inScopeScores: number[] = [];
  for (const q of IN_SCOPE_QUESTIONS) {
    const res = await retrieve(job.repoId, q, 1, workspaceRoot);
    const score = res[0]?.score || 0;
    inScopeScores.push(score);
    console.log(`  "${q}" -> Top Score: ${score.toFixed(4)}`);
  }

  console.log('\nOut-of-Scope Questions:');
  const outOfScopeScores: number[] = [];
  for (const q of OUT_OF_SCOPE_QUESTIONS) {
    const res = await retrieve(job.repoId, q, 1, workspaceRoot);
    const score = res[0]?.score || 0;
    outOfScopeScores.push(score);
    console.log(`  "${q}" -> Top Score: ${score.toFixed(4)}`);
  }

  const lowestInScope = Math.min(...inScopeScores);
  const highestOutOfScope = Math.max(...outOfScopeScores);
  const suggested = (lowestInScope + highestOutOfScope) / 2;

  console.log('\nResults:');
  console.log(`  Lowest In-Scope Score:     ${lowestInScope.toFixed(4)}`);
  console.log(`  Highest Out-of-Scope Score: ${highestOutOfScope.toFixed(4)}`);
  console.log(`  Suggested MIN_EVIDENCE_SCORE: ${suggested.toFixed(4)}`);

  return {
    lowestInScope,
    highestOutOfScope,
    suggested,
  };
}

// Direct execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  calibrateThreshold().catch((err) => {
    console.error('Calibration failed:', err);
    process.exit(1);
  });
}

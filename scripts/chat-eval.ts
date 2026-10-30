// scripts/chat-eval.ts - Evaluates golden question set against a repository
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobManager } from '../apps/api/src/ingest/jobs.js';
import { answerQuestion } from '../apps/api/src/ghost/answer.js';
import { REFUSAL_PHRASE } from '../apps/api/src/ghost/citations.js';
import { getWorkspaceRoot } from '../apps/api/src/ingest/sourceValidator.js';

export interface EvalRow {
  num: number;
  question: string;
  passed: boolean;
  grounded: boolean;
  citations: string;
  notes: string;
}

export interface EvalResult {
  rows: EvalRow[];
  passedCount: number;
  total: number;
  score: number;
}

export const GOLDEN_QUESTIONS = [
  {
    num: 1,
    question: 'What does this project do?',
    passCondition: 'Grounded; cites README.md',
    check: (res: any) =>
      res.grounded &&
      res.citations.some((c: any) => c.label.toLowerCase().includes('readme.md')),
  },
  {
    num: 2,
    question: 'Why does storage use a JSON file?',
    passCondition: 'Grounded; cites docs/DESIGN.md or commit',
    check: (res: any) =>
      res.grounded &&
      res.citations.some(
        (c: any) =>
          c.label.includes('docs/DESIGN.md') ||
          (c.kind === 'commit' && c.label.toLowerCase().includes('json')) ||
          (c.snippet && c.snippet.toLowerCase().includes('json file'))
      ),
  },
  {
    num: 3,
    question: 'Is anything broken?',
    passCondition: 'Grounded; mentions pendingCount; cites src/todo.js or test/todo.test.js',
    check: (res: any) =>
      res.grounded &&
      (res.answer.includes('pendingCount') || res.citations.some((c: any) => c.snippet.includes('pendingCount'))),
  },
  {
    num: 4,
    question: 'Who wrote this and when was the last change?',
    passCondition: 'Grounded; names Ada Hollow and 2022-02-20; cites a commit',
    check: (res: any) =>
      res.grounded &&
      res.citations.some(
        (c: any) =>
          c.kind === 'commit' ||
          (c.snippet && c.snippet.includes('Ada Hollow'))
      ),
  },
  {
    num: 5,
    question: 'What is the weather in Jaipur today?',
    passCondition: 'Refusal phrase; no citations',
    check: (res: any) =>
      res.answer.includes(REFUSAL_PHRASE) &&
      res.citations.length === 0 &&
      res.grounded === false,
  },
];

export async function runChatEval(
  source = './fixtures/haunted-todo',
  workspaceRoot = getWorkspaceRoot()
): Promise<EvalResult> {
  // Ensure repo is summoned / ingested
  const job = jobManager.createJob(source, workspaceRoot);
  while (true) {
    const s = jobManager.getJob(job.jobId);
    if (!s || s.status === 'completed' || s.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const rows: EvalRow[] = [];
  let passedCount = 0;

  for (const q of GOLDEN_QUESTIONS) {
    const res = await answerQuestion({
      repoId: job.repoId,
      message: q.question,
      workspaceRoot,
    });

    const passed = Boolean(q.check(res));
    if (passed) passedCount++;

    const citationsStr = res.citations.map((c) => c.label).join(', ') || '(none)';

    rows.push({
      num: q.num,
      question: q.question,
      passed,
      grounded: res.grounded,
      citations: citationsStr,
      notes: passed ? 'PASS' : `FAIL: expected ${q.passCondition}`,
    });
  }

  return {
    rows,
    passedCount,
    total: GOLDEN_QUESTIONS.length,
    score: passedCount / GOLDEN_QUESTIONS.length,
  };
}

export function printEvalTable(evalResult: EvalResult) {
  console.log('| # | Question | Grounded | Citations | Result |');
  console.log('|---|---|---|---|---|');
  for (const r of evalResult.rows) {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`| ${r.num} | ${r.question} | ${r.grounded} | ${r.citations} | ${status} |`);
  }
  console.log(`\nTotal Score: ${evalResult.passedCount} / ${evalResult.total} (${(evalResult.score * 100).toFixed(1)}%)`);
}

// Direct execution
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runChatEval().then((res) => {
    printEvalTable(res);
  }).catch((err) => {
    console.error('Chat eval failed:', err);
    process.exit(1);
  });
}

// scripts/verify-retrieval.ts - Verifies end-to-end indexing and retrieval on an actual repository
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobManager } from '../apps/api/src/ingest/jobs.js';
import { retrieve } from '../apps/api/src/index/retrieve.js';
import { loadIndex } from '../apps/api/src/index/store.js';
import { config } from '../apps/api/src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function main() {
  console.log('====================================================');
  console.log('REPOREVENANT - Phase 2 Live Index & Retrieval Check');
  console.log('====================================================');

  const fixturePath = './fixtures/haunted-todo';
  console.log(`\n1. Summoning real fixture repository: ${fixturePath}`);
  const startTime = Date.now();

  const job = jobManager.createJob(fixturePath, rootDir);
  console.log(`Job created with ID: ${job.jobId}, repoId: ${job.repoId}`);

  // Listen to SSE / event progress
  jobManager.on(`progress:${job.jobId}`, (evt) => {
    console.log(`  [Stage: ${evt.stage.padEnd(7)}] status=${evt.status.padEnd(9)} progress=${String(evt.progress).padStart(3)}% : ${evt.message}`);
  });

  // Await completion
  while (true) {
    const current = jobManager.getJob(job.jobId);
    if (!current || current.status === 'completed' || current.status === 'failed') {
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const durationMs = Date.now() - startTime;
  const finalJob = jobManager.getJob(job.jobId);
  console.log(`\nJob finished in ${(durationMs / 1000).toFixed(2)}s with status: ${finalJob?.status}`);

  if (finalJob?.status !== 'completed') {
    console.error('Job failed with error:', finalJob?.error);
    process.exit(1);
  }

  // 2. Verify on-disk persistence
  const repoDataDir = path.resolve(rootDir, config.DATA_DIR, 'repos', job.repoId);
  console.log(`\n2. Verifying on-disk index at: ${repoDataDir}`);
  const loadedIndex = loadIndex(repoDataDir);

  if (!loadedIndex) {
    console.error('FAIL: Could not load index from disk');
    process.exit(1);
  }

  console.log(`  - Chunks loaded from disk: ${loadedIndex.chunks.length}`);
  console.log(`  - Vector dimension: ${loadedIndex.dims}`);
  console.log(`  - Raw vector buffer size: ${loadedIndex.vectors.byteLength} bytes (${loadedIndex.vectors.length} floats)`);

  // 3. Test queries
  const testQueries = [
    {
      query: 'why json file storage instead of sqlite',
      expectedSource: 'docs/DESIGN.md',
    },
    {
      query: 'pendingCount unfinished todos calculation',
      expectedSource: 'src/todo.js',
    },
    {
      query: 'who made the last commit before life got busy',
      expectedSource: 'commit',
    },
  ];

  console.log('\n3. Testing Semantic & Hybrid Retrieval Queries:');
  let allQueriesPassed = true;

  for (const { query, expectedSource } of testQueries) {
    console.log(`\n----------------------------------------------------`);
    console.log(`QUERY: "${query}"`);
    console.log(`----------------------------------------------------`);
    const results = await retrieve(job.repoId, query, 3, rootDir);

    if (results.length === 0) {
      console.error(`  FAIL: No evidence returned for query "${query}"`);
      allQueriesPassed = false;
      continue;
    }

    let foundExpected = false;
    for (const r of results) {
      console.log(`  [${r.eid}] Score: ${r.score.toFixed(4)} | Kind: ${r.kind}`);
      console.log(`       Title:      ${r.title}`);
      if (r.path) {
        console.log(`       Path:       ${r.path} (lines ${r.startLine}-${r.endLine})`);
      }
      if (r.sha) {
        console.log(`       Commit SHA: ${r.sha}`);
      }
      console.log(`       Snippet:    ${r.text.replace(/\r?\n/g, ' ').slice(0, 100)}...`);

      // Check if evidence preserves source references
      if (r.kind === 'file') {
        if (!r.path || typeof r.startLine !== 'number' || typeof r.endLine !== 'number') {
          console.error(`  FAIL: Evidence ${r.eid} missing file path or line numbers`);
          allQueriesPassed = false;
        }
      } else if (r.kind === 'commit') {
        if (!r.sha) {
          console.error(`  FAIL: Evidence ${r.eid} missing commit SHA`);
          allQueriesPassed = false;
        }
      }

      if (
        (expectedSource === 'commit' && r.kind === 'commit') ||
        (r.path && r.path.includes(expectedSource)) ||
        (r.title && r.title.includes(expectedSource))
      ) {
        foundExpected = true;
      }
    }

    if (foundExpected) {
      console.log(`  => PASS: Found expected source reference "${expectedSource}" in top results`);
    } else {
      console.warn(`  => WARNING: Expected "${expectedSource}" not in top 3`);
      allQueriesPassed = false;
    }
  }

  // 4. Test Out-of-scope query refusal threshold check (T2.3 from spec)
  console.log(`\n----------------------------------------------------`);
  console.log(`OUT-OF-SCOPE QUERY: "weather jaipur today"`);
  console.log(`----------------------------------------------------`);
  const outOfScopeResults = await retrieve(job.repoId, 'weather jaipur today', 3, rootDir);
  const topScore = outOfScopeResults[0]?.score || 0;
  console.log(`  Top score: ${topScore.toFixed(4)} (Threshold MIN_EVIDENCE_SCORE: ${config.MIN_EVIDENCE_SCORE})`);
  if (topScore < config.MIN_EVIDENCE_SCORE) {
    console.log(`  => PASS: Query correctly scores below MIN_EVIDENCE_SCORE for clean refusal`);
  } else {
    console.error(`  => FAIL: Out-of-scope query scored ${topScore} >= ${config.MIN_EVIDENCE_SCORE}`);
    allQueriesPassed = false;
  }

  if (allQueriesPassed) {
    console.log('\n====================================================');
    console.log('SUCCESS: All actual repository indexing & retrieval checks passed!');
    console.log('====================================================');
  } else {
    console.error('\nFAIL: Some checks did not pass');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});

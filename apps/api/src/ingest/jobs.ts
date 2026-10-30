// apps/api/src/ingest/jobs.ts - In-memory job manager, stage execution, and SSE event streaming
import path from 'node:path';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { config } from '../config.js';
import type { Repo, Chunk } from '../types.js';
import type { JobState, JobProgressEvent, JobStage } from './types.js';
import { validateSource, getWorkspaceRoot, type ValidatedSource } from './sourceValidator.js';
import { cloneRepository } from './clone.js';
import { walkRepository } from './walk.js';
import { parseGitHistory } from './gitlog.js';
import { gitHubClient, type IGitHubClient } from './github.js';
import { extractReadmeExcerpt, extractDependencies, buildRepoOverview } from './metadata.js';
import { chunkFiles, chunkCommits, chunkIssues, capChunks } from './chunk.js';
import { embedChunks } from '../index/embed.js';
import { saveIndex, loadIndex, isIndexUpToDate } from '../index/store.js';
import { AppError } from '../errors.js';

export class JobManager extends EventEmitter {
  private jobs = new Map<string, JobState>();
  private activeRepoJobs = new Map<string, string>(); // repoId -> jobId
  private github: IGitHubClient = gitHubClient;

  setGitHubClient(client: IGitHubClient) {
    this.github = client;
  }

  getJob(id: string): JobState | undefined {
    return this.jobs.get(id);
  }

  createJob(source: string, workspaceRoot = getWorkspaceRoot()): { jobId: string; repoId: string } {
    const validated = validateSource(source, workspaceRoot);

    // If an identical source or repoId already has a running job, return that job
    const existingJobId = this.activeRepoJobs.get(validated.repoId);
    if (existingJobId) {
      const existing = this.jobs.get(existingJobId);
      if (existing && (existing.status === 'queued' || existing.status === 'running')) {
        return { jobId: existingJobId, repoId: validated.repoId };
      }
    }

    const jobId = `job-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const job: JobState & { events: JobProgressEvent[] } = {
      id: jobId,
      source: validated.source,
      repoId: validated.repoId,
      status: 'queued',
      stage: 'clone',
      progress: 0,
      message: 'Summoning the repository...',
      createdAt: now,
      updatedAt: now,
      events: [],
    };

    this.jobs.set(jobId, job as any);
    this.activeRepoJobs.set(validated.repoId, jobId);

    // Process asynchronously
    setImmediate(() => {
      this.executeJob(jobId, validated, workspaceRoot).catch((err) => {
        console.error(`Job ${jobId} failed:`, err);
      });
    });

    return { jobId, repoId: validated.repoId };
  }

  private emitProgress(jobId: string, stage: JobStage, status: JobState['status'], message: string, progress: number) {
    const job = this.jobs.get(jobId) as (JobState & { events?: JobProgressEvent[] }) | undefined;
    const event: JobProgressEvent = { stage, status, message, progress };

    if (job) {
      job.stage = stage;
      job.status = status;
      job.message = message;
      job.progress = progress;
      job.updatedAt = new Date().toISOString();
      if (!job.events) job.events = [];
      job.events.push(event);
    }

    this.emit(`progress:${jobId}`, event);
  }

  private async executeJob(jobId: string, validated: ValidatedSource, workspaceRoot: string) {
    const baseDataDir = path.resolve(workspaceRoot, config.DATA_DIR);
    const repoManagedDir = path.join(baseDataDir, 'repos', validated.repoId);
    const repoCloneDir = path.join(repoManagedDir, 'repo');

    fs.mkdirSync(repoManagedDir, { recursive: true });

    try {
      // 1. STAGE: clone
      this.emitProgress(jobId, 'clone', 'running', 'Exhuming repository structure...', 15);
      await cloneRepository(validated, repoCloneDir);

      // 2. STAGE: walk
      this.emitProgress(jobId, 'walk', 'running', 'Exhuming files...', 35);
      const walkResult = walkRepository(repoCloneDir, config.MAX_FILE_BYTES);

      // 3. STAGE: history
      this.emitProgress(jobId, 'history', 'running', 'Reading the last commits...', 60);
      const gitSummary = await parseGitHistory(repoCloneDir, 500);

      // 4. STAGE: issues
      this.emitProgress(jobId, 'issues', 'running', 'Listening to the issues...', 75);
      let issues: any[] = [];
      let pullRequests: any[] = [];
      const warnings: string[] = [];

      if (validated.type === 'remote' && validated.owner && validated.repo) {
        const ghResult = await this.github.fetchIssuesAndPRs(validated.owner, validated.repo);
        issues = ghResult.issues;
        pullRequests = ghResult.pullRequests;
        warnings.push(...ghResult.warnings);
      }

      // 5. STAGE: embed (inserted in Phase 2)
      this.emitProgress(jobId, 'embed', 'running', 'Communing with the vectors...', 85);
      const headSha = gitSummary.commits[0]?.sha;
      let chunksCount = 0;
      let indexDims = 256;

      if (isIndexUpToDate(repoManagedDir, headSha)) {
        const loaded = loadIndex(repoManagedDir);
        chunksCount = loaded?.chunks.length || 0;
        indexDims = loaded?.dims || 256;
      } else {
        const fileChunks = chunkFiles(walkResult.files, repoCloneDir);
        const commitChunks = chunkCommits(gitSummary.commits);
        const issueChunks = chunkIssues(issues);
        const allChunks = [...fileChunks, ...commitChunks, ...issueChunks];
        const capped = capChunks(allChunks, config.MAX_CHUNKS);

        const { vectors, dims } = await embedChunks(capped, (proc, tot) => {
          const pct = 85 + Math.floor((proc / tot) * 10);
          this.emitProgress(jobId, 'embed', 'running', `Embedding chunks (${proc}/${tot})...`, pct);
        });

        indexDims = dims;
        saveIndex(repoManagedDir, capped, vectors, dims, headSha);
        chunksCount = capped.length;
      }

      // Metadata & Overview
      const readmeExcerpt = extractReadmeExcerpt(repoCloneDir);
      const dependencies = extractDependencies(repoCloneDir);
      const repoOverview = buildRepoOverview(
        validated,
        walkResult,
        gitSummary,
        readmeExcerpt,
        dependencies,
        warnings
      );
      repoOverview.chunksIndexed = chunksCount;

      const metaWithIndexInfo = {
        ...repoOverview,
        headSha,
        dims: indexDims,
      };

      // Persist meta.json, history.json, issues.json
      fs.writeFileSync(path.join(repoManagedDir, 'meta.json'), JSON.stringify(metaWithIndexInfo, null, 2), 'utf8');
      fs.writeFileSync(path.join(repoManagedDir, 'history.json'), JSON.stringify(gitSummary.commits, null, 2), 'utf8');
      fs.writeFileSync(path.join(repoManagedDir, 'issues.json'), JSON.stringify(issues, null, 2), 'utf8');

      // 6. STAGE: ready
      this.emitProgress(jobId, 'ready', 'completed', 'Haunting complete.', 100);
      this.activeRepoJobs.delete(validated.repoId);
    } catch (err: any) {
      const message = err.message || 'Unknown ingestion failure';
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = message;
        job.updatedAt = new Date().toISOString();
      }
      this.emitProgress(jobId, job?.stage || 'clone', 'failed', message, 0);
      this.activeRepoJobs.delete(validated.repoId);
    }
  }

  // Repository storage readers
  getRepo(repoId: string, workspaceRoot = getWorkspaceRoot()): Repo | null {
    const metaPath = path.resolve(workspaceRoot, config.DATA_DIR, 'repos', repoId, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      return null;
    }
  }

  listRepos(workspaceRoot = getWorkspaceRoot()): Repo[] {
    const reposDir = path.resolve(workspaceRoot, config.DATA_DIR, 'repos');
    if (!fs.existsSync(reposDir)) return [];
    const entries = fs.readdirSync(reposDir, { withFileTypes: true });
    const repos: Repo[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const repo = this.getRepo(entry.name, workspaceRoot);
        if (repo) repos.push(repo);
      }
    }
    return repos;
  }

  getChunk(repoId: string, chunkId: string, workspaceRoot = getWorkspaceRoot()): Chunk | null {
    const chunksPath = path.resolve(workspaceRoot, config.DATA_DIR, 'repos', repoId, 'chunks.json');
    if (!fs.existsSync(chunksPath)) return null;
    try {
      const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8')) as Chunk[];
      return chunks.find((c) => c.id === chunkId) || null;
    } catch {
      return null;
    }
  }
}

export const jobManager = new JobManager();

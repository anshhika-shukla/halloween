// apps/api/src/routes/jobs.ts - Job status and SSE progress streaming routes
import { Router } from 'express';
import { jobManager } from '../ingest/jobs.js';
import type { JobProgressEvent } from '../ingest/types.js';
import { AppError } from '../errors.js';

export const jobsRouter = Router();

jobsRouter.get('/jobs/:id', (req, res, next) => {
  try {
    const job = jobManager.getJob(req.params.id);
    if (!job) {
      throw new AppError('job_not_found', `Job ${req.params.id} was not found`, 404);
    }

    res.json({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      repoId: job.repoId,
      error: job.error,
    });
  } catch (err) {
    next(err);
  }
});

jobsRouter.get('/jobs/:id/events', (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = jobManager.getJob(jobId);
    if (!job) {
      throw new AppError('job_not_found', `Job ${jobId} was not found`, 404);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Replay all past events buffered for this job
    const bufferedEvents = (job as any).events as JobProgressEvent[] || [];
    for (const event of bufferedEvents) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (job.status === 'completed' || job.status === 'failed') {
      res.end();
      return;
    }

    const eventName = `progress:${jobId}`;
    const onProgress = (event: JobProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.status === 'completed' || event.status === 'failed') {
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      jobManager.off(eventName, onProgress);
    };

    jobManager.on(eventName, onProgress);
    req.on('close', cleanup);
  } catch (err) {
    next(err);
  }
});

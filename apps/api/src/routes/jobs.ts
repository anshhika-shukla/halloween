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

    const bufferedEvents = (job as any).events as JobProgressEvent[] || [];
    const snapshotLength = bufferedEvents.length;

    let finished = false;
    const eventName = `progress:${jobId}`;

    const cleanup = () => {
      if (!finished) {
        finished = true;
        jobManager.off(eventName, onProgress);
      }
    };

    const onProgress = (event: JobProgressEvent) => {
      if (finished) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      if (event.status === 'completed' || event.status === 'failed') {
        cleanup();
        res.end();
      }
    };

    // Attach listener first so no future progress events can be lost
    jobManager.on(eventName, onProgress);
    req.on('close', cleanup);

    // Replay earlier buffered events that occurred before attaching listener
    for (let i = 0; i < snapshotLength; i++) {
      const event = bufferedEvents[i];
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (typeof (res as any).flush === 'function') (res as any).flush();

    // If job was already finished prior to or during replay, close stream cleanly
    if (job.status === 'completed' || job.status === 'failed') {
      cleanup();
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

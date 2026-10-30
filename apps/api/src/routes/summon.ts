// apps/api/src/routes/summon.ts - Ingestion kick-off route
import { Router } from 'express';
import { jobManager } from '../ingest/jobs.js';
import { AppError } from '../errors.js';

export const summonRouter = Router();

summonRouter.post('/summon', (req, res, next) => {
  try {
    const { source } = req.body || {};
    if (!source || typeof source !== 'string') {
      throw new AppError('invalid_source', 'Source repository is required and must be a string', 400);
    }

    const { jobId } = jobManager.createJob(source);
    res.status(202).json({ jobId });
  } catch (err) {
    next(err);
  }
});

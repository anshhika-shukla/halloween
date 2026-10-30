// apps/api/src/routes/repos.ts - Ingested repositories queries
import { Router } from 'express';
import { jobManager } from '../ingest/jobs.js';
import { AppError } from '../errors.js';

export const reposRouter = Router();

reposRouter.get('/repos', (_req, res) => {
  const repos = jobManager.listRepos();
  res.json(repos);
});

reposRouter.get('/repos/:id', (req, res, next) => {
  try {
    const repo = jobManager.getRepo(req.params.id);
    if (!repo) {
      throw new AppError('repo_not_found', `Repository ${req.params.id} was not found`, 404);
    }
    res.json(repo);
  } catch (err) {
    next(err);
  }
});

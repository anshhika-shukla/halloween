// apps/api/src/routes/chat.ts - Ghost Chat API endpoint
import { Router } from 'express';
import { z } from 'zod';
import { jobManager } from '../ingest/jobs.js';
import { answerQuestion } from '../ghost/answer.js';
import { AppError } from '../errors.js';

export const chatRouter = Router();

const chatBodySchema = z.object({
  message: z.string().trim().min(1, 'Message cannot be empty'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  seance: z.boolean().optional(),
  mode: z.enum(['plain', 'seance']).optional(),
});

chatRouter.post('/repos/:id/chat', async (req, res, next) => {
  try {
    const repoId = req.params.id;
    const repo = jobManager.getRepo(repoId);
    if (!repo) {
      throw new AppError('repo_not_found', `Repository ${repoId} was not found`, 404);
    }

    const parsed = chatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMsg = parsed.error.errors.map((e) => e.message).join(', ');
      throw new AppError('invalid_request', errorMsg, 400);
    }

    const { message, history, seance, mode } = parsed.data;
    const isSeance = seance ?? (mode === 'seance');

    const chatResponse = await answerQuestion({
      repoId,
      message,
      history,
      seance: isSeance,
    });

    res.json(chatResponse);
  } catch (err) {
    next(err);
  }
});

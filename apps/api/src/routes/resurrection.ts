// apps/api/src/routes/resurrection.ts - Endpoints for findings, patch proposal, and application
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { detectFindings } from '../resurrect/detect.js';
import { getSandboxRunner } from '../resurrect/sandbox.js';
import { proposePatch, findPatchById } from '../resurrect/propose.js';
import { approvePatch, rejectPatch } from '../resurrect/apply.js';

export const resurrectionRouter = Router();

const ProposeBodySchema = z.object({
  findingId: z.string().min(1, 'findingId is required'),
});

// GET /api/repos/:id/resurrection
resurrectionRouter.get('/repos/:id/resurrection', async (req, res, next) => {
  try {
    const { id } = req.params;
    const runner = getSandboxRunner();
    const { findings } = await detectFindings(id);

    res.json({
      findings,
      sandbox: {
        mode: config.SANDBOX,
        available: runner.isAvailable(),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/repos/:id/resurrection/propose
resurrectionRouter.post('/repos/:id/resurrection/propose', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = ProposeBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        'invalid_request',
        parseResult.error.errors.map((e) => e.message).join(', '),
        400
      );
    }

    const patch = await proposePatch(id, parseResult.data.findingId);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

// POST /api/patches/:id/approve
resurrectionRouter.post('/patches/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = await approvePatch(id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

// POST /api/repos/:repoId/patches/:id/approve
resurrectionRouter.post('/repos/:repoId/patches/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = await approvePatch(id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

// POST /api/patches/:id/reject
resurrectionRouter.post('/patches/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = await rejectPatch(id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

// POST /api/repos/:repoId/patches/:id/reject
resurrectionRouter.post('/repos/:repoId/patches/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = await rejectPatch(id);
    res.json(patch);
  } catch (err) {
    next(err);
  }
});

// GET /api/patches/:id/download
resurrectionRouter.get('/patches/:id/download', (req, res, next) => {
  try {
    const { id } = req.params;
    const record = findPatchById(id);
    if (!record) {
      throw new AppError('patch_not_found', `Patch ${id} not found`, 404);
    }

    res.setHeader('Content-Type', 'text/x-diff; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fix-${record.patch.findingId}.patch"`
    );
    res.send(record.patch.diff);
  } catch (err) {
    next(err);
  }
});

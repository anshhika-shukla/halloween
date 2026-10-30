// apps/api/src/errors.ts - Standardized error handling for REPOREVENANT
import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Handle Zod or generic validation errors
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: err.errors?.[0]?.message || 'Validation error',
      },
    });
  }

  const status = typeof err.status === 'number' ? err.status : 500;
  const message = err?.message || 'Internal server error';
  const code = err?.code && typeof err.code === 'string' ? err.code : 'internal_error';

  return res.status(status).json({
    error: {
      code,
      message,
    },
  });
}

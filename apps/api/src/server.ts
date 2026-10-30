// apps/api/src/server.ts - Main Express server entrypoint
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { errorMiddleware } from './errors.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.use('/api', healthRouter);

  // Error handling middleware
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();

if (process.env.NODE_ENV !== 'test') {
  const port = config.API_PORT;
  app.listen(port, () => {
    console.log(`👻 REPOREVENANT API running on port ${port} (mode: ${config.LLM_PROVIDER}, sandbox: ${config.SANDBOX})`);
  });
}

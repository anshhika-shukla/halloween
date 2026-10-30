// apps/api/src/routes/health.ts - System and dependencies health endpoint
import { Router } from 'express';
import { execSync } from 'node:child_process';
import { config } from '../config.js';
import { ollamaProvider } from '../llm/ollama.js';

export const healthRouter = Router();

export function checkDockerAvailable(): boolean {
  try {
    execSync('docker info', {
      timeout: 1500,
      stdio: 'ignore',
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

healthRouter.get('/health', async (_req, res) => {
  let ollamaReachable = false;
  let ollamaModels: string[] = [];

  try {
    ollamaReachable = await ollamaProvider.isReachable();
    if (ollamaReachable) {
      ollamaModels = await ollamaProvider.listModels();
    }
  } catch {
    ollamaReachable = false;
    ollamaModels = [];
  }

  const dockerAvailable = checkDockerAvailable();
  const sandboxAvailable = config.SANDBOX === 'unsafe-local' ? true : dockerAvailable;

  res.status(200).json({
    status: 'ok',
    provider: config.LLM_PROVIDER,
    offlineMode: Boolean(config.OFFLINE_MODE),
    ollama: {
      reachable: ollamaReachable,
      models: ollamaModels,
    },
    sandbox: {
      mode: config.SANDBOX,
      available: sandboxAvailable,
    },
  });
});

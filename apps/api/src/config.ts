// apps/api/src/config.ts - Typed environment configuration and validation
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const portSchema = z.preprocess(
  (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && /^\d+$/.test(val)) return Number(val);
    return NaN;
  },
  z.number({ invalid_type_error: 'API_PORT must be a numeric port' })
    .int('API_PORT must be a numeric port')
    .positive('API_PORT must be a numeric port')
).default(4000);

export const configSchema = z.object({
  LLM_PROVIDER: z.enum(['ollama', 'openai-compat', 'mock'], {
    errorMap: () => ({ message: 'Invalid LLM_PROVIDER. Allowed: ollama | openai-compat | mock' }),
  }).default('ollama'),
  OLLAMA_HOST: z.string().default('http://127.0.0.1:11434'),
  OPENAI_COMPAT_BASE_URL: z.string().default('http://127.0.0.1:8080/v1'),
  CHAT_MODEL: z.string().trim().min(1, 'CHAT_MODEL cannot be empty').default('qwen2.5-coder:7b'),
  EMBED_MODEL: z.string().trim().min(1, 'EMBED_MODEL cannot be empty').default('nomic-embed-text'),
  OFFLINE_MODE: z.union([
    z.number(),
    z.string().regex(/^[01]$/).transform(Number),
  ]).default(0),
  GITHUB_TOKEN: z.string().optional(),
  DATA_DIR: z.string().default('./data'),
  PROMPTS_DIR: z.string().default('./apps/api/prompts'),
  MAX_FILE_BYTES: z.union([
    z.number().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).default(200000),
  MAX_CHUNKS: z.union([
    z.number().positive(),
    z.string().regex(/^\d+$/).transform(Number),
  ]).default(4000),
  MIN_EVIDENCE_SCORE: z.union([
    z.number(),
    z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number),
  ]).default(0.15),
  SANDBOX: z.enum(['docker', 'unsafe-local', 'off']).default('docker'),
  ALLOW_LOCAL_SOURCES: z.union([
    z.number(),
    z.string().regex(/^[01]$/).transform(Number),
  ]).default(1),
  API_PORT: portSchema,
  NEXT_PUBLIC_API_URL: z.string().default('http://127.0.0.1:4000'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): Config {
  const envToParse = { ...rawEnv };
  if (process.env.NODE_ENV === 'test' && rawEnv === process.env && !envToParse.LLM_PROVIDER) {
    envToParse.LLM_PROVIDER = 'mock';
  }
  const result = configSchema.safeParse(envToParse);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Configuration validation failed: ${errorDetails}`);
  }
  return result.data;
}

export let config: Config = loadConfig();

export function setConfig(newConfig: Config) {
  config = newConfig;
}

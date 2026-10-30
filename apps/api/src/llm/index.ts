// apps/api/src/llm/index.ts - Provider factory
import { config } from '../config.js';
import type { LLMProvider } from './provider.js';
import { mockProvider } from './mock.js';
import { ollamaProvider } from './ollama.js';

export * from './provider.js';
export * from './mock.js';
export * from './ollama.js';

export function getProvider(overrideType?: string): LLMProvider {
  const providerType = overrideType || config.LLM_PROVIDER;
  if (providerType === 'mock') {
    return mockProvider;
  }
  if (providerType === 'ollama') {
    return ollamaProvider;
  }
  return mockProvider;
}

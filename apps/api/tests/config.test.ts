// apps/api/tests/config.test.ts - Automated test for configuration loading and validation
import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('T0.3: Configuration Loading & Validation', () => {
  it('loads valid defaults', () => {
    const cfg = loadConfig({});
    expect(cfg.LLM_PROVIDER).toBe('ollama');
    expect(cfg.CHAT_MODEL).toBe('qwen2.5-coder:7b');
    expect(cfg.EMBED_MODEL).toBe('nomic-embed-text');
    expect(cfg.API_PORT).toBe(4000);
    expect(cfg.SANDBOX).toBe('docker');
  });

  it('throws when CHAT_MODEL is empty', () => {
    expect(() => {
      loadConfig({ CHAT_MODEL: '' });
    }).toThrow(/CHAT_MODEL cannot be empty/i);
  });

  it('throws when LLM_PROVIDER is invalid (nope)', () => {
    expect(() => {
      loadConfig({ LLM_PROVIDER: 'nope' });
    }).toThrow(/Invalid LLM_PROVIDER/i);
  });

  it('throws when API_PORT is non-numeric (abc)', () => {
    expect(() => {
      loadConfig({ API_PORT: 'abc' });
    }).toThrow(/API_PORT must be a numeric port/i);
  });
});

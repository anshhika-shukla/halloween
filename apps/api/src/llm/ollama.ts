// apps/api/src/llm/ollama.ts - Local Ollama HTTP API provider
import type { ChatParams, ChatResult, LLMProvider } from './provider.js';
import { config } from '../config.js';

export class OllamaProvider implements LLMProvider {
  private host: string;
  private chatModel: string;
  private embedModel: string;

  constructor(host = config.OLLAMA_HOST, chatModel = config.CHAT_MODEL, embedModel = config.EMBED_MODEL) {
    this.host = host.replace(/\/+$/, '');
    this.chatModel = chatModel;
    this.embedModel = embedModel;
  }

  setChatModel(model: string) {
    this.chatModel = model;
  }

  async isReachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.host}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embedModel,
        input: texts,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama embed error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const messages = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        options: {
          temperature: params.temperature ?? 0.2,
        },
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Ollama chat error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      message?: { content: string };
      model?: string;
    };

    return {
      text: data.message?.content || '',
      model: data.model || this.chatModel,
    };
  }
}

export const ollamaProvider = new OllamaProvider();

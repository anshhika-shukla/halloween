// apps/api/src/llm/openai.ts - OpenAI-compatible HTTP API provider (llama.cpp, vLLM, LM Studio, Ollama /v1)
import type { ChatParams, ChatResult, LLMProvider } from './provider.js';
import { config } from '../config.js';

export class OpenAICompatProvider implements LLMProvider {
  private baseUrl: string;
  private chatModel: string;
  private embedModel: string;

  constructor(
    baseUrl = config.OPENAI_COMPAT_BASE_URL,
    chatModel = config.CHAT_MODEL,
    embedModel = config.EMBED_MODEL
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.chatModel = chatModel;
    this.embedModel = embedModel;
  }

  setChatModel(model: string) {
    this.chatModel = model;
  }

  async isReachable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return (data.data || []).map((m) => m.id);
    } catch {
      return [];
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.embedModel,
        input: texts,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI-compatible embed error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const messages = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: params.signal,
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: params.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI-compatible chat error (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content: string } }>;
      model?: string;
    };

    return {
      text: data.choices?.[0]?.message?.content || '',
      model: data.model || this.chatModel,
    };
  }
}

export const openAICompatProvider = new OpenAICompatProvider();

// apps/api/src/llm/provider.ts - Unified LLM Provider Interface

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatParams {
  system: string;
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  model: string;
}

export interface LLMProvider {
  chat(params: ChatParams): Promise<ChatResult>;
  embed(texts: string[]): Promise<number[][]>;
  listModels(): Promise<string[]>;
}

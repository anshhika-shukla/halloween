// apps/web/src/types.ts - Core domain and API types for REPOREVENANT web app

export type Chunk = {
  id: string;
  kind: 'file' | 'commit' | 'issue';
  path?: string;
  startLine?: number;
  endLine?: number;
  sha?: string;
  number?: number;
  title: string;
  text: string;
};

export type Evidence = Chunk & {
  eid: string;
  score: number;
};

export type Citation = {
  eid: string;
  kind: Chunk['kind'];
  label: string;
  ref: string;
  snippet: string;
  url?: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  grounded?: boolean;
  model?: string;
  latencyMs?: number;
  flaggedSentences?: number[];
  disclaimer?: string;
};

export type ChatResponse = {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  mode: 'plain' | 'seance';
  model: string;
  latencyMs: number;
  refusal?: string;
  flaggedSentences: number[];
  disclaimer: string;
};

export type Repo = {
  id: string;
  name: string;
  source: string;
  defaultBranch: string;
  lastCommitAt: string;
  deadForDays: number;
  commitCount: number;
  languages: Record<string, number>;
  fileCount: number;
  chunksIndexed: number | null;
  readmeExcerpt: string;
  dependencies: string[];
  warnings: string[];
};

export type JobStage = 'clone' | 'walk' | 'history' | 'issues' | 'embed' | 'ready';

export type JobProgressEvent = {
  stage: JobStage;
  status: 'running' | 'completed' | 'failed';
  message: string;
  progress: number;
};

export type JobState = {
  id: string;
  source: string;
  repoId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stage: JobStage;
  progress: number;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthResponse = {
  status: 'ok';
  provider: 'ollama' | 'openai-compat' | 'mock';
  offlineMode: boolean;
  ollama: {
    reachable: boolean;
    models: string[];
  };
  sandbox: {
    mode: 'docker' | 'unsafe-local' | 'off';
    available: boolean;
  };
};

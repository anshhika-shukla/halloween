// apps/api/src/types.ts - Core domain and API types for REPOREVENANT

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
  eid: string; /* 'E1', 'E2', ... per query */
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

export type Finding = {
  id: string;
  kind: 'failing-test' | 'todo' | 'outdated-dep' | 'issue';
  title: string;
  evidence: string[];
  difficulty: 'easy' | 'medium' | 'hard';
};

export type TestRun = {
  exitCode: number;
  passed: number;
  failed: number;
  output: string;
};

export type Patch = {
  id: string;
  findingId: string;
  diff: string;
  explanation: string;
  citations: Citation[];
  attempts: number;
  verification: {
    status: 'verified' | 'unverified' | 'failed';
    before?: TestRun;
    after?: TestRun;
    reason?: string;
  };
  state: 'proposed' | 'approved' | 'rejected';
  branch?: string;
};

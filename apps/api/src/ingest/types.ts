// apps/api/src/ingest/types.ts - Ingestion job and metadata types
export type JobStage = 'clone' | 'walk' | 'history' | 'issues' | 'embed' | 'ready';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobProgressEvent {
  stage: JobStage;
  status: JobStatus;
  message: string;
  progress: number;
}

export interface JobState {
  id: string;
  source: string;
  repoId?: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  message: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedCommit {
  sha: string;
  author: string;
  email: string;
  date: string;
  subject: string;
  body: string;
  filesChanged: string[];
}

export interface IngestedIssue {
  id: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  createdAt: string;
  url?: string;
}

export interface IngestedPullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  createdAt: string;
  url?: string;
}

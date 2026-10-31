import type {
  HealthResponse,
  JobState,
  JobProgressEvent,
  Repo,
  Chunk,
  ChatResponse,
  Finding,
  Patch,
} from '../types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const data = await res.json();
      if (data && data.error) {
        errorDetail = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`API error (${res.status}): ${errorDetail}`);
  }
  return res.json() as Promise<T>;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleResponse<HealthResponse>(res);
}

export async function summonRepo(source: string): Promise<{ jobId: string; repoId: string }> {
  const res = await fetch(`${API_BASE}/api/summon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  return handleResponse<{ jobId: string; repoId: string }>(res);
}

export async function getJob(jobId: string): Promise<JobState> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}`);
  return handleResponse<JobState>(res);
}

export async function listRepos(): Promise<Repo[]> {
  const res = await fetch(`${API_BASE}/api/repos`);
  return handleResponse<Repo[]>(res);
}

export async function getRepo(repoId: string): Promise<Repo> {
  const res = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(repoId)}`);
  return handleResponse<Repo>(res);
}

export async function getChunk(repoId: string, chunkId: string): Promise<Chunk> {
  const res = await fetch(
    `${API_BASE}/api/repos/${encodeURIComponent(repoId)}/chunks/${encodeURIComponent(chunkId)}`
  );
  return handleResponse<Chunk>(res);
}

export async function sendChatMessage(
  repoId: string,
  params: {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    mode?: 'plain' | 'seance';
  }
): Promise<ChatResponse> {
  const res = await fetch(
    `${API_BASE}/api/repos/${encodeURIComponent(repoId)}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  );
  return handleResponse<ChatResponse>(res);
}

export function subscribeJobEvents(
  jobId: string,
  onEvent: (event: JobProgressEvent) => void,
  onError?: (err: Event) => void
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  const es = new EventSource(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/events`);

  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as JobProgressEvent;
      onEvent(data);
    } catch (err) {
      console.error('Failed to parse SSE event payload:', err);
    }
  };

  es.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    es.close();
  };
}

export async function getResurrection(repoId: string): Promise<{
  findings: Finding[];
  sandbox: { mode: string; available: boolean };
}> {
  const res = await fetch(`${API_BASE}/api/repos/${encodeURIComponent(repoId)}/resurrection`);
  return handleResponse<{
    findings: Finding[];
    sandbox: { mode: string; available: boolean };
  }>(res);
}

export async function proposePatch(repoId: string, findingId: string): Promise<Patch> {
  const res = await fetch(
    `${API_BASE}/api/repos/${encodeURIComponent(repoId)}/resurrection/propose`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId }),
    }
  );
  return handleResponse<Patch>(res);
}

export async function approvePatch(patchId: string): Promise<Patch> {
  const res = await fetch(`${API_BASE}/api/patches/${encodeURIComponent(patchId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<Patch>(res);
}

export async function rejectPatch(patchId: string): Promise<Patch> {
  const res = await fetch(`${API_BASE}/api/patches/${encodeURIComponent(patchId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return handleResponse<Patch>(res);
}

export function getPatchDownloadUrl(patchId: string): string {
  return `${API_BASE}/api/patches/${encodeURIComponent(patchId)}/download`;
}


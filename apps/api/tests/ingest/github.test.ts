// apps/api/tests/ingest/github.test.ts - Automated test T1.5 for GitHub client
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GitHubClient } from '../../src/ingest/github.js';

describe('T1.5: GitHub REST Client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('parses issues and separates PRs from issues', async () => {
    const mockApiResponse = [
      {
        id: 101,
        number: 1,
        title: 'Real Issue',
        body: 'Issue description',
        labels: [{ name: 'bug' }],
        created_at: '2023-01-01T00:00:00Z',
      },
      {
        id: 102,
        number: 2,
        title: 'Pull Request Item',
        body: 'PR description',
        labels: [],
        created_at: '2023-01-02T00:00:00Z',
        pull_request: { url: 'https://api.github.com/repos/o/r/pulls/2' },
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as any);

    const client = new GitHubClient(undefined);
    const result = await client.fetchIssuesAndPRs('owner', 'repo');

    expect(result.issues.length).toBe(1);
    expect(result.issues[0].title).toBe('Real Issue');
    expect(result.issues[0].labels).toEqual(['bug']);

    expect(result.pullRequests.length).toBe(1);
    expect(result.pullRequests[0].title).toBe('Pull Request Item');

    expect(result.warnings.length).toBe(0);
  });

  it('handles 403 rate limit with a warning and no crash', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'rate limit exceeded',
    } as any);

    const client = new GitHubClient(undefined);
    const result = await client.fetchIssuesAndPRs('owner', 'repo');

    expect(result.issues).toEqual([]);
    expect(result.pullRequests).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain('403');
  });

  it('sends the Authorization token header only when token is set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    } as any);
    globalThis.fetch = mockFetch;

    // 1. Without token
    const clientNoToken = new GitHubClient(undefined);
    await clientNoToken.fetchIssuesAndPRs('owner', 'repo');
    const headersNoToken = mockFetch.mock.calls[0][1].headers;
    expect(headersNoToken.Authorization).toBeUndefined();

    // 2. With token
    const clientWithToken = new GitHubClient('ghp_test_secret_token');
    await clientWithToken.fetchIssuesAndPRs('owner', 'repo');
    const headersWithToken = mockFetch.mock.calls[1][1].headers;
    expect(headersWithToken.Authorization).toBe('Bearer ghp_test_secret_token');
  });
});

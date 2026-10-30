// apps/api/src/ingest/github.ts - GitHub REST client for fetching open issues and pull requests
import { config } from '../config.js';
import type { IngestedIssue, IngestedPullRequest } from './types.js';

export interface GitHubFetchResult {
  issues: IngestedIssue[];
  pullRequests: IngestedPullRequest[];
  warnings: string[];
}

export interface IGitHubClient {
  fetchIssuesAndPRs(owner: string, repo: string): Promise<GitHubFetchResult>;
}

export class GitHubClient implements IGitHubClient {
  private token?: string;

  constructor(token = config.GITHUB_TOKEN) {
    this.token = token && token.trim().length > 0 ? token.trim() : undefined;
  }

  async fetchIssuesAndPRs(owner: string, repo: string): Promise<GitHubFetchResult> {
    const warnings: string[] = [];
    const issues: IngestedIssue[] = [];
    const pullRequests: IngestedPullRequest[] = [];

    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RepoRevenant-Agent',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(url, { headers });

      if (res.status === 403 || res.status === 429) {
        warnings.push('GitHub API rate limit reached or access forbidden (403). Ingesting without remote issues.');
        return { issues, pullRequests, warnings };
      }

      if (!res.ok) {
        warnings.push(`GitHub API error (${res.status}): Failed to fetch issues.`);
        return { issues, pullRequests, warnings };
      }

      const data = (await res.json()) as any[];
      if (!Array.isArray(data)) {
        return { issues, pullRequests, warnings };
      }

      for (const item of data) {
        const labels = Array.isArray(item.labels)
          ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.name)).filter(Boolean)
          : [];

        if (item.pull_request) {
          // Exclude PRs from the issue list per spec
          pullRequests.push({
            id: String(item.id || item.number),
            number: item.number,
            title: item.title || '',
            body: (item.body || '').slice(0, 3000),
            createdAt: item.created_at || new Date().toISOString(),
            url: item.html_url,
          });
        } else {
          issues.push({
            id: String(item.id || item.number),
            number: item.number,
            title: item.title || '',
            body: (item.body || '').slice(0, 3000),
            labels,
            createdAt: item.created_at || new Date().toISOString(),
            url: item.html_url,
          });
        }
      }
    } catch (err: any) {
      warnings.push(`Failed to connect to GitHub API: ${err.message}`);
    }

    return { issues, pullRequests, warnings };
  }
}

export const gitHubClient = new GitHubClient();

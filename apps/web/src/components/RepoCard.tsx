'use client';

import React from 'react';
import type { Repo } from '../types';

interface RepoCardProps {
  repo: Repo | null;
  isLoading?: boolean;
}

export function RepoCard({ repo, isLoading = false }: RepoCardProps) {
  if (isLoading || !repo) {
    return (
      <div
        className="glass-panel"
        style={{ padding: '1.25rem', height: '100%', minHeight: '300px' }}
      >
        <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
          Communing with repository crypt...
        </div>
      </div>
    );
  }

  // Format dead duration
  const formatDead = (days: number) => {
    if (days >= 365) {
      const years = (days / 365).toFixed(1);
      return `Dead for ${years} years`;
    }
    return `Dead for ${days} days`;
  };

  const topLanguages = Object.entries(repo.languages || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);

  return (
    <aside
      className="glass-panel"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        overflowY: 'auto',
      }}
      data-testid="repo-card"
    >
      {/* Title & Badge */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span className="badge badge-dead">
            ⚰️ {formatDead(repo.deadForDays)}
          </span>
          <span
            className="badge"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-dim)',
            }}
          >
            {repo.defaultBranch}
          </span>
        </div>

        <h2
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            wordBreak: 'break-all',
          }}
        >
          {repo.name}
        </h2>

        <p
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginTop: '0.25rem',
            wordBreak: 'break-all',
          }}
        >
          {repo.source}
        </p>
      </div>

      {/* Numerical Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-teal)' }}>
            {repo.fileCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Files
          </div>
        </div>

        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-violet)' }}>
            {repo.commitCount}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Commits
          </div>
        </div>

        <div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>
            {repo.chunksIndexed ?? '—'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Chunks
          </div>
        </div>
      </div>

      {/* Languages */}
      {topLanguages.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}
          >
            Languages
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {topLanguages.map(([lang, count]) => (
              <span
                key={lang}
                className="badge"
                style={{
                  background: 'rgba(94, 234, 212, 0.08)',
                  color: 'var(--text-ghost)',
                  border: '1px solid rgba(94, 234, 212, 0.2)',
                  fontSize: '0.75rem',
                }}
              >
                {lang} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last Commit Date */}
      <div>
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.25rem',
          }}
        >
          Last Sign of Life
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {new Date(repo.lastCommitAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>

      {/* Readme Excerpt */}
      {repo.readmeExcerpt && (
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.4rem',
            }}
          >
            README Fragment
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '0.65rem',
              borderRadius: 'var(--radius-sm)',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          >
            {repo.readmeExcerpt}
          </div>
        </div>
      )}

      {/* Warnings if any */}
      {repo.warnings && repo.warnings.length > 0 && (
        <div
          style={{
            padding: '0.6rem 0.75rem',
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
            color: 'var(--accent-amber)',
          }}
        >
          {repo.warnings.map((w, idx) => (
            <div key={idx}>⚠ {w}</div>
          ))}
        </div>
      )}
    </aside>
  );
}

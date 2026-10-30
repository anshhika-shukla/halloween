'use client';

import React, { useState } from 'react';

export function validateSource(value: string): { valid: boolean; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: 'Repository source cannot be empty.' };
  }

  // Sample or fixture path
  if (
    trimmed === 'fixtures/haunted-todo' ||
    trimmed === 'haunted-todo' ||
    trimmed.startsWith('./fixtures/') ||
    trimmed.startsWith('fixtures/')
  ) {
    return { valid: true };
  }

  // Reject non-HTTPS
  if (trimmed.startsWith('http://')) {
    return {
      valid: false,
      error: 'Insecure source rejected. Remote repository URLs must use HTTPS (e.g., https://github.com/owner/repo).',
    };
  }

  // Reject ssh or git protocols without https
  if (trimmed.startsWith('git@') || trimmed.startsWith('ssh://')) {
    return {
      valid: false,
      error: 'SSH cloning is not supported. Please provide an HTTPS URL.',
    };
  }

  // GitHub / git repository URL validation
  if (trimmed.includes('github.com')) {
    const githubRegex = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?\/?$/;
    if (!githubRegex.test(trimmed)) {
      return {
        valid: false,
        error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
      };
    }
    return { valid: true };
  }

  // Generic https url check
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') {
      return { valid: false, error: 'Repository source must use HTTPS.' };
    }
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: 'Please enter a valid HTTPS repository URL (e.g., https://github.com/owner/repo) or choose a sample repository.',
    };
  }
}

interface SummonFormProps {
  onSubmit: (source: string) => void;
  isLoading?: boolean;
}

export function SummonForm({ onSubmit, isLoading = false }: SummonFormProps) {
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateSource(source);
    if (!result.valid) {
      setError(result.error || 'Invalid repository source');
      return;
    }
    setError(null);
    onSubmit(source.trim());
  };

  const handleSampleClick = () => {
    const sample = 'fixtures/haunted-todo';
    setSource(sample);
    setError(null);
    onSubmit(sample);
  };

  return (
    <div className="glass-panel" style={{ padding: '2rem', maxWidth: '640px', width: '100%', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="repo-source-input"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'var(--text-ghost)',
              letterSpacing: '0.02em',
            }}
          >
            ENTER GITHUB REPOSITORY URL OR SAMPLE
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="repo-source-input"
              type="url"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://github.com/owner/abandoned-repo"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                fontSize: '0.95rem',
                background: 'rgba(7, 9, 12, 0.95)',
                border: error ? '1px solid var(--accent-red)' : '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                boxShadow: error ? '0 0 10px rgba(248, 113, 113, 0.25)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
              aria-invalid={!!error}
              aria-describedby={error ? 'repo-source-error' : undefined}
            />
          </div>

          {error && (
            <div
              id="repo-source-error"
              role="alert"
              style={{
                marginTop: '0.5rem',
                color: 'var(--accent-red)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span>⚠</span> {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            className="btn-neon"
            disabled={isLoading}
            id="summon-button"
            style={{ flex: '1 1 200px' }}
          >
            {isLoading ? (
              <>
                <span className="animate-ghost">👻</span>
                <span>Summoning...</span>
              </>
            ) : (
              <>
                <span>✦</span>
                <span>Summon the Ghost</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary"
            disabled={isLoading}
            onClick={handleSampleClick}
            id="sample-repo-button"
            style={{ flex: '0 0 auto' }}
          >
            <span>⚰️ Try sample (haunted-todo)</span>
          </button>
        </div>
      </form>
    </div>
  );
}

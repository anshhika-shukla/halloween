'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { GhostLogo } from './GhostLogo';
import { getHealth } from '../lib/api';
import type { HealthResponse } from '../types';

export function StatusBar() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getHealth()
      .then((data) => {
        if (mounted) setHealth(data);
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'Health check failed');
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(7, 9, 12, 0.85)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <Link
        href="/"
        prefetch={false}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          textDecoration: 'none',
          color: 'var(--text-main)',
        }}
      >
        <GhostLogo size="sm" />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: '1.05rem',
            background: 'linear-gradient(90deg, #5eead4, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          REPOREVENANT
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
        {error ? (
          <span className="badge" style={{ background: 'rgba(248, 113, 113, 0.15)', color: 'var(--accent-red)' }}>
            ● API OFFLINE
          </span>
        ) : health ? (
          <>
            <span
              className="badge"
              style={{
                background: health.offlineMode ? 'rgba(94, 234, 212, 0.12)' : 'rgba(167, 139, 250, 0.15)',
                color: health.offlineMode ? 'var(--accent-teal)' : 'var(--accent-violet)',
              }}
              title={health.offlineMode ? 'Running 100% offline' : 'Cloud or network connected'}
            >
              ● {health.offlineMode ? 'OFFLINE SECURE' : 'ONLINE'}
            </span>

            <span
              className="badge"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              MODEL: {health.provider.toUpperCase()}
            </span>

            <span
              className="badge"
              style={{
                background:
                  health.sandbox.mode === 'docker'
                    ? 'rgba(94, 234, 212, 0.12)'
                    : health.sandbox.mode === 'unsafe-local'
                    ? 'rgba(251, 191, 36, 0.15)'
                    : 'rgba(255, 255, 255, 0.05)',
                color:
                  health.sandbox.mode === 'docker'
                    ? 'var(--accent-teal)'
                    : health.sandbox.mode === 'unsafe-local'
                    ? 'var(--accent-amber)'
                    : 'var(--text-dim)',
              }}
              title={`Sandbox: ${health.sandbox.mode}`}
            >
              BOX: {health.sandbox.mode.toUpperCase()}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>Connecting to crypt...</span>
        )}
      </div>
    </header>
  );
}

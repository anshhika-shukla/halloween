'use client';

import React, { useEffect, useState } from 'react';
import type { Citation, Chunk } from '../types';
import { getChunk } from '../lib/api';

interface EvidenceDrawerProps {
  citation: Citation | null;
  repoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceDrawer({
  citation,
  repoId,
  isOpen,
  onClose,
}: EvidenceDrawerProps) {
  const [chunk, setChunk] = useState<Chunk | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !citation) {
      setChunk(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // citation.ref is typically the chunk ID or path
    const chunkIdToFetch = citation.ref;

    getChunk(repoId, chunkIdToFetch)
      .then((data) => {
        setChunk(data);
        setIsLoading(false);
      })
      .catch((err) => {
        // Fallback: use citation data itself
        console.warn('Could not fetch full chunk, using citation preview:', err);
        setError('Full chunk details unavailable; showing verified citation snippet.');
        setIsLoading(false);
      });
  }, [isOpen, citation, repoId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
      data-testid="evidence-drawer"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-glow)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--accent-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.25rem',
              }}
            >
              CITED REPOSITORY EVIDENCE [{citation.kind.toUpperCase()}]
            </div>
            <h3
              style={{
                fontSize: '1.1rem',
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
              }}
            >
              {citation.label}
            </h3>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            aria-label="Close evidence drawer"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
          >
            ✕
          </button>
        </div>

        {/* Metadata info */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.4rem', color: 'var(--text-muted)' }}>
            <div>Reference:</div>
            <div style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{citation.ref}</div>

            {chunk?.path && (
              <>
                <div>File Path:</div>
                <div style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{chunk.path}</div>
              </>
            )}

            {chunk?.startLine !== undefined && (
              <>
                <div>Lines:</div>
                <div style={{ color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>
                  L{chunk.startLine} - L{chunk.endLine}
                </div>
              </>
            )}

            {chunk?.sha && (
              <>
                <div>Commit SHA:</div>
                <div style={{ color: 'var(--accent-violet)', fontFamily: 'var(--font-mono)' }}>
                  {chunk.sha.substring(0, 8)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Evidence Snippet / Code */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}
          >
            Verified Snippet
          </div>

          {isLoading ? (
            <div style={{ color: 'var(--accent-teal)', fontStyle: 'italic', padding: '2rem 0' }}>
              ✦ Communing with chunk index...
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                background: '#040608',
                border: '1px solid rgba(94, 234, 212, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '1rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                lineHeight: 1.6,
                color: '#e2e8f0',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {chunk?.text || citation.snippet || 'No snippet text recorded.'}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.8rem',
                color: 'var(--accent-amber)',
              }}
            >
              ⓘ {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

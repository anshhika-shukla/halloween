'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StatusBar } from '../../../components/StatusBar';
import { RepoCard } from '../../../components/RepoCard';
import { GhostChat } from '../../../components/GhostChat';
import { ResurrectionPanel } from '../../../components/ResurrectionPanel';
import { EvidenceDrawer } from '../../../components/EvidenceDrawer';
import { getRepo } from '../../../lib/api';
import type { Repo, Citation } from '../../../types';

export default function GhostHauntPage() {
  const params = useParams();
  const repoId = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';

  const [repo, setRepo] = useState<Repo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);

  useEffect(() => {
    if (!repoId) return;

    setIsLoading(true);
    getRepo(repoId)
      .then((data) => {
        setRepo(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load repo:', err);
        setError(err.message || 'Failed to commune with repo crypt.');
        setIsLoading(false);
      });
  }, [repoId]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />

      <main style={{ flex: 1, position: 'relative' }}>
        {error ? (
          <div
            style={{
              padding: '3rem 1.5rem',
              maxWidth: '600px',
              margin: '0 auto',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚰️</div>
            <h2 style={{ color: 'var(--accent-red)', marginBottom: '0.5rem' }}>
              Crypt Unreachable
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {error}
            </p>
            <a href="/" className="btn-secondary">
              ← Return to Summoning Chamber
            </a>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* Left Column: Repository Metadata */}
            <RepoCard repo={repo} isLoading={isLoading} />

            {/* Center Column: Ghost Chat & Citations */}
            <GhostChat
              repoId={repoId}
              onCitationClick={(citation) => setSelectedCitation(citation)}
            />

            {/* Right Column: Resurrection Mode */}
            <ResurrectionPanel
              repoId={repoId}
              onCitationClick={(citation) => setSelectedCitation(citation)}
            />
          </div>
        )}

        {/* Evidence Drawer Overlay */}
        <EvidenceDrawer
          citation={selectedCitation}
          repoId={repoId}
          isOpen={!!selectedCitation}
          onClose={() => setSelectedCitation(null)}
        />
      </main>
    </div>
  );
}

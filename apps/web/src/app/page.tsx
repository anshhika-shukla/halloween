'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StatusBar } from '../components/StatusBar';
import { GhostLogo } from '../components/GhostLogo';
import { SummonForm } from '../components/SummonForm';
import { ScanProgress } from '../components/ScanProgress';
import { summonRepo, listRepos } from '../lib/api';
import type { Repo } from '../types';

export default function HomePage() {
  const router = useRouter();
  const [activeJob, setActiveJob] = useState<{ jobId: string; repoId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [summonError, setSummonError] = useState<string | null>(null);

  // Load existing repos
  useEffect(() => {
    listRepos()
      .then((data) => setRepos(data))
      .catch((err) => console.warn('Could not list repos:', err));
  }, []);

  const handleSummon = async (source: string) => {
    setIsSubmitting(true);
    setSummonError(null);

    try {
      const res = await summonRepo(source);
      setActiveJob(res);
    } catch (err: any) {
      console.error('Summon failed:', err);
      setSummonError(err.message || 'Failed to initiate summon ritual.');
      setIsSubmitting(false);
    }
  };

  const handleScanComplete = (repoId: string) => {
    router.push(`/ghost/${encodeURIComponent(repoId)}`);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />

      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* If a scan is currently active, show the ScanProgress experience */}
        {activeJob ? (
          <div style={{ padding: '2rem 0' }}>
            <ScanProgress
              jobId={activeJob.jobId}
              repoId={activeJob.repoId}
              onComplete={handleScanComplete}
              onCancel={() => {
                setActiveJob(null);
                setIsSubmitting(false);
              }}
            />
          </div>
        ) : (
          /* Landing page / Summon Experience */
          <div>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', padding: '3rem 0 2.5rem' }}>
              <div style={{ display: 'inline-block', marginBottom: '1.5rem' }}>
                <GhostLogo size="xl" />
              </div>

              <h1
                style={{
                  fontSize: 'clamp(2rem, 5vw, 3.25rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  marginBottom: '1rem',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #5eead4 50%, #a78bfa 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Every abandoned codebase has a story.
                <br />
                Let&apos;s bring its ghost back to life.
              </h1>

              <p
                style={{
                  maxWidth: '680px',
                  margin: '0 auto 2rem',
                  fontSize: '1.1rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                REPOREVENANT studies git commits, documentation, source code, and unresolved issues using local open-weight AI. Interrogate the codebase through an evidence-bound conversational interface—running 100% offline on your machine.
              </p>

              {/* Summon Form */}
              <SummonForm onSubmit={handleSummon} isLoading={isSubmitting} />

              {summonError && (
                <div
                  role="alert"
                  style={{
                    maxWidth: '640px',
                    margin: '1rem auto 0',
                    padding: '0.75rem 1rem',
                    background: 'rgba(248, 113, 113, 0.12)',
                    border: '1px solid var(--accent-red)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--accent-red)',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                  }}
                >
                  ⚠ Summoning error: {summonError}
                </div>
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
                margin: '3rem 0',
              }}
            >
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📜</div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-teal)', marginBottom: '0.35rem' }}>
                  Evidence-Bound Dialogue
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Every claim the Ghost makes cites specific file paths, line ranges, or commit SHAs. Ungrounded claims are flagged and dimmed.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🔒</div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-violet)', marginBottom: '0.35rem' }}>
                  100% Offline & Private
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  All indexing, embeddings, and chat inference run entirely locally via open-weight models. No code ever leaves your laptop.
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⚡</div>
                <h3 style={{ fontSize: '1.1rem', color: '#38bdf8', marginBottom: '0.35rem' }}>
                  Resurrection Ready
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Beyond conversation, REPOREVENANT locates broken tests, authors minimal surgical patches, and verifies fixes inside sandboxes.
                </p>
              </div>
            </div>

            {/* Existing Indexed Repositories */}
            {repos.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h2
                  style={{
                    fontSize: '1rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '1rem',
                  }}
                >
                  Indexed Graveyard Repositories
                </h2>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  {repos.map((r) => (
                    <Link
                      key={r.id}
                      href={`/ghost/${encodeURIComponent(r.id)}`}
                      className="glass-panel"
                      style={{
                        padding: '1.25rem',
                        textDecoration: 'none',
                        color: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span className="badge badge-dead">
                            Dead {r.deadForDays > 365 ? `${(r.deadForDays / 365).toFixed(1)}y` : `${r.deadForDays}d`}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>
                            {r.chunksIndexed ?? 0} chunks
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                          {r.name}
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {r.source}
                        </p>
                      </div>

                      <div
                        style={{
                          marginTop: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          color: 'var(--accent-teal)',
                        }}
                      >
                        <span>Enter Seance</span>
                        <span>→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

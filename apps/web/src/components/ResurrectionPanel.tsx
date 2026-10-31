'use client';

import React, { useEffect, useState } from 'react';
import {
  getResurrection,
  proposePatch,
  approvePatch,
  rejectPatch,
  getPatchDownloadUrl,
} from '../lib/api';
import { CitationChip } from './CitationChip';
import type { Finding, Patch, Citation } from '../types';

interface ResurrectionPanelProps {
  repoId: string;
  onCitationClick?: (citation: Citation) => void;
}

export function ResurrectionPanel({ repoId, onCitationClick }: ResurrectionPanelProps) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [sandbox, setSandbox] = useState<{ mode: string; available: boolean }>({
    mode: 'docker',
    available: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activePatch, setActivePatch] = useState<Patch | null>(null);
  const [resurrectingFindingId, setResurrectingFindingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!repoId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getResurrection(repoId)
      .then((data) => {
        if (!isMounted) return;
        setFindings(data.findings || []);
        setSandbox(data.sandbox || { mode: 'docker', available: false });
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load resurrection data:', err);
        setError(err.message || 'Failed to inspect crypt diagnostics.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [repoId]);

  const handlePropose = async (finding: Finding) => {
    setActionError(null);
    setResurrectingFindingId(finding.id);

    try {
      const patch = await proposePatch(repoId, finding.id);
      setActivePatch(patch);
    } catch (err: any) {
      console.error('Failed to propose patch:', err);
      setActionError(err.message || 'Failed to manifest resurrection patch.');
    } finally {
      setResurrectingFindingId(null);
    }
  };

  const handleApprove = async () => {
    if (!activePatch) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const updated = await approvePatch(activePatch.id);
      setActivePatch(updated);
    } catch (err: any) {
      console.error('Failed to approve patch:', err);
      setActionError(err.message || 'Failed to apply patch.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!activePatch) return;
    setIsActionLoading(true);
    setActionError(null);

    try {
      const updated = await rejectPatch(activePatch.id);
      setActivePatch(updated);
    } catch (err: any) {
      console.error('Failed to reject patch:', err);
      setActionError(err.message || 'Failed to discard patch.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderDiffLine = (line: string, idx: number) => {
    let bg = 'transparent';
    let color = 'var(--text-dim)';
    let prefix = ' ';

    if (line.startsWith('+++') || line.startsWith('---')) {
      color = 'var(--accent-teal)';
      bg = 'rgba(94, 234, 212, 0.08)';
    } else if (line.startsWith('@@')) {
      color = 'var(--accent-purple)';
      bg = 'rgba(167, 139, 250, 0.08)';
    } else if (line.startsWith('+')) {
      color = '#4ade80';
      bg = 'rgba(74, 222, 128, 0.12)';
      prefix = '+';
    } else if (line.startsWith('-')) {
      color = '#f87171';
      bg = 'rgba(248, 113, 113, 0.12)';
      prefix = '-';
    }

    return (
      <div
        key={idx}
        style={{
          display: 'flex',
          backgroundColor: bg,
          color,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: '1.4',
          padding: '0 0.5rem',
          whiteSpace: 'pre',
          borderLeft: line.startsWith('+')
            ? '2px solid #4ade80'
            : line.startsWith('-')
            ? '2px solid #f87171'
            : '2px solid transparent',
        }}
      >
        <span style={{ width: '1.2rem', userSelect: 'none', opacity: 0.6 }}>{prefix}</span>
        <span style={{ flex: 1, overflowX: 'auto' }}>
          {line.startsWith('+') || line.startsWith('-') ? line.slice(1) : line}
        </span>
      </div>
    );
  };

  return (
    <aside
      className="glass-panel resurrection-sidebar"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        overflowY: 'auto',
      }}
      data-testid="resurrection-panel"
      aria-label="Resurrection Chamber"
    >
      {/* Header & Sandbox Mode Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span
            className="badge"
            style={{
              background: 'rgba(94, 234, 212, 0.15)',
              color: 'var(--accent-teal)',
              marginBottom: '0.5rem',
              border: '1px solid rgba(94, 234, 212, 0.3)',
            }}
          >
            PHASE 5: RESURRECTION
          </span>
          <h3
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '0.25rem',
            }}
          >
            Resurrection Chamber
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Provable repairs for abandoned software.
          </p>
        </div>

        {/* Sandbox Badge */}
        <span
          className="badge"
          data-testid="sandbox-badge"
          style={{
            fontSize: '0.7rem',
            background: sandbox.available
              ? 'rgba(74, 222, 128, 0.15)'
              : 'rgba(248, 113, 113, 0.15)',
            color: sandbox.available ? '#4ade80' : '#f87171',
            border: `1px solid ${sandbox.available ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
          }}
          title={sandbox.available ? 'Sandbox operational' : 'Sandbox offline/disabled'}
        >
          SANDBOX: {sandbox.mode.toUpperCase()}
        </span>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            background: 'rgba(248, 113, 113, 0.15)',
            border: '1px solid rgba(248, 113, 113, 0.4)',
            color: '#f87171',
            padding: '0.6rem 0.8rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.78rem',
          }}
        >
          {actionError}
        </div>
      )}

      {/* Main View: Either Active Patch or Findings List */}
      {activePatch ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Back button to findings */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setActivePatch(null)}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              ← Back to Findings
            </button>

            {/* Verification Status Badge */}
            <span
              className="badge"
              data-testid="patch-verification-badge"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                background:
                  activePatch.verification.status === 'verified'
                    ? 'rgba(74, 222, 128, 0.15)'
                    : activePatch.verification.status === 'unverified'
                    ? 'rgba(251, 191, 36, 0.15)'
                    : 'rgba(248, 113, 113, 0.15)',
                color:
                  activePatch.verification.status === 'verified'
                    ? '#4ade80'
                    : activePatch.verification.status === 'unverified'
                    ? '#fbbf24'
                    : '#f87171',
                border: `1px solid ${
                  activePatch.verification.status === 'verified'
                    ? 'rgba(74, 222, 128, 0.4)'
                    : activePatch.verification.status === 'unverified'
                    ? 'rgba(251, 191, 36, 0.4)'
                    : 'rgba(248, 113, 113, 0.4)'
                }`,
              }}
            >
              {activePatch.verification.status === 'verified' && '✓ VERIFIED'}
              {activePatch.verification.status === 'unverified' && '⚡ UNVERIFIED'}
              {activePatch.verification.status === 'failed' && '✖ FAILED'}
            </span>
          </div>

          {/* Test Strip (Before / After) */}
          {activePatch.verification.after && (
            <div
              data-testid="test-run-strip"
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.75rem',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-dim)', marginRight: '0.3rem' }}>Before:</span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>
                  {activePatch.verification.before?.failed || 1} failed
                </span>
                <span style={{ color: 'var(--text-dim)', margin: '0 0.3rem' }}>•</span>
                <span style={{ color: '#4ade80' }}>
                  {activePatch.verification.before?.passed || 0} passed
                </span>
              </div>
              <div style={{ color: 'var(--accent-teal)' }}>➔</div>
              <div>
                <span style={{ color: 'var(--text-dim)', marginRight: '0.3rem' }}>After:</span>
                <span
                  style={{
                    color: activePatch.verification.after.failed > 0 ? '#f87171' : '#4ade80',
                    fontWeight: 600,
                  }}
                >
                  {activePatch.verification.after.failed} failed
                </span>
                <span style={{ color: 'var(--text-dim)', margin: '0 0.3rem' }}>•</span>
                <span style={{ color: '#4ade80' }}>
                  {activePatch.verification.after.passed} passed
                </span>
              </div>
            </div>
          )}

          {/* Explanation with Citations */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(94, 234, 212, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--accent-teal)',
                marginBottom: '0.4rem',
              }}
            >
              Ghost Explanation
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {activePatch.explanation}
            </p>

            {/* Citation Chips */}
            {activePatch.citations && activePatch.citations.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.35rem',
                  marginTop: '0.6rem',
                }}
              >
                {activePatch.citations.map((c) => (
                  <CitationChip
                    key={c.eid}
                    citation={c}
                    onOpen={(cit) => onCitationClick && onCitationClick(cit)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Diff Viewer */}
          <div
            style={{
              background: 'rgba(5, 7, 10, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.4rem 0.6rem',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Unified Diff (git apply format)</span>
              <span>{activePatch.attempts} attempt(s)</span>
            </div>

            <div
              data-testid="diff-viewer"
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '0.4rem 0',
              }}
            >
              {activePatch.diff.split('\n').map((line, idx) => renderDiffLine(line, idx))}
            </div>
          </div>

          {/* Action State: Proposed, Approved, Rejected */}
          {activePatch.state === 'proposed' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApprove}
                disabled={isActionLoading}
                data-testid="approve-patch-btn"
                style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
              >
                {isActionLoading ? 'Committing...' : '✓ Approve Patch'}
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={handleReject}
                disabled={isActionLoading}
                data-testid="reject-patch-btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.8rem',
                  color: '#f87171',
                  borderColor: 'rgba(248, 113, 113, 0.3)',
                }}
              >
                Discard
              </button>

              <a
                href={getPatchDownloadUrl(activePatch.id)}
                download={`fix-${activePatch.findingId}.patch`}
                className="btn-secondary"
                data-testid="download-patch-btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.5rem 0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
                title="Download raw patch file"
              >
                ⬇ .patch
              </a>
            </div>
          )}

          {activePatch.state === 'approved' && (
            <div
              style={{
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontSize: '0.78rem',
                color: '#4ade80',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                ✓ Patch Approved & Committed!
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                Branch: <code>{activePatch.branch || `reporevenant/fix-${activePatch.findingId}`}</code>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <a
                  href={getPatchDownloadUrl(activePatch.id)}
                  download={`fix-${activePatch.findingId}.patch`}
                  className="btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem', textDecoration: 'none' }}
                >
                  ⬇ Download Patch
                </a>
              </div>
            </div>
          )}

          {activePatch.state === 'rejected' && (
            <div
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem',
                fontSize: '0.78rem',
                color: '#f87171',
                textAlign: 'center',
              }}
            >
              Patch was discarded.
            </div>
          )}
        </div>
      ) : (
        /* Findings List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Exhumed Findings ({findings.length})</span>
          </div>

          {isLoading ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              <div className="ghostly-pulse" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                🔮
              </div>
              <div style={{ fontSize: '0.8rem' }}>Exhuming failing tests & TODOs...</div>
            </div>
          ) : error ? (
            <div
              role="alert"
              style={{
                padding: '1rem',
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#f87171',
                fontSize: '0.8rem',
              }}
            >
              {error}
            </div>
          ) : findings.length === 0 ? (
            <div
              style={{
                padding: '1.5rem 1rem',
                textAlign: 'center',
                color: 'var(--text-dim)',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
            >
              🕊️ No failing tests or unresolved TODOs found. The repository rests in peace.
            </div>
          ) : (
            findings.map((f) => {
              const isResurrecting = resurrectingFindingId === f.id;
              const isFailingTest = f.kind === 'failing-test';

              return (
                <div
                  key={f.id}
                  data-testid={`finding-card-${f.id}`}
                  style={{
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: isFailingTest
                      ? '1px solid rgba(248, 113, 113, 0.35)'
                      : '1px solid rgba(251, 191, 36, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: isFailingTest
                          ? 'rgba(248, 113, 113, 0.2)'
                          : 'rgba(251, 191, 36, 0.2)',
                        color: isFailingTest ? '#f87171' : '#fbbf24',
                      }}
                    >
                      {f.kind.toUpperCase()}
                    </span>

                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--text-dim)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {f.difficulty}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      lineHeight: 1.3,
                    }}
                  >
                    {f.title}
                  </div>

                  {f.evidence && f.evidence.length > 0 && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-dim)',
                        fontFamily: 'monospace',
                        background: 'rgba(0, 0, 0, 0.4)',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '3px',
                        overflowX: 'auto',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.evidence[0]}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handlePropose(f)}
                    disabled={isResurrecting || !!resurrectingFindingId}
                    data-testid={`resurrect-btn-${f.id}`}
                    style={{
                      marginTop: '0.2rem',
                      fontSize: '0.75rem',
                      padding: '0.4rem 0.6rem',
                      width: '100%',
                    }}
                  >
                    {isResurrecting ? '⚡ Resurrecting (Attempt 1/3)...' : '⚡ Attempt Resurrection'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Safety Guarantee Footer */}
      <div
        style={{
          marginTop: 'auto',
          fontSize: '0.72rem',
          color: 'var(--text-dim)',
          lineHeight: 1.4,
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <strong>Safety Guarantee:</strong> All proposed patches undergo strict path/file guards and
        zero-egress sandbox execution before human review.
      </div>
    </aside>
  );
}

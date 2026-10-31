'use client';

import React, { useEffect, useState, useRef } from 'react';
import type { JobProgressEvent, JobStage, JobState } from '../types';
import { getJob, subscribeJobEvents } from '../lib/api';

const STAGE_CONFIG: Record<
  JobStage,
  { label: string; spookyDesc: string; order: number }
> = {
  clone: {
    label: 'CLONE',
    spookyDesc: 'Exhuming repository from the digital ether...',
    order: 1,
  },
  walk: {
    label: 'WALK',
    spookyDesc: 'Walking the desolate file tree, cataloging remnants...',
    order: 2,
  },
  history: {
    label: 'COMMITS',
    spookyDesc: 'Communing with ancient git commits from departed authors...',
    order: 3,
  },
  issues: {
    label: 'ISSUES',
    spookyDesc: 'Summoning unresolved grievances and spectral issues...',
    order: 4,
  },
  embed: {
    label: 'EMBED',
    spookyDesc: 'Distilling neural vector embeddings into semantic memory...',
    order: 5,
  },
  ready: {
    label: 'READY',
    spookyDesc: 'The Ghost is fully manifest. Entering the seance chamber...',
    order: 6,
  },
};

const STAGES: JobStage[] = ['clone', 'walk', 'history', 'issues', 'embed', 'ready'];

interface ScanProgressProps {
  jobId: string;
  repoId: string;
  onComplete: (repoId: string) => void;
  onCancel?: () => void;
}

export function ScanProgress({
  jobId,
  repoId,
  onComplete,
  onCancel,
}: ScanProgressProps) {
  const [currentStage, setCurrentStage] = useState<JobStage>('clone');
  const [progress, setProgress] = useState<number>(5);
  const [currentMessage, setCurrentMessage] = useState<string>(
    STAGE_CONFIG.clone.spookyDesc
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const currentRepoIdRef = useRef<string>(repoId || '');

  useEffect(() => {
    if (repoId) {
      currentRepoIdRef.current = repoId;
    }
  }, [repoId]);

  // Auto-scroll terminal log
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    let completed = false;

    // First fetch initial job state
    getJob(jobId)
      .then((state: JobState) => {
        if (state.repoId) {
          currentRepoIdRef.current = state.repoId;
        }
        if (state.stage) {
          setCurrentStage(state.stage);
          setProgress(Math.max(state.progress || 0, 5));
          if (state.message) setCurrentMessage(state.message);
        }
        if (state.status === 'completed' || state.stage === 'ready') {
          completed = true;
          setIsCompleted(true);
          setProgress(100);
          const finalId = state.repoId || currentRepoIdRef.current || repoId;
          setTimeout(() => onComplete(finalId), 600);
        } else if (state.status === 'failed') {
          setError(state.error || 'Ingestion failed');
        }
      })
      .catch((err) => {
        console.warn('Initial job query warning:', err);
      });

    // Subscribe to SSE
    const unsubscribe = subscribeJobEvents(
      jobId,
      (ev: JobProgressEvent) => {
        if (completed) return;

        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, `[${timestamp}] [${ev.stage.toUpperCase()}] ${ev.message}`]);

        if (ev.stage) {
          setCurrentStage(ev.stage);
          if (STAGE_CONFIG[ev.stage]) {
            setCurrentMessage(ev.message || STAGE_CONFIG[ev.stage].spookyDesc);
          }
        }

        if (typeof ev.progress === 'number') {
          setProgress(Math.max(ev.progress, 5));
        }

        if (ev.status === 'failed') {
          setError(ev.message || 'Job failed');
        }

        if (ev.stage === 'ready' || (ev.stage === 'embed' && ev.status === 'completed')) {
          completed = true;
          setIsCompleted(true);
          setProgress(100);
          const targetId = currentRepoIdRef.current || repoId;
          if (targetId) {
            setTimeout(() => onComplete(targetId), 800);
          } else {
            getJob(jobId)
              .then((st) => {
                const finalId = st.repoId || currentRepoIdRef.current || repoId;
                setTimeout(() => onComplete(finalId), 800);
              })
              .catch(() => {
                setTimeout(() => onComplete(targetId), 800);
              });
          }
        }
      },
      () => {
        // SSE error / disconnect fallback: poll once or display
      }
    );

    // Fallback polling interval in case SSE disconnects
    const pollInterval = setInterval(() => {
      if (completed) return;
      getJob(jobId)
        .then((state) => {
          if (state.repoId) {
            currentRepoIdRef.current = state.repoId;
          }
          if (state.status === 'completed' || state.stage === 'ready') {
            completed = true;
            setIsCompleted(true);
            setProgress(100);
            const finalId = state.repoId || currentRepoIdRef.current || repoId;
            setTimeout(() => onComplete(finalId), 600);
          } else if (state.status === 'failed') {
            setError(state.error || 'Job failed');
          }
        })
        .catch(() => {});
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [jobId, repoId, onComplete]);

  const currentOrder = STAGE_CONFIG[currentStage]?.order || 1;

  return (
    <div
      className="glass-panel"
      style={{
        maxWidth: '720px',
        width: '100%',
        margin: '0 auto',
        padding: '2rem',
      }}
      data-testid="scan-progress"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            SCANNING & EXHUMING REPOSITORY
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Target: <code style={{ color: 'var(--accent-teal)' }}>{repoId}</code>
          </p>
        </div>
        <span
          className="badge"
          style={{
            background: isCompleted ? 'rgba(94, 234, 212, 0.15)' : 'rgba(167, 139, 250, 0.15)',
            color: isCompleted ? 'var(--accent-teal)' : 'var(--accent-violet)',
          }}
        >
          {isCompleted ? 'HAUNTING READY' : `${progress}% INGESTED`}
        </span>
      </div>

      {/* Stage indicators */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {STAGES.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const isPassed = cfg.order < currentOrder || isCompleted;
          const isCurrent = cfg.order === currentOrder && !isCompleted;

          return (
            <div
              key={stage}
              style={{
                textAlign: 'center',
                padding: '0.5rem 0.25rem',
                borderRadius: 'var(--radius-sm)',
                background: isCurrent
                  ? 'rgba(94, 234, 212, 0.15)'
                  : isPassed
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.3)',
                border: isCurrent
                  ? '1px solid var(--accent-teal)'
                  : isPassed
                  ? '1px solid rgba(94, 234, 212, 0.3)'
                  : '1px solid rgba(255, 255, 255, 0.05)',
                color: isCurrent
                  ? 'var(--accent-teal)'
                  : isPassed
                  ? 'var(--text-ghost)'
                  : 'var(--text-dim)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: isCurrent ? 700 : 500,
                boxShadow: isCurrent ? '0 0 10px rgba(94, 234, 212, 0.2)' : 'none',
              }}
            >
              {isPassed ? '✓ ' : isCurrent ? '● ' : '○ '}
              {cfg.label}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '10px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          marginBottom: '1.25rem',
          border: '1px solid rgba(94, 234, 212, 0.2)',
        }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #0f766e, #5eead4)',
            boxShadow: '0 0 14px var(--accent-teal-glow)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Current spooky status narrative */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--accent-teal)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-ghost)',
          fontStyle: 'italic',
        }}
      >
        <span className="animate-ghost">👻</span>
        <span>{currentMessage}</span>
      </div>

      {/* Terminal log stream */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-dim)',
            marginBottom: '0.35rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Spectral Telemetry Stream
        </div>
        <div
          ref={terminalRef}
          style={{
            background: '#040608',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            height: '160px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            color: '#94a3b8',
            lineHeight: 1.6,
          }}
          data-testid="scan-terminal"
        >
          {logs.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>Initiating ingestion ritual...</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ wordBreak: 'break-all' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(248, 113, 113, 0.1)',
            border: '1px solid var(--accent-red)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--accent-red)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          ⚠ Exhumation Error: {error}
        </div>
      )}

      {/* Footer controls */}
      {onCancel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            Cancel Ingestion
          </button>
        </div>
      )}
    </div>
  );
}

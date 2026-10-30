'use client';

import React from 'react';

interface ResurrectionPanelProps {
  repoId: string;
}

export function ResurrectionPanel({ repoId }: ResurrectionPanelProps) {
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
    >
      <div>
        <span
          className="badge"
          style={{
            background: 'rgba(94, 234, 212, 0.1)',
            color: 'var(--accent-teal)',
            marginBottom: '0.5rem',
          }}
        >
          PHASE 5 PREVIEW
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
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          The Ghost can inspect repository diagnostics, extract unresolved issues or TODOs, formulate patches, and prove them in an isolated sandbox.
        </p>
      </div>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px dashed rgba(94, 234, 212, 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧪</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-ghost)', marginBottom: '0.25rem' }}>
          Diagnostic Sandbox
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
          Target: <code>{repoId}</code>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled
          style={{ width: '100%', fontSize: '0.8rem', opacity: 0.6 }}
        >
          <span>⚡ Run Resurrection Diagnostics</span>
        </button>
      </div>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', lineHeight: 1.5 }}>
        <strong>Offline Guarantee:</strong> All code execution and patch evaluation runs inside local containers with zero network egress.
      </div>
    </aside>
  );
}

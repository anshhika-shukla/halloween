// apps/web/tests/resurrection.test.tsx - T5.9: ResurrectionPanel UI tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ResurrectionPanel } from '../src/components/ResurrectionPanel';
import * as api from '../src/lib/api';
import type { Finding, Patch } from '../src/types';

describe('Phase 5: ResurrectionPanel UI (T5.9)', () => {
  const mockFindings: Finding[] = [
    {
      id: 'f-101',
      kind: 'failing-test',
      title: 'pendingCount ignores finished items',
      evidence: ['not ok 3 - pendingCount ignores finished items'],
      difficulty: 'easy',
    },
    {
      id: 'f-102',
      kind: 'todo',
      title: 'TODO: dedupe ids when two lists are merged',
      evidence: ['src/storage.js:12: // TODO: dedupe ids'],
      difficulty: 'easy',
    },
  ];

  const mockPatch: Patch = {
    id: 'patch-abc',
    findingId: 'f-101',
    diff: `diff --git a/src/todo.js b/src/todo.js
--- a/src/todo.js
+++ b/src/todo.js
@@ -12,2 +12,2 @@
-  return list.filter((t) => (t.done = false)).length;
+  return list.filter((t) => (t.done === false)).length;
`,
    explanation: 'Fixed the assignment operator in the filter predicate. [E1]',
    citations: [
      {
        eid: 'E1',
        kind: 'file',
        label: '[src/todo.js:12]',
        ref: 'file:src/todo.js:12',
        snippet: 'return list.filter((t) => (t.done === false)).length;',
      },
    ],
    attempts: 1,
    verification: {
      status: 'verified',
      before: { exitCode: 1, passed: 2, failed: 1, output: '1 failed' },
      after: { exitCode: 0, passed: 3, failed: 0, output: '3 passed' },
    },
    state: 'proposed',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getResurrection').mockResolvedValue({
      findings: mockFindings,
      sandbox: { mode: 'docker', available: true },
    });
  });

  it('renders exhumed findings and sandbox status badge', async () => {
    render(<ResurrectionPanel repoId="test-repo" />);

    await waitFor(() => {
      expect(screen.getByText('pendingCount ignores finished items')).toBeInTheDocument();
      expect(screen.getByText('TODO: dedupe ids when two lists are merged')).toBeInTheDocument();
    });

    expect(screen.getByTestId('sandbox-badge')).toHaveTextContent(/SANDBOX: DOCKER/i);
    expect(screen.getByTestId('resurrect-btn-f-101')).toBeInTheDocument();
  });

  it('proposes patch on click, rendering diff viewer, test strip, explanation, and badges', async () => {
    vi.spyOn(api, 'proposePatch').mockResolvedValue(mockPatch);
    const onCitationClick = vi.fn();

    render(<ResurrectionPanel repoId="test-repo" onCitationClick={onCitationClick} />);

    await waitFor(() => {
      expect(screen.getByTestId('resurrect-btn-f-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('resurrect-btn-f-101'));

    await waitFor(() => {
      expect(screen.getByTestId('patch-verification-badge')).toHaveTextContent(/✓ VERIFIED/i);
    });

    // Check before/after test strip
    expect(screen.getByTestId('test-run-strip')).toHaveTextContent(/1 failed/i);
    expect(screen.getByTestId('test-run-strip')).toHaveTextContent(/0 failed/i);

    // Check diff viewer
    expect(screen.getByTestId('diff-viewer')).toHaveTextContent(/filter\(\(t\) => \(t\.done === false\)\)/);

    // Check explanation and citation
    expect(screen.getByText(/Fixed the assignment operator/i)).toBeInTheDocument();
    expect(screen.getByTestId('citation-chip-E1')).toBeInTheDocument();

    // Citation click
    fireEvent.click(screen.getByTestId('citation-chip-E1'));
    expect(onCitationClick).toHaveBeenCalledWith(mockPatch.citations[0]);

    // Check action buttons
    expect(screen.getByTestId('approve-patch-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reject-patch-btn')).toBeInTheDocument();
    expect(screen.getByTestId('download-patch-btn')).toBeInTheDocument();
  });

  it('approves patch and displays committed branch information', async () => {
    vi.spyOn(api, 'proposePatch').mockResolvedValue(mockPatch);
    vi.spyOn(api, 'approvePatch').mockResolvedValue({
      ...mockPatch,
      state: 'approved',
      branch: 'reporevenant/fix-f-101',
    });

    render(<ResurrectionPanel repoId="test-repo" />);

    await waitFor(() => {
      expect(screen.getByTestId('resurrect-btn-f-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('resurrect-btn-f-101'));

    await waitFor(() => {
      expect(screen.getByTestId('approve-patch-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('approve-patch-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Patch Approved & Committed!/i)).toBeInTheDocument();
      expect(screen.getByText(/reporevenant\/fix-f-101/)).toBeInTheDocument();
    });
  });

  it('rejects patch and displays discarded status', async () => {
    vi.spyOn(api, 'proposePatch').mockResolvedValue(mockPatch);
    vi.spyOn(api, 'rejectPatch').mockResolvedValue({
      ...mockPatch,
      state: 'rejected',
    });

    render(<ResurrectionPanel repoId="test-repo" />);

    await waitFor(() => {
      expect(screen.getByTestId('resurrect-btn-f-101')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('resurrect-btn-f-101'));

    await waitFor(() => {
      expect(screen.getByTestId('reject-patch-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reject-patch-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Patch was discarded/i)).toBeInTheDocument();
    });
  });
});

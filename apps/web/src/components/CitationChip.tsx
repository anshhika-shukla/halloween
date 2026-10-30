'use client';

import React from 'react';
import type { Citation } from '../types';

interface CitationChipProps {
  citation: Citation;
  onOpen?: (citation: Citation) => void;
}

export function CitationChip({ citation, onOpen }: CitationChipProps) {
  const getIcon = () => {
    switch (citation.kind) {
      case 'file':
        return '📄';
      case 'commit':
        return '📜';
      case 'issue':
        return '📌';
      default:
        return '🔍';
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onOpen) {
      onOpen(citation);
    }
  };

  return (
    <button
      type="button"
      className="citation-chip"
      onClick={handleClick}
      title={citation.snippet ? `${citation.ref}\n"${citation.snippet}"` : citation.ref}
      aria-label={`View evidence for citation ${citation.label}`}
      data-testid={`citation-chip-${citation.eid}`}
    >
      <span aria-hidden="true" style={{ fontSize: '0.85em' }}>
        {getIcon()}
      </span>
      <span>{citation.label}</span>
    </button>
  );
}

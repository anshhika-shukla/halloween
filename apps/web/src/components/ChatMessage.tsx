'use client';

import React from 'react';
import type { ChatMessage as ChatMessageType, Citation } from '../types';
import { CitationChip } from './CitationChip';
import { GhostLogo } from './GhostLogo';

interface ChatMessageProps {
  message: ChatMessageType;
  onCitationClick?: (citation: Citation) => void;
}

// Simple markdown renderer for bold, code blocks, inline code, and lists
function formatMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const content = part.slice(3, -3).replace(/^[a-z]+\n/, '');
      return (
        <pre key={i} style={{ margin: '0.75rem 0' }}>
          <code>{content}</code>
        </pre>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Render content with flagged ungrounded sentences highlighted/dimmed
function renderSentences(
  content: string,
  flaggedIndices: number[] = []
): React.ReactNode {
  // If no sentences are flagged, format normally
  if (!flaggedIndices || flaggedIndices.length === 0) {
    return formatMarkdown(content);
  }

  // Split content by sentence boundaries preserving delimiters
  const sentenceRegex = /([^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$)/g;
  const rawSentences = content.match(sentenceRegex) || [content];

  return rawSentences.map((sentence, idx) => {
    const isFlagged = flaggedIndices.includes(idx);
    const formatted = formatMarkdown(sentence);

    if (isFlagged) {
      return (
        <span
          key={idx}
          className="ungrounded-sentence"
          title="⚠️ Unverified claim: this statement is not supported by indexed repository evidence"
          data-testid="ungrounded-sentence"
        >
          {formatted}
        </span>
      );
    }
    return <span key={idx}>{formatted}</span>;
  });
}

export function ChatMessage({ message, onCitationClick }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '1.25rem',
        }}
        data-testid="chat-message-user"
      >
        <div
          style={{
            maxWidth: '80%',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 'var(--radius-md) var(--radius-md) 2px var(--radius-md)',
            padding: '0.85rem 1.15rem',
            color: 'var(--text-main)',
            fontSize: '0.95rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant / Ghost message
  const hasCitations = message.citations && message.citations.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.75rem',
        alignItems: 'flex-start',
      }}
      data-testid="chat-message-ghost"
    >
      <div style={{ flexShrink: 0, marginTop: '0.2rem' }}>
        <GhostLogo size="sm" />
      </div>

      <div
        className="glass-panel"
        style={{
          flex: 1,
          padding: '1.25rem',
          borderRadius: '2px var(--radius-md) var(--radius-md) var(--radius-md)',
        }}
      >
        {/* Header badges */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.85rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            paddingBottom: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.85rem',
                color: 'var(--accent-teal)',
              }}
            >
              THE GHOST
            </span>

            {message.grounded !== undefined && (
              <span
                className={`badge ${message.grounded ? 'badge-grounded' : 'badge-unverified'}`}
                data-testid="grounded-badge"
              >
                {message.grounded
                  ? '✦ Grounded in repository evidence'
                  : '⚠ No record found in repo'}
              </span>
            )}
          </div>

          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
            }}
          >
            {message.model && (
              <span
                style={{
                  color: message.model.toLowerCase().includes('mock') ? 'var(--accent-amber)' : 'inherit',
                }}
              >
                {message.model.toLowerCase().includes('mock') ? '⚠️ MOCK (SIMULATED)' : message.model}
              </span>
            )}
            {typeof message.latencyMs === 'number' && (
              <span> · {message.latencyMs}ms</span>
            )}
          </div>
        </div>

        {/* Answer Content */}
        <div
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.65,
            color: 'var(--text-ghost)',
            wordBreak: 'break-word',
          }}
          data-testid="ghost-answer-content"
        >
          {renderSentences(message.content, message.flaggedSentences)}
        </div>

        {/* Citations Section */}
        {hasCitations && (
          <div
            style={{
              marginTop: '1.25rem',
              paddingTop: '0.85rem',
              borderTop: '1px solid rgba(94, 234, 212, 0.15)',
            }}
            data-testid="citations-section"
          >
            <div
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-teal)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem',
              }}
            >
              Cited Evidence ({message.citations!.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {message.citations!.map((cit) => (
                <CitationChip
                  key={cit.eid}
                  citation={cit}
                  onOpen={onCitationClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer footer */}
        <div
          style={{
            marginTop: '0.85rem',
            fontSize: '0.72rem',
            color: 'var(--text-dim)',
            fontStyle: 'italic',
          }}
        >
          {message.disclaimer || 'Ghost may hallucinate. Verify against cited evidence.'}
        </div>
      </div>
    </div>
  );
}

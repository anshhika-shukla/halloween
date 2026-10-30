'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, Citation } from '../types';
import { sendChatMessage } from '../lib/api';
import { ChatMessage } from './ChatMessage';

const STARTER_PROMPTS = [
  'Why was this repository abandoned?',
  'Where is the main entry point and how does it start?',
  'Explain the core architecture and data flow.',
  'Are there any failing tests, open TODOs or known bugs?',
];

interface GhostChatProps {
  repoId: string;
  onCitationClick: (citation: Citation) => void;
}

export function GhostChat({ repoId, onCitationClick }: GhostChatProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mode, setMode] = useState<'plain' | 'seance'>('plain');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setError(null);
    setInput('');

    // Append user message
    const userMsg: ChatMessageType = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Build conversation history for API
      const history = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage(repoId, {
        message: text,
        history,
        mode,
      });

      const assistantMsg: ChatMessageType = {
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        grounded: res.grounded,
        model: res.model,
        latencyMs: res.latencyMs,
        flaggedSentences: res.flaggedSentences,
        disclaimer: res.disclaimer,
      };

      setMessages([...newMessages, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'The connection to the Ghost was severed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
      data-testid="ghost-chat-container"
    >
      {/* Chat header toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(7, 9, 12, 0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🕯️</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '0.85rem',
              letterSpacing: '0.04em',
            }}
          >
            SEANCE DIALOGUE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Seance mode toggle */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMode(mode === 'plain' ? 'seance' : 'plain')}
            style={{
              fontSize: '0.75rem',
              padding: '0.3rem 0.6rem',
              color: mode === 'seance' ? 'var(--accent-violet)' : 'var(--text-muted)',
              border: mode === 'seance' ? '1px solid var(--accent-violet)' : '1px solid rgba(255, 255, 255, 0.1)',
              background: mode === 'seance' ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            }}
            title="Toggle between technical maintainer tone and spooky gothic seance tone"
          >
            {mode === 'seance' ? '🔮 SEANCE MODE ACTIVE' : '⚙️ PLAIN MODE'}
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMessages([])}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
              title="Clear conversation history"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          padding: '1.25rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        data-testid="chat-messages-scroll"
      >
        {messages.length === 0 ? (
          /* Empty state */
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '2rem 1rem',
            }}
            data-testid="chat-empty-state"
          >
            <div
              className="animate-ghost"
              style={{ fontSize: '3rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 16px var(--accent-teal-glow))' }}
            >
              👻
            </div>
            <h3
              style={{
                fontSize: '1.2rem',
                color: 'var(--text-main)',
                marginBottom: '0.5rem',
                fontWeight: 600,
              }}
            >
              The Ghost Awakens
            </h3>
            <p
              style={{
                maxWidth: '460px',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                marginBottom: '1.5rem',
              }}
            >
              Every claim made by this ghost is evidence-bound and cited directly from indexed files, git commits, or repository issues.
            </p>

            <div style={{ width: '100%', maxWidth: '520px' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                }}
              >
                Inquire into the repository:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                {STARTER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleSend(prompt)}
                    style={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      fontSize: '0.85rem',
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span>✦</span> {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage
              key={i}
              message={msg}
              onCitationClick={onCitationClick}
            />
          ))
        )}

        {/* Loading typing indicator */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              color: 'var(--accent-teal)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
            }}
            data-testid="chat-loading-indicator"
          >
            <span className="animate-ghost">👻</span>
            <span>The Ghost is communing with indexed evidence...</span>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(248, 113, 113, 0.12)',
              border: '1px solid var(--accent-red)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-red)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            ⚠ Seance Error: {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(7, 9, 12, 0.85)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the Ghost anything about this repository..."
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              minHeight: '44px',
              maxHeight: '120px',
              padding: '0.65rem 0.85rem',
              fontSize: '0.95rem',
              background: '#040608',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-main)',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.4,
            }}
            aria-label="Repository question"
          />

          <button
            type="submit"
            className="btn-neon"
            disabled={isLoading || !input.trim()}
            style={{ height: '44px', padding: '0 1.25rem' }}
            id="chat-send-button"
          >
            <span>Ask</span>
            <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
}

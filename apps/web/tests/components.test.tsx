import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SummonForm, validateSource } from '../src/components/SummonForm';
import { CitationChip } from '../src/components/CitationChip';
import { ChatMessage } from '../src/components/ChatMessage';
import type { Citation, ChatMessage as ChatMessageType } from '../src/types';

describe('Phase 4: UI Components (T4.1)', () => {
  describe('SummonForm & validateSource', () => {
    it('validates URLs correctly', () => {
      // Rejects empty
      expect(validateSource('').valid).toBe(false);
      expect(validateSource('   ').valid).toBe(false);

      // Rejects non-HTTPS
      const httpResult = validateSource('http://github.com/torvalds/linux');
      expect(httpResult.valid).toBe(false);
      expect(httpResult.error).toMatch(/HTTPS/i);

      // Rejects malformed
      const malformedResult = validateSource('not-a-valid-url');
      expect(malformedResult.valid).toBe(false);

      // Accepts valid HTTPS GitHub repo
      const validGithub = validateSource('https://github.com/octocat/Hello-World');
      expect(validGithub.valid).toBe(true);

      // Accepts sample fixture path
      const sample = validateSource('fixtures/haunted-todo');
      expect(sample.valid).toBe(true);
    });

    it('rejects invalid input on submit and displays error message', () => {
      const handleSubmit = vi.fn();
      render(<SummonForm onSubmit={handleSubmit} />);

      const input = screen.getByLabelText(/enter github repository url/i);
      const submitButton = screen.getByRole('button', { name: /summon the ghost/i });

      // Enter insecure http url
      fireEvent.change(input, { target: { value: 'http://github.com/bad/repo' } });
      fireEvent.click(submitButton);

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/HTTPS/i)).toBeInTheDocument();
    });

    it('accepts valid GitHub URL and calls onSubmit', () => {
      const handleSubmit = vi.fn();
      render(<SummonForm onSubmit={handleSubmit} />);

      const input = screen.getByLabelText(/enter github repository url/i);
      const submitButton = screen.getByRole('button', { name: /summon the ghost/i });

      fireEvent.change(input, { target: { value: 'https://github.com/facebook/react' } });
      fireEvent.click(submitButton);

      expect(handleSubmit).toHaveBeenCalledWith('https://github.com/facebook/react');
    });

    it('triggers sample repo summon when quick action is clicked', () => {
      const handleSubmit = vi.fn();
      render(<SummonForm onSubmit={handleSubmit} />);

      const sampleButton = screen.getByRole('button', { name: /try sample/i });
      fireEvent.click(sampleButton);

      expect(handleSubmit).toHaveBeenCalledWith('fixtures/haunted-todo');
    });
  });

  describe('CitationChip', () => {
    const mockCitation: Citation = {
      eid: 'c1',
      kind: 'file',
      label: '[src/index.js:10-25]',
      ref: 'file:src/index.js:1',
      snippet: 'const server = express();',
    };

    it('renders citation label and triggers onOpen when clicked', () => {
      const handleOpen = vi.fn();
      render(<CitationChip citation={mockCitation} onOpen={handleOpen} />);

      const chip = screen.getByRole('button', { name: /view evidence for citation/i });
      expect(chip).toHaveTextContent('[src/index.js:10-25]');

      fireEvent.click(chip);
      expect(handleOpen).toHaveBeenCalledWith(mockCitation);
    });
  });

  describe('ChatMessage', () => {
    it('renders user message', () => {
      const userMessage: ChatMessageType = {
        role: 'user',
        content: 'Why was this repository abandoned?',
      };
      render(<ChatMessage message={userMessage} />);

      expect(screen.getByText('Why was this repository abandoned?')).toBeInTheDocument();
    });

    it('renders ghost response with grounded badge and citations', () => {
      const mockCitations: Citation[] = [
        {
          eid: 'cit-1',
          kind: 'file',
          label: '[README.md:1-15]',
          ref: 'file:README.md:1',
          snippet: '# Haunted Todo\nAn abandoned app.',
        },
      ];

      const ghostMessage: ChatMessageType = {
        role: 'assistant',
        content: 'The repository is an unfinished todo list application.',
        citations: mockCitations,
        grounded: true,
        model: 'qwen2.5-coder',
        latencyMs: 120,
      };

      const handleCitationClick = vi.fn();
      render(<ChatMessage message={ghostMessage} onCitationClick={handleCitationClick} />);

      expect(screen.getByTestId('grounded-badge')).toHaveTextContent(/Grounded in repository evidence/i);
      expect(screen.getByText(/120ms/)).toBeInTheDocument();
      expect(screen.getByText('[README.md:1-15]')).toBeInTheDocument();

      // Click citation
      fireEvent.click(screen.getByText('[README.md:1-15]'));
      expect(handleCitationClick).toHaveBeenCalledWith(mockCitations[0]);
    });

    it('renders ungrounded badge when grounded is false', () => {
      const ungroundedMessage: ChatMessageType = {
        role: 'assistant',
        content: 'I have searched the repository archives and found no record of that component.',
        citations: [],
        grounded: false,
      };

      render(<ChatMessage message={ungroundedMessage} />);

      expect(screen.getByTestId('grounded-badge')).toHaveTextContent(/No record found in repo/i);
    });

    it('visually styles flagged ungrounded sentences', () => {
      const flaggedMessage: ChatMessageType = {
        role: 'assistant',
        content: 'This sentence is verified. But this sentence is completely ungrounded.',
        flaggedSentences: [1], // second sentence flagged
        grounded: true,
      };

      render(<ChatMessage message={flaggedMessage} />);

      const ungroundedSpan = screen.getByTestId('ungrounded-sentence');
      expect(ungroundedSpan).toHaveTextContent('But this sentence is completely ungrounded.');
      expect(ungroundedSpan).toHaveClass('ungrounded-sentence');
      expect(ungroundedSpan).toHaveAttribute('title', expect.stringContaining('Unverified claim'));
    });
  });
});

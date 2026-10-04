import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, toast, writeText } = vi.hoisted(() => ({
  state: {
    canvas: {
      questions: [{ id: 'q1', text: 'Travel', color: '#444444' }],
      transcripts: [{ id: 't1', title: 'Interview', content: 'My commute is easier now.', caseId: 'c1' }],
      cases: [
        { id: 'c1', name: 'Participant one' },
        { id: 'c2', name: 'Participant two' },
      ],
      codings: [] as {
        id: string;
        transcriptId: string;
        questionId: string;
        codedText: string;
        startOffset: number;
        endOffset: number;
        createdAt: string;
      }[],
    },
    deleteCoding: vi.fn().mockResolvedValue(undefined),
    setSelectedQuestionId: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
  useActiveCanvas: () => state.canvas,
}));
vi.mock('react-hot-toast', () => ({ default: toast }));

import ExcerptBrowserModal from './ExcerptBrowserModal';

describe('excerpt browser first-run and recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.canvas.codings = [];
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  });

  const addCoding = () => {
    state.canvas.codings = [
      {
        id: 'coding-1',
        transcriptId: 't1',
        questionId: 'q1',
        codedText: 'commute',
        startOffset: 3,
        endOffset: 10,
        createdAt: '2026-10-01T00:00:00Z',
      },
    ];
  };

  it('explains the purpose, offers import and a real lesson without creating data', () => {
    const onClose = vi.fn();
    const listener = vi.fn();
    window.addEventListener('qualcanvas:open-transcript-picker', listener);
    try {
      render(<ExcerptBrowserModal onClose={onClose} />);
      expect(screen.getByText(/Keep meaningful passages together/)).toBeVisible();
      expect(screen.getByRole('link', { name: /See a coded-passage example/ })).toHaveAttribute(
        'href',
        '/help/first-code.html',
      );
      expect(screen.getByRole('button', { name: 'Copy All' })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(state.deleteCoding).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('qualcanvas:open-transcript-picker', listener);
    }
  });

  it('uses labelled controls and clears a case-only filter without losing saved excerpts', () => {
    addCoding();
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by case' }), { target: { value: 'c2' } });
    expect(screen.getByText('No excerpts match your filters.')).toBeVisible();
    expect(screen.queryByText('No coded excerpts yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('combobox', { name: 'Filter by case' })).toHaveValue('all');
    expect(screen.getByRole('textbox', { name: 'Search excerpts' })).toHaveFocus();
    expect(screen.getByText('commute')).toBeVisible();
    expect(state.deleteCoding).not.toHaveBeenCalled();
  });

  it('clears search, source and code restrictions together', () => {
    addCoding();
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search excerpts' }), { target: { value: 'missing' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by code' }), { target: { value: 'q1' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by source' }), { target: { value: 't1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('textbox', { name: 'Search excerpts' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Filter by code' })).toHaveValue('all');
    expect(screen.getByRole('combobox', { name: 'Filter by source' })).toHaveValue('all');
    expect(screen.getByText('commute')).toBeVisible();
  });

  it('teaches keyword search and trims accidental surrounding spaces', () => {
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'KWIC' }));
    expect(screen.getByText(/See a word in its original sentence/)).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Keyword in context' }), { target: { value: ' commute ' } });
    expect(screen.getByRole('table', { name: 'Keyword occurrences' })).toBeVisible();
    expect(screen.getByText('commute')).toBeVisible();
    expect(screen.getByRole('button', { name: 'KWIC' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers a focused keyword retry rather than a dead end', () => {
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'KWIC' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Keyword in context' }), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try another word' }));
    expect(screen.getByRole('textbox', { name: 'Keyword in context' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Keyword in context' })).toHaveFocus();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('does not report Copy All success when the clipboard rejects it', async () => {
    addCoding();
    writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy All' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not copy. Select the passage and copy it using your browser.'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('copies the current results after successful clipboard completion', async () => {
    addCoding();
    render(<ExcerptBrowserModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy All' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied'));
    expect(writeText).toHaveBeenCalledWith('[Travel] "commute" — Interview');
    expect(state.deleteCoding).not.toHaveBeenCalled();
  });
});

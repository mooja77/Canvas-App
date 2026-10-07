import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    cases: [] as { id: string; name: string; attributes: Record<string, string> }[],
    questions: [] as { id: string; text: string; color: string }[],
    transcripts: [] as { id: string; title: string; caseId?: string | null }[],
    codings: [] as { id: string; transcriptId: string; questionId: string; codedText: string }[],
  },
}));
vi.mock('../../../stores/canvasStore', () => ({ useActiveCanvas: () => state }));
import CrossCaseAnalysisModal from './CrossCaseAnalysisModal';

describe('cross-case first-use and honest recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cases = [];
    state.questions = [];
    state.transcripts = [];
    state.codings = [];
  });

  const populate = () => {
    state.cases = [{ id: 'case-a', name: 'Participant A', attributes: { role: 'Manager' } }];
    state.questions = [
      { id: 'code-a', text: 'Confidence', color: '#ffffff' },
      { id: 'code-b', text: 'Unused code', color: '#ffffff' },
    ];
    state.transcripts = [{ id: 'source-a', title: 'Fictional interview', caseId: 'case-a' }];
    state.codings = [{ id: 'coding-a', transcriptId: 'source-a', questionId: 'code-a', codedText: 'Clear guidance' }];
  };

  it('teaches the purpose and opens the real case manager after closing this dialog', () => {
    const close = vi.fn();
    const listener = vi.fn((event: Event) => {
      expect(close).toHaveBeenCalledTimes(1);
      expect((event as CustomEvent).detail).toEqual({ modal: 'case-manager' });
    });
    window.addEventListener('qualcanvas:open-canvas-modal', listener);
    try {
      render(<CrossCaseAnalysisModal onClose={close} />);
      expect(screen.getByText(/Compare what different groups said/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'See a worked case example' })).toHaveAttribute(
        'href',
        '/training#video-14',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Set up cases and assign transcripts' }));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('qualcanvas:open-canvas-modal', listener);
    }
  });

  it('labels the actual filters and focuses the group selector without changing saved data', () => {
    populate();
    render(<CrossCaseAnalysisModal onClose={vi.fn()} />);
    const group = screen.getByRole('combobox', { name: 'Group by attribute' });
    expect(screen.getByRole('combobox', { name: 'Filter by attribute' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by code' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a group' }));
    expect(group).toHaveFocus();
    expect(state.codings).toHaveLength(1);
  });

  it('distinguishes a filter miss from missing saved research and resets only filters', () => {
    populate();
    render(<CrossCaseAnalysisModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Group by attribute' }), { target: { value: 'role' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excerpts' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by code' }), { target: { value: 'code-b' } });
    expect(screen.getByText(/Your saved passages have not been removed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('"Clear guidance"')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Group by attribute' })).toHaveValue('role');
    expect(state.codings).toHaveLength(1);
  });

  it('explains unassigned sources rather than calling them matched results', () => {
    populate();
    state.transcripts[0].caseId = null;
    render(<CrossCaseAnalysisModal onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Group by attribute' }), { target: { value: 'role' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excerpts' }));
    expect(screen.getByText(/Your coded transcripts are not assigned to cases/)).toBeInTheDocument();
    expect(screen.queryByText('1 coding matched')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up cases and assign transcripts' })).toBeInTheDocument();
  });

  it('offers the actual transcript picker when there are no sources', () => {
    populate();
    state.transcripts = [];
    state.codings = [];
    const close = vi.fn();
    const picker = vi.fn(() => expect(close).toHaveBeenCalledTimes(1));
    window.addEventListener('qualcanvas:open-transcript-picker', picker);
    try {
      render(<CrossCaseAnalysisModal onClose={close} />);
      fireEvent.change(screen.getByRole('combobox', { name: 'Group by attribute' }), { target: { value: 'role' } });
      fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
      expect(picker).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('qualcanvas:open-transcript-picker', picker);
    }
  });
});

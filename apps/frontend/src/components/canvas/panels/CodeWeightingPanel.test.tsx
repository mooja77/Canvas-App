import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { state, save } = vi.hoisted(() => ({
  state: {
    transcripts: [] as { id: string; title: string; content: string }[],
    questions: [] as { id: string; text: string; color: string }[],
    codings: [] as { id: string; questionId: string; transcriptId: string; codedText: string }[],
  },
  save: vi.fn(),
}));
vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => ({ id: 'fictional-canvas', name: 'Fictional research' }),
  useActiveCanvasId: () => 'fictional-canvas',
  useCanvasQuestions: () => state.questions,
  useCanvasCodings: () => state.codings,
  useCanvasTranscripts: () => state.transcripts,
}));
vi.mock('../../../hooks/useCanvasArtifact', () => ({ useCanvasArtifact: () => [{}, save] }));
import CodeWeightingPanel from './CodeWeightingPanel';

describe('code weighting teaching and recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.transcripts = [];
    state.questions = [];
    state.codings = [];
  });

  it('teaches the purpose, offers import and a worked example without inventing data', () => {
    render(<CodeWeightingPanel onClose={vi.fn()} />);
    expect(screen.getByText(/Stars help you compare how important/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Paste or import a transcript' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See a coded-passage example/ })).toHaveAttribute(
      'href',
      '/help/first-code.html',
    );
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Rate/ })).not.toBeInTheDocument();
  });

  it('closes the weighting dialog before opening the existing import picker', () => {
    const onClose = vi.fn();
    const picker = vi.fn(() => expect(onClose).toHaveBeenCalledTimes(1));
    window.addEventListener('qualcanvas:open-transcript-picker', picker);
    try {
      render(<CodeWeightingPanel onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
      expect(picker).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('qualcanvas:open-transcript-picker', picker);
    }
  });

  it('opens the actual existing transcript when the project has uncoded material', () => {
    state.transcripts = [{ id: 'source-1', title: 'Fictional interview', content: 'Fictional passage' }];
    const onClose = vi.fn();
    const focus = vi.fn((event: Event) => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect((event as CustomEvent).detail).toEqual({ nodeId: 'transcript-source-1' });
    });
    window.addEventListener('qualcanvas:focus-node', focus);
    try {
      render(<CodeWeightingPanel onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Open a transcript to code' }));
      expect(focus).toHaveBeenCalledTimes(1);
      expect(save).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('qualcanvas:focus-node', focus);
    }
  });

  it('labels both keyboard-reachable filters', () => {
    render(<CodeWeightingPanel onClose={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Filter by code' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort codings' })).toBeInTheDocument();
  });

  it('resets an empty filter without claiming saved codings are missing or changing them', () => {
    state.questions = [
      { id: 'coded', text: 'Confidence', color: '#3B82F6' },
      { id: 'empty', text: 'Unused code', color: '#3B82F6' },
    ];
    state.transcripts = [{ id: 'source-1', title: 'Fictional interview', content: 'Fictional passage' }];
    state.codings = [{ id: 'coding-1', questionId: 'coded', transcriptId: 'source-1', codedText: 'Fictional passage' }];
    render(<CodeWeightingPanel onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by code' }), { target: { value: 'empty' } });
    expect(screen.getByText(/Your saved codings have not been removed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all codings' }));
    expect(screen.getByText('"Fictional passage"')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by code' })).toHaveValue('');
    expect(save).not.toHaveBeenCalled();
  });
});

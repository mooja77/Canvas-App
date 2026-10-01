import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { state, fetchCanvases, navigate } = vi.hoisted(() => {
  const fetchCanvases = vi.fn().mockResolvedValue(true);
  const navigate = vi.fn();
  return {
    state: {
      canvases: [] as { id: string; name: string }[],
      activeCanvasId: null as string | null,
      loading: false,
      error: null as string | null,
      questions: [] as { id: string; text: string; color: string }[],
      codings: [] as { questionId: string }[],
      fetchCanvases,
      openCanvas: vi.fn(),
      setSelectedQuestionId: vi.fn(),
      selectedQuestionId: null as string | null,
    },
    fetchCanvases,
    navigate,
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
  useCanvasLoading: () => state.loading,
  useCanvasError: () => state.error,
  useCanvasQuestions: () => state.questions,
  useCanvasCodings: () => state.codings,
}));

import CanvasesPanel from './CanvasesPanel';
import CodebookPanel from './CodebookPanel';

describe('first-run activity sidebars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.canvases = [];
    state.activeCanvasId = null;
    state.loading = false;
    state.error = null;
    state.questions = [];
    state.codings = [];
  });

  it('does not claim there are no canvases when loading fails, and offers retry', () => {
    state.error = 'Failed to load canvases';
    render(<CanvasesPanel />);

    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your canvases");
    expect(screen.queryByText(/A canvas keeps your transcripts/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fetchCanvases).toHaveBeenCalled();
  });

  it('teaches the first action only after a successful empty load', () => {
    render(<CanvasesPanel />);
    expect(screen.getByText(/A canvas keeps your transcripts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New canvas/ }));
    expect(navigate).toHaveBeenCalledWith('/canvas');
  });

  it('keeps the empty guidance hidden until canvas loading has finished', () => {
    state.loading = true;
    render(<CanvasesPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your canvases');
    expect(screen.queryByText(/A canvas keeps your transcripts/)).not.toBeInTheDocument();
  });

  it('takes a researcher from an empty codebook to transcript import', () => {
    state.activeCanvasId = 'canvas-1';
    const listener = vi.fn();
    window.addEventListener('qualcanvas:open-transcript-picker', listener);
    render(<CodebookPanel />);

    expect(screen.getByText(/Codes collect passages/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('qualcanvas:open-transcript-picker', listener);
  });
});

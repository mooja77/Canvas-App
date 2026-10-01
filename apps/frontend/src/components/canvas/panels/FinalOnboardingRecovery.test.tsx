import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state, api } = vi.hoisted(() => ({
  state: {
    questions: [] as { id: string; text: string }[],
    activeCanvas: { id: 'canvas-fixture', transcripts: [] as { id: string; title: string }[], questions: [] },
    updateQuestion: vi.fn(),
  },
  api: { getSummaries: vi.fn(), generateSummary: vi.fn(), updateSummary: vi.fn() },
}));

vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (value: typeof state) => unknown) => selector(state),
  useCanvasQuestions: () => state.questions,
  useCanvasCodings: () => [],
  useActiveCanvas: () => state.activeCanvas,
}));
vi.mock('../../../services/api', () => ({ canvasApi: api }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));

import HierarchyPanel from './HierarchyPanel';
import SummaryPanel from './SummaryPanel';

describe('onboarding panel recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.questions = [];
    state.activeCanvas.transcripts = [];
    api.getSummaries.mockResolvedValue({ data: { data: [] } });
    api.generateSummary.mockResolvedValue({
      data: {
        data: {
          id: 'generated-fixture',
          summaryText: 'Mock response only',
          sourceType: 'transcript',
          summaryType: 'paraphrase',
          createdAt: '2026-01-01',
        },
      },
    });
  });

  it('teaches an empty hierarchy and deep-links to transcript import', () => {
    const onClose = vi.fn();
    const listener = vi.fn();
    window.addEventListener('qualcanvas:open-transcript-picker', listener);
    try {
      render(<HierarchyPanel onClose={onClose} />);
      expect(screen.getByText(/Group related codes/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /See a coded-passage example/ })).toHaveAttribute(
        'href',
        '/help/first-code.html',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('qualcanvas:open-transcript-picker', listener);
    }
  });

  it('does not present an empty summary list while loading', () => {
    api.getSummaries.mockReturnValue(new Promise(() => {}));
    render(<SummaryPanel onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading summaries');
    expect(screen.queryByText(/No summaries yet/)).not.toBeInTheDocument();
  });

  it('distinguishes failed summary loading from an empty list and retries saved data', async () => {
    api.getSummaries.mockRejectedValueOnce(new Error('fixture network failure')).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'summary-fixture',
            summaryText: 'Previously saved finding',
            sourceType: 'transcript',
            summaryType: 'paraphrase',
            createdAt: '2026-01-01',
          },
        ],
      },
    });
    render(<SummaryPanel onClose={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your summaries");
    expect(screen.queryByText(/No summaries yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Previously saved finding')).toBeInTheDocument();
    expect(api.generateSummary).not.toHaveBeenCalled();
  });

  it('offers a labelled example and import without generating or saving research', async () => {
    const onClose = vi.fn();
    const listener = vi.fn();
    window.addEventListener('qualcanvas:open-transcript-picker', listener);
    try {
      render(<SummaryPanel onClose={onClose} />);
      expect(await screen.findByText(/A short summary helps you compare/)).toBeInTheDocument();
      expect(screen.getByText(/Example only: Travel costs/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Paste or import a transcript' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(api.generateSummary).not.toHaveBeenCalled();
      expect(api.updateSummary).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('qualcanvas:open-transcript-picker', listener);
    }
  });

  it('connects source labels and the empty-state action to a keyboard-reachable selector', async () => {
    state.activeCanvas.transcripts = [{ id: 'transcript-fixture', title: 'Research interview' }];
    render(<SummaryPanel onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose a source' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Choose a source' }));
    expect(screen.getByLabelText('Transcript or code')).toHaveFocus();
    expect(screen.getByLabelText('Source type')).toBeInTheDocument();
    expect(screen.getByLabelText('Summary type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close summaries' })).toHaveClass('h-8', 'w-8');
  });

  it('requires the existing AI configuration guard before generation, not before reading', async () => {
    state.activeCanvas.transcripts = [{ id: 'transcript-fixture', title: 'Research interview' }];
    const requireAiConfig = vi.fn();
    render(<SummaryPanel onClose={vi.fn()} requireAiConfig={requireAiConfig} />);
    await screen.findByText(/No summaries yet/);
    expect(api.getSummaries).toHaveBeenCalledWith('canvas-fixture');
    expect(requireAiConfig).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Transcript or code'), { target: { value: 'transcript-fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Summary' }));
    expect(requireAiConfig).toHaveBeenCalledWith('AI Summarization', expect.any(Function));
    expect(api.generateSummary).not.toHaveBeenCalled();
  });

  it('generates only after the existing configuration guard admits the action', async () => {
    state.activeCanvas.transcripts = [{ id: 'transcript-fixture', title: 'Research interview' }];
    const requireAiConfig = vi.fn();
    render(<SummaryPanel onClose={vi.fn()} requireAiConfig={requireAiConfig} />);
    await screen.findByText(/No summaries yet/);
    fireEvent.change(screen.getByLabelText('Transcript or code'), { target: { value: 'transcript-fixture' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Summary' }));
    expect(api.generateSummary).not.toHaveBeenCalled();
    await act(async () => {
      requireAiConfig.mock.calls[0][1]();
    });
    expect(api.generateSummary).toHaveBeenCalledTimes(1);
    expect(api.generateSummary).toHaveBeenCalledWith('canvas-fixture', {
      sourceType: 'transcript',
      sourceId: 'transcript-fixture',
      summaryType: 'paraphrase',
    });
  });
});

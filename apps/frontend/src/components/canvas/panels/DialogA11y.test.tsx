import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilePreviewModal from './FilePreviewModal';
import PresentationMode from './PresentationMode';
import FullProductTour from '../../help/FullProductTour';

const mockCompleteOnboarding = vi.fn();

vi.mock('../../../stores/canvasStore', () => {
  const state = {
    activeCanvasId: 'canvas-1',
    activeCanvas: { transcripts: [], questions: [], codings: [] },
  };
  const useCanvasStore = Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state,
  });
  return {
    useActiveCanvas: () => ({
      id: 'canvas-1',
      name: 'Healthcare Study',
      transcripts: [],
      questions: [],
      codings: [],
      memos: [],
      cases: [],
    }),
    useCanvasStore,
  };
});

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (
    selector: (s: {
      onboardingComplete: boolean;
      completeOnboarding: () => void;
      showFullProductTour: boolean;
      closeFullProductTour: () => void;
    }) => unknown,
  ) =>
    selector({
      onboardingComplete: false,
      completeOnboarding: mockCompleteOnboarding,
      showFullProductTour: true,
      closeFullProductTour: mockCompleteOnboarding,
    }),
}));

describe('Proper dialog roles, focus trap, and Escape handling (qualcanvas-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FilePreviewModal renders an accessible modal dialog and closes on Escape', () => {
    const onClose = vi.fn();
    const file = new File(['hello'], 'interview.txt', { type: 'text/plain' });
    render(<FilePreviewModal files={[file]} onImport={vi.fn()} onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Import 1 file' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('PresentationMode renders an accessible modal dialog and exits on Escape', () => {
    const onExit = vi.fn();
    render(<PresentationMode onExit={onExit} />);

    const dialog = screen.getByRole('dialog', { name: 'Healthcare Study' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('FullProductTour renders an accessible modal dialog and closes on Escape', () => {
    render(<FullProductTour />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'product-tour-title');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
  });
});

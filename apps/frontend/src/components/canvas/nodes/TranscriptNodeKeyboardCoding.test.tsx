import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TranscriptNode from './TranscriptNode';

const mockSetPendingSelection = vi.fn();

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Right: 'right', Left: 'left' },
  NodeResizer: () => null,
}));

vi.mock('./useNodeCollapsed', () => ({
  useNodeCollapsed: () => ({ collapsed: false, toggleCollapsed: vi.fn() }),
}));

vi.mock('../panels/QuickCodePopover', () => ({
  default: ({ codedText, startOffset, endOffset }: { codedText: string; startOffset: number; endOffset: number }) => (
    <div data-testid="quick-code-popover">
      {codedText}:{startOffset}-{endOffset}
    </div>
  ),
}));

vi.mock('../../../stores/canvasStore', () => {
  const transcript = {
    id: 'tr-1',
    title: 'Participant 1',
    content: 'The onboarding felt quick and clear for new nurses.',
    caseId: null,
  };
  const state = {
    activeCanvas: {
      myRole: 'owner',
      codings: [],
      transcripts: [transcript],
      questions: [],
      cases: [],
    },
    pendingSelection: null as null | {
      transcriptId: string;
      startOffset: number;
      endOffset: number;
      codedText: string;
    },
    setPendingSelection: (
      sel: { transcriptId: string; startOffset: number; endOffset: number; codedText: string } | null,
    ) => {
      state.pendingSelection = sel;
      mockSetPendingSelection(sel);
    },
    deleteTranscript: vi.fn(),
    codeInVivo: vi.fn(),
    spreadToParagraph: vi.fn(),
  };
  const useCanvasStore = (selector: (s: typeof state) => unknown) => selector(state);
  return {
    useCanvasStore,
    useCanvasQuestions: () => [],
    useCanvasTranscripts: () => [transcript],
    useCanvasCases: () => [],
    usePendingSelection: () => state.pendingSelection,
    useShowCodingStripes: () => false,
  };
});

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (selector: (s: { zoomTier: string; verifyHighlight: null }) => unknown) =>
    selector({ zoomTier: 'full', verifyHighlight: null }),
}));

describe('TranscriptNode keyboard coding (qualcanvas-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets a keyboard-only user select a passage in the textarea and open QuickCodePopover without a mouse', () => {
    render(
      <MemoryRouter>
        <TranscriptNode
          id="transcript-tr-1"
          type="transcript"
          selected={false}
          dragging={false}
          draggable={true}
          selectable={true}
          deletable={true}
          zIndex={1}
          isConnectable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          data={{ transcriptId: 'tr-1', title: 'Participant 1' }}
        />
      </MemoryRouter>,
    );

    const toggle = screen.getByRole('button', { name: 'Code with keyboard' });
    fireEvent.click(toggle);

    const textarea = screen.getByLabelText('Select transcript passage with keyboard') as HTMLTextAreaElement;
    // Select " onboarding felt quick " (with surrounding spaces to verify offset trimming)
    textarea.selectionStart = 3;
    textarea.selectionEnd = 26;
    fireEvent.select(textarea);

    fireEvent.click(screen.getByRole('button', { name: 'Code selection' }));

    expect(mockSetPendingSelection).toHaveBeenCalledWith({
      transcriptId: 'tr-1',
      startOffset: 4,
      endOffset: 25,
      codedText: 'onboarding felt quick',
    });
  });
});

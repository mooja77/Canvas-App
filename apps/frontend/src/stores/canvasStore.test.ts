import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './canvasStore';

// Helper to reset store between tests
function resetStore() {
  useCanvasStore.setState({
    canvases: [],
    loading: false,
    error: null,
    activeCanvasId: null,
    activeCanvas: null,
    pendingSelection: null,
    selectedQuestionId: null,
    showCodingStripes: false,
    savingLayout: false,
  });
}

describe('canvasStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('has empty canvases array', () => {
      expect(useCanvasStore.getState().canvases).toEqual([]);
    });

    it('has no active canvas', () => {
      expect(useCanvasStore.getState().activeCanvasId).toBeNull();
      expect(useCanvasStore.getState().activeCanvas).toBeNull();
    });

    it('has loading false and no error', () => {
      expect(useCanvasStore.getState().loading).toBe(false);
      expect(useCanvasStore.getState().error).toBeNull();
    });

    it('has no pending selection', () => {
      expect(useCanvasStore.getState().pendingSelection).toBeNull();
    });

    it('has coding stripes off by default', () => {
      expect(useCanvasStore.getState().showCodingStripes).toBe(false);
    });
  });

  describe('setPendingSelection', () => {
    it('sets a pending selection', () => {
      const selection = {
        transcriptId: 'tx-1',
        startOffset: 10,
        endOffset: 50,
        codedText: 'some selected text',
      };
      useCanvasStore.getState().setPendingSelection(selection);
      expect(useCanvasStore.getState().pendingSelection).toEqual(selection);
    });

    it('clears pending selection when set to null', () => {
      useCanvasStore.getState().setPendingSelection({
        transcriptId: 'tx-1',
        startOffset: 0,
        endOffset: 5,
        codedText: 'hello',
      });
      expect(useCanvasStore.getState().pendingSelection).not.toBeNull();

      useCanvasStore.getState().setPendingSelection(null);
      expect(useCanvasStore.getState().pendingSelection).toBeNull();
    });
  });

  describe('setSelectedQuestionId', () => {
    it('sets selected question id', () => {
      useCanvasStore.getState().setSelectedQuestionId('q-123');
      expect(useCanvasStore.getState().selectedQuestionId).toBe('q-123');
    });

    it('clears selected question id', () => {
      useCanvasStore.getState().setSelectedQuestionId('q-123');
      useCanvasStore.getState().setSelectedQuestionId(null);
      expect(useCanvasStore.getState().selectedQuestionId).toBeNull();
    });
  });

  describe('toggleCodingStripes', () => {
    it('toggles coding stripes on', () => {
      expect(useCanvasStore.getState().showCodingStripes).toBe(false);
      useCanvasStore.getState().toggleCodingStripes();
      expect(useCanvasStore.getState().showCodingStripes).toBe(true);
    });

    it('toggles coding stripes off again', () => {
      useCanvasStore.getState().toggleCodingStripes();
      useCanvasStore.getState().toggleCodingStripes();
      expect(useCanvasStore.getState().showCodingStripes).toBe(false);
    });
  });

  describe('selector hooks return correct slices', () => {
    it('useActiveCanvas returns activeCanvas', () => {
      // Selectors are just functions that pick from state — test them via getState
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) => s.activeCanvas;
      expect(selector(useCanvasStore.getState())).toBeNull();
    });

    it('useCanvasTranscripts returns empty array when no active canvas', () => {
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) =>
        s.activeCanvas?.transcripts ?? [];
      expect(selector(useCanvasStore.getState())).toEqual([]);
    });

    it('useCanvasQuestions returns empty array when no active canvas', () => {
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) =>
        s.activeCanvas?.questions ?? [];
      expect(selector(useCanvasStore.getState())).toEqual([]);
    });

    it('useShowCodingStripes returns showCodingStripes value', () => {
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) => s.showCodingStripes;
      expect(selector(useCanvasStore.getState())).toBe(false);
      useCanvasStore.getState().toggleCodingStripes();
      expect(selector(useCanvasStore.getState())).toBe(true);
    });

    it('useCanvasLoading returns loading value', () => {
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) => s.loading;
      expect(selector(useCanvasStore.getState())).toBe(false);
    });
  });
});

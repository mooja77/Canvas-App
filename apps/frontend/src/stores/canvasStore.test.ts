import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/api', () => ({
  canvasApi: { saveLayout: vi.fn().mockResolvedValue({}), getCanvas: vi.fn() },
  getAllCanvases: vi.fn(),
}));
vi.mock('../lib/offlineStorage', () => ({
  cacheCanvas: vi.fn().mockResolvedValue(undefined),
  getCachedCanvas: vi.fn().mockResolvedValue(null),
  clearCachedCanvas: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { default: toast };
});

import { useCanvasStore } from './canvasStore';
import { canvasApi } from '../services/api';
import toast from 'react-hot-toast';

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
    vi.clearAllMocks();
    vi.mocked(canvasApi.saveLayout).mockResolvedValue({} as never);
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
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) => s.activeCanvas?.transcripts ?? [];
      expect(selector(useCanvasStore.getState())).toEqual([]);
    });

    it('useCanvasQuestions returns empty array when no active canvas', () => {
      const selector = (s: ReturnType<typeof useCanvasStore.getState>) => s.activeCanvas?.questions ?? [];
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

  describe('saveLayout role guard', () => {
    it('silently skips persistence for read-only viewers', async () => {
      useCanvasStore.setState({
        activeCanvasId: 'c1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCanvas: { id: 'c1', myRole: 'viewer' } as any,
      });
      await useCanvasStore.getState().saveLayout([]);
      expect(canvasApi.saveLayout).not.toHaveBeenCalled();
    });

    it('persists layout for owners', async () => {
      useCanvasStore.setState({
        activeCanvasId: 'c1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCanvas: { id: 'c1', myRole: 'owner' } as any,
      });
      await useCanvasStore.getState().saveLayout([]);
      expect(canvasApi.saveLayout).toHaveBeenCalledWith('c1', { positions: [] });
    });

    it('serializes overlapping layout saves so they cannot contend on the same rows', async () => {
      useCanvasStore.setState({
        activeCanvasId: 'c1',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCanvas: { id: 'c1', myRole: 'owner' } as any,
      });
      let releaseFirst!: () => void;
      vi.mocked(canvasApi.saveLayout)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              releaseFirst = () => resolve({} as never);
            }),
        )
        .mockResolvedValueOnce({} as never);

      const first = useCanvasStore.getState().saveLayout([]);
      await vi.waitFor(() => expect(canvasApi.saveLayout).toHaveBeenCalledTimes(1));
      const second = useCanvasStore.getState().saveLayout([]);
      await Promise.resolve();
      expect(canvasApi.saveLayout).toHaveBeenCalledTimes(1);
      expect(useCanvasStore.getState().savingLayout).toBe(true);

      releaseFirst();
      await Promise.all([first, second]);
      expect(canvasApi.saveLayout).toHaveBeenCalledTimes(2);
      expect(useCanvasStore.getState().savingLayout).toBe(false);
    });
  });

  // ─── Bug hunt 2026-09-02: H3 (load sequencing) ───

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  const canvasResponse = (id: string, extra: Record<string, unknown> = {}) =>
    ({ data: { data: { id, myRole: 'owner', ...extra } } }) as never;

  describe('load sequencing (H3)', () => {
    it('a slower earlier openCanvas cannot overwrite the canvas opened later', async () => {
      const a = deferred<unknown>();
      const b = deferred<unknown>();
      vi.mocked(canvasApi.getCanvas).mockImplementation(((id: string) =>
        id === 'A' ? a.promise : b.promise) as never);

      const openA = useCanvasStore.getState().openCanvas('A');
      const openB = useCanvasStore.getState().openCanvas('B');
      b.resolve(canvasResponse('B'));
      await openB;
      expect(useCanvasStore.getState().activeCanvasId).toBe('B');

      a.resolve(canvasResponse('A'));
      await openA;

      expect(useCanvasStore.getState().activeCanvasId).toBe('B');
      expect(useCanvasStore.getState().activeCanvas?.id).toBe('B');
      expect(useCanvasStore.getState().loading).toBe(false);
    });

    it('a refreshCanvas that resolves after the user switched canvases is discarded', async () => {
      useCanvasStore.setState({
        activeCanvasId: 'A',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCanvas: { id: 'A', myRole: 'owner' } as any,
      });
      const refresh = deferred<unknown>();
      const b = deferred<unknown>();
      vi.mocked(canvasApi.getCanvas).mockImplementation(((id: string) =>
        id === 'A' ? refresh.promise : b.promise) as never);

      const refreshing = useCanvasStore.getState().refreshCanvas();
      const openB = useCanvasStore.getState().openCanvas('B');
      b.resolve(canvasResponse('B'));
      await openB;

      refresh.resolve(canvasResponse('A', { name: 'stale refresh' }));
      await refreshing;

      expect(useCanvasStore.getState().activeCanvasId).toBe('B');
      expect(useCanvasStore.getState().activeCanvas?.id).toBe('B');
    });

    it('an openCanvas that resolves after closeCanvas does not resurrect the canvas', async () => {
      const a = deferred<unknown>();
      vi.mocked(canvasApi.getCanvas).mockImplementation((() => a.promise) as never);

      const openA = useCanvasStore.getState().openCanvas('A');
      useCanvasStore.getState().closeCanvas();
      a.resolve(canvasResponse('A'));
      await openA;

      expect(useCanvasStore.getState().activeCanvasId).toBeNull();
      expect(useCanvasStore.getState().activeCanvas).toBeNull();
      expect(useCanvasStore.getState().loading).toBe(false);
    });

    it('a stale openCanvas failure does not clear the canvas opened later', async () => {
      const a = deferred<unknown>();
      const b = deferred<unknown>();
      vi.mocked(canvasApi.getCanvas).mockImplementation(((id: string) =>
        id === 'A' ? a.promise : b.promise) as never);

      const openA = useCanvasStore.getState().openCanvas('A');
      const openB = useCanvasStore.getState().openCanvas('B');
      b.resolve(canvasResponse('B'));
      await openB;

      a.reject({ response: { status: 404 } });
      await openA;

      expect(useCanvasStore.getState().activeCanvasId).toBe('B');
      expect(useCanvasStore.getState().activeCanvas?.id).toBe('B');
      expect(useCanvasStore.getState().error).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  // ─── Bug hunt 2026-09-02: M3 (layout save queue) ───

  describe('layout save queue (M3)', () => {
    const owner = (id: string) =>
      useCanvasStore.setState({
        activeCanvasId: id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeCanvas: { id, myRole: 'owner' } as any,
      });
    const pos = (nodeId: string, x: number, y: number) =>
      ({ id: '', canvasId: '', nodeId, nodeType: 'memo', x, y }) as never;

    it('queues per canvas so a hung save on one canvas does not block another', async () => {
      owner('c1');
      const hung = deferred<unknown>();
      vi.mocked(canvasApi.saveLayout)
        .mockImplementationOnce(() => hung.promise as never)
        .mockResolvedValueOnce({} as never);

      const first = useCanvasStore.getState().saveLayout([]);
      await vi.waitFor(() => expect(canvasApi.saveLayout).toHaveBeenCalledTimes(1));

      owner('c2');
      const second = useCanvasStore.getState().saveLayout([]);
      await vi.waitFor(() => expect(canvasApi.saveLayout).toHaveBeenCalledTimes(2));
      expect(canvasApi.saveLayout).toHaveBeenLastCalledWith('c2', { positions: [] });
      await second;
      // c1 is still in flight, so the chip must keep showing Saving.
      expect(useCanvasStore.getState().savingLayout).toBe(true);

      hung.resolve({});
      await first;
      expect(useCanvasStore.getState().savingLayout).toBe(false);
    });

    it('coalesces saves queued behind an in-flight request, newer positions winning by nodeId', async () => {
      owner('c1');
      const hung = deferred<unknown>();
      vi.mocked(canvasApi.saveLayout)
        .mockImplementationOnce(() => hung.promise as never)
        .mockResolvedValue({} as never);

      const first = useCanvasStore.getState().saveLayout([pos('n1', 0, 0)]);
      await vi.waitFor(() => expect(canvasApi.saveLayout).toHaveBeenCalledTimes(1));
      const second = useCanvasStore.getState().saveLayout([pos('n2', 1, 1), pos('n4', 2, 2)]);
      const third = useCanvasStore.getState().saveLayout([pos('n2', 5, 5), pos('n3', 3, 3)]);

      hung.resolve({});
      await Promise.all([first, second, third]);

      // One request for the two queued saves. The layout PUT upserts per
      // nodeId, so n4 (only in the superseded payload) must still be sent.
      expect(canvasApi.saveLayout).toHaveBeenCalledTimes(2);
      expect(canvasApi.saveLayout).toHaveBeenLastCalledWith('c1', {
        positions: [
          { nodeId: 'n2', nodeType: 'memo', x: 5, y: 5, width: undefined, height: undefined, collapsed: undefined },
          { nodeId: 'n3', nodeType: 'memo', x: 3, y: 3, width: undefined, height: undefined, collapsed: undefined },
          { nodeId: 'n4', nodeType: 'memo', x: 2, y: 2, width: undefined, height: undefined, collapsed: undefined },
        ],
      });
      expect(useCanvasStore.getState().savingLayout).toBe(false);
      expect(useCanvasStore.getState().layoutSaveFailed).toBe(false);
    });

    it('a timed-out layout save clears savingLayout and records the failure like a 500', async () => {
      owner('c1');
      vi.mocked(canvasApi.saveLayout).mockRejectedValueOnce(
        Object.assign(new Error('timeout of 15000ms exceeded'), { code: 'ECONNABORTED' }),
      );

      await useCanvasStore.getState().saveLayout([]);

      expect(useCanvasStore.getState().savingLayout).toBe(false);
      expect(useCanvasStore.getState().layoutSaveFailed).toBe(true);
      expect(toast.error).toHaveBeenCalledWith('Layout save failed');
    });
  });
});

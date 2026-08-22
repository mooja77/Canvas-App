import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * openCanvas used to treat EVERY failure from GET /canvas/:id as "we must be
 * offline" and re-serve the full cached canvas from IndexedDB — transcripts,
 * codings, memos and a stale `myRole: 'owner'` — behind a friendly
 * "Loaded from offline cache" toast.
 *
 * That is a confidentiality bug: a removed collaborator (403) or a trashed
 * canvas (404) is a definitive answer from the server, not a network outage.
 * These tests pin the distinction and the cache purge that follows a refusal.
 */

const { getCanvas, cacheCanvas, getCachedCanvas, clearCachedCanvas, toastFn, toastError } = vi.hoisted(() => ({
  getCanvas: vi.fn(),
  cacheCanvas: vi.fn().mockResolvedValue(undefined),
  getCachedCanvas: vi.fn(),
  clearCachedCanvas: vi.fn().mockResolvedValue(undefined),
  toastFn: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../services/api', () => ({
  canvasApi: { getCanvas },
}));

vi.mock('../lib/offlineStorage', () => ({
  cacheCanvas,
  getCachedCanvas,
  clearCachedCanvas,
}));

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(toastFn, { error: toastError, success: vi.fn() });
  return { default: toast, toast };
});

import { useCanvasStore } from './canvasStore';

const CACHED_CANVAS = {
  id: 'c-secret',
  name: 'Confidential Interviews',
  myRole: 'owner',
  transcripts: [{ id: 't1', content: 'participant said something private' }],
  questions: [],
  memos: [],
  codings: [],
};

function httpError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: {} },
  });
}

function networkError() {
  // Axios shape for "no response ever arrived" — the genuine offline case.
  return Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' });
}

describe('canvasStore.openCanvas access handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCachedCanvas.mockResolvedValue(CACHED_CANVAS);
    clearCachedCanvas.mockResolvedValue(undefined);
    useCanvasStore.setState({
      activeCanvasId: null,
      activeCanvas: null,
      loading: false,
      error: null,
      pendingSelection: null,
    });
  });

  it('does not serve the cached canvas when access is refused (403)', async () => {
    getCanvas.mockRejectedValue(httpError(403));

    await useCanvasStore.getState().openCanvas('c-secret');

    const state = useCanvasStore.getState();
    expect(state.activeCanvas).toBeNull();
    expect(state.activeCanvasId).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeTruthy();
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('purges the local copy when access is refused (403)', async () => {
    getCanvas.mockRejectedValue(httpError(403));

    await useCanvasStore.getState().openCanvas('c-secret');

    expect(clearCachedCanvas).toHaveBeenCalledWith('c-secret');
  });

  it('does not serve the cached canvas for a trashed / missing canvas (404)', async () => {
    getCanvas.mockRejectedValue(httpError(404));

    await useCanvasStore.getState().openCanvas('c-secret');

    const state = useCanvasStore.getState();
    expect(state.activeCanvas).toBeNull();
    expect(clearCachedCanvas).toHaveBeenCalledWith('c-secret');
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('does not serve the cached canvas when the session has expired (401)', async () => {
    getCanvas.mockRejectedValue(httpError(401));

    await useCanvasStore.getState().openCanvas('c-secret');

    expect(useCanvasStore.getState().activeCanvas).toBeNull();
    // A 401 is not "you were removed" — the cached copy may still be the
    // user's own, so it is left alone for when they sign back in.
    expect(clearCachedCanvas).not.toHaveBeenCalled();
  });

  it('still serves the cached canvas on a genuine network failure', async () => {
    getCanvas.mockRejectedValue(networkError());

    await useCanvasStore.getState().openCanvas('c-secret');

    const state = useCanvasStore.getState();
    expect(state.activeCanvas).toEqual(CACHED_CANVAS);
    expect(state.activeCanvasId).toBe('c-secret');
    expect(clearCachedCanvas).not.toHaveBeenCalled();
    expect(toastFn).toHaveBeenCalled();
  });

  it('still serves the cached canvas when the backend is down (503)', async () => {
    getCanvas.mockRejectedValue(httpError(503));

    await useCanvasStore.getState().openCanvas('c-secret');

    expect(useCanvasStore.getState().activeCanvas).toEqual(CACHED_CANVAS);
    expect(clearCachedCanvas).not.toHaveBeenCalled();
  });
});

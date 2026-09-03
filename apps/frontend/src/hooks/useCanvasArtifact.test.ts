import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasArtifact } from './useCanvasArtifact';

vi.mock('../services/api', () => ({
  canvasApi: {
    getArtifact: vi.fn(),
    saveArtifact: vi.fn(),
  },
}));

import { canvasApi } from '../services/api';

const getArtifact = vi.mocked(canvasApi.getArtifact);
const saveArtifact = vi.mocked(canvasApi.saveArtifact);
const EMPTY: string[] = [];
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

describe('useCanvasArtifact', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('loads a server value and refreshes the local cache', async () => {
    getArtifact.mockResolvedValue({ data: { data: { exists: true, value: ['server'] } } } as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    await waitFor(() => expect(result.current[0]).toEqual(['server']));
    expect(localStorage.getItem('test-canvas-1')).toBe('["server"]');
  });

  it('migrates a legacy local-only value when the server has no copy', async () => {
    localStorage.setItem('test-canvas-1', '["legacy"]');
    getArtifact.mockResolvedValue({ data: { data: { exists: false, value: [] } } } as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    await waitFor(() => expect(saveArtifact).toHaveBeenCalledWith('canvas-1', 'sticky-notes', ['legacy']));
    expect(result.current[0]).toEqual(['legacy']);
  });

  it('coalesces edits while preserving the local value immediately', async () => {
    vi.useFakeTimers();
    getArtifact.mockResolvedValue({ data: { data: { exists: false, value: [] } } } as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    await act(async () => Promise.resolve());
    act(() => {
      result.current[1](['first']);
      result.current[1](['latest']);
    });
    expect(result.current[0]).toEqual(['latest']);
    expect(localStorage.getItem('test-canvas-1')).toBe('["latest"]');
    await act(async () => vi.advanceTimersByTimeAsync(350));
    expect(saveArtifact).toHaveBeenLastCalledWith('canvas-1', 'sticky-notes', ['latest']);
  });

  // ─── Bug hunt 2026-09-02: H1 / H2 (edits racing the initial GET) ───

  interface Note {
    id: string;
    text: string;
  }
  const EMPTY_NOTES: Note[] = [];
  const isNotes = (value: unknown): value is Note[] =>
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'object' && entry !== null && typeof (entry as Note).id === 'string');
  const EMPTY_WEIGHTS: Record<string, number> = {};
  const isWeights = (value: unknown): value is Record<string, number> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }
  // A macrotask hop drains every microtask the reconcile chain enqueues.
  const flush = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 0)));

  it('H1: keeps an edit made while the GET was pending when the GET fails', async () => {
    const get = deferred<unknown>();
    getArtifact.mockImplementation(() => get.promise as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    act(() => result.current[1](['C']));
    expect(result.current[0]).toEqual(['C']);

    get.reject(new Error('network down'));
    await flush();

    expect(result.current[0]).toEqual(['C']);
    expect(localStorage.getItem('test-canvas-1')).toBe('["C"]');
  });

  it('H2: merges a post-mount edit into the server value by id instead of overwriting it', async () => {
    const get = deferred<unknown>();
    getArtifact.mockImplementation(() => get.promise as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact<Note[]>({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY_NOTES,
        validate: isNotes,
      }),
    );

    act(() =>
      result.current[1]([
        { id: 'b', text: 'B local' },
        { id: 'c', text: 'C' },
      ]),
    );

    get.resolve({
      data: {
        data: {
          exists: true,
          value: [
            { id: 'a', text: 'A' },
            { id: 'b', text: 'B server' },
          ],
        },
      },
    });
    await flush();

    const merged = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B local' },
      { id: 'c', text: 'C' },
    ];
    expect(result.current[0]).toEqual(merged);
    expect(saveArtifact).toHaveBeenCalledWith('canvas-1', 'sticky-notes', merged);
    expect(JSON.parse(localStorage.getItem('test-canvas-1') as string)).toEqual(merged);

    // The debounced save scheduled by the pre-merge edit must not fire later
    // and PUT the stale local copy over the merge.
    await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 400)));
    expect(saveArtifact).toHaveBeenLastCalledWith('canvas-1', 'sticky-notes', merged);
  });

  it('H2: merges code-weight records with local keys winning', async () => {
    const get = deferred<unknown>();
    getArtifact.mockImplementation(() => get.promise as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact<Record<string, number>>({
        canvasId: 'canvas-1',
        type: 'code-weights',
        storageKeyPrefix: 'weights-',
        fallback: EMPTY_WEIGHTS,
        validate: isWeights,
      }),
    );

    act(() => result.current[1]({ b: 2, c: 3 }));
    get.resolve({ data: { data: { exists: true, value: { a: 1, b: 9 } } } });
    await flush();

    expect(result.current[0]).toEqual({ a: 1, b: 2, c: 3 });
    expect(saveArtifact).toHaveBeenCalledWith('canvas-1', 'code-weights', { a: 1, b: 2, c: 3 });
  });

  it('H2: merges a pre-mount dirty local copy when the server already has a row', async () => {
    localStorage.setItem('test-canvas-1', '["C"]');
    localStorage.setItem('test-canvas-1-server-dirty', '1');
    getArtifact.mockResolvedValue({ data: { data: { exists: true, value: ['A', 'B'] } } } as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    await waitFor(() => expect(saveArtifact).toHaveBeenCalledWith('canvas-1', 'sticky-notes', ['A', 'B', 'C']));
    expect(result.current[0]).toEqual(['A', 'B', 'C']);
    expect(localStorage.getItem('test-canvas-1-server-dirty')).toBeNull();
  });

  it('H2: still pushes a pre-mount dirty local copy wholesale when the server has no row', async () => {
    localStorage.setItem('test-canvas-1', '["legacy"]');
    localStorage.setItem('test-canvas-1-server-dirty', '1');
    getArtifact.mockResolvedValue({ data: { data: { exists: false } } } as never);
    saveArtifact.mockResolvedValue({} as never);
    const { result } = renderHook(() =>
      useCanvasArtifact({
        canvasId: 'canvas-1',
        type: 'sticky-notes',
        storageKeyPrefix: 'test-',
        fallback: EMPTY,
        validate: isStrings,
      }),
    );

    await waitFor(() => expect(saveArtifact).toHaveBeenCalledWith('canvas-1', 'sticky-notes', ['legacy']));
    expect(result.current[0]).toEqual(['legacy']);
  });
});

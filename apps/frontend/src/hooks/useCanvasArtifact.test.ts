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
});

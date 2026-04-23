import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── In-memory IndexedDB mock ───

function createMockIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  function getStore(name: string) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  }

  const mockIndexedDB = {
    open: vi.fn((_name: string, _version?: number) => {
      const request: Record<string, unknown> = {
        result: {
          transaction: (storeName: string, mode: string) => {
            const store = getStore(storeName);
            return {
              objectStore: (_name?: string) => ({
                put: (value: { id: string }) => {
                  store.set(value.id, value);
                  return { onsuccess: null, onerror: null };
                },
                get: (key: string) => {
                  const req = {
                    result: store.get(key) || null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                  };
                  Promise.resolve().then(() => req.onsuccess?.());
                  return req;
                },
                delete: (key: string) => {
                  store.delete(key);
                  return { onsuccess: null, onerror: null };
                },
              }),
            };
          },
          createObjectStore: vi.fn(),
        },
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
      };

      // Fire upgrade + success asynchronously
      Promise.resolve().then(() => {
        (request as any).onupgradeneeded?.();
        (request as any).onsuccess?.();
      });

      return request;
    }),
    _stores: stores,
    _clear: () => stores.clear(),
  };

  return mockIndexedDB;
}

let mockIDB: ReturnType<typeof createMockIndexedDB>;

beforeEach(() => {
  mockIDB = createMockIndexedDB();
  vi.stubGlobal('indexedDB', mockIDB);
});

afterEach(() => {
  mockIDB._clear();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ─── offlineStorage tests ───

describe('offlineStorage', () => {
  it('saves canvas data to IndexedDB', async () => {
    const { cacheCanvas } = await import('../lib/offlineStorage');
    const canvas = { id: 'c1', name: 'Test Canvas', transcripts: [] };

    await cacheCanvas(canvas);

    const stored = mockIDB._stores.get('canvases')?.get('c1');
    expect(stored).toEqual(canvas);
  });

  it('retrieves saved canvas data', async () => {
    const { cacheCanvas, getCachedCanvas } = await import('../lib/offlineStorage');
    const canvas = { id: 'c2', name: 'My Canvas', questions: ['q1'] };

    await cacheCanvas(canvas);
    const result = await getCachedCanvas('c2');

    expect(result).toEqual(canvas);
  });

  it('handles missing data gracefully', async () => {
    const { getCachedCanvas } = await import('../lib/offlineStorage');
    const result = await getCachedCanvas('nonexistent');
    expect(result).toBeNull();
  });

  it('clears storage for a specific canvas', async () => {
    const { cacheCanvas, clearCachedCanvas, getCachedCanvas } = await import('../lib/offlineStorage');
    await cacheCanvas({ id: 'c3', name: 'To Clear' });

    await clearCachedCanvas('c3');

    const result = await getCachedCanvas('c3');
    expect(result).toBeNull();
  });
});

// ─── offlineQueue tests ───

describe('offlineQueue', () => {
  // Mock crypto.randomUUID
  beforeEach(() => {
    let counter = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `uuid-${++counter}`,
    });
  });

  it('queues operation when offline', async () => {
    const { queueOperation, getQueue } = await import('../lib/offlineQueue');

    queueOperation({ method: 'POST', url: '/canvas/c1/codings', body: { text: 'hello' } });

    const queue = getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].method).toBe('POST');
    expect(queue[0].url).toBe('/canvas/c1/codings');
    expect(queue[0].body).toEqual({ text: 'hello' });
  });

  it('replays operations when back online', async () => {
    const { queueOperation, replayQueue, getQueue } = await import('../lib/offlineQueue');
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    queueOperation({ method: 'POST', url: '/canvas/c1/codings', body: { a: 1 } });
    queueOperation({ method: 'PUT', url: '/canvas/c1/layout', body: { b: 2 } });

    await replayQueue('http://localhost:3007/api/v1');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3007/api/v1/canvas/c1/codings',
      expect.objectContaining({ method: 'POST' }),
    );

    // Queue should be cleared after successful replay
    expect(getQueue()).toHaveLength(0);
  });

  it('preserves operation order', async () => {
    const { queueOperation, getQueue } = await import('../lib/offlineQueue');

    queueOperation({ method: 'POST', url: '/a' });
    queueOperation({ method: 'PUT', url: '/b' });
    queueOperation({ method: 'DELETE', url: '/c' });

    const queue = getQueue();
    expect(queue[0].url).toBe('/a');
    expect(queue[1].url).toBe('/b');
    expect(queue[2].url).toBe('/c');
  });

  it('handles replay failure gracefully (stops at failed op)', async () => {
    const { queueOperation, replayQueue, getQueue } = await import('../lib/offlineQueue');
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // first succeeds
      .mockRejectedValueOnce(new Error('offline')); // second fails
    vi.stubGlobal('fetch', fetchSpy);

    queueOperation({ method: 'POST', url: '/op1' });
    queueOperation({ method: 'POST', url: '/op2' });
    queueOperation({ method: 'POST', url: '/op3' });

    await replayQueue('http://localhost:3007');

    // Should have attempted 2 (stopped at failure), queue NOT cleared
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(getQueue()).toHaveLength(3); // all still in queue
  });

  it('clears queue after successful replay', async () => {
    const { queueOperation, replayQueue, clearQueue, getQueue } = await import('../lib/offlineQueue');
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);

    queueOperation({ method: 'POST', url: '/x' });
    await replayQueue('http://localhost:3007');

    expect(getQueue()).toHaveLength(0);
  });
});

// ─── API interceptor tests ───

describe('API interceptors', () => {
  it('detects 401 and logs out', async () => {
    // We need to test the interceptor behavior by importing the configured client
    const { useAuthStore } = await import('../stores/authStore');
    useAuthStore.setState({ authenticated: true, authType: 'email' });

    const { canvasClient } = await import('../services/api');

    // Create a mock adapter that returns 401
    const originalAdapter = canvasClient.defaults.adapter;
    canvasClient.defaults.adapter = () =>
      Promise.reject({
        response: { status: 401, data: { message: 'Token expired' } },
        isAxiosError: true,
      });

    // Spy on location change
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '/' },
      writable: true,
      configurable: true,
    });

    try {
      await canvasClient.get('/canvas');
    } catch {
      // Expected to reject
    }

    // Verify the auth store was logged out
    expect(useAuthStore.getState().authenticated).toBe(false);

    // Restore adapter
    canvasClient.defaults.adapter = originalAdapter;
  });

  it('detects plan limit response (403 PLAN_LIMIT_EXCEEDED)', async () => {
    const { canvasClient } = await import('../services/api');

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    canvasClient.defaults.adapter = () =>
      Promise.reject({
        response: {
          status: 403,
          data: { code: 'PLAN_LIMIT_EXCEEDED', limit: 'canvases', current: 1, max: 1 },
        },
        isAxiosError: true,
      });

    try {
      await canvasClient.get('/canvas');
    } catch {
      // Expected
    }

    const planLimitEvent = dispatchSpy.mock.calls.find(
      (c) => c[0] instanceof CustomEvent && c[0].type === 'plan-limit-exceeded',
    );
    expect(planLimitEvent).toBeDefined();
    expect((planLimitEvent![0] as CustomEvent).detail.code).toBe('PLAN_LIMIT_EXCEEDED');

    dispatchSpy.mockRestore();
  });

  it('handles network error (no response)', async () => {
    const { canvasClient } = await import('../services/api');

    canvasClient.defaults.adapter = () =>
      Promise.reject({
        message: 'Network Error',
        isAxiosError: true,
        response: undefined,
      });

    try {
      await canvasClient.get('/canvas');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      // Network errors propagate as-is (no response object)
      expect((err as { response?: unknown }).response).toBeUndefined();
      expect((err as { message: string }).message).toBe('Network Error');
    }
  });
});

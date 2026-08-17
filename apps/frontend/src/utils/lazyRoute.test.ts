import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHUNK_RECOVERY_FLAG, clearChunkRecoveryFlag, recoverFromChunkLoadFailure } from './lazyRoute';
import { setUpdateServiceWorker } from './swUpdate';

// Reproduces the live 2026-08-17 /login failure: a stale precached index.html
// points at a chunk hash Cloudflare Pages has dropped, Pages answers the miss
// with index.html at 200/text/html, and import() rejects.
const chunkLoadError = new TypeError('Failed to fetch dynamically imported module: /assets/LoginPage-07-ZNt3B.js');

const reload = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  setUpdateServiceWorker(null);
  // jsdom's location.reload is not implemented; replace it outright.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  setUpdateServiceWorker(null);
  vi.useRealTimers();
});

describe('recoverFromChunkLoadFailure', () => {
  it('activates the waiting worker before reloading', async () => {
    const order: string[] = [];
    const updateSW = vi.fn(async () => {
      order.push('activate');
    });
    reload.mockImplementation(() => order.push('reload'));
    setUpdateServiceWorker(updateSW);

    // Never settles by design (the page navigates away), so race it.
    void recoverFromChunkLoadFailure();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled(), { timeout: 5000 });

    expect(updateSW).toHaveBeenCalledWith(true);
    // Ordering is the fix: reloading first would just re-serve the stale HTML
    // from the still-active worker and break on the same chunk again.
    expect(order).toEqual(['activate', 'reload']);
  });

  it('still reloads when no service worker is registered', async () => {
    void recoverFromChunkLoadFailure();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('marks the attempt so a second failure cannot loop', async () => {
    void recoverFromChunkLoadFailure();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBe('1');
  });
});

describe('lazyRoute factory behaviour', () => {
  // Exercise the promise wiring lazyRoute installs, without React.lazy's
  // Suspense machinery — the branching is what matters here.
  const wrap = <T>(factory: () => Promise<T>) =>
    factory().then(
      (mod) => {
        clearChunkRecoveryFlag();
        return mod;
      },
      (error: unknown) => {
        if (sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1') throw error;
        return recoverFromChunkLoadFailure();
      },
    );

  it('passes a successful import straight through', async () => {
    const mod = { default: 'Page' };
    await expect(wrap(async () => mod)).resolves.toBe(mod);
  });

  it('clears the flag once a chunk loads, re-arming recovery', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
    await wrap(async () => ({ default: 'Page' }));
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBeNull();
  });

  it('recovers on the first chunk-load failure', async () => {
    void wrap(async () => {
      throw chunkLoadError;
    });
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('rethrows the second failure instead of reloading again', async () => {
    sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
    await expect(
      wrap(async () => {
        throw chunkLoadError;
      }),
    ).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(reload).not.toHaveBeenCalled();
  });
});

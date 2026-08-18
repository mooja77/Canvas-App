import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHUNK_RECOVERY_FLAG, clearChunkRecoveryFlag, recoverFromChunkLoadFailure } from './lazyRoute';
import { activateWaitingWorker } from './swUpdate';

// Reproduces the live /login failure: a stale precached index.html points at a
// build whose chunks Cloudflare Pages has purged, Pages answers the miss with
// index.html at 200/text/html, and import() rejects. Note the message names the
// module that was requested, not the transitive dependency that actually failed
// - confirmed in a local two-build reproduction on 2026-08-18.
const chunkLoadError = new TypeError('Failed to fetch dynamically imported module: /assets/LoginPage-CObARbdE.js');

const reload = vi.fn();
let listeners: Record<string, () => void>;
let registration: {
  waiting: { postMessage: ReturnType<typeof vi.fn> } | null;
  update: ReturnType<typeof vi.fn>;
};

function installServiceWorker(options: { waiting: boolean; waitingAfterUpdate?: boolean }) {
  const waiting = options.waiting ? { postMessage: vi.fn() } : null;
  registration = {
    waiting,
    update: vi.fn(async () => {
      if (options.waitingAfterUpdate) registration.waiting = { postMessage: vi.fn() };
    }),
  };
  listeners = {};
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => registration),
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
    },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('activateWaitingWorker', () => {
  it('skips waiting and reports that a new version exists', async () => {
    installServiceWorker({ waiting: true });
    const done = activateWaitingWorker(10_000);

    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    expect(registration.waiting?.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    listeners.controllerchange();
    await expect(done).resolves.toBe(true);
    // Activation must not reload by itself - the caller decides.
    expect(reload).not.toHaveBeenCalled();
  });

  it('forces an update check when no worker is waiting yet', async () => {
    // The chunk rejects within ms of boot, while registerSW is still probing,
    // so `waiting` is routinely still null at this point.
    installServiceWorker({ waiting: false, waitingAfterUpdate: true });
    const done = activateWaitingWorker(10_000);

    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    listeners.controllerchange();
    await expect(done).resolves.toBe(true);
  });

  it('still reports true on timeout - a new version demonstrably exists', async () => {
    installServiceWorker({ waiting: true });
    await expect(activateWaitingWorker(10)).resolves.toBe(true);
  });

  it('reports false when nothing is waiting', async () => {
    installServiceWorker({ waiting: false });
    await expect(activateWaitingWorker(10)).resolves.toBe(false);
  });

  it('reports false when there is no registration at all', async () => {
    installServiceWorker({ waiting: false });
    (navigator.serviceWorker.getRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await expect(activateWaitingWorker(10)).resolves.toBe(false);
  });

  it('reports false when service workers are unavailable', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    await expect(activateWaitingWorker(10)).resolves.toBe(false);
  });
});

describe('recoverFromChunkLoadFailure', () => {
  it('reloads and marks the attempt when a new version exists', async () => {
    installServiceWorker({ waiting: true });
    void recoverFromChunkLoadFailure();
    // Let the new worker take control, rather than sitting out the 10s bound.
    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    listeners.controllerchange();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBe('1');
  });

  it('does NOT reload or spend the guard when there is no new version', async () => {
    // Offline, or any unreachable-chunk cause: reloading cannot conjure the
    // chunk, and the one-shot guard must stay available for a real stale
    // bundle later in this session.
    installServiceWorker({ waiting: false });
    await expect(recoverFromChunkLoadFailure()).rejects.toThrow(/No service-worker update/);
    expect(reload).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBeNull();
  });
});

describe('lazyRoute factory behaviour', () => {
  // Mirrors the promise wiring lazyRoute installs, without React.lazy's
  // Suspense machinery - the branching is what matters here.
  const wrap = <T>(factory: () => Promise<T>) =>
    factory().then(
      (mod) => {
        clearChunkRecoveryFlag();
        return mod;
      },
      (error: unknown) => {
        if (sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1') throw error;
        return recoverFromChunkLoadFailure().catch(() => {
          throw error;
        });
      },
    );

  it('passes a successful import straight through', async () => {
    installServiceWorker({ waiting: false });
    const mod = { default: 'Page' };
    await expect(wrap(async () => mod)).resolves.toBe(mod);
  });

  it('clears the flag once a chunk loads, re-arming recovery', async () => {
    installServiceWorker({ waiting: false });
    sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
    await wrap(async () => ({ default: 'Page' }));
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBeNull();
  });

  it('recovers on the first chunk-load failure when an update is waiting', async () => {
    installServiceWorker({ waiting: true });
    void wrap(async () => {
      throw chunkLoadError;
    });
    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    listeners.controllerchange();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('surfaces the ORIGINAL chunk error when recovery is impossible', async () => {
    installServiceWorker({ waiting: false });
    await expect(
      wrap(async () => {
        throw chunkLoadError;
      }),
    ).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(reload).not.toHaveBeenCalled();
  });

  it('rethrows the second failure instead of reloading again', async () => {
    installServiceWorker({ waiting: false });
    sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
    await expect(
      wrap(async () => {
        throw chunkLoadError;
      }),
    ).rejects.toThrow('Failed to fetch dynamically imported module');
    expect(reload).not.toHaveBeenCalled();
  });
});

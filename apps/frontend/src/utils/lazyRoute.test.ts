import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CHUNK_RECOVERY_FLAG, clearChunkRecoveryFlag, recoverFromChunkLoadFailure } from './lazyRoute';
import { applyServiceWorkerUpdate } from './swUpdate';

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

describe('applyServiceWorkerUpdate', () => {
  it('skips waiting and reloads once the new worker takes control', async () => {
    installServiceWorker({ waiting: true });
    const done = applyServiceWorkerUpdate(10_000);

    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    expect(registration.waiting?.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    // Nothing should have reloaded yet - reloading before the new worker
    // controls the page just re-serves the same stale index.html.
    expect(reload).not.toHaveBeenCalled();

    listeners.controllerchange();
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('forces an update check when no worker is waiting yet', async () => {
    // The chunk rejects within ms of boot, while registerSW is still probing,
    // so `waiting` is routinely still null at this point.
    installServiceWorker({ waiting: false, waitingAfterUpdate: true });
    const done = applyServiceWorkerUpdate(10_000);

    await vi.waitFor(() => expect(registration.update).toHaveBeenCalled());
    await vi.waitFor(() => expect(registration.waiting?.postMessage).toHaveBeenCalled());
    listeners.controllerchange();
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads anyway if the worker never takes control', async () => {
    installServiceWorker({ waiting: true });
    await applyServiceWorkerUpdate(10);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when there is no registration at all', async () => {
    installServiceWorker({ waiting: false });
    (navigator.serviceWorker.getRegistration as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await applyServiceWorkerUpdate(10);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when service workers are unavailable', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    await applyServiceWorkerUpdate(10);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('recoverFromChunkLoadFailure', () => {
  it('marks the attempt so a second failure cannot loop', async () => {
    installServiceWorker({ waiting: false });
    void recoverFromChunkLoadFailure();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(sessionStorage.getItem(CHUNK_RECOVERY_FLAG)).toBe('1');
  });
});

describe('lazyRoute factory behaviour', () => {
  // Exercise the promise wiring lazyRoute installs, without React.lazy's
  // Suspense machinery - the branching is what matters here.
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

  beforeEach(() => installServiceWorker({ waiting: false }));

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

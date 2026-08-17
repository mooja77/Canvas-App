/**
 * A small registry so code outside main.tsx can apply a waiting service-worker
 * update.
 *
 * `registerSW` is called once at boot in main.tsx and returns the function that
 * activates a waiting worker. Route code needs that same function to recover
 * from a stale-bundle chunk-load failure (see `lazyRoute`), and importing
 * main.tsx from a route would pull the whole boot sequence into the chunk — so
 * main.tsx hands the function here instead.
 */

/** Matches the `updateSW` returned by `registerSW` from `virtual:pwa-register`. */
export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorker: UpdateServiceWorker | null = null;

export function setUpdateServiceWorker(fn: UpdateServiceWorker | null): void {
  updateServiceWorker = fn;
}

/** Exposed for tests. */
export function getUpdateServiceWorker(): UpdateServiceWorker | null {
  return updateServiceWorker;
}

/**
 * How long to wait for the waiting worker to take control before reloading
 * anyway. `updateSW(true)` reloads the page itself once the new worker claims
 * the client, so in the normal case this timer never fires.
 */
export const SW_ACTIVATION_TIMEOUT_MS = 3000;

/**
 * Activate a waiting service worker and reload onto the fresh bundle.
 *
 * The ordering is the whole point. Reloading *without* activating leaves the
 * previous worker in control, and it keeps serving the same precached
 * index.html — which references the very chunk hashes that no longer exist.
 * That is why a plain F5 does not fix a stale-bundle failure.
 */
export async function applyServiceWorkerUpdate(timeoutMs: number = SW_ACTIVATION_TIMEOUT_MS): Promise<void> {
  if (updateServiceWorker) {
    try {
      // Deliberately not awaited: updateSW(true) only settles once the new
      // worker takes control, and if none is waiting it may never settle.
      void updateServiceWorker(true);
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    } catch {
      // Fall through to the unconditional reload below.
    }
  }

  // Safety net for every path that did not already navigate away: no worker
  // registered, nothing waiting, or SKIP_WAITING dropped.
  window.location.reload();
}

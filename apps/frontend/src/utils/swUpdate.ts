/**
 * Activate a waiting service worker and reload onto the fresh bundle.
 *
 * Used by `lazyRoute` to recover from a stale-bundle chunk-load failure.
 *
 * Three things make this fiddly. All three were observed failing in a local
 * two-build reproduction before this was written:
 *
 * 1. **The failure beats the update check.** A lazy chunk rejects within a few
 *    hundred ms of boot, while `registerSW` is still probing. Recovery that
 *    assumes `registration.waiting` is populated loses that race.
 * 2. **`update()` resolving does not mean a worker is waiting.** It resolves
 *    once the check completes, while the new worker may still be `installing`.
 *    Reading `waiting` straight afterwards routinely yields null, and recovery
 *    then reloads with nothing activated - which fixes nothing.
 * 3. **Reloading before the new worker controls the page achieves nothing.**
 *    The old worker keeps serving the same precached index.html, so the reload
 *    lands on the same missing chunk. That is why a plain F5 never fixed it.
 */

/** Upper bound on waiting for the new worker to install and claim the page. */
export const SW_ACTIVATION_TIMEOUT_MS = 10_000;

function waitForInstall(worker: ServiceWorker, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const settle = () => {
      if (worker.state === 'installed' || worker.state === 'activated' || worker.state === 'redundant') {
        worker.removeEventListener('statechange', settle);
        resolve();
      }
    };
    worker.addEventListener('statechange', settle);
    setTimeout(resolve, timeoutMs);
    settle();
  });
}

/** Resolve the worker sitting in `waiting`, forcing a check and awaiting install. */
async function findWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (registration.waiting) return registration.waiting;

  await registration.update().catch(() => {});
  if (registration.waiting) return registration.waiting;

  // update() can resolve while the replacement is still installing.
  const installing = registration.installing;
  if (installing) await waitForInstall(installing, timeoutMs);

  return registration.waiting ?? null;
}

/**
 * Activate a waiting worker, if there is one.
 *
 * Returns whether a new version actually existed. That answer is the useful
 * one: if nothing is waiting we are already running the newest bundle, so the
 * missing chunk is unreachable for some other reason (offline, a network
 * blip) and reloading cannot conjure it up. Callers use this to decide between
 * reloading and surfacing the failure.
 *
 * `navigator.onLine` is deliberately NOT used for that decision - it reports
 * whether a network interface exists, not whether the origin is reachable, so
 * it stays `true` for most real-world "offline" cases.
 */
export async function activateWaitingWorker(timeoutMs: number = SW_ACTIVATION_TIMEOUT_MS): Promise<boolean> {
  const container = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (!container) return false;

  try {
    const registration = await container.getRegistration();
    const waiting = registration ? await findWaitingWorker(registration, timeoutMs) : null;
    if (!waiting) return false;

    const controllerChanged = new Promise<void>((resolve) => {
      container.addEventListener('controllerchange', () => resolve(), { once: true });
    });
    const timedOut = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

    waiting.postMessage({ type: 'SKIP_WAITING' });
    await Promise.race([controllerChanged, timedOut]);

    // True even on timeout: a new version demonstrably exists, so reloading is
    // still the right move.
    return true;
  } catch {
    return false;
  }
}

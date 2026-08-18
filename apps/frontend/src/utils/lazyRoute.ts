import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { activateWaitingWorker } from './swUpdate';

/**
 * `React.lazy` that can survive a deploy.
 *
 * ## The failure this exists for
 *
 * The service worker precaches `index.html` but **no JavaScript** (see
 * `globPatterns` in vite.config.ts — html/css/fonts/images only). Route chunks
 * are runtime-cached instead. In `registerType: 'prompt'` mode a newly deployed
 * worker sits in `waiting` until the user clicks Reload or closes every tab, so
 * the *old* worker keeps answering navigations with the *old* precached
 * index.html, which references the previous build's chunk hashes.
 *
 * Cloudflare Pages drops the previous deploy's assets, and — because it is
 * configured as an SPA — answers the miss with `index.html` at **HTTP 200,
 * Content-Type: text/html** rather than a 404. The browser refuses to evaluate
 * HTML as a module and `import()` rejects:
 *
 *     TypeError: Failed to fetch dynamically imported module: /assets/LoginPage-<old>.js
 *
 * Without recovery this is terminal for the route: the ErrorBoundary renders,
 * and reloading serves the same stale HTML, so the user is stuck. It was
 * observed live on /login on 2026-08-17.
 *
 * ## The recovery
 *
 * Treat a failed chunk import as evidence that our HTML is stale: activate the
 * waiting worker and reload onto the fresh bundle. One attempt per tab session,
 * so a genuinely missing chunk or an offline user cannot cause a reload loop —
 * the second failure is rethrown and the ErrorBoundary handles it as before.
 * The flag is cleared as soon as any chunk loads successfully.
 */

export const CHUNK_RECOVERY_FLAG = 'qc-chunk-recovery-attempted';

/** Thrown when there is no newer bundle to recover onto. */
export class ChunkRecoveryUnavailableError extends Error {
  constructor() {
    super('No service-worker update available to recover onto');
    this.name = 'ChunkRecoveryUnavailableError';
  }
}

function hasAttemptedRecovery(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RECOVERY_FLAG) === '1';
  } catch {
    // Private mode / blocked storage: without a durable flag we cannot rule out
    // a reload loop, so decline to recover rather than risk one.
    return true;
  }
}

function markRecoveryAttempted(): void {
  try {
    sessionStorage.setItem(CHUNK_RECOVERY_FLAG, '1');
  } catch {
    // Ignored — hasAttemptedRecovery() already fails closed.
  }
}

export function clearChunkRecoveryFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RECOVERY_FLAG);
  } catch {
    // Ignored.
  }
}

/**
 * Visible for testing. Returns only if recovery is impossible - when it is
 * possible the page navigates away and this never settles.
 */
export async function recoverFromChunkLoadFailure(): Promise<never> {
  // Only spend a reload (and the one-shot guard) when a new version actually
  // exists. If nothing is waiting we are already on the newest bundle, so the
  // chunk is unreachable for another reason and reloading would just cost the
  // user a flash of skeleton before failing again.
  const newVersionExists = await activateWaitingWorker();
  if (!newVersionExists) throw new ChunkRecoveryUnavailableError();

  markRecoveryAttempted();
  window.location.reload();
  return new Promise<never>(() => {});
}

// Mirrors React.lazy's own signature so call sites keep their prop types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoute<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().then(
      (mod) => {
        // A chunk loaded, so whatever went wrong is behind us. Re-arm recovery
        // for any later route in this session.
        clearChunkRecoveryFlag();
        return mod;
      },
      (error: unknown) => {
        if (hasAttemptedRecovery()) throw error;
        // Surface the original chunk error, not the sentinel, so the boundary
        // and Sentry see the real failure.
        return recoverFromChunkLoadFailure().catch(() => {
          throw error;
        });
      },
    ),
  );
}

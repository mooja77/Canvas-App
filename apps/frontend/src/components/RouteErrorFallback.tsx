import { useEffect, useState } from 'react';

/**
 * Shown when a route fails to render — in practice almost always a lazy chunk
 * that could not be fetched.
 *
 * Two distinct causes, which need different words and different actions:
 *
 * - **Offline, route never opened before.** Its chunk was never runtime-cached,
 *   and nothing local can produce it. Reloading will not help until the network
 *   is back. (Routes the user *has* visited do work offline.)
 * - **Online.** Almost always a stale bundle: a deploy has happened, the old
 *   service worker is still serving the previous index.html, and the chunk
 *   hashes it references have been purged. `lazyRoute` tries to recover from
 *   this automatically; reaching this fallback means that already failed, so a
 *   manual reload is the remaining move.
 *
 * Either way the raw "Failed to fetch dynamically imported module" is not
 * something to put in front of a researcher.
 */
export default function RouteErrorFallback() {
  const [offline, setOffline] = useState(() => navigator.onLine === false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {offline ? "This page isn't available offline" : "This page didn't load"}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {offline
          ? "You're offline, and this page hasn't been opened on this device yet. Pages you have already visited still work — reconnect to open this one."
          : 'QualCanvas was probably updated while this tab was open. Reloading will pick up the new version.'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {offline ? 'Try again' : 'Reload'}
      </button>
    </div>
  );
}

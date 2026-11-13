/**
 * Two HTML shells, chosen by route.
 *
 *  - index.html     : marketing shell. Carries the consent loader
 *                     (/cookie-consent.js) that can start Google Tag Manager
 *                     and Plausible after the visitor accepts.
 *  - app-shell.html : signed-in app shell. Contains no advertising or marketing
 *                     loader at all (see public/cookie-consent-app.js).
 *
 * A route that can display research data or account data must be served by the
 * app shell. The same pattern list is mirrored in public/_worker.js (production
 * routing, plain JS, cannot import this file); a unit test keeps them equal.
 */
export const APP_ROUTE_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\/account\/?$/,
  /^\/admin\/?$/,
  /^\/canvas(?:\/[^/]+)?\/?$/,
  /^\/forgot-password\/?$/,
  /^\/repository\/?$/,
  /^\/reset-password\/?$/,
  /^\/team\/?$/,
  /^\/verify-email\/?$/,
]);

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export type ShellKind = 'app' | 'marketing';

export function currentShell(doc: Document = document): ShellKind {
  return doc.documentElement.dataset.shell === 'app' ? 'app' : 'marketing';
}

const RELOAD_KEY = 'qc-shell-reload';

/**
 * Client-side navigation cannot swap shells, so an in-page jump from a marketing
 * route to an app route (or back) would keep the wrong shell, and with it the
 * wrong set of scripts, in the document. Returns the URL to hard-load when the
 * shell for `pathname` differs from the one loaded, else null. A one-per-5s
 * sessionStorage breaker stops a reload loop if a server ever disagrees with
 * isAppRoute.
 */
export function shellMismatchTarget(
  pathname: string,
  search: string,
  hash: string,
  doc: Document = document,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  now: number = Date.now(),
): string | null {
  const wanted: ShellKind = isAppRoute(pathname) ? 'app' : 'marketing';
  if (wanted === currentShell(doc)) return null;
  try {
    const last = Number(storage?.getItem(RELOAD_KEY) ?? 0);
    if (now - last < 5000) return null;
    storage?.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: allow the single reload.
  }
  return `${pathname}${search}${hash}`;
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

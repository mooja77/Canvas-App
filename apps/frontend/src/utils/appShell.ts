/**
 * Three HTML shells, chosen by route.
 *
 *  - index.html     : marketing shell. Carries the consent loader
 *                     (/cookie-consent.js) that can start Google Tag Manager
 *                     and Plausible after the visitor accepts.
 *  - app-shell.html : research shell (canvas, repository, team, admin, token
 *                     pages). No advertising/marketing loader and no support
 *                     chat widget.
 *  - support-shell.html : account and /support screens. Same as the app shell
 *                     plus the JMS support chat widget.
 *
 * A route that can display research data or account data must be served by the
 * app shell. The same pattern list is mirrored in public/_worker.js (production
 * routing, plain JS, cannot import this file); a unit test keeps them equal.
 */
/**
 * Research routes: can render interview, transcript, coding or account-token
 * content. Served by app-shell.html, which has no marketing loader AND no
 * support-chat widget.
 */
export const RESEARCH_ROUTE_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\/admin\/?$/,
  /^\/canvas(?:\/[^/]+)?\/?$/,
  /^\/forgot-password\/?$/,
  /^\/repository\/?$/,
  /^\/reset-password\/?$/,
  /^\/team\/?$/,
  /^\/verify-email\/?$/,
]);

/**
 * Support routes: account, billing and settings (/account) and the help screen
 * (/support). Served by support-shell.html, the only shell that loads the JMS
 * support chat widget. These screens never render transcripts or coding.
 */
export const SUPPORT_ROUTE_PATTERNS: readonly RegExp[] = Object.freeze([/^\/account\/?$/, /^\/support\/?$/]);

/** Every route served by a non-marketing shell (research first, then support). */
export const APP_ROUTE_PATTERNS: readonly RegExp[] = Object.freeze([
  ...RESEARCH_ROUTE_PATTERNS,
  ...SUPPORT_ROUTE_PATTERNS,
]);

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export type ShellKind = 'app' | 'support' | 'marketing';

export function shellForRoute(pathname: string): ShellKind {
  if (SUPPORT_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname))) return 'support';
  return isAppRoute(pathname) ? 'app' : 'marketing';
}

/** HTML file (relative to the site root, no extension) that serves a shell. */
export const SHELL_FILES: Record<Exclude<ShellKind, 'marketing'>, string> = {
  app: 'app-shell',
  support: 'support-shell',
};

export function currentShell(doc: Document = document): ShellKind {
  const value = doc.documentElement.dataset.shell;
  return value === 'app' || value === 'support' ? value : 'marketing';
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
  const wanted: ShellKind = shellForRoute(pathname);
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

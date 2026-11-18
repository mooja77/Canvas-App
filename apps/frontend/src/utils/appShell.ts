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

const RELOAD_KEY = 'qc-shell-reload-v2';
const RELOAD_WINDOW_MS = 5_000;
const MAX_RECENT_TARGETS = 16;

/**
 * Client-side navigation cannot swap shells, so an in-page jump from a marketing
 * route to an app route (or back) would keep the wrong shell, and with it the
 * wrong set of scripts, in the document. Returns the URL to hard-load when the
 * shell for `pathname` differs from the one loaded, else null. Only the same
 * crossing may be suppressed while a recent automatic attempt is pending.
 * The stored fingerprint never contains the raw path, token or fragment.
 */
export async function shellMismatchTarget(
  pathname: string,
  search: string,
  hash: string,
  doc: Document = document,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  now: number = Date.now(),
  signal?: AbortSignal,
): Promise<string | null> {
  const wanted: ShellKind = shellForRoute(pathname);
  const loaded = currentShell(doc);
  if (wanted === loaded || !storage || signal?.aborted) return null;
  const target = `${pathname}${search}${hash}`;
  try {
    const input = new TextEncoder().encode(JSON.stringify([loaded, wanted, target]));
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
    if (signal?.aborted) return null;
    const key = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const recent = Object.entries(JSON.parse(storage.getItem(RELOAD_KEY) ?? '{}')).filter(
      ([id, at]) => /^[0-9a-f]{64}$/.test(id) && typeof at === 'number' && at <= now && now - at < RELOAD_WINDOW_MS,
    );
    if (recent.some(([id]) => id === key)) return null;
    storage.setItem(
      RELOAD_KEY,
      JSON.stringify(Object.fromEntries([...recent.slice(1 - MAX_RECENT_TARGETS), [key, now]])),
    );
    return target;
  } catch {
    // If we cannot stop a loop, the boundary still blocks the route and lets
    // the visitor try a full document reload themselves.
    return null;
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

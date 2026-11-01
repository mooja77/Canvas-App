/**
 * Hand-off between the build-time prerendered page (#marketing-root, written
 * by scripts/prerender-marketing.mjs) and the React page that replaces it.
 */

const ROOT_ID = 'marketing-root';
const STYLES_ID = 'prerender-styles';
const APP_ROOT_ID = 'root';
// If the React page never mounts (chunk error, a route without PageShell), do
// not leave a dead copy of the page on screen.
const FALLBACK_REMOVE_MS = 10000;

function normalise(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Remove the prerendered block and its inline styles. Safe to call twice. */
export function removePrerender(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLES_ID)?.remove();
  // Shown in the same task the prerendered copy is removed, so no frame ever
  // has both, and #root never moves (see removeStalePrerender).
  document.getElementById(APP_ROOT_ID)?.style.removeProperty('display');
}

/**
 * Called once at startup. Keeps the block only when it is this route's own
 * prerender; otherwise removes it straight away (the old behaviour).
 */
export function removeStalePrerender(): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  const path = root.getAttribute('data-prerendered-path');
  if (path && normalise(path) === normalise(window.location.pathname)) {
    root.setAttribute('inert', '');
    // Keep React's #root out of layout until the swap. If it rendered (route
    // skeleton) below the prerendered page, removing that page would move
    // #root up by a whole page: Lighthouse measured CLS 1.0 for exactly that.
    document.getElementById(APP_ROOT_ID)?.style.setProperty('display', 'none');
    window.setTimeout(removePrerender, FALLBACK_REMOVE_MS);
    return;
  }
  removePrerender();
}

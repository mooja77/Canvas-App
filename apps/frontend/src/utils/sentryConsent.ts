// Consent gate for browser Sentry (error reports and traces; this app has no
// session replay).
//
// Rule: "Reject" switches Sentry off for EVERYONE, signed in or not. Nothing
// here looks at who is signed in; the only input is the stored cookie choice
// plus the live events from /cookie-consent.js, so a choice changed while the
// page is open takes effect straight away: Accept starts Sentry, Reject or
// Withdraw stops it.

export const CONSENT_STORAGE_KEY = 'jms_cookie_consent';
export const CONSENT_ACCEPTED_EVENT = 'qualcanvas:consent-accepted';
export const CONSENT_REJECTED_EVENT = 'qualcanvas:consent-rejected';

export interface SentryConsentControls {
  /** Start error reporting and replay. Must be safe to call when stopped. */
  start(): void;
  /** Stop replay, close the client. Must be safe to call when stopped. */
  stop(): void;
}

export function readStoredConsent(win: Window = window): string | null {
  try {
    return win.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Starts Sentry only when consent is "accepted" (now, or later in the visit),
 * and stops it whenever consent is rejected or withdrawn. Returns an unbind.
 */
export function bindSentryConsent(controls: SentryConsentControls, win: Window = window): () => void {
  let running = false;
  const start = () => {
    if (running) return;
    running = true;
    controls.start();
  };
  const stop = () => {
    if (!running) return;
    running = false;
    controls.stop();
  };
  const sync = () => (readStoredConsent(win) === 'accepted' ? start() : stop());

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONSENT_STORAGE_KEY) sync();
  };

  if (readStoredConsent(win) === 'accepted') start();
  win.addEventListener(CONSENT_ACCEPTED_EVENT, start);
  win.addEventListener(CONSENT_REJECTED_EVENT, stop);
  // A choice made in another tab of the same browser.
  win.addEventListener('storage', onStorage);

  return () => {
    win.removeEventListener(CONSENT_ACCEPTED_EVENT, start);
    win.removeEventListener(CONSENT_REJECTED_EVENT, stop);
    win.removeEventListener('storage', onStorage);
  };
}

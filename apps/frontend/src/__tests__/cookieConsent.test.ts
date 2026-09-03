import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `public/cookie-consent.js` is a classic IIFE shipped verbatim (no bundler),
 * so it is loaded here from disk and evaluated against jsdom. `window` is
 * shadowed with a Proxy only so that `window.location.reload` can be observed
 * - jsdom's Location is unforgeable and cannot be spied on directly.
 */
const SCRIPT = readFileSync(resolve(process.cwd(), 'public/cookie-consent.js'), 'utf8');
const CONSENT_KEY = 'jms_cookie_consent';

// The script registers a window listener each time it is evaluated. Every
// evaluation routes reload() through this one variable so the listener that
// happens to build the banner always reports to the current test.
let reloadSpy = vi.fn();

function loadScript() {
  const realWindow = window;
  const fakeLocation = {
    pathname: '/',
    reload: () => reloadSpy(),
  };
  const windowProxy = new Proxy(realWindow, {
    get(target, prop) {
      if (prop === 'location') return fakeLocation;
      // The shared vitest setup installs a non-constructible ResizeObserver
      // stub; the script treats a missing one as "not supported".
      if (prop === 'ResizeObserver') return undefined;
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  });
  new Function('window', SCRIPT)(windowProxy);
}

function openPreferences() {
  window.dispatchEvent(new Event('qualcanvas:open-cookie-preferences'));
}

function banner(): HTMLElement | null {
  return document.getElementById('cookie-consent-banner');
}

function clickReject() {
  const button = document.getElementById('cc-reject');
  if (!button) throw new Error('reject button not rendered');
  button.click();
}

describe('cookie-consent.js reject after accept', () => {
  beforeEach(() => {
    reloadSpy = vi.fn();
    localStorage.clear();
    document.body.innerHTML = '';
    document.body.className = '';
    document.getElementById('google-tag-manager')?.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('reloads once when the rejection is persisted (GTM is already running)', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    loadScript();
    openPreferences();
    expect(banner()).not.toBeNull();

    clickReject();

    expect(localStorage.getItem(CONSENT_KEY)).toBe('rejected');
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(banner()).toBeNull();
  });

  // L6: if the write throws, storage still says 'accepted'. A reload would
  // re-inject GTM from that stored choice with no banner to tell the user
  // their withdrawal did not stick.
  it('does not reload and keeps the banner when the rejection could not be stored', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    loadScript();
    openPreferences();
    expect(banner()).not.toBeNull();

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    clickReject();

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(banner()).not.toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBe('accepted');
    // The in-page choice is still honoured: Consent Mode is told to deny.
    const updates = (window as unknown as { dataLayer: IArguments[] }).dataLayer.filter(
      (entry) => entry[0] === 'consent' && entry[1] === 'update',
    );
    expect(updates.at(-1)?.[2]).toMatchObject({ analytics_storage: 'denied' });
  });

  it('keeps a first-time rejection instantaneous even when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    loadScript();
    expect(banner()).not.toBeNull();

    clickReject();

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(banner()).toBeNull();
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENT_ACCEPTED_EVENT,
  CONSENT_REJECTED_EVENT,
  CONSENT_STORAGE_KEY,
  bindSentryConsent,
} from './sentryConsent';

const controls = () => ({ start: vi.fn(), stop: vi.fn() });

describe('Sentry consent gate', () => {
  let unbind: (() => void) | undefined;

  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    unbind?.();
    unbind = undefined;
  });

  it('does not start for an undecided visitor', () => {
    const c = controls();
    unbind = bindSentryConsent(c);
    expect(c.start).not.toHaveBeenCalled();
  });

  it('does not start after Reject (the gate has no signed-in exception)', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'rejected');
    const c = controls();
    unbind = bindSentryConsent(c);
    expect(c.start).not.toHaveBeenCalled();
  });

  it('starts at load for a stored Accept', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    const c = controls();
    unbind = bindSentryConsent(c);
    expect(c.start).toHaveBeenCalledTimes(1);
  });

  it('starts once when Accept happens during the visit', () => {
    const c = controls();
    unbind = bindSentryConsent(c);
    window.dispatchEvent(new Event(CONSENT_ACCEPTED_EVENT));
    window.dispatchEvent(new Event(CONSENT_ACCEPTED_EVENT));
    expect(c.start).toHaveBeenCalledTimes(1);
  });

  it('stops at once when consent is rejected after being accepted, and can restart', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    const c = controls();
    unbind = bindSentryConsent(c);
    window.dispatchEvent(new Event(CONSENT_REJECTED_EVENT));
    window.dispatchEvent(new Event(CONSENT_REJECTED_EVENT));
    expect(c.stop).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event(CONSENT_ACCEPTED_EVENT));
    expect(c.start).toHaveBeenCalledTimes(2);
  });

  it('follows a choice changed in another tab', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    const c = controls();
    unbind = bindSentryConsent(c);
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'rejected');
    window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_STORAGE_KEY }));
    expect(c.stop).toHaveBeenCalledTimes(1);
  });

  it('stops listening after unbind', () => {
    const c = controls();
    bindSentryConsent(c)();
    window.dispatchEvent(new Event(CONSENT_ACCEPTED_EVENT));
    expect(c.start).not.toHaveBeenCalled();
  });
});

describe('/cookie-consent.js drives the gate', () => {
  const script = readFileSync(path.join(process.cwd(), 'public', 'cookie-consent.js'), 'utf8');
  let unbind: (() => void) | undefined;

  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  });
  afterEach(() => {
    unbind?.();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('Reject after Accept stops Sentry in the same visit, even if the page stays', () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
    const c = controls();
    unbind = bindSentryConsent(c);
    expect(c.start).toHaveBeenCalledTimes(1);
    new Function(script)();
    window.dispatchEvent(new Event('qualcanvas:open-cookie-preferences'));
    (document.getElementById('cc-reject') as HTMLButtonElement).click();
    expect(c.stop).toHaveBeenCalledTimes(1);
  });

  it('Reject on a fresh visit never starts Sentry', () => {
    const c = controls();
    unbind = bindSentryConsent(c);
    new Function(script)();
    (document.getElementById('cc-reject') as HTMLButtonElement).click();
    expect(c.start).not.toHaveBeenCalled();
  });
});

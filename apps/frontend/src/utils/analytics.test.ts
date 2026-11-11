import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  beforeEach(() => {
    window.localStorage.setItem('jms_cookie_consent', 'accepted');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.removeItem('jms_cookie_consent');
  });

  it('sends nothing before a choice or after Reject', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    window.localStorage.removeItem('jms_cookie_consent');
    trackEvent('first_transcript_uploaded');
    window.localStorage.setItem('jms_cookie_consent', 'rejected');
    trackEvent('first_transcript_uploaded');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the backend event request alive through immediate navigation', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    trackEvent('first_transcript_uploaded');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/events/track',
      expect.objectContaining({ method: 'POST', keepalive: true }),
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from './analytics';

describe('trackEvent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

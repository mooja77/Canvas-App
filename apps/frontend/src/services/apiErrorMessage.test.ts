import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from './api';

describe('apiErrorMessage (qualcanvas-10)', () => {
  it('prefers plain server error messages', () => {
    expect(
      apiErrorMessage({ response: { status: 400, data: { error: 'Transcript title is required.' } } }, 'Fallback'),
    ).toBe('Transcript title is required.');
  });

  it('translates HTTP 500 without leaking raw Axios status text', () => {
    const msg = apiErrorMessage(
      { response: { status: 500, data: {} }, message: 'Request failed with status code 500' },
      'Fallback',
    );
    expect(msg).not.toMatch(/status code 500/i);
    expect(msg).toMatch(/something went wrong on our side/i);
  });

  it('explains network and offline failures in plain words', () => {
    const msg = apiErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' }, 'Fallback');
    expect(msg).toMatch(/no internet connection/i);
    expect(msg).toMatch(/not saved/i);
  });

  it('explains rate limits, oversized uploads, and timeouts', () => {
    expect(apiErrorMessage({ response: { status: 429, data: {} } }, 'Fallback')).toMatch(/too many requests/i);
    expect(apiErrorMessage({ response: { status: 413, data: {} } }, 'Fallback')).toMatch(/too large/i);
    expect(apiErrorMessage({ code: 'ECONNABORTED' }, 'Fallback')).toMatch(/timed out/i);
  });

  it('falls back cleanly for unknown errors', () => {
    expect(apiErrorMessage(new Error('unexpected'), 'Could not save your note.')).toBe('Could not save your note.');
  });
});

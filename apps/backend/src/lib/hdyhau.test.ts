import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { forwardHdyhau, isHdyhauChannel, HDYHAU_CHANNELS } from './hdyhau.js';

// Exercises the real trackJmsEvent with fetch mocked, so the assertion is on
// the exact bytes the Command Centre ingest receives.
describe('forwardHdyhau payload', () => {
  const fetchMock = vi.fn();
  const originalKey = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    process.env.ADMIN_API_KEY = 'test-admin-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = originalKey;
  });

  function sentBody() {
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://admin.jmsdevlab.com/api/events/ingest');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers['x-admin-key']).toBe('test-admin-key');
    return JSON.parse(init.body);
  }

  it('sends the contract shape for a real researcher', async () => {
    await forwardHdyhau('maria.rossi@unibo.it', 'trade_group');
    expect(sentBody()).toEqual({
      app_id: 'qualcanvas',
      events: [
        {
          name: 'hdyhau',
          email: 'maria.rossi@unibo.it',
          properties: { channel: 'trade_group', is_test: false },
        },
      ],
    });
  });

  it('marks fixture accounts is_test using the app predicate', async () => {
    await forwardHdyhau('jamie.test@example.com', 'google');
    expect(sentBody().events[0].properties).toEqual({ channel: 'google', is_test: true });
  });

  it('includes free_text only for "other"', async () => {
    await forwardHdyhau('a.researcher@ucc.ie', 'other', 'A methods seminar');
    expect(sentBody().events[0].properties).toEqual({
      channel: 'other',
      free_text: 'A methods seminar',
      is_test: false,
    });
  });

  it('is a silent no-op when ADMIN_API_KEY is unset', async () => {
    delete process.env.ADMIN_API_KEY;
    await forwardHdyhau('a.researcher@ucc.ie', 'social');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when the ingest fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(forwardHdyhau('a.researcher@ucc.ie', 'social')).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('HDYHAU channel whitelist', () => {
  it('is the canonical list without the Shopify key', () => {
    expect([...HDYHAU_CHANNELS]).toEqual(['ai_assistant', 'google', 'word_of_mouth', 'trade_group', 'social', 'other']);
    expect(isHdyhauChannel('shopify_app_store')).toBe(false);
    expect(isHdyhauChannel('Google search')).toBe(false);
    expect(isHdyhauChannel('google')).toBe(true);
  });
});

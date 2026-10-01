import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackActivationEvent } from './jms-events.js';

describe('trackActivationEvent', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.ADMIN_API_KEY = 'ingest-key';
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ADMIN_API_KEY;
  });

  it('forwards a real researcher’s milestone with the address the Command Centre filters on', async () => {
    await trackActivationEvent('first_value_reached', 'dr.aoife@ucc.ie', { canvas_id: 'c1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      app_id: 'qualcanvas',
      events: [{ name: 'first_value_reached', email: 'dr.aoife@ucc.ie', properties: { canvas_id: 'c1' } }],
    });
  });

  it.each(['activation-journey-1@example.com', 'mooja77@gmail.com', 'qa.tester@ucc.ie', null])(
    'drops test, internal and address-less accounts (%s) before anything leaves the server',
    async (email) => {
      await trackActivationEvent('sign_up', email, { method: 'email' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

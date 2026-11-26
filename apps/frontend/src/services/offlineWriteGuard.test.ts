import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canvasClient, apiErrorMessage } from './api';

describe('offline write guard (qualcanvas-13)', () => {
  let originalOnLine: boolean;
  const originalAdapter = canvasClient.defaults.adapter;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
    canvasClient.defaults.adapter = originalAdapter;
  });

  it('rejects write requests immediately with an honest offline message without hitting the network', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const adapter = vi.fn();
    canvasClient.defaults.adapter = adapter;

    await expect(canvasClient.post('/canvas/c1/memos', { content: 'note' })).rejects.toMatchObject({
      code: 'ERR_NETWORK',
      response: {
        data: {
          error: 'You are offline. Changes are not saved until you reconnect.',
        },
      },
    });
    expect(adapter).not.toHaveBeenCalled();

    try {
      await canvasClient.delete('/canvas/c1/memos/m1');
    } catch (err) {
      expect(apiErrorMessage(err, 'Fallback')).toBe('You are offline. Changes are not saved until you reconnect.');
    }
    expect(adapter).not.toHaveBeenCalled();
  });

  it('still allows GET requests to reach the adapter when offline (e.g. cache/service worker)', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    });
    const adapter = vi.fn().mockResolvedValue({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });
    canvasClient.defaults.adapter = adapter;

    const res = await canvasClient.get('/canvas');
    expect(res.status).toBe(200);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});

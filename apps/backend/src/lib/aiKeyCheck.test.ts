import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomBytes } from 'crypto';
import { checkProviderKey, friendlyProviderError } from './aiKeyCheck.js';

const key = () => `sk-test-${randomBytes(8).toString('hex')}`;

function stubFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('checkProviderKey — validating a customer key with a free call', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('OpenAI: lists models with the key as a bearer token (no tokens spent)', async () => {
    const k = key();
    const f = stubFetch(async () => new Response('{"data":[]}', { status: 200 }));
    expect(await checkProviderKey('openai', `  ${k}  `)).toEqual({ ok: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${k}`);
  });

  it('a rejected key says to re-copy it', async () => {
    stubFetch(async () => new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 }));
    const r = await checkProviderKey('openai', key());
    expect(r).toMatchObject({ ok: false, code: 'INVALID_KEY' });
    expect(!r.ok && r.message).toMatch(/did not accept this key/);
  });

  it('no credit points at the billing page', async () => {
    stubFetch(async () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }));
    const r = await checkProviderKey('openai', key());
    expect(r).toMatchObject({ ok: false, code: 'NO_CREDIT' });
    expect(!r.ok && r.message).toContain('platform.openai.com');
  });

  it('a restricted key is explained', async () => {
    stubFetch(async () => new Response('{}', { status: 403 }));
    expect(await checkProviderKey('openai', key())).toMatchObject({ ok: false, code: 'NO_PERMISSION' });
  });

  it('a network failure says nothing was saved', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const r = await checkProviderKey('anthropic', key());
    expect(r).toMatchObject({ ok: false, code: 'UNREACHABLE' });
    expect(!r.ok && r.message).toMatch(/Nothing was saved/);
  });

  it('Anthropic and Google send the key in a header, never the URL', async () => {
    const k = key();
    const f = stubFetch(async () => new Response('{}', { status: 200 }));
    await checkProviderKey('anthropic', k);
    await checkProviderKey('google', k);
    expect(f.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/models');
    expect((f.mock.calls[0][1].headers as Record<string, string>)['x-api-key']).toBe(k);
    expect(f.mock.calls[1][0]).not.toContain(k);
    expect((f.mock.calls[1][1].headers as Record<string, string>)['x-goog-api-key']).toBe(k);
  });

  it('friendlyProviderError turns a quota error on a real call into a next step', () => {
    expect(friendlyProviderError('openai', { status: 429, code: 'insufficient_quota', message: '429 quota' })).toMatch(
      /no credit left/,
    );
    expect(friendlyProviderError('openai', { status: 400, message: '400 Audio file could not be decoded' })).toMatch(
      /could not be decoded/,
    );
  });
});

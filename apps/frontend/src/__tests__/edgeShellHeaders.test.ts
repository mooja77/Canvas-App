import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Cloudflare Pages' plain-JS worker does not ship declarations.
import worker from '../../public/_worker.js';

const source = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8').replace(/\r\n/g, '\n');
const policy = (path: string) => {
  const lines = source.split('\n');
  const start = lines.indexOf(path);
  if (start < 0) throw Error('Missing header rule: ' + path);
  for (const line of lines.slice(start + 1)) {
    if (!/^\s/.test(line)) break;
    if (line.trim().startsWith('Content-Security-Policy: '))
      return line.trim().slice('Content-Security-Policy: '.length);
  }
  throw Error('Missing CSP: ' + path);
};
const broad = policy('/*');
const research = policy('/canvas*');
const support = policy('/support*');

describe('effective CSP on the response returned by the Pages worker', () => {
  it.each([
    ['/repository', research],
    ['/canvas/synthetic', research],
    ['/reset-password', research],
    ['/app-shell', research],
    ['/account', support],
    ['/support', support],
    ['/support-shell', support],
    ['/', broad],
    ['/vs/example', broad],
  ])('%s returns the right policy even if the ASSETS rewrite inherits the global rule', async (path, expected) => {
    const env = {
      ASSETS: {
        async fetch(req: Request) {
          const asset = new URL(req.url).pathname;
          const found = ['/', '/app-shell', '/support-shell'].includes(asset);
          return new Response(found ? 'synthetic shell' : 'missing', {
            status: found ? 200 : 404,
            headers: { 'Content-Security-Policy': broad, 'X-Asset-Marker': 'preserved' },
          });
        },
      },
    };
    const r = await worker.fetch(new Request('https://example.test' + path), env);
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Security-Policy')).toBe(expected);
    expect(r.headers.get('X-Asset-Marker')).toBe('preserved');
    expect(await r.text()).toBe('synthetic shell');
  });
});

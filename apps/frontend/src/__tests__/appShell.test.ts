import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTE_PATTERNS, isAppRoute, shellMismatchTarget } from '../utils/appShell';

/**
 * The signed-in app must never load an advertising or marketing tag, and must
 * never send an ad-consent signal. This is enforced structurally: app routes are
 * served a different HTML shell (app-shell.html) that has no loader in it. These
 * tests drive the real production router (public/_worker.js) and inspect the
 * document it would serve for each route.
 */
const ROOT = process.cwd(); // apps/frontend (vitest cwd)
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

// Everything that can start an advertising/marketing/analytics request, or
// signal ad consent. Matched case-insensitively against whole documents.
const FORBIDDEN = [
  /googletagmanager/i,
  /GTM-[A-Z0-9]+/,
  /gtag/i,
  /dataLayer/i,
  /\bfbq\b/,
  /connect\.facebook/i,
  /doubleclick/i,
  /googleads/i,
  /google-analytics/i,
  /plausible/i,
  /ad_storage/i,
  /ad_user_data/i,
  /ad_personalization/i,
  /jms-analytics-container/i,
  /\/cookie-consent\.js/i, // the marketing loader (note: cookie-consent-app.js is a different file)
];

const APP_PATHS = [
  '/canvas',
  '/canvas/cm123abc',
  '/account',
  '/team',
  '/repository',
  '/admin',
  '/reset-password',
  '/verify-email',
  '/forgot-password',
];
// Client routes the worker serves from the marketing shell. (/pricing, /login and
// the other public pages are prerendered static files copied from index.html.)
const MARKETING_SPA_PATHS = ['/', '/vs/atlas-ti'];
const MARKETING_PATHS = ['/', '/pricing', '/login', '/cookies', '/methodology', '/vs/atlas-ti'];

async function servedDocument(pathname: string): Promise<string> {
  // @ts-expect-error plain-JS Pages worker has no type declarations
  const worker = (await import('../../public/_worker.js')) as unknown as {
    default: { fetch(request: Request, env: unknown): Promise<Response> };
  };
  const files: Record<string, string> = { '/': 'index.html', '/app-shell': 'app-shell.html' };
  const env = {
    ASSETS: {
      async fetch(request: Request) {
        const file = files[new URL(request.url).pathname];
        if (!file || !existsSync(resolve(ROOT, file))) return new Response('not found', { status: 404 });
        return new Response(read(file), { status: 200 });
      },
    },
  };
  const response = await worker.default.fetch(new Request(`https://qualcanvas.com${pathname}`), env);
  expect(response.status, `${pathname} status`).toBe(200);
  return response.text();
}

describe('signed-in app shell carries no advertising or marketing loader', () => {
  it.each(APP_PATHS)('the document served for %s contains no ads/marketing tag or ad-consent signal', async (path) => {
    const served = await servedDocument(path);
    // Comments load nothing; the shell's header comment names what is absent.
    const html = served.replace(/<!--[\s\S]*?-->/g, '');
    for (const pattern of FORBIDDEN) {
      expect(html, `${path} must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(html).toContain('data-shell="app"');
  });

  it('the app banner script has no tag-loading or consent-signal code', () => {
    const js = read('public/cookie-consent-app.js');
    // Strip comments: the header comment names what is absent.
    const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const pattern of FORBIDDEN) {
      expect(code, `cookie-consent-app.js must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(code).not.toMatch(/createElement\(['"]script['"]\)/);
  });

  it('the app shell references only the banner script and the shared bundle entry', () => {
    const html = read('app-shell.html').replace(/<!--[\s\S]*?-->/g, '');
    const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.sort()).toEqual(['/cookie-consent-app.js', '/src/main.tsx']);
  });

  it('marketing routes still get the consent-gated loader (marketing tags stay on public pages)', async () => {
    for (const path of MARKETING_SPA_PATHS) {
      const html = await servedDocument(path);
      expect(html, path).toContain('data-shell="marketing"');
      expect(html, path).toContain('/cookie-consent.js');
    }
    expect(read('public/cookie-consent.js')).toContain('googletagmanager.com/gtm.js');
  });

  it('the app routes carry a CSP with no advertising/marketing hosts', () => {
    const headers = read('public/_headers');
    const blocks = headers.split(/\r?\n/).reduce<Record<string, string>>((acc, line, i, lines) => {
      if (/^\/\S+\*$/.test(line.trim()) && lines[i + 1]?.includes('Content-Security-Policy')) {
        acc[line.trim()] = lines[i + 1];
      }
      return acc;
    }, {});
    expect(Object.keys(blocks).sort()).toEqual(
      [
        '/account*',
        '/admin*',
        '/canvas*',
        '/forgot-password*',
        '/repository*',
        '/reset-password*',
        '/team*',
        '/verify-email*',
      ].sort(),
    );
    for (const [route, policy] of Object.entries(blocks)) {
      for (const host of [
        'googletagmanager',
        'doubleclick',
        'facebook',
        'plausible',
        'google-analytics',
        'analytics.google',
        'google.com',
        'google.ie',
        'accounts.google',
      ]) {
        expect(policy, `${route} CSP must not allow ${host}`).not.toContain(host);
      }
      expect(policy).toContain("default-src 'self'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain('wss://api.qualcanvas.com');
    }
  });
});

describe('route classification stays in step across the app, the worker and the loader', () => {
  it('classifies app and marketing paths', () => {
    for (const p of APP_PATHS) expect(isAppRoute(p), p).toBe(true);
    for (const p of MARKETING_PATHS) expect(isAppRoute(p), p).toBe(false);
    expect(isAppRoute('/canvas/a/b')).toBe(false);
  });

  it('public/_worker.js lists exactly the same app route patterns', () => {
    const worker = read('public/_worker.js');
    const block = worker.match(/const APP_ROUTE_PATTERNS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
    const sources = [...block.matchAll(/^\s*(\/.*\/),?\s*$/gm)].map((m) => m[1]);
    expect(sources).toEqual(APP_ROUTE_PATTERNS.map((p) => String(p)));
  });

  it('vite.config.ts service-worker denylist lists exactly the same patterns', () => {
    const config = read('vite.config.ts');
    const block = config.match(/navigateFallbackDenylist: \[([\s\S]*?)\],/)?.[1] ?? '';
    const sources = [...block.matchAll(/^\s*(\/.*\/),?\s*$/gm)].map((m) => m[1]);
    expect(sources).toEqual(APP_ROUTE_PATTERNS.map((p) => String(p)));
  });

  it('the marketing loader refuses to run on app routes (stale service-worker copies)', () => {
    const script = read('public/cookie-consent.js');
    const guard = script.match(/if \(\s*(\/\^[\s\S]*?\/)\.test\(/)?.[1];
    expect(guard).toBeDefined();
    const regex = new RegExp((guard as string).slice(1, -1));
    for (const p of APP_PATHS) expect(regex.test(p), p).toBe(true);
    for (const p of MARKETING_PATHS) expect(regex.test(p), p).toBe(false);
  });
});

describe('shellMismatchTarget', () => {
  const marketingDoc = document.implementation.createHTMLDocument('m');
  marketingDoc.documentElement.dataset.shell = 'marketing';
  const appDoc = document.implementation.createHTMLDocument('a');
  appDoc.documentElement.dataset.shell = 'app';
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('forces a full load when a marketing page navigates into the app (e.g. after login)', () => {
    expect(shellMismatchTarget('/canvas', '?x=1', '#h', marketingDoc, store(), 10_000)).toBe('/canvas?x=1#h');
  });

  it('forces a full load when the app navigates back to a marketing page', () => {
    expect(shellMismatchTarget('/pricing', '', '', appDoc, store(), 10_000)).toBe('/pricing');
  });

  it('does nothing when the shell already matches', () => {
    expect(shellMismatchTarget('/canvas', '', '', appDoc, store(), 10_000)).toBeNull();
    expect(shellMismatchTarget('/pricing', '', '', marketingDoc, store(), 10_000)).toBeNull();
  });

  it('will not reload in a loop', () => {
    const s = store();
    expect(shellMismatchTarget('/canvas', '', '', marketingDoc, s, 10_000)).toBe('/canvas');
    expect(shellMismatchTarget('/canvas', '', '', marketingDoc, s, 11_000)).toBeNull();
    expect(shellMismatchTarget('/canvas', '', '', marketingDoc, s, 16_000)).toBe('/canvas');
  });
});

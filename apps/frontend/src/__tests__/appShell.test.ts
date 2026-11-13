import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APP_ROUTE_PATTERNS,
  RESEARCH_ROUTE_PATTERNS,
  SUPPORT_ROUTE_PATTERNS,
  isAppRoute,
  shellForRoute,
  shellMismatchTarget,
} from '../utils/appShell';

/**
 * The signed-in app must never load an advertising or marketing tag, never send
 * an ad-consent signal, and the JMS support chat widget must never load on a
 * screen that can show research data. Enforced structurally: each route class is
 * served a different HTML shell. These tests drive the real production router
 * (public/_worker.js) and inspect the document it would serve for each route.
 */
const ROOT = process.cwd(); // apps/frontend (vitest cwd)
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');
const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

// Everything that can start an advertising/marketing/analytics request, or
// signal ad consent. Matched against whole documents.
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
  /\/cookie-consent\.js/i, // the marketing loader (cookie-consent-app.js is a different file)
];

// The JMS support chat widget: its host, script path and element ids.
const CHAT_WIDGET = [/jms-admin-portal/i, /workers\.dev/i, /chat\/widget/i, /jms-chat/i];

// Research routes: can render interview, transcript, coding or token content.
// No marketing tag and NO support-chat widget may ever be served here.
const RESEARCH_PATHS = [
  '/canvas',
  '/canvas/cm123abc',
  '/team',
  '/repository',
  '/admin',
  '/reset-password',
  '/verify-email',
  '/forgot-password',
];
// Support routes: account/billing/settings and the help screen. The ONLY routes
// that load the support-chat widget.
const SUPPORT_PATHS = ['/account', '/support'];
const APP_PATHS = [...RESEARCH_PATHS, ...SUPPORT_PATHS];
// Client routes the worker serves from the marketing shell. (/pricing, /login and
// the other public pages are prerendered static files copied from index.html.)
const MARKETING_SPA_PATHS = ['/', '/vs/atlas-ti'];
const MARKETING_PATHS = ['/', '/pricing', '/login', '/cookies', '/methodology', '/vs/atlas-ti'];

async function servedDocument(pathname: string): Promise<string> {
  // @ts-expect-error plain-JS Pages worker has no type declarations
  const worker = (await import('../../public/_worker.js')) as unknown as {
    default: { fetch(request: Request, env: unknown): Promise<Response> };
  };
  const files: Record<string, string> = {
    '/': 'index.html',
    '/app-shell': 'app-shell.html',
    '/support-shell': 'support-shell.html',
  };
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

describe('signed-in app shells carry no advertising or marketing loader', () => {
  it.each(APP_PATHS)('the document served for %s contains no ads/marketing tag or ad-consent signal', async (path) => {
    // Comments load nothing; the shells' header comments name what is absent.
    const html = stripComments(await servedDocument(path));
    for (const pattern of FORBIDDEN) {
      expect(html, `${path} must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(html).toContain(`data-shell="${SUPPORT_PATHS.includes(path) ? 'support' : 'app'}"`);
  });

  it('the app banner script has no tag-loading or consent-signal code', () => {
    const js = read('public/cookie-consent-app.js');
    // Strip comments: the header comment names what is absent.
    const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const pattern of [...FORBIDDEN, ...CHAT_WIDGET]) {
      expect(code, `cookie-consent-app.js must not match ${pattern}`).not.toMatch(pattern);
    }
    expect(code).not.toMatch(/createElement\(['"]script['"]\)/);
  });

  it('the app and support shells reference only the banner script and the shared bundle entry', () => {
    for (const file of ['app-shell.html', 'support-shell.html']) {
      const html = stripComments(read(file));
      const srcs = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
      expect(srcs.sort(), file).toEqual(['/cookie-consent-app.js', '/src/main.tsx']);
    }
  });

  it('marketing routes still get the consent-gated loader (marketing tags stay on public pages)', async () => {
    for (const path of MARKETING_SPA_PATHS) {
      const html = await servedDocument(path);
      expect(html, path).toContain('data-shell="marketing"');
      expect(html, path).toContain('/cookie-consent.js');
    }
    expect(read('public/cookie-consent.js')).toContain('googletagmanager.com/gtm.js');
  });
});

describe('support chat widget is absent from every research route', () => {
  it.each(RESEARCH_PATHS)('the document served for %s does not request the widget', async (path) => {
    const html = stripComments(await servedDocument(path));
    for (const pattern of CHAT_WIDGET) {
      expect(html, `${path} must not match ${pattern}`).not.toMatch(pattern);
    }
    // Not even a loader for it: the research shell has no inline scripts at all.
    expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
  });

  it.each(SUPPORT_PATHS)('%s is a support route: the widget loads there, from the support shell', async (path) => {
    const html = await servedDocument(path);
    expect(html).toContain('https://jms-admin-portal.mooja77.workers.dev/api/chat/widget.js');
    expect(html).toContain("referrerPolicy = 'no-referrer'");
  });

  it('no other shell or banner script names the widget host (the build check scans the shared bundle)', () => {
    for (const file of ['app-shell.html', 'public/cookie-consent-app.js', 'index.html']) {
      expect(stripComments(read(file)), file).not.toMatch(/jms-admin-portal|chat\/widget\.js/i);
    }
  });

  it('research screens link to the help screen with a plain full-page link', () => {
    expect(read('src/components/NeedHelpLink.tsx')).toContain('href="/support"');
    for (const file of [
      'src/pages/TeamPage.tsx',
      'src/pages/RepositoryPage.tsx',
      'src/components/canvas/CanvasWorkspace.tsx',
    ]) {
      expect(read(file), file).toContain('<NeedHelpLink');
    }
  });

  it('research routes carry a CSP without the chat host; support routes allow it; none allow marketing hosts', () => {
    const headers = read('public/_headers');
    const blocks = headers.split(/\r?\n/).reduce<Record<string, string>>((acc, line, i, lines) => {
      if (/^\/\S+\*$/.test(line.trim()) && lines[i + 1]?.includes('Content-Security-Policy')) {
        acc[line.trim()] = lines[i + 1];
      }
      return acc;
    }, {});
    const researchRoutes = [
      '/admin*',
      '/canvas*',
      '/forgot-password*',
      '/repository*',
      '/reset-password*',
      '/team*',
      '/verify-email*',
    ];
    const supportRoutes = ['/account*', '/support*'];
    expect(Object.keys(blocks).sort()).toEqual([...researchRoutes, ...supportRoutes].sort());
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
      if (researchRoutes.includes(route)) {
        expect(policy, `${route} is a research route: no chat host`).not.toContain('jms-admin-portal');
        expect(policy, `${route} is a research route: no workers.dev`).not.toContain('workers.dev');
      } else {
        expect(policy, `${route} is a support route`).toContain('https://jms-admin-portal.mooja77.workers.dev');
      }
    }
  });
});

describe('route classification stays in step across the app, the worker and the loader', () => {
  it('classifies research, support and marketing paths', () => {
    for (const p of APP_PATHS) expect(isAppRoute(p), p).toBe(true);
    for (const p of MARKETING_PATHS) expect(isAppRoute(p), p).toBe(false);
    for (const p of RESEARCH_PATHS) expect(shellForRoute(p), p).toBe('app');
    for (const p of SUPPORT_PATHS) expect(shellForRoute(p), p).toBe('support');
    for (const p of MARKETING_PATHS) expect(shellForRoute(p), p).toBe('marketing');
    expect(isAppRoute('/canvas/a/b')).toBe(false);
  });

  it('public/_worker.js lists exactly the same research and support route patterns', () => {
    const worker = read('public/_worker.js');
    const list = (name: string) => {
      const start = worker.indexOf(`const ${name} = Object.freeze([`);
      const end = worker.indexOf(']);', start);
      return [...worker.slice(start, end).matchAll(/\/\^.*?\$\//g)].map((m) => m[0]);
    };
    expect(list('RESEARCH_ROUTE_PATTERNS')).toEqual(RESEARCH_ROUTE_PATTERNS.map((p) => String(p)));
    expect(list('SUPPORT_ROUTE_PATTERNS')).toEqual(SUPPORT_ROUTE_PATTERNS.map((p) => String(p)));
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
  const shellDoc = (kind: string) => {
    const doc = document.implementation.createHTMLDocument(kind);
    doc.documentElement.dataset.shell = kind;
    return doc;
  };
  const marketingDoc = shellDoc('marketing');
  const appDoc = shellDoc('app');
  const supportDoc = shellDoc('support');
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

  it('forces a full load between the support shell and the research shell (widget must not carry into research)', () => {
    expect(shellMismatchTarget('/canvas/abc', '', '', supportDoc, store(), 10_000)).toBe('/canvas/abc');
    expect(shellMismatchTarget('/support', '', '', appDoc, store(), 10_000)).toBe('/support');
    expect(shellMismatchTarget('/account', '', '', supportDoc, store(), 10_000)).toBeNull();
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

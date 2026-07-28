import { chromium, expect } from '@playwright/test';

// Use the canonical custom domain so Google OAuth (origin-whitelisted to
// qualcanvas.com only) doesn't 403 in the smoke. The Cloudflare default URL
// https://qualcanvas.pages.dev serves the same bundle but isn't in the GCP
// authorized JS origins — users never visit it either.
const DEFAULT_FRONTEND_URL = 'https://qualcanvas.com';
const DEFAULT_BACKEND_URL = 'https://canvas-app-production.up.railway.app';
const DEFAULT_ACCESS_CODE = 'CANVAS-DEMO2025';
const IGNORED_BROWSER_EVENT = /google|googlesyndication|doubleclick|analytics|clarity|sentry/i;

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function splitUrls(value) {
  return value
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url) => url.replace(/\/+$/, ''));
}

const frontendUrls = splitUrls(
  readArg('frontend-urls') || process.env.SMOKE_FRONTEND_URLS || process.env.SMOKE_FRONTEND_URL || DEFAULT_FRONTEND_URL,
);
const backendUrl = (readArg('backend-url') || process.env.SMOKE_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
const accessCode = readArg('access-code') || process.env.SMOKE_ACCESS_CODE || DEFAULT_ACCESS_CODE;

async function checkBackendReady(maxAttempts = 6, baseDelayMs = 5000) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), 60000) * (1 + Math.random() * 0.3);
      console.error(`Backend not ready (attempt ${attempt}/${maxAttempts - 1}), retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const response = await fetch(`${backendUrl}/ready`);
      if (!response.ok) {
        lastError = new Error(`Backend /ready returned ${response.status}`);
        continue;
      }

      const body = await response.json();
      const failedChecks = Object.entries(body.checks || {})
        .filter(([, value]) => value !== 'ok')
        .map(([key, value]) => `${key}:${value}`);

      if (failedChecks.length) {
        lastError = new Error(`Backend /ready failed checks: ${failedChecks.join(', ')}`);
        continue;
      }

      return body;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function smokeFrontend(browser, frontendUrl) {
  const page = await browser.newPage();
  const browserEvents = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !IGNORED_BROWSER_EVENT.test(msg.text())) {
      browserEvents.push(`console: ${msg.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    if (!IGNORED_BROWSER_EVENT.test(request.url())) {
      browserEvents.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`.trim());
    }
  });

  await page.goto(`${frontendUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('Sign In with Code').first().click();

  const codeInput = page.getByPlaceholder('Enter your access code');
  await codeInput.fill(accessCode);

  await Promise.all([
    page.waitForURL('**/canvas**', { timeout: 30000 }),
    page
      .locator('form')
      .filter({ has: codeInput })
      .getByRole('button', { name: /Sign In with Code/i })
      .click(),
  ]);

  const skipSetup = page.getByRole('button', { name: /Skip setup/i });
  if (await skipSetup.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipSetup.click();
  }

  await expect(page.locator('[data-tour="canvas-list"]')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: /Coding Canvases/i })).toBeVisible({ timeout: 10000 });

  const result = {
    ok: browserEvents.length === 0,
    frontendUrl,
    finalUrl: page.url(),
    title: await page.title(),
    nonAnalyticsErrors: browserEvents.slice(0, 10),
  };

  await page.close();
  return result;
}

async function smokeFrontendWithRetry(browser, frontendUrl, maxAttempts = 3, baseDelayMs = 5000) {
  let result;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      // Cloudflare Pages can take a few seconds to finish propagating a new
      // deploy across edges; a script fetch right at deploy completion can
      // transiently 500. Retry before failing the smoke (seen 2026-07-15).
      const delay = baseDelayMs * attempt;
      console.error(`Frontend smoke failed for ${frontendUrl} (attempt ${attempt}/${maxAttempts - 1}), retrying in ${Math.round(delay / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    result = await smokeFrontend(browser, frontendUrl);
    if (result.ok) return result;
  }
  return result;
}

// The canonical origin baked into every prerendered file by
// apps/frontend/scripts/prerender-marketing.mjs. Self-canonical is always
// qualcanvas.com regardless of which host serves the bytes.
const PRERENDER_ORIGIN = 'https://qualcanvas.com';
const HOMEPAGE_TITLE = 'QualCanvas — Visual Coding for Interview Research';
// Routes that prerender-marketing.mjs emits as their own static HTML. Each must
// carry its OWN <title> (NOT the homepage title) and its OWN canonical equal to
// the requested URL — otherwise the SPA fallback is being served (regression:
// Google sees them as homepage duplicates again).
const MARKETING_PRERENDER_ROUTES = [
  '/cite',
  '/vs',
  '/for-institutions',
  '/customers',
  '/press',
  '/colophon',
  '/trust',
  '/trust/ai',
  '/changelog',
  '/accessibility-statement',
  '/guide',
];

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/href=["']([^"']+)["']/i);
  return href ? href[1].trim() : null;
}

// Fetch the raw HTML for each prerendered marketing route (no JS executed, the
// way Googlebot sees it) and assert it is a distinct static page, not the
// homepage SPA fallback.
async function checkMarketingPrerender(frontendUrl) {
  const failures = [];
  for (const path of MARKETING_PRERENDER_ROUTES) {
    const url = `${frontendUrl}${path}`;
    const expectedCanonical = `${PRERENDER_ORIGIN}${path}`;
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Googlebot/2.1' } });
      if (!res.ok) {
        failures.push(`${path}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const title = extractTitle(html);
      const canonical = extractCanonical(html);

      if (!title) {
        failures.push(`${path}: no <title>`);
      } else if (title === HOMEPAGE_TITLE) {
        failures.push(`${path}: title is the homepage title (SPA fallback served — prerender missing)`);
      }

      if (!canonical) {
        failures.push(`${path}: no canonical link`);
      } else if (canonical !== expectedCanonical) {
        failures.push(`${path}: canonical is "${canonical}", expected "${expectedCanonical}"`);
      }
    } catch (err) {
      failures.push(`${path}: fetch failed — ${err.message}`);
    }
  }
  return { ok: failures.length === 0, frontendUrl, checked: MARKETING_PRERENDER_ROUTES.length, failures };
}

async function main() {
  const ready = await checkBackendReady();
  const browser = await chromium.launch({ headless: true });

  try {
    const frontendResults = [];
    for (const frontendUrl of frontendUrls) {
      frontendResults.push(await smokeFrontendWithRetry(browser, frontendUrl));
    }

    const marketingPrerenderResults = [];
    for (const frontendUrl of frontendUrls) {
      marketingPrerenderResults.push(await checkMarketingPrerender(frontendUrl));
    }

    const result = {
      ok:
        frontendResults.every((entry) => entry.ok) &&
        marketingPrerenderResults.every((entry) => entry.ok),
      backend: {
        url: backendUrl,
        status: ready.status,
        version: ready.version,
        checks: ready.checks,
      },
      frontends: frontendResults,
      marketingPrerender: marketingPrerenderResults,
    };

    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});

import { chromium, expect } from '@playwright/test';

const DEFAULT_FRONTEND_URL = 'https://qualcanvas.pages.dev';
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

async function main() {
  const ready = await checkBackendReady();
  const browser = await chromium.launch({ headless: true });

  try {
    const frontendResults = [];
    for (const frontendUrl of frontendUrls) {
      frontendResults.push(await smokeFrontend(browser, frontendUrl));
    }

    const result = {
      ok: frontendResults.every((entry) => entry.ok),
      backend: {
        url: backendUrl,
        status: ready.status,
        version: ready.version,
        checks: ready.checks,
      },
      frontends: frontendResults,
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

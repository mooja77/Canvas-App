import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const siteBase = (process.env.QUALCANVAS_CAPTURE_SITE || 'https://qualcanvas.com').replace(/\/$/, '');
const accessCode = process.env.QUALCANVAS_DEMO_CODE;
if (!accessCode) {
  throw new Error('QUALCANVAS_DEMO_CODE is required; never store a production access code in this script');
}
const packageDir = process.env.QUALCANVAS_VIDEO_PACKAGE || 'youtube-training/2026-07-17-initial-library';
const outputDir = path.resolve(packageDir, 'captures');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-IE',
  reducedMotion: 'reduce',
  storageState: undefined,
});
const page = await context.newPage();
page.setDefaultTimeout(25_000);

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

async function settle(delay = 700) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(delay);
  await page
    .addStyleTag({
      content: `
      *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
      button[aria-label="Chat with us"], [data-testid="chat-widget"], iframe[src*="accounts.google"], #cookie-consent-banner { display: none !important; }
    `,
    })
    .catch(() => {});
}

async function assertSafeVisibleText(name) {
  const text = await page.locator('body').innerText();
  const forbiddenSecret =
    /(sk_(?:live|test)_[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{12,}|Bearer\s+[A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
  if (forbiddenSecret.test(text)) throw new Error(`${name}: possible credential-like text is visible`);
  if (/\bSHARE-[A-Z0-9]{6,}\b/.test(text)) throw new Error(`${name}: an active share code is visible; capture refused`);
  const emails = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const unsafeEmail = emails.find(
    (email) => !email.toLowerCase().endsWith('@qualcanvas.com') && !email.toLowerCase().endsWith('.invalid'),
  );
  if (unsafeEmail) throw new Error(`${name}: non-product email is visible; capture refused`);
}

async function capture(name) {
  await assertSafeVisibleText(name);
  await page.screenshot({
    path: path.join(outputDir, `${name}.png`),
    fullPage: false,
    animations: 'disabled',
  });
  console.log(`captured ${name}`);
}

async function visit(route, name, readyText) {
  await page.goto(`${siteBase}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (readyText) await page.getByText(readyText, { exact: false }).first().waitFor({ state: 'visible' });
  await settle();
  await capture(name);
}

async function captureSection(route, name, text) {
  await page.goto(`${siteBase}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const target = page.getByText(text, { exact: false }).first();
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  await capture(name);
}

async function closeLayer() {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(350);
}

async function openButtonAndCapture(buttonName, captureName, exact = true) {
  await page.getByRole('button', { name: buttonName, exact }).click();
  await page.waitForTimeout(450);
  if (captureName === '21-share-canvas') {
    await page.evaluate(() => {
      const replacement = 'DEMO CODE HIDDEN';
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        node.nodeValue = node.nodeValue?.replace(/\bSHARE-[A-Z0-9]{6,}\b/g, replacement) ?? '';
        node = walker.nextNode();
      }
      for (const input of document.querySelectorAll('input, textarea')) {
        if ('value' in input && /\bSHARE-[A-Z0-9]{6,}\b/.test(input.value)) input.value = replacement;
      }
    });
  }
  await capture(captureName);
  await closeLayer();
}

async function openToolAndCapture(menuItem, captureName) {
  await page.getByRole('button', { name: 'Tools menu' }).click();
  const item =
    typeof menuItem === 'string'
      ? page.getByRole('menuitem', { name: menuItem, exact: true })
      : page.getByRole('menuitem', { name: menuItem });
  await item.click();
  await page.waitForTimeout(650);
  await capture(captureName);
  await closeLayer();
}

try {
  await visit('/', '01-landing-hero', 'Code interviews like you think');
  await captureSection('/', '02-landing-workflow', 'From transcript to defensible theme');
  await visit('/pricing', '03-pricing', 'Pricing.');
  await visit('/guide', '04-guide', 'Complete Guide to QualCanvas');
  await visit('/for-teams', '05-for-teams', 'Code together. Disagree productively.');
  await visit('/for-institutions', '06-for-institutions', 'Department-wide qualitative research');
  await visit('/trust/ai', '07-trust-ai', 'Where AI is in QualCanvas');
  await visit('/methodology', '08-methodology', 'Doing qualitative research with QualCanvas');
  await visit('/privacy', '09-privacy', 'Privacy');
  await visit('/customers', '10-customers', 'What researchers do with QualCanvas');

  // Fresh isolated authentication. No persistent profile, autofill or Google session is used.
  await page.goto(`${siteBase}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign In with Code', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Access code' }).fill(accessCode);
  await page.getByRole('button', { name: 'Sign In with Code', exact: true }).last().click();
  await page.waitForURL(/\/canvas(?:\/|$)/);
  await page.getByRole('heading', { name: 'Coding Canvases' }).waitFor({ state: 'visible' });
  await settle(900);
  await capture('11-canvas-list');

  await page.getByRole('button', { name: 'New Canvas', exact: true }).click();
  await page.waitForTimeout(450);
  await capture('12-new-canvas');
  await closeLayer();

  await page
    .getByRole('heading', { name: /Thematic Analysis/ })
    .first()
    .click();
  await page.waitForURL(/\/canvas\/.+/);
  await page.getByRole('button', { name: 'Analyze menu' }).waitFor({ state: 'visible' });
  await settle(1300);
  await page
    .getByRole('button', { name: 'Fit View' })
    .click()
    .catch(() => {});
  await page.waitForTimeout(450);
  await capture('13-canvas-workspace');

  await openButtonAndCapture('Transcript', '14-transcript-menu');
  await openButtonAndCapture('Code', '15-code-menu');
  await openButtonAndCapture('Memo', '16-memo-menu');
  await openButtonAndCapture('Tools menu', '17-tools-menu');
  await openButtonAndCapture('Analyze menu', '18-analyze-menu');
  await openButtonAndCapture('AI menu', '19-ai-menu');
  await openButtonAndCapture('Export and import', '20-export-menu');
  await openButtonAndCapture('Share canvas', '21-share-canvas');

  await openButtonAndCapture('Survey', '31-survey-import');
  await openToolAndCapture('Cases', '32-cases');
  await openToolAndCapture('Cross-Case', '33-cross-case');

  await page.getByRole('button', { name: 'Export and import' }).click();
  await page.getByRole('menuitem', { name: 'Import QDPX (NVivo / ATLAS.ti)' }).click();
  await page.waitForTimeout(650);
  await capture('34-qdpx-import');
  await closeLayer();

  await openButtonAndCapture('More canvas actions', '35-more-actions');

  await page.keyboard.press('Control+K');
  await page.waitForTimeout(450);
  await capture('22-command-palette');
  await closeLayer();

  await openToolAndCapture('Codebook', '23-codebook');
  await openToolAndCapture('Ethics', '24-ethics');
  await openToolAndCapture(/Intercoder agreement/, '25-intercoder');
  await openToolAndCapture('Dashboard', '26-dashboard');
  await openButtonAndCapture('Help', '27-help-menu');

  const themeToggle = page.getByRole('button', { name: /Switch to (dark|light) mode/ });
  await themeToggle.click();
  await page.waitForTimeout(450);
  await capture('28-dark-mode');

  await page.getByRole('button', { name: 'Sources (1)' }).click();
  await page.waitForTimeout(350);
  await capture('30-sources-panel');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await capture('29-mobile-canvas');
  await page.setViewportSize({ width: 1920, height: 1080 });

  // The public demo account does not persist repository records. Stub only the
  // empty list response so we can capture the real plan-controlled UI without
  // creating or displaying any account data.
  await page.route('**/api/repositories', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ repositories: [] }) });
      return;
    }
    await route.continue();
  });
  await page.goto(`${siteBase}/repository`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Research Repository' }).waitFor({ state: 'visible' });
  await settle(700);
  await capture('36-research-repository');
  await page.getByRole('button', { name: 'New Repository' }).click();
  await page.waitForTimeout(350);
  await capture('37-new-repository');

  if (consoleErrors.length) {
    console.warn(`Browser console reported ${consoleErrors.length} error(s):`);
    console.warn(consoleErrors.join('\n'));
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  await Promise.race([context.close().catch(() => {}), pause(3_000)]);
  await Promise.race([browser.close().catch(() => {}), pause(3_000)]);
}

process.exit(process.exitCode || 0);

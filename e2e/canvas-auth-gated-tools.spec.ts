import { test, expect, type Page } from '@playwright/test';
import { isLegacyE2eAuth } from './helpers';

/**
 * Sprint 1C — auth-gated tool states (live QA finding #6).
 *
 * Research Calendar requires an email-linked account. On legacy
 * access-code auth it previously showed an indefinite spinner + a silent
 * 401 from /api/calendar/events. It must now show an explicit
 * email-auth-required panel instead.
 *
 * The default E2E setup project authenticates with the demo access code
 * (CANVAS-DEMO2025), i.e. legacy auth — so these tests exercise the gated
 * path directly.
 */

const API = 'http://localhost:3007/api/v1';
const PREFIX = `E2E-AG ${Date.now()}`;
let jwt = '';
let canvasId = '';

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function gotoSeededCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
}

async function openResearchCalendar(page: Page) {
  await page.getByRole('button', { name: 'Tools menu' }).first().click();
  const menu = page.getByRole('menu').first();
  await expect(menu).toBeVisible();
  await menu
    .getByText(/Research Calendar|Calendar/i)
    .first()
    .click();
}

test.describe('Canvas auth-gated tools', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    await p.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    await p.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
    await p.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    await p.close();
    await ctx.close();
  });

  test('finding #6: legacy auth opening Research Calendar shows email-auth-required state', async ({ page }) => {
    await gotoSeededCanvas(page);
    test.skip(!(await isLegacyE2eAuth(page)), 'Test requires legacy access-code auth');

    await openResearchCalendar(page);

    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // The explicit email-auth-required panel must be visible.
    await expect(dialog.getByText(/email account required/i)).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByRole('link', { name: /link your email account/i })).toBeVisible();

    // No indefinite spinner — the gated panel resolves immediately.
    await expect(dialog.locator('.animate-spin')).toHaveCount(0);
  });

  test('finding #6: Research Calendar gate links to the account page', async ({ page }) => {
    await gotoSeededCanvas(page);
    test.skip(!(await isLegacyE2eAuth(page)), 'Test requires legacy access-code auth');

    await openResearchCalendar(page);
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const accountLink = dialog.getByRole('link', { name: /link your email account/i });
    await expect(accountLink).toHaveAttribute('href', '/account');
  });
});

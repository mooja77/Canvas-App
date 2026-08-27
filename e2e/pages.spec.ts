import { test, expect } from '@playwright/test';

// Page-level smoke tests for public marketing routes. After the marketing
// refresh (PR #7) these assertions were updated to match the shipped copy.
test.describe('Page-Level Tests', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify main heading
    const heading = page.locator('h1');
    await expect(heading.first()).toContainText(/code interviews/i);
    await expect(heading.first()).toContainText(/visually/i);

    // Verify CTA button
    const startBtn = page
      .getByRole('link', { name: /start free/i })
      .or(page.getByRole('button', { name: /start free/i }));
    await expect(startBtn.first()).toBeVisible();

    // Verify a link to /pricing exists. The refreshed landing page links via
    // copy like "Choose your plan" / "Compare all features →" rather than the
    // literal word "Pricing", so we assert by href to stay copy-agnostic.
    const pricingLink = page.locator('a[href="/pricing"]:visible');
    await expect(pricingLink.first()).toBeVisible();
  });

  test('interactive demo applies a suggested code from a pointer click', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const quickPhrase = page.getByRole('button', { name: 'Coming back to school', exact: true });
    await expect(quickPhrase).toBeVisible({ timeout: 5000 });
    await quickPhrase.click();

    await expect(page.getByRole('dialog', { name: 'Suggested codes' })).toBeVisible();
    await page.getByRole('button', { name: '+ transition / return', exact: true }).click();

    await expect(page.locator('span[title^="transition / return"]')).toContainText('Coming back to school');
    await expect(page.getByText('1 span', { exact: true })).toBeVisible();
  });

  test('cookie banner keeps the support control clear and cleans up after rejection', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('jms_cookie_consent'));
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const banner = page.locator('#cookie-consent-banner');
    await expect(banner).toBeVisible();

    // The external support widget is intentionally disabled in E2E. Insert a
    // same-ID stand-in so this remains a deterministic regression test for the
    // shipped collision-avoidance CSS without calling a third-party service.
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'jms-chat-btn';
      button.style.cssText = 'position:fixed;right:16px;width:56px;height:56px';
      document.body.appendChild(button);
    });

    const layout = await page.evaluate(() => {
      const consent = document.getElementById('cookie-consent-banner')!.getBoundingClientRect();
      const chat = document.getElementById('jms-chat-btn')!.getBoundingClientRect();
      return {
        bannerHeight: consent.height,
        measuredHeight: parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--cookie-consent-height'),
        ),
        gap: consent.top - chat.bottom,
        bodyClass: document.body.classList.contains('cookie-consent-visible'),
      };
    });

    expect(layout.bodyClass).toBe(true);
    expect(layout.bannerHeight).toBeGreaterThan(0);
    expect(Math.abs(layout.measuredHeight - layout.bannerHeight)).toBeLessThan(1);
    expect(layout.gap).toBeGreaterThanOrEqual(15);

    await page.getByRole('button', { name: 'Reject non-essential cookies' }).click();
    await expect(banner).not.toBeVisible();
    expect(
      await page.evaluate(() => ({
        bodyClass: document.body.classList.contains('cookie-consent-visible'),
        measuredHeight: getComputedStyle(document.documentElement).getPropertyValue('--cookie-consent-height'),
      })),
    ).toEqual({ bodyClass: false, measuredHeight: '' });
  });

  test('pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Verify tier cards exist (Free, Pro, Team)
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify email input
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible();

    // Verify password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible();

    // Verify sign-in button
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await expect(signInBtn.first()).toBeVisible();

    // Verify legacy code sign-in disclosure is still available.
    await expect(page.getByRole('button', { name: /sign in with code/i })).toBeVisible();
  });

  test('session expired banner', async ({ page }) => {
    await page.goto('/login?expired=true');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/session has expired/i)).toBeVisible();
  });

  test('404 page', async ({ page }) => {
    await page.goto('/nonexistent-route');
    await page.waitForLoadState('networkidle');

    const notFoundText = page.getByText(/not found/i).or(page.getByText(/404/i));
    await expect(notFoundText.first()).toBeVisible();
  });

  test('account page accessible', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Verify profile section loads (authenticated via setup)
    const profileSection = page.getByText(/profile|account|plan|usage/i);
    await expect(profileSection.first()).toBeVisible({ timeout: 5000 });
  });
});

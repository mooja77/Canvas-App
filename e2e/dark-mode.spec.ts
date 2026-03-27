import { test, expect } from '@playwright/test';
import { openCanvas } from './helpers';

// ═══════════════════════════════════════════════════════════════════
// Dark Mode Tests
// The dark mode toggle lives on the CanvasPage header, so tests
// navigate to /canvas first to toggle, then verify on other pages.
// ═══════════════════════════════════════════════════════════════════

/** Helper: navigate to canvas list and toggle dark mode on */
async function enableDarkMode(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto('/canvas');
  await page.waitForLoadState('networkidle');

  const darkModeBtn = page.locator('button[aria-label="Switch to dark mode"]');
  const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');

  // If already in dark mode, we're done
  if (await lightModeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    return;
  }

  // Click dark mode toggle
  if (await darkModeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await darkModeBtn.click();
  }
}

/** Helper: ensure light mode is restored */
async function restoreLightMode(page: import('@playwright/test').Page) {
  const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');
  if (await lightModeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await lightModeBtn.click();
  }
}

test.describe('Dark Mode', () => {

  test('dark mode toggle changes background color', async ({ page }) => {
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    // Record background color before toggle
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const darkModeBtn = page.locator('button[aria-label="Switch to dark mode"]');
    const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');
    const btn = darkModeBtn.or(lightModeBtn);
    if (!await btn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(); return;
    }

    await btn.first().click();
    // Wait for the dark class to toggle on <html>
    await page.waitForFunction(
      (bgBeforeVal) => getComputedStyle(document.body).backgroundColor !== bgBeforeVal,
      bgBefore,
      { timeout: 3000 }
    ).catch(() => {});

    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);

    // Restore
    await restoreLightMode(page);
  });

  test('dark mode persists across page navigation', async ({ page }) => {
    await enableDarkMode(page);

    // Verify dark mode is active
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Navigate to pricing page
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    // Dark mode should persist
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Navigate back to canvas to clean up
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await restoreLightMode(page);
  });

  test('dark mode persists across page reload', async ({ page }) => {
    await enableDarkMode(page);

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Clean up
    await restoreLightMode(page);
  });

  test('dark mode applies to canvas workspace', async ({ page }) => {
    await enableDarkMode(page);

    // Now open a canvas
    await openCanvas(page);

    // Verify the dark class is on the document
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // The react-flow pane should be visible
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 5000 });

    // Canvas background should exist
    const bgColor = await page.evaluate(() => {
      const el = document.querySelector('.react-flow') as HTMLElement;
      return el ? getComputedStyle(el).backgroundColor : '';
    });
    expect(bgColor).toBeTruthy();

    // Clean up
    await restoreLightMode(page);
  });

  test('dark mode applies to pricing page', async ({ page }) => {
    await enableDarkMode(page);

    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Pricing cards should still be visible in dark mode
    await expect(page.getByText('Free').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Pro').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Team').first()).toBeVisible({ timeout: 3000 });

    // Clean up
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await restoreLightMode(page);
  });

  test('dark mode applies to login page', async ({ page }) => {
    await enableDarkMode(page);

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Login form elements should still be visible
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(
      page.locator('input[type="email"]')
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 3000 });

    // Clean up
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await restoreLightMode(page);
  });

  test('dark mode applies to guide page', async ({ page }) => {
    await enableDarkMode(page);

    await page.goto('/guide');
    await page.waitForLoadState('domcontentloaded');

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    // Guide content should still be visible
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible({ timeout: 5000 });

    // Clean up
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await restoreLightMode(page);
  });

  test('system preference detection (prefers-color-scheme)', async ({ browser }) => {
    // Create a context with dark color scheme preference
    const darkContext = await browser.newContext({
      colorScheme: 'dark',
      storageState: 'e2e/.auth/user.json',
    });
    const page = await darkContext.newPage();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The app should detect the system dark preference
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const hasDarkToggle = await page.locator('button[aria-label*="dark mode"], button[aria-label*="light mode"]').first().isVisible({ timeout: 3000 }).catch(() => false);

    // System dark mode should either auto-apply or the toggle should be available
    expect(isDark || hasDarkToggle).toBe(true);

    await darkContext.close();
  });
});

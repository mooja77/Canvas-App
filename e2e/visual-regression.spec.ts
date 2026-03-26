import { test, expect } from '@playwright/test';
import { openCanvas } from './helpers';

// Only run visual regression on Chromium — other browsers render differently
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual regression: Chromium only');

// ═══════════════════════════════════════════════════════════════════
// Visual Regression Tests
// Uses Playwright's built-in screenshot comparison (toHaveScreenshot).
// First run creates baseline snapshots; subsequent runs compare against them.
// Baselines are stored in e2e/visual-regression.spec.ts-snapshots/.
// ═══════════════════════════════════════════════════════════════════

const SCREENSHOT_OPTS = { maxDiffPixels: 100, animations: 'disabled' as const };
const STANDARD_VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

// ─── Page Snapshots (Public Pages) ───────────────────────────────

test.describe('Visual Regression — Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('1 - Landing page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('landing-page.png', SCREENSHOT_OPTS);
  });

  test('2 - Login page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/login');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('login-page.png', SCREENSHOT_OPTS);
  });

  test('3 - Pricing page (above the fold)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/pricing');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('pricing-page.png', SCREENSHOT_OPTS);
  });

  test('4 - Guide page (hero + first section)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/guide');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('guide-page.png', SCREENSHOT_OPTS);
  });

  test('5 - 404 page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/nonexistent-page-12345');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('404-page.png', SCREENSHOT_OPTS);
  });
});

// ─── Page Snapshots (Authenticated Pages) ────────────────────────

test.describe('Visual Regression — Authenticated Pages', () => {
  test('6 - Canvas list page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
    await page.goto('/canvas');
    await page.waitForSelector('[data-tour="canvas-list"], h2', { timeout: 10000 });
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('canvas-list-page.png', SCREENSHOT_OPTS);
  });

  test('7 - Canvas workspace', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openCanvas(page);
    // Press fitView button if available, otherwise just wait for stable layout
    const fitViewBtn = page.locator('button[title="fit view"], button[aria-label="fit view"]');
    if (await fitViewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fitViewBtn.click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('canvas-workspace.png', SCREENSHOT_OPTS);
  });
});

// ─── Component Snapshots ─────────────────────────────────────────

test.describe('Visual Regression — Component Snapshots', () => {
  test('8 - Toolbar', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openCanvas(page);
    const toolbar = page.locator('[data-tour="canvas-toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    await expect(toolbar).toHaveScreenshot('toolbar.png', SCREENSHOT_OPTS);
  });

  test('9 - Code navigator sidebar', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openCanvas(page);
    const navigator = page.locator('[data-tour="canvas-navigator"]');
    // The navigator may already be visible or may need toggling
    if (!await navigator.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Try clicking a toggle button to open the navigator
      const toggleBtn = page.locator('button[title="Toggle navigator"], button[aria-label="Toggle navigator"], button[title="Navigator"], button[aria-label="Navigator"]');
      if (await toggleBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggleBtn.first().click();
        await page.waitForTimeout(500);
      }
    }
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    await expect(navigator).toHaveScreenshot('code-navigator.png', SCREENSHOT_OPTS);
  });

  test('10 - Command palette (Ctrl+K)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openCanvas(page);
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    // The command palette should be a dialog or modal with a search input
    const palette = page.locator('[role="dialog"], [data-command-palette], .command-palette').first();
    await expect(palette).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await expect(palette).toHaveScreenshot('command-palette.png', SCREENSHOT_OPTS);
  });

  test('11 - Share modal', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openCanvas(page);
    // Allow extra time for workspace to fully load
    await page.waitForTimeout(1000);
    const shareBtn = page.locator('button[title="Share canvas"]');
    await expect(shareBtn).toBeVisible({ timeout: 10000 });
    await shareBtn.click();
    await page.waitForTimeout(500);
    const modal = page.locator('[role="dialog"][aria-label="Share Canvas"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(300);
    await expect(modal).toHaveScreenshot('share-modal.png', SCREENSHOT_OPTS);
  });
});

// ─── Theme & Responsive Snapshots ────────────────────────────────

test.describe('Visual Regression — Theme & Responsive', () => {
  test('12 - Dark mode landing page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    // Enable dark mode via localStorage before navigation
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, darkMode: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
    // Also add the dark class directly for pages that read it from localStorage
    await page.goto('/');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('dark-mode-landing-page.png', SCREENSHOT_OPTS);
  });

  test('13 - Mobile landing page (375x812)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('mobile-landing-page.png', SCREENSHOT_OPTS);
  });

  test('14 - Mobile login page (375x812)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/login');
    await page.waitForTimeout(1000);
    await expect(page).toHaveScreenshot('mobile-login-page.png', SCREENSHOT_OPTS);
  });

  test('15 - Pricing page annual toggle', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/pricing');
    await page.waitForTimeout(1000);
    // Click the Annual toggle/button
    const annualToggle = page.getByText('Annual').or(
      page.getByRole('button', { name: /annual/i })
    ).or(
      page.locator('label:has-text("Annual")')
    );
    await annualToggle.first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('pricing-annual-toggle.png', SCREENSHOT_OPTS);
  });
});

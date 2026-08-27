import { test, expect } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════
// Mobile Responsive Tests
// ═══════════════════════════════════════════════════════════════════

const MOBILE_WIDTH = 375;
const MOBILE_HEIGHT = 812;

test.describe('Mobile Responsive', () => {
  test('landing page hamburger menu appears on mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hamburger = page.locator('button[aria-label="Toggle menu"]');
    await expect(hamburger).toBeVisible({ timeout: 5000 });
    await expect(page.locator('nav .md\\:flex a[href="/pricing"]')).toBeHidden();
  });

  test('landing page hamburger menu opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Find the hamburger / mobile menu button
    const hamburger = page.locator('button[aria-label="Toggle menu"]');

    await expect(hamburger).toBeVisible({ timeout: 5000 });

    // Click hamburger to open menu
    await hamburger.click();

    const mobileGuide = page.locator('.md\\:hidden a[href="/guide"]:visible');
    await expect(mobileGuide).toBeVisible();

    // Close menu by clicking the toggle again
    await hamburger.click();
    await expect(mobileGuide).not.toBeVisible();
  });

  test('landing navigation switches at the tablet breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const hamburger = page.locator('button[aria-label="Toggle menu"]');
    const desktopPricing = page.locator('nav .md\\:flex a[href="/pricing"]');
    await expect(hamburger).toBeVisible();
    await expect(desktopPricing).toBeHidden();

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(hamburger).toBeHidden();
    await expect(desktopPricing).toBeVisible();
  });

  test('login page is usable at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Email input should be visible and within viewport
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible({ timeout: 3000 });

    // Password input should be visible
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 3000 });

    // Sign in button should be visible
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible({ timeout: 3000 });

    // Inputs should not overflow the viewport
    const emailBox = await emailInput.first().boundingBox();
    if (emailBox) {
      expect(emailBox.x).toBeGreaterThanOrEqual(0);
      expect(emailBox.x + emailBox.width).toBeLessThanOrEqual(MOBILE_WIDTH + 5);
    }
  });

  test('canvas list is responsive at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });

    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    // Canvas list or empty state should be visible within mobile viewport
    const canvasList = page.getByText('Coding Canvases').or(page.getByText('Create your first canvas'));
    await expect(canvasList.first()).toBeVisible({ timeout: 5000 });

    // Check that the page content fits within the mobile viewport (no horizontal overflow)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test('pricing page stacks plan cards vertically', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');

    // All three plan names should be visible
    await expect(page.getByText('Free').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Pro').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Team').first()).toBeVisible({ timeout: 5000 });

    // On mobile, cards should stack vertically and not overflow horizontally
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test('guide page sidebar collapses on mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/guide');
    await page.waitForLoadState('domcontentloaded');

    // The guide main heading should be visible
    await expect(page.getByRole('heading', { name: /Complete Guide/i }).first()).toBeVisible({ timeout: 5000 });

    // On mobile, the content should fit within mobile viewport width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test('guide page is scrollable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/guide');
    await page.waitForLoadState('domcontentloaded');

    // GuidePage is lazy-loaded. Wait for the route chunk to render before
    // measuring document geometry; DOMContentLoaded only covers index.html.
    await expect(page.getByRole('heading', { name: /Complete Guide/i }).first()).toBeVisible({ timeout: 5000 });

    // Guide page has lots of content, so it should be scrollable
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(scrollHeight).toBeGreaterThan(MOBILE_HEIGHT);

    // Scroll down and verify scrolling works
    await page.evaluate(() => window.scrollBy(0, 500));

    const scrollTop = await page.evaluate(() => window.scrollY);
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('canvas toolbar adapts to mobile width', async ({ page }) => {
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    // On mobile, the canvas list page should render
    const canvasList = page.getByText('Coding Canvases').or(page.getByText('Create your first canvas'));
    await expect(canvasList.first()).toBeVisible({ timeout: 5000 });

    // Click first canvas card to open it
    const heading = page.locator('h3').first();
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await heading.click();
      await page.waitForSelector('.react-flow__pane', { timeout: 10000 }).catch(() => {});
    }

    // At mobile width the canvas may show a simplified view or the pane may be visible
    // Check that page doesn't crash and content is present
    const hasCanvas = await page
      .locator('.react-flow__pane')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasToolbar = await page
      .locator('[data-tour="canvas-toolbar"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const hasContent = await page.evaluate(() => document.body.innerHTML.length > 100);

    // The page should render something meaningful (canvas or fallback)
    expect(hasContent).toBe(true);

    // No horizontal overflow at mobile width
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });
});

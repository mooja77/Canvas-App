import { test, expect } from '@playwright/test';
import { openCanvas } from './helpers';

// ═══════════════════════════════════════════════════════════════════
// Resilience Tests
// ═══════════════════════════════════════════════════════════════════

test.describe('Resilience', () => {

  test('page loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-critical errors
        if (text.includes('favicon') || text.includes('.map') || text.includes('DevTools')) return;
        consoleErrors.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out network errors that are expected in E2E
    const criticalErrors = consoleErrors.filter((e) =>
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('404') &&
      !e.includes('favicon') &&
      !e.includes('Stripe') &&
      !e.includes('Google')
    );

    expect(criticalErrors).toEqual([]);
  });

  test('404 page displays for unknown routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');
    await page.waitForLoadState('domcontentloaded');

    const notFoundText = page.getByText(/not found/i).or(
      page.getByText(/404/i)
    );
    await expect(notFoundText.first()).toBeVisible({ timeout: 5000 });
  });

  test('refreshing canvas page maintains state', async ({ page }) => {
    await openCanvas(page);

    // Wait for canvas to fully load
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 10000 });

    // Get canvas ID from URL or localStorage for reliable re-navigation
    const canvasId = await page.evaluate(() => {
      const match = window.location.pathname.match(/\/canvas\/(.+)/);
      if (match) return match[1];
      const tabs = localStorage.getItem('canvas-open-tabs');
      if (tabs) {
        const parsed = JSON.parse(tabs);
        return parsed[0] || null;
      }
      return null;
    });

    // Count nodes before refresh
    const nodeCountBefore = await page.locator('.react-flow__node').count();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // After reload, the app may return to canvas list. Re-enter the canvas if needed.
    const paneVisible = await page.locator('.react-flow__pane').isVisible({ timeout: 3000 }).catch(() => false);
    if (!paneVisible) {
      // Click first canvas card or navigate to the canvas by ID
      if (canvasId) {
        await page.goto(`/canvas/${canvasId}`);
        await page.waitForLoadState('networkidle');
      } else {
        const heading = page.locator('h3').first();
        if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
          await heading.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }

    // Canvas should be visible
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 10000 });

    // Node count should remain the same (state maintained server-side)
    const nodeCountAfter = await page.locator('.react-flow__node').count();
    expect(nodeCountAfter).toBe(nodeCountBefore);
  });

  test('browser back button navigates correctly', async ({ page }) => {
    // Start at landing page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to pricing
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Free').first()).toBeVisible({ timeout: 5000 });

    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: 5000 });

    // Go back to pricing
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/pricing');
    await expect(page.getByText('Free').first()).toBeVisible({ timeout: 5000 });

    // Go back to landing
    await page.goBack();
    await page.waitForLoadState('domcontentloaded');
    const url = page.url();
    expect(url.endsWith('/') || url.endsWith(':5174')).toBe(true);
  });

  test('deep link to specific canvas works', async ({ page }) => {
    // First open canvas to get a canvas ID
    await openCanvas(page);
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 10000 });

    // Extract canvas ID from localStorage or URL
    const canvasId = await page.evaluate(() => {
      const match = window.location.pathname.match(/\/canvas\/(.+)/);
      if (match) return match[1];
      const tabs = localStorage.getItem('canvas-open-tabs');
      if (tabs) {
        const parsed = JSON.parse(tabs);
        return parsed[0] || null;
      }
      return null;
    });

    if (!canvasId) {
      test.skip(); return;
    }

    // Navigate away
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Deep link directly to the canvas
    await page.goto(`/canvas/${canvasId}`);
    await page.waitForLoadState('networkidle');

    // Canvas workspace should load
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 10000 });
  });

  test('multiple rapid page navigations do not crash', async ({ page }) => {
    // Rapidly navigate between pages
    const routes = ['/', '/pricing', '/login', '/guide', '/pricing', '/'];

    for (const route of routes) {
      await page.goto(route);
      // Use domcontentloaded for rapid navigation testing
      await page.waitForLoadState('domcontentloaded');
    }

    // Page should not have crashed — verify it's interactive
    await expect(page.locator('body')).toBeVisible({ timeout: 5000 });

    // No unhandled errors should have caused a blank page
    const hasContent = await page.evaluate(() => {
      return document.body.children.length > 0 && document.body.innerHTML.length > 100;
    });
    expect(hasContent).toBe(true);
  });
});

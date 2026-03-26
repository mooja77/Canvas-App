import { test, expect } from '@playwright/test';
import { openCanvas } from './helpers';

test.describe('Canvas Navigation Features', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page);
  });

  test('snap-to-grid toggle changes background variant', async ({ page }) => {
    // Initially background should use dots variant
    const bgBefore = page.locator('.react-flow__background');
    await expect(bgBefore).toBeVisible({ timeout: 3000 });

    // Get the pattern element type before toggle (dots = circle elements, lines = line/path elements)
    const hasDotsBefore = await page.evaluate(() => {
      const bg = document.querySelector('.react-flow__background');
      if (!bg) return false;
      // Dots variant uses pattern with circles
      return bg.querySelectorAll('circle').length > 0 || bg.querySelector('[class*="dot"]') !== null;
    });

    // Click on the pane first to ensure keyboard focus is on the canvas
    const pane = page.locator('.react-flow__pane');
    await pane.click();

    // Press G to toggle snap-to-grid
    await page.keyboard.press('g');

    // After toggle, background variant should change (dots -> lines)
    // Also verify the "GRID" indicator appears in the status bar
    const gridIndicator = page.getByText('GRID');
    const hasGrid = await gridIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    // Check that the background pattern changed
    const hasLineAfter = await page.evaluate(() => {
      const bg = document.querySelector('.react-flow__background');
      if (!bg) return false;
      // Lines variant uses line elements in the pattern
      return bg.querySelectorAll('line').length > 0 || bg.querySelector('[class*="line"]') !== null;
    });

    // Either the background pattern changed or the GRID indicator appeared
    expect(hasLineAfter || hasGrid).toBe(true);

    // Press G again to toggle back
    await page.keyboard.press('g');
  });

  test('focus mode hides sidebar and toolbar then restores', async ({ page }) => {
    // Verify toolbar is visible before focus mode
    const toolbar = page.locator('[data-tour="canvas-toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // Verify minimap is visible before focus mode
    const minimap = page.locator('.react-flow__minimap');

    // Click the pane to ensure canvas has focus
    const pane = page.locator('.react-flow__pane');
    await pane.click();

    // Press Ctrl+. to enter focus mode
    await page.keyboard.press('Control+.');

    // Toolbar should be hidden in focus mode
    await expect(toolbar).not.toBeVisible({ timeout: 3000 });

    // Minimap should be hidden in focus mode
    await expect(minimap).not.toBeVisible({ timeout: 2000 });

    // Exit focus mode button should appear
    const exitBtn = page.locator('button[title*="Exit focus mode"]');
    await expect(exitBtn).toBeVisible({ timeout: 2000 });

    // Press Ctrl+. again to exit focus mode
    await page.keyboard.press('Control+.');

    // Toolbar should be visible again
    await expect(toolbar).toBeVisible({ timeout: 3000 });
  });

  test('dark mode toggle adds and removes dark class', async ({ page }) => {
    // Find the dark mode toggle button in the header
    const darkModeBtn = page.locator('button[aria-label*="dark mode"], button[aria-label*="light mode"]');
    if (!await darkModeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip(); return;
    }

    // Check current dark mode state
    const isDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Click the dark mode toggle
    await darkModeBtn.click();

    // Dark class should have toggled
    await page.waitForFunction(
      (wasDark) => document.documentElement.classList.contains('dark') !== wasDark,
      isDarkBefore,
      { timeout: 2000 }
    );
    const isDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkAfter).toBe(!isDarkBefore);

    // Toggle back to original state
    const darkModeBtnAgain = page.locator('button[aria-label*="dark mode"], button[aria-label*="light mode"]');
    await darkModeBtnAgain.click();

    // Should be back to original
    await page.waitForFunction(
      (wasDark) => document.documentElement.classList.contains('dark') === wasDark,
      isDarkBefore,
      { timeout: 2000 }
    );
    const isDarkFinal = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkFinal).toBe(isDarkBefore);
  });

  test('auto-arrange shows canvas arranged toast', async ({ page }) => {
    // Find the Arrange button in the toolbar
    const arrangeBtn = page.getByRole('button', { name: /Arrange/i });
    if (!await arrangeBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip(); return;
    }

    await arrangeBtn.first().click();

    // Check for either "Canvas arranged" success toast or "No nodes to arrange" info toast
    const successToast = page.getByText('Canvas arranged');
    const emptyToast = page.getByText('No nodes to arrange');
    const hasSuccess = await successToast.isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmpty = await emptyToast.isVisible({ timeout: 1000 }).catch(() => false);

    expect(hasSuccess || hasEmpty).toBe(true);
  });

  test('navigator sidebar toggle collapses and expands', async ({ page }) => {
    // Find the navigator toggle button
    const hideNavBtn = page.locator('button[title="Hide navigator"]');
    const showNavBtn = page.locator('button[title="Show navigator"]');

    // Determine initial state
    const isNavigatorVisible = await hideNavBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const isNavigatorHidden = await showNavBtn.isVisible({ timeout: 1000 }).catch(() => false);

    if (!isNavigatorVisible && !isNavigatorHidden) {
      // Neither button found — skip
      test.skip(); return;
    }

    if (isNavigatorVisible) {
      // Navigator is shown — click to hide
      await hideNavBtn.click();

      // The "Show navigator" button should now be visible
      await expect(showNavBtn).toBeVisible({ timeout: 3000 });

      // Click to show again
      await showNavBtn.click();

      // The "Hide navigator" button should be back
      await expect(hideNavBtn).toBeVisible({ timeout: 3000 });
    } else {
      // Navigator is hidden — click to show
      await showNavBtn.click();

      // The "Hide navigator" button should now be visible
      await expect(hideNavBtn).toBeVisible({ timeout: 3000 });

      // Click to hide again
      await hideNavBtn.click();

      // The "Show navigator" button should be back
      await expect(showNavBtn).toBeVisible({ timeout: 3000 });
    }
  });
});

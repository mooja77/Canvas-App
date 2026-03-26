import type { Page } from '@playwright/test';

/**
 * Shared helper to open a canvas for E2E testing.
 * Handles: onboarding dismissal, empty canvas creation, node waiting.
 */
export async function openCanvas(page: Page) {
  // Ensure onboarding tour is dismissed
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });

  await page.goto('/canvas');
  await page.waitForLoadState('networkidle');

  // If no canvases, create one via the UI
  const emptyState = page.getByText('Create your first canvas');
  if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole('button', { name: /New Canvas|Get Started/i }).first().click();
    // Fill name and create
    const nameInput = page.locator('input').filter({ hasText: '' }).first();
    const inputs = page.locator('input[type="text"], input:not([type])');
    for (let i = 0; i < await inputs.count(); i++) {
      const input = inputs.nth(i);
      const val = await input.inputValue();
      if (!val || val === '') {
        await input.fill('E2E Test Canvas');
        break;
      }
    }
    const createBtn = page.getByRole('button', { name: /Create Canvas/i });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');
    }
  }

  // Click first canvas card if on list page
  const heading = page.locator('h3').first();
  if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
    await heading.click();
  }

  // Wait for ReactFlow pane
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Dismiss any remaining tour overlay
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }
  const overlay = page.locator('.fixed.inset-0.z-\\[10000\\]');
  if (await overlay.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.keyboard.press('Escape');
  }
}

export function getViewportTransform(page: Page) {
  return page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!vp) return null;
    const match = vp.style.transform.match(/translate\((.+?)px,\s*(.+?)px\)\s*scale\((.+?)\)/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) };
  });
}

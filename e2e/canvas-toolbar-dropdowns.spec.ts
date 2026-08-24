import { expect, test } from '@playwright/test';
import { openCanvas } from './helpers';

test('toolbar dropdown closes on Escape and releases the canvas controls', async ({ page }) => {
  await openCanvas(page);

  await page.locator('[data-tour="canvas-btn-ai"] button').click();
  await expect(page.getByTestId('collision-popover')).toBeVisible();
  await expect(page.getByTestId('collision-popover').getByText('Auto-Code')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('collision-popover')).toHaveCount(0);

  await page.locator('[title="Back to canvas list"]').click();
  await expect(page.locator('[data-tour="canvas-list"]')).toBeVisible({ timeout: 10000 });
});

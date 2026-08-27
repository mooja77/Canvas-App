import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('real-user pilot is responsive, accessible, and submits anonymous structured feedback', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/pilot');
  await expect(page).toHaveTitle(/real-user pilot/i);
  await expect(page.getByRole('heading', { name: /test one complete research workflow/i })).toBeVisible();
  await expect(page.getByText(/use only fictional, synthetic, or already-public/i)).toBeVisible();

  await page.getByLabel(/your role/i).selectOption('ux-service-researcher');
  await page.getByLabel(/previous qualcanvas experience/i).selectOption('first-time');
  await page.getByLabel(/1\. create a project result/i).selectOption('easy');
  // The native radio is visually hidden; activate its visible label exactly
  // as a participant does instead of forcing a click through the overlay.
  await page.locator('label:has(input[name="recommendation-score"][value="8"])').click();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')).toEqual([]);

  await page.getByRole('button', { name: /submit pilot feedback/i }).click();
  await expect(page.getByRole('heading', { name: /thank you for testing qualcanvas/i })).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
});

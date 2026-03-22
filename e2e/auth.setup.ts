import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with access code' }).click();
  const codeInput = page.getByRole('textbox', { name: 'Enter your access code' });
  await codeInput.waitFor({ state: 'visible' });
  await codeInput.fill('CANVAS-DEMO2025');
  await page.waitForTimeout(200);

  const signInBtn = page.getByRole('button', { name: 'Sign In with Code' });
  await expect(signInBtn).toBeEnabled({ timeout: 5000 });
  await signInBtn.click();

  // Wait for navigation
  await page.waitForURL('**/canvas**', { timeout: 10000 });
  await expect(page.getByText('Coding Canvases')).toBeVisible({ timeout: 5000 });

  // Save auth state (localStorage + cookies)
  await page.context().storageState({ path: AUTH_FILE });
});

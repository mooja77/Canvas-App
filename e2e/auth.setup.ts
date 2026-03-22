import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const AUTH_FILE = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Reuse existing auth state if it exists and is recent (< 10 min old)
  if (fs.existsSync(AUTH_FILE)) {
    const stat = fs.statSync(AUTH_FILE);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 10 * 60 * 1000) {
      // Auth state is fresh — skip login to avoid rate limiting
      return;
    }
  }

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

  // Mark onboarding tour as complete so it doesn't block E2E tests.
  // The uiStore uses Zustand persist with key 'canvas-app-ui'.
  await page.evaluate(() => {
    const existing = localStorage.getItem('canvas-app-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('canvas-app-ui', JSON.stringify(state));
  });

  // Save auth state (localStorage + cookies)
  await page.context().storageState({ path: AUTH_FILE });
});

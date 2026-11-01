import { test, expect } from '@playwright/test';
import { uniqueEmail, waitForEmail, tokenFromLink, testPassword } from './support/api';

// The real UI against the real backend: a researcher signs up in the browser,
// confirms their email from the captured message, and reaches the workspace.
test.describe('Browser journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jms_cookie_consent', 'rejected');
    });
  });

  test('sign up in the UI, verify from the email, land in the canvas list', async ({ page }) => {
    const email = uniqueEmail('ui');
    await page.goto('/login');
    await page.locator('#auth-tab-register').click();
    const panel = page.locator('#auth-panel-register');
    await panel.getByPlaceholder('Dr. Jane Doe').fill('Estate UI Researcher');
    await panel.getByPlaceholder('you@university.edu').fill(email);
    await panel.getByPlaceholder('At least 8 characters').fill(testPassword());
    await panel.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(canvas|onboarding|welcome)/, { timeout: 30_000 });

    const mail = await waitForEmail(email, /Verify your QualCanvas email/);
    const token = tokenFromLink(mail.html ?? '', '/verify-email');
    await page.goto(`/verify-email#token=${token}&email=${encodeURIComponent(email)}`);
    // Signed in here as this account: one "Yes" verifies, no password step.
    await expect(page.getByRole('heading', { name: 'Did you create this QualCanvas account?' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Yes, I created it' }).click();
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible({ timeout: 15_000 });
  });

  test('sign in with a wrong password shows an error and stays on /login', async ({ page }) => {
    await page.goto('/login');
    const panel = page.locator('#auth-panel-login');
    await panel.getByPlaceholder('you@university.edu').fill(uniqueEmail('nouser'));
    await panel.getByPlaceholder('Enter your password').fill(testPassword());
    await panel.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page
        .getByRole('alert')
        .or(page.getByText(/invalid|incorrect/i))
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('pricing page shows the published prices', async ({ page }) => {
    await page.goto('/pricing');
    const body = page.locator('body');
    // Monthly is the default view: the headline is the monthly charge.
    await expect(body).toContainText('$5a month, or $48 a year');
    await expect(body).toContainText('$15a month, or $144 a year');
    await expect(body).toContainText('$39per seat a month, or $384 per seat a year');
    await expect(body).toContainText('Save up to 20%');
    // Annual shows the yearly charge. Team saves 17.9% (rounded 18%), so the
    // page must not claim a flat 20%.
    await page.getByRole('button', { name: /Annual/ }).click();
    await expect(body).toContainText('$48a year, which works out at $4 a month (save 20%)');
    await expect(body).toContainText('$384per seat a year, which works out at $32 a month (save 18%)');
    // Transcription runs only on the researcher's own OpenAI key: no plan
    // includes minutes or hours (decision 28 Sep 2026).
    await expect(body).toContainText('Audio transcription (with your own OpenAI key)');
    await expect(body).not.toContainText(/\d+\s*(hrs|hours)/i);
    await expect(body).not.toContainText(/pooled/i);
    await page.getByRole('button', { name: /^Monthly$/ }).click();
    await expect(body).toContainText('$15');
    await expect(body).toContainText('$39');
  });
});

import { test, expect } from '@playwright/test';

test.describe('Page-Level Tests', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify main heading
    const heading = page.locator('h1');
    await expect(heading.first()).toContainText(/code transcripts/i);
    await expect(heading.first()).toContainText(/not in spreadsheets/i);

    // Verify CTA button
    const startBtn = page
      .getByRole('link', { name: /start free/i })
      .or(page.getByRole('button', { name: /start free/i }));
    await expect(startBtn.first()).toBeVisible();

    // Verify pricing link
    const pricingLink = page.getByRole('link', { name: /pricing/i });
    await expect(pricingLink.first()).toBeVisible();
  });

  test('pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // Verify tier cards exist (Free, Pro, Team)
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify email input
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
    await expect(emailInput.first()).toBeVisible();

    // Verify password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible();

    // Verify sign-in button
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await expect(signInBtn.first()).toBeVisible();

    // Verify legacy code sign-in disclosure is still available.
    await expect(page.getByRole('button', { name: /sign in with code/i })).toBeVisible();
  });

  test('session expired banner', async ({ page }) => {
    await page.goto('/login?expired=true');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/session has expired/i)).toBeVisible();
  });

  test('404 page', async ({ page }) => {
    await page.goto('/nonexistent-route');
    await page.waitForLoadState('networkidle');

    const notFoundText = page.getByText(/not found/i).or(page.getByText(/404/i));
    await expect(notFoundText.first()).toBeVisible();
  });

  test('account page accessible', async ({ page }) => {
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Verify profile section loads (authenticated via setup)
    const profileSection = page.getByText(/profile|account|plan|usage/i);
    await expect(profileSection.first()).toBeVisible({ timeout: 5000 });
  });
});

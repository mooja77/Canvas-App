import { test, expect } from '@playwright/test';

test.describe('Page-Level Tests', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    // Verify main heading
    const heading = page.locator('h1');
    await expect(heading.first()).toContainText(/qualitative coding/i);
    await expect(heading.first()).toContainText(/made visual/i);

    // Verify CTA button
    const startBtn = page.getByRole('link', { name: /start free/i }).or(
      page.getByRole('button', { name: /start free/i })
    );
    await expect(startBtn.first()).toBeVisible();

    // Verify pricing link
    const pricingLink = page.getByRole('link', { name: /pricing/i });
    await expect(pricingLink.first()).toBeVisible();
  });

  test('pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForTimeout(500);

    // Verify tier cards exist (Free, Pro, Team)
    await expect(page.getByText('Free').first()).toBeVisible();
    await expect(page.getByText('Pro').first()).toBeVisible();
    await expect(page.getByText('Team').first()).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(500);

    // Verify email input
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(
      page.locator('input[type="email"]')
    );
    await expect(emailInput.first()).toBeVisible();

    // Verify password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput.first()).toBeVisible();

    // Verify sign-in button
    const signInBtn = page.getByRole('button', { name: /sign in/i });
    await expect(signInBtn.first()).toBeVisible();

    // Verify access code section
    const accessCodeSection = page.getByText(/access code/i);
    await expect(accessCodeSection.first()).toBeVisible();
  });

  test('session expired banner', async ({ page }) => {
    await page.goto('/login?expired=true');
    await page.waitForTimeout(500);

    await expect(page.getByText(/session has expired/i)).toBeVisible();
  });

  test('404 page', async ({ page }) => {
    await page.goto('/nonexistent-route');
    await page.waitForTimeout(500);

    const notFoundText = page.getByText(/not found/i).or(
      page.getByText(/404/i)
    );
    await expect(notFoundText.first()).toBeVisible();
  });

  test('account page accessible', async ({ page }) => {
    await page.goto('/account');
    await page.waitForTimeout(1000);

    // Verify profile section loads (authenticated via setup)
    const profileSection = page.getByText(/profile|account|plan|usage/i);
    await expect(profileSection.first()).toBeVisible({ timeout: 5000 });
  });
});

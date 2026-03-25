import { test, expect } from '@playwright/test';

/**
 * P0 E2E tests for authentication flows.
 *
 * These tests run against the live dev server (frontend :5174, backend :3007)
 * WITHOUT pre-authenticated storage state so we can exercise login/guard
 * behavior from a clean slate.
 */

// Override the default project config — these tests must run WITHOUT
// the saved auth state so that navigation guards and login flows are testable.
test.use({ storageState: { cookies: [], origins: [] } });

// ---------------------------------------------------------------------------
// Login Page UI
// ---------------------------------------------------------------------------
test.describe('Login Page UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('1 - renders email and password fields', async ({ page }) => {
    const emailInput = page.locator('#login-email');
    await expect(emailInput).toBeVisible();

    const passwordInput = page.locator('#login-password');
    await expect(passwordInput).toBeVisible();
  });

  test('2 - Sign In button is disabled when fields are empty', async ({ page }) => {
    const signInBtn = page.getByRole('button', { name: 'Sign In' }).first();
    await expect(signInBtn).toBeDisabled();
  });

  test('3 - Sign In button enables when email and password are filled', async ({ page }) => {
    await page.locator('#login-email').fill('user@example.com');
    await page.locator('#login-password').fill('somepassword');

    const signInBtn = page.getByRole('button', { name: 'Sign In' }).first();
    await expect(signInBtn).toBeEnabled();
  });

  test('4 - "Sign In with Code" expands access code input', async ({ page }) => {
    // The access code input should not be visible initially
    const codeInput = page.getByPlaceholder('Enter your access code');
    await expect(codeInput).not.toBeVisible();

    // Click the toggle button
    await page.getByRole('button', { name: /sign in with code/i }).click();

    // Now the code input should be visible
    await expect(codeInput).toBeVisible();
  });

  test('5 - access code login with CANVAS-DEMO2025 redirects to /canvas', async ({ page }) => {
    // Expand access code section
    await page.getByRole('button', { name: /sign in with code/i }).click();

    const codeInput = page.getByPlaceholder('Enter your access code');
    await expect(codeInput).toBeVisible();
    await codeInput.fill('CANVAS-DEMO2025');

    // Use the submit button inside the access code form (not the toggle button)
    const signInCodeBtn = page.locator('form button[type="submit"]').last();
    await expect(signInCodeBtn).toBeEnabled();
    await signInCodeBtn.click();

    await page.waitForURL('**/canvas**', { timeout: 15000 });
    await expect(page).toHaveURL(/\/canvas/);
  });

  test('6 - invalid access code shows error message', async ({ page }) => {
    // Expand access code section
    await page.getByRole('button', { name: /sign in with code/i }).click();

    const codeInput = page.getByPlaceholder('Enter your access code');
    await codeInput.fill('INVALID-CODE-12345');

    const signInCodeBtn = page.locator('form button[type="submit"]').last();
    await signInCodeBtn.click();

    // Toast error should appear
    const toast = page.locator('[role="status"]').or(page.locator('.go3958317564'));
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
  });

  test('7 - Sign Up tab switches to signup form', async ({ page }) => {
    const signUpTab = page.getByRole('tab', { name: 'Sign Up' });
    await signUpTab.click();

    // Signup form should show name field
    const nameInput = page.locator('#register-name');
    await expect(nameInput).toBeVisible();
  });

  test('8 - signup form shows name, email, password fields', async ({ page }) => {
    await page.getByRole('tab', { name: 'Sign Up' }).click();

    await expect(page.locator('#register-name')).toBeVisible();
    await expect(page.locator('#register-email')).toBeVisible();
    await expect(page.locator('#register-password')).toBeVisible();
  });

  test('9 - password strength indicator appears while typing', async ({ page }) => {
    await page.getByRole('tab', { name: 'Sign Up' }).click();

    const passwordInput = page.locator('#register-password');
    await passwordInput.fill('ab');

    // Strength label should be visible (e.g. "Weak")
    const strengthLabel = page.getByText(/Weak|Fair|Good|Strong/);
    await expect(strengthLabel).toBeVisible();

    // Typing a stronger password should update the label
    await passwordInput.fill('StrongP@ss123');
    await expect(page.getByText('Strong')).toBeVisible();
  });

  test('10 - forgot password link navigates to /forgot-password', async ({ page }) => {
    const forgotLink = page.getByRole('link', { name: /forgot password/i });
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await page.waitForURL('**/forgot-password**', { timeout: 5000 });
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});

// ---------------------------------------------------------------------------
// Forgot Password Page
// ---------------------------------------------------------------------------
test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('11 - renders email input', async ({ page }) => {
    const emailInput = page.locator('#reset-email');
    await expect(emailInput).toBeVisible();

    // Also verify heading
    await expect(page.getByText('Reset your password')).toBeVisible();
  });

  test('12 - submitting email shows success message', async ({ page }) => {
    const emailInput = page.locator('#reset-email');
    await emailInput.fill('anyuser@example.com');

    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    // Should show the success message regardless of whether the email exists
    await expect(page.getByText(/if an account exists/i)).toBeVisible({ timeout: 10000 });
  });

  test('13 - empty email keeps Send button disabled', async ({ page }) => {
    const sendBtn = page.getByRole('button', { name: 'Send Reset Link' });
    await expect(sendBtn).toBeDisabled();
  });

  test('14 - back to login link works', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /back to sign in/i });
    await expect(backLink).toBeVisible();
    await backLink.click();

    await page.waitForURL('**/login**', { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Navigation Guards
// ---------------------------------------------------------------------------
test.describe('Navigation Guards', () => {
  test('15 - /canvas redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/canvas');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('16 - /account redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/account');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('17 - /repository redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/repository');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('18 - /team redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/team');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('19 - after login, user is redirected to /canvas', async ({ page }) => {
    // Go to login page
    await page.goto('/login');

    // Log in via access code
    await page.getByRole('button', { name: /sign in with code/i }).click();
    const codeInput = page.getByPlaceholder('Enter your access code');
    await codeInput.fill('CANVAS-DEMO2025');

    const signInCodeBtn = page.locator('form button[type="submit"]').last();
    await expect(signInCodeBtn).toBeEnabled();
    await signInCodeBtn.click();

    // Should end up on /canvas
    await page.waitForURL('**/canvas**', { timeout: 15000 });
    await expect(page).toHaveURL(/\/canvas/);
  });

  test('20 - logout clears auth and redirects to /login', async ({ page }) => {
    // First, log in
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in with code/i }).click();
    const codeInput = page.getByPlaceholder('Enter your access code');
    await codeInput.fill('CANVAS-DEMO2025');

    const signInCodeBtn = page.locator('form button[type="submit"]').last();
    await expect(signInCodeBtn).toBeEnabled();
    await signInCodeBtn.click();
    await page.waitForURL('**/canvas**', { timeout: 15000 });

    // Now clear auth from localStorage (simulates logout) and navigate
    await page.evaluate(() => {
      localStorage.removeItem('qualcanvas-auth');
    });

    // Navigate to a protected route — should redirect to login
    await page.goto('/canvas');
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

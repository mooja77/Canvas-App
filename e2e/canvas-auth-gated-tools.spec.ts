import { expect, test } from '@playwright/test';
import { isLegacyE2eAuth, openCanvas } from './helpers';

/**
 * Sprint 0 scaffold — Horizon 1C (auth-gated tool states).
 *
 * Tests are skipped until features that require email auth show an explicit
 * email-auth-required state instead of an indefinite spinner / silent 401.
 * Maps to finding #6 (Research Calendar behaves poorly on legacy access-code
 * auth).
 *
 * Flip `test.skip(...)` → `test(...)` as each finding gets a verified fix.
 */

test.skip('finding #6: legacy auth opening Research Calendar shows email-auth-required state', async ({ page }) => {
  await openCanvas(page);

  const onLegacy = await isLegacyE2eAuth(page);
  test.skip(!onLegacy, 'Test requires legacy access-code auth');

  await page
    .getByRole('button', { name: /Research Calendar|Calendar/i })
    .first()
    .click();

  // Acceptable: visible disabled state OR an explicit message that the user
  // must link an email account. NOT acceptable: indefinite spinner + console
  // 401 from /api/calendar/events.
  const explainer = page.getByText(/email|link your account|sign in/i).first();
  await expect(explainer).toBeVisible({ timeout: 3000 });

  const spinner = page.locator('[role="progressbar"], .animate-spin');
  // If a spinner appears at all, it must resolve to the explainer within 3s
  // (no indefinite loading).
  await expect(spinner).toHaveCount(0, { timeout: 5000 });
});

test.skip('finding #6: legacy auth either hides Research Calendar OR labels it as email-only', async ({ page }) => {
  await openCanvas(page);

  const onLegacy = await isLegacyE2eAuth(page);
  test.skip(!onLegacy, 'Test requires legacy access-code auth');

  const calendarButton = page.getByRole('button', { name: /Research Calendar|Calendar/i }).first();

  // The button should either be hidden, disabled, or visibly annotated as
  // "Email required" — not silently navigable into a broken modal.
  const visible = await calendarButton.isVisible({ timeout: 1000 }).catch(() => false);
  if (visible) {
    const isDisabled = await calendarButton.isDisabled();
    const label = (await calendarButton.textContent()) || '';
    expect(isDisabled || /email|link/i.test(label)).toBeTruthy();
  }
});

import { expect, test } from '@playwright/test';
import { openCanvas } from './helpers';

/**
 * Sprint 0 scaffold — Horizon 1C (modal accessibility hygiene).
 *
 * Tests are skipped until every modal close icon has aria-label="Close",
 * dialogs are wrapped in role="dialog" + aria-modal="true", and rating
 * controls have accessible names (Rate 1 star, Rate 2 stars, ...).
 * Maps to finding #5 (modals are icon-only and mostly unnamed).
 *
 * Flip `test.skip(...)` → `test(...)` as each finding gets a verified fix.
 */

const MODALS = [
  { name: 'Project Overview', trigger: /Project Overview|Overview/i },
  { name: 'Excerpt Browser', trigger: /Excerpt Browser|Excerpts/i },
  { name: 'Rich Export Report', trigger: /Rich Export|Export Report/i },
  { name: 'Ethics Compliance', trigger: /Ethics/i },
  { name: 'Code Weighting', trigger: /Code Weighting|Weighting/i },
  { name: 'Research Calendar', trigger: /Research Calendar|Calendar/i },
  { name: 'Share Canvas', trigger: /Share/i },
] as const;

for (const modal of MODALS) {
  test.skip(`finding #5: ${modal.name} modal exposes role=dialog with aria-modal=true`, async ({ page }) => {
    await openCanvas(page);

    await page.getByRole('button', { name: modal.trigger }).first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test.skip(`finding #5: ${modal.name} modal has a named Close control`, async ({ page }) => {
    await openCanvas(page);

    await page.getByRole('button', { name: modal.trigger }).first().click();
    const closeBtn = page.getByRole('button', { name: /^Close$/i }).first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test.skip('finding #5: Code Weighting rating controls have accessible names (Rate N stars)', async ({ page }) => {
  await openCanvas(page);

  await page
    .getByRole('button', { name: /Code Weighting|Weighting/i })
    .first()
    .click();
  for (let stars = 1; stars <= 5; stars++) {
    const button = page.getByRole('button', { name: new RegExp(`Rate ${stars} star`, 'i') });
    await expect(button.first()).toBeVisible();
  }
});

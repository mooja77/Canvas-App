import { expect, test } from '@playwright/test';
import { openCanvas } from './helpers';

/**
 * Sprint 0 scaffold — Horizon 1B (responsive popover primitive).
 *
 * Tests are skipped until the collision-aware popover primitive lands and
 * Tools + Analyze are converted to use it. Each test maps to a numbered
 * finding in `test-results/ui-ux-review-2026-05-14-deep-live-report.md`.
 *
 * Flip `test.skip(...)` → `test(...)` as each finding gets a verified fix.
 *
 * Goal: dropdowns/popovers never extend past the viewport, never overlap
 * critical canvas controls, and remain operable on mobile/tablet/desktop.
 */

const BREAKPOINTS = [
  { name: 'mobile-compact', w: 320, h: 568 },
  { name: 'mobile-portrait', w: 390, h: 844 },
  { name: 'mobile-landscape', w: 568, h: 320 },
  { name: 'tablet-portrait', w: 768, h: 1024 },
  { name: 'desktop-narrow', w: 1024, h: 640 },
] as const;

for (const bp of BREAKPOINTS) {
  test.skip(`finding #13, #19: Tools menu does not clip at ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.w, height: bp.h });
    await openCanvas(page);

    await page.locator('[data-tour="canvas-btn-ai"] button').click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bp.w);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bp.h);
  });

  test.skip(`finding #13, #20: Analyze menu does not clip at ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.w, height: bp.h });
    await openCanvas(page);

    await page
      .getByRole('button', { name: /Analyze/i })
      .first()
      .click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(bp.w);
    expect(box!.y + box!.height).toBeLessThanOrEqual(bp.h);
  });
}

test.skip('finding #4: minimap fades in deliberately (no flicker)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCanvas(page);

  // Minimap should either be fully opaque from first paint or animate from
  // 0 to 1 over a known duration. Flicker is defined as 2+ unique frame
  // hashes for the minimap region within the first 500ms after fit.
  const minimap = page.locator('.react-flow__minimap');
  await expect(minimap).toBeVisible();
  const opacity = await minimap.evaluate((el) => getComputedStyle(el).opacity);
  expect(parseFloat(opacity)).toBeGreaterThanOrEqual(0.95);
});

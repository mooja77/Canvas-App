import { expect, test } from '@playwright/test';
import { getViewportTransform, openCanvas } from './helpers';

/**
 * Sprint 0 scaffold — Horizon 1A (fit, framing, auto-layout math).
 *
 * Tests are skipped until the dynamic fit/framing fix lands. Each test maps
 * to a numbered finding in `test-results/ui-ux-review-2026-05-14-deep-live-report.md`.
 *
 * Flip `test.skip(...)` → `test(...)` as each finding gets a verified fix.
 *
 * Goal: first load at each breakpoint shows meaningful graph content
 * (visible nodes >= ceil(0.7 * totalNodes), zero offscreen-clipped, fit
 * controls clickable) — not a blank shell.
 */

const BREAKPOINTS = [
  { name: 'mobile-portrait', w: 390, h: 844, minVisibleRatio: 0.7 },
  { name: 'mobile-landscape', w: 568, h: 320, minVisibleRatio: 0.6 },
  { name: 'mobile-compact', w: 320, h: 568, minVisibleRatio: 0.7 },
  { name: 'tablet-portrait', w: 768, h: 1024, minVisibleRatio: 0.85 },
  { name: 'tablet-landscape', w: 1024, h: 768, minVisibleRatio: 0.9 },
  { name: 'desktop-narrow', w: 1024, h: 640, minVisibleRatio: 0.9 },
] as const;

for (const bp of BREAKPOINTS) {
  test(`finding #1, #2, #17, #18: initial fit renders ${bp.minVisibleRatio * 100}%+ of nodes at ${bp.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: bp.w, height: bp.h });
    await openCanvas(page);

    // Wait for at least one node to render. openCanvas returns once
    // .react-flow__pane is attached, but onlyRenderVisibleElements +
    // a brief mount race can leave 0 nodes mounted until the fit settles.
    await page.locator('.react-flow__node').first().waitFor({ state: 'attached', timeout: 8000 });

    const totalNodes = await page.locator('.react-flow__node').count();
    expect(totalNodes).toBeGreaterThan(0);

    const visible = await page.locator('.react-flow__node:visible').count();
    expect(visible / totalNodes).toBeGreaterThanOrEqual(bp.minVisibleRatio);

    const transform = await getViewportTransform(page);
    expect(transform).not.toBeNull();
    expect(transform!.scale).toBeGreaterThan(0.05);
  });
}

test('finding #18: orientation change re-runs fit and recovers graph', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCanvas(page);
  await page.locator('.react-flow__node').first().waitFor({ state: 'attached', timeout: 8000 });

  await page.setViewportSize({ width: 844, height: 390 });
  // ResizeObserver debounce (200ms) + animation (200ms) + buffer.
  await page.waitForTimeout(800);

  const transform = await getViewportTransform(page);
  expect(transform).not.toBeNull();
  const visible = await page.locator('.react-flow__node:visible').count();
  expect(visible).toBeGreaterThan(0);
});

test('finding #3: Fit View control is not intercepted by minimap/status at tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openCanvas(page);

  const fitView = page.locator('.react-flow__controls-fitview');
  await expect(fitView).toBeVisible();
  await fitView.click(); // should not throw "intercepted by SVG/status bar"
});

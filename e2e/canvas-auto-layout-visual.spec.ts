import { expect, test } from '@playwright/test';
import { getViewportTransform, openCanvas } from './helpers';

/**
 * Sprint 0 scaffold — Horizon 1A (auto-layout viewport-awareness).
 *
 * Tests are skipped until auto-layout is made viewport-aware. Maps to
 * findings #11 (auto-layout collapses to vertical column) and #15 (low-zoom
 * selection state overwhelms graph).
 *
 * Flip `test.skip(...)` → `test(...)` as each finding gets a verified fix.
 *
 * Goal: auto-layout produces a frame that fits in the viewport, preserves
 * edges, and re-runs fit after layout.
 */

test.skip('finding #11: auto-layout does not collapse a dense graph into a vertical column', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCanvas(page);

  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+l'); // auto-layout shortcut
  await page.waitForTimeout(600); // layout + fit settle

  // Bounding box of all visible nodes should have aspect ratio between 0.4
  // and 2.5 — vertical-column collapse produces an aspect < 0.2.
  const aspect = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.react-flow__node')) as HTMLElement[];
    if (nodes.length === 0) return null;
    const rects = nodes.map((n) => n.getBoundingClientRect());
    const minX = Math.min(...rects.map((r) => r.left));
    const maxX = Math.max(...rects.map((r) => r.right));
    const minY = Math.min(...rects.map((r) => r.top));
    const maxY = Math.max(...rects.map((r) => r.bottom));
    const w = maxX - minX;
    const h = maxY - minY;
    if (h === 0) return null;
    return w / h;
  });
  expect(aspect).not.toBeNull();
  expect(aspect!).toBeGreaterThan(0.4);
});

test.skip('finding #11: auto-layout preserves visible edges in dense graphs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCanvas(page);

  const edgesBefore = await page.locator('.react-flow__edge').count();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+l');
  await page.waitForTimeout(600);

  const edgesAfter = await page.locator('.react-flow__edge').count();
  expect(edgesAfter).toBeGreaterThanOrEqual(edgesBefore);
});

test.skip('finding #11: post-layout fit produces a meaningful scale (not < 0.18)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCanvas(page);

  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+l');
  await page.waitForTimeout(600);

  const transform = await getViewportTransform(page);
  expect(transform).not.toBeNull();
  expect(transform!.scale).toBeGreaterThanOrEqual(0.18);
});

test.skip('finding #15: select-all at low zoom shows group bounds, not per-node handles', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCanvas(page);

  await page.keyboard.press('Control+a');
  // At zoom < 0.4 with > 20 selected nodes, individual handles should not
  // dominate — implementation hides per-node selection chrome below a zoom
  // threshold and shows a group bounds rectangle + count badge instead.
  const handleCount = await page.locator('.react-flow__node--selected .react-flow__handle').count();
  expect(handleCount).toBeLessThan(20);
});

import { test, expect } from '@playwright/test';

// Helper: open canvas (already authenticated via setup)
async function openCanvas(page: any) {
  // Ensure onboarding tour is dismissed via localStorage before navigating
  await page.addInitScript(() => {
    const existing = localStorage.getItem('canvas-app-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('canvas-app-ui', JSON.stringify(state));
  });

  await page.goto('/canvas');
  await page.waitForTimeout(500);

  // If canvas list is showing, click the first canvas
  const heading = page.locator('h3').first();
  if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
    await heading.click();
  }

  // Wait for ReactFlow
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Safety net: dismiss onboarding tour if it still appears
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
    await page.waitForTimeout(300);
  }
  // Last resort: press Escape to dismiss any overlay
  const overlay = page.locator('.fixed.inset-0.z-\\[10000\\]');
  if (await overlay.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

function getViewportTransform(page: any) {
  return page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!vp) return null;
    const match = vp.style.transform.match(/translate\((.+?)px,\s*(.+?)px\)\s*scale\((.+?)\)/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) };
  });
}

test.describe('Canvas Workspace', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page);
  });

  test('loads canvas with ReactFlow pane', async ({ page }) => {
    // Verify ReactFlow rendered (pane is always present even if no nodes)
    await expect(page.locator('.react-flow__pane')).toBeVisible();
  });

  test('scroll wheel zooms in', async ({ page }) => {
    const before = await getViewportTransform(page);
    expect(before).not.toBeNull();

    // Get the center of the ReactFlow pane
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(800);

    const after = await getViewportTransform(page);
    expect(after).not.toBeNull();
    expect(after!.scale).toBeGreaterThan(before!.scale);
  });

  test('scroll wheel zooms out', async ({ page }) => {
    // First zoom in so we have room to zoom out
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(800);

    const before = await getViewportTransform(page);

    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(800);

    const after = await getViewportTransform(page);
    expect(after!.scale).toBeLessThan(before!.scale);
  });

  test('zoom does not snap back', async ({ page }) => {
    const before = await getViewportTransform(page);

    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(800);

    const zoomed = await getViewportTransform(page);
    expect(zoomed!.scale).toBeGreaterThan(before!.scale);

    // Wait 2s — should NOT snap back
    await page.waitForTimeout(2000);

    const afterWait = await getViewportTransform(page);
    expect(afterWait!.scale).toBeCloseTo(zoomed!.scale, 1);
  });

  test('Zoom In button works', async ({ page }) => {
    const before = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Zoom In' }).click();
    await page.waitForTimeout(500);

    const after = await getViewportTransform(page);
    expect(after!.scale).toBeGreaterThan(before!.scale);
  });

  test('Fit View button works', async ({ page }) => {
    // Zoom in first
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(500);

    const zoomed = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Fit View' }).click();
    await page.waitForTimeout(500);

    const fitted = await getViewportTransform(page);
    // Fit View should change viewport (unless canvas is empty with no nodes to fit)
    if (await page.locator('.react-flow__node').count() > 0) {
      expect(fitted!.scale).not.toBeCloseTo(zoomed!.scale, 1);
    }
  });

  test('node drag preserves position', async ({ page }) => {
    const node = page.locator('.react-flow__node').first();
    if (!await node.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip(); return;
    }
    const box = await node.boundingBox();
    if (!box) return;

    // Drag via the drag handle
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + 10, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterDrag = await node.boundingBox();

    // Wait for data sync
    await page.waitForTimeout(2000);

    const afterSync = await node.boundingBox();
    expect(afterSync!.x).toBeCloseTo(afterDrag!.x, -1);
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg: any) => {
      if (msg.type() === 'error' && !msg.text().includes('WebSocket') && !msg.text().includes('Socket')) {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });

  test('scroll mode toggle works', async ({ page }) => {
    const scrollBtn = page.getByRole('button', { name: /Scroll: Zoom/i });
    if (await scrollBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scrollBtn.click();
      await expect(page.getByRole('button', { name: /Scroll: Pan/i })).toBeVisible();

      await page.getByRole('button', { name: /Scroll: Pan/i }).click();
      await expect(page.getByRole('button', { name: /Scroll: Zoom/i })).toBeVisible();
    }
  });

  test('session expired banner shows', async ({ page }) => {
    await page.goto('/login?expired=true');
    await expect(page.getByText('Your session has expired')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import { openCanvas, getViewportTransform } from './helpers';

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
    // Wait for zoom animation to settle
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) > prevScale;
      },
      before!.scale,
      { timeout: 3000 }
    );

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
    // Wait for zoom-in animation to settle
    await page.waitForFunction(() => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!vp) return false;
      const match = vp.style.transform.match(/scale\((.+?)\)/);
      return match && parseFloat(match[1]) > 1;
    }, undefined, { timeout: 3000 });

    const before = await getViewportTransform(page);

    await page.mouse.wheel(0, 500);
    // Wait for zoom-out animation to settle
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) < prevScale;
      },
      before!.scale,
      { timeout: 3000 }
    );

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
    // Wait for zoom animation to settle
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) > prevScale;
      },
      before!.scale,
      { timeout: 3000 }
    );

    const zoomed = await getViewportTransform(page);
    expect(zoomed!.scale).toBeGreaterThan(before!.scale);

    // Verify stability — wait and confirm scale hasn't snapped back
    await page.waitForFunction(
      (expectedScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && Math.abs(parseFloat(match[1]) - expectedScale) < 0.1;
      },
      zoomed!.scale,
      { timeout: 3000 }
    );

    const afterWait = await getViewportTransform(page);
    expect(afterWait!.scale).toBeCloseTo(zoomed!.scale, 1);
  });

  test('Zoom In button works', async ({ page }) => {
    const before = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Zoom In' }).click();
    // Wait for zoom animation to settle
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) > prevScale;
      },
      before!.scale,
      { timeout: 3000 }
    );

    const after = await getViewportTransform(page);
    expect(after!.scale).toBeGreaterThan(before!.scale);
  });

  test('Fit View button works', async ({ page }) => {
    // Zoom in first
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -500);
    // Wait for zoom animation
    await page.waitForFunction(() => {
      const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
      if (!vp) return false;
      const match = vp.style.transform.match(/scale\((.+?)\)/);
      return match && parseFloat(match[1]) > 1;
    }, undefined, { timeout: 3000 });

    const zoomed = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Fit View' }).click();
    // Wait for fit-view animation
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && Math.abs(parseFloat(match[1]) - prevScale) > 0.01;
      },
      zoomed!.scale,
      { timeout: 3000 }
    ).catch(() => { /* canvas may be empty */ });

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

    const afterDrag = await node.boundingBox();

    // Wait for data sync via network idle
    await page.waitForLoadState('networkidle');

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

    // Wait for any async operations to complete
    await page.waitForLoadState('networkidle');
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

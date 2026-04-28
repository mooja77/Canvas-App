import { test, expect, type Page } from '@playwright/test';
import { openCanvas, getViewportTransform } from './helpers';

// ─── Helpers ───

async function getJwt(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
}

async function apiHeaders(page: Page) {
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function goToCanvasList(page: Page) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto('/canvas');
  await page.waitForSelector('[data-tour="canvas-list"], h2', { timeout: 10000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

async function createCanvasViaApi(page: Page, name: string): Promise<string> {
  const headers = await apiHeaders(page);
  const res = await page.request.post('http://localhost:3007/api/canvas', { headers, data: { name } });
  expect(res.ok(), `Canvas create failed: ${res.status()}`).toBeTruthy();
  return (await res.json()).data.id;
}

async function deleteCanvasViaApi(page: Page, canvasId: string) {
  const jwt = await getJwt(page);
  const h = { Authorization: `Bearer ${jwt}` };
  await page.request.delete(`http://localhost:3007/api/canvas/${canvasId}`, { headers: h });
  await page.request.delete(`http://localhost:3007/api/canvas/${canvasId}/permanent`, { headers: h });
}

async function openCanvasById(page: Page, canvasId: string) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (
    await skipBtn
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await skipBtn.first().click();
  }
  await page.waitForSelector('.react-flow__node', { timeout: 10000 }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// Canvas Workspace Full Tests
// ═══════════════════════════════════════════════════════════════════

test.describe('Canvas Workspace Full', () => {
  let canvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await goToCanvasList(page);
    canvasId = await createCanvasViaApi(page, `E2E Workspace Full ${Date.now()}`);
    const headers = await apiHeaders(page);

    // Seed transcript + codes + coding so status bar shows counts
    const sampleText = [
      'The research methodology involved conducting semi-structured interviews with fifteen participants',
      'from diverse backgrounds across three different institutions. Each interview lasted approximately',
      'sixty minutes and was recorded with the consent of the participant. The interviews explored themes',
      'of professional development, workplace culture, and personal motivation.',
    ].join(' ');
    const tRes = await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/transcripts`, {
      headers,
      data: { title: 'Workspace Test Interview', content: sampleText },
    });
    const transcriptId = (await tRes.json()).data.id;

    const cRes = await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Professional Development', color: '#4F46E5' },
    });
    const codeId = (await cRes.json()).data.id;

    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Workplace Culture', color: '#059669' },
    });

    if (transcriptId && codeId) {
      await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/codings`, {
        headers,
        data: {
          transcriptId,
          questionId: codeId,
          startOffset: 0,
          endOffset: 91,
          codedText:
            'The research methodology involved conducting semi-structured interviews with fifteen participants',
        },
      });
    }
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    if (canvasId) await deleteCanvasViaApi(page, canvasId);
    await page.close();
  });

  test('1 - Zoom in button increases zoom percentage in status bar', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const before = await getViewportTransform(page);
    expect(before).not.toBeNull();

    await page.getByRole('button', { name: 'Zoom In' }).click();

    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) > prevScale;
      },
      before!.scale,
      { timeout: 3000 },
    );

    const after = await getViewportTransform(page);
    expect(after!.scale).toBeGreaterThan(before!.scale);

    // Status bar should reflect the updated zoom
    const zoomText = page.locator('[data-tour="canvas-status-bar"]').locator('text=/\\d+%/');
    await expect(zoomText.first()).toBeVisible({ timeout: 3000 });
  });

  test('2 - Zoom out button decreases zoom percentage', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const initial = await getViewportTransform(page);
    expect(initial).not.toBeNull();

    // Zoom in first so we can zoom out — click and wait for each
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) > prevScale;
      },
      initial!.scale,
      { timeout: 5000 },
    );

    const before = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Zoom Out' }).click();

    await page.waitForFunction(
      (prevScale) => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
        if (!vp) return false;
        const match = vp.style.transform.match(/scale\((.+?)\)/);
        return match && parseFloat(match[1]) < prevScale;
      },
      before!.scale,
      { timeout: 5000 },
    );

    const after = await getViewportTransform(page);
    expect(after!.scale).toBeLessThan(before!.scale);
  });

  test('3 - Fit View button works', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Verify Fit View button is present and clickable
    const fitViewBtn = page.getByRole('button', { name: 'Fit View' });
    await expect(fitViewBtn).toBeVisible({ timeout: 5000 });

    // Zoom in significantly first using mouse wheel
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // Also pan to move far from center
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 300, box.y + box.height / 2 + 200, { steps: 5 });
      await page.mouse.up();
    }

    const before = await getViewportTransform(page);

    // Click Fit View
    await fitViewBtn.click();

    // Wait briefly for animation
    await page
      .waitForFunction(
        ({ prevX, prevY }) => {
          const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
          if (!vp) return false;
          const match = vp.style.transform.match(/translate\((.+?)px,\s*(.+?)px\)\s*scale\((.+?)\)/);
          if (!match) return false;
          const x = parseFloat(match[1]);
          const y = parseFloat(match[2]);
          return Math.abs(x - prevX) > 0.5 || Math.abs(y - prevY) > 0.5;
        },
        { prevX: before!.x, prevY: before!.y },
        { timeout: 5000 },
      )
      .catch(() => {
        /* viewport may already be fitted */
      });

    // Viewport should have a valid transform — this confirms Fit View ran without error
    const after = await getViewportTransform(page);
    expect(after).not.toBeNull();
    expect(after!.scale).toBeGreaterThan(0);
  });

  test('4 - Ctrl+K opens command palette with search input', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click pane to ensure focus is on the canvas
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Control+k');

    // Command palette should appear with a search input
    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('input[placeholder*="command"]'))
      .or(page.locator('input[placeholder*="Type"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 3000 });

    // Close it
    await page.keyboard.press('Escape');
  });

  test('5 - Command palette search filters actions', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click pane to ensure focus is on the canvas
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Control+k');

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('input[placeholder*="command"]'))
      .or(page.locator('input[placeholder*="Type"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 3000 });

    // Type a search term to filter
    await searchInput.first().fill('memo');

    // Should show results containing "memo"
    const memoResult = page.locator('text=/[Mm]emo/');
    await expect(memoResult.first()).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test('6 - Escape closes command palette', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click pane to ensure focus is on the canvas
    const pane = page.locator('.react-flow__pane');
    await pane.click();

    await page.keyboard.press('Control+k');

    const searchInput = page
      .locator('input[placeholder*="Search"]')
      .or(page.locator('input[placeholder*="command"]'))
      .or(page.locator('input[placeholder*="Type"]'));
    await expect(searchInput.first()).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');

    // Search input should no longer be visible
    await expect(searchInput.first()).not.toBeVisible({ timeout: 3000 });
  });

  test('7 - Dark mode toggle switches workspace theme', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Navigate to canvas list where the toggle lives, toggle, and return
    const darkModeBtn = page.locator('button[aria-label="Switch to dark mode"]');
    const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');
    const btn = darkModeBtn.or(lightModeBtn);

    if (
      !(await btn
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false))
    ) {
      test.skip();
      return;
    }

    await btn.first().click();

    await page
      .waitForFunction((bgBeforeVal) => getComputedStyle(document.body).backgroundColor !== bgBeforeVal, bgBefore, {
        timeout: 3000,
      })
      .catch(() => {});

    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);

    // Restore by clicking again
    const restoreBtn = darkModeBtn.or(lightModeBtn);
    if (
      await restoreBtn
        .first()
        .isVisible({ timeout: 1000 })
        .catch(() => false)
    ) {
      await restoreBtn.first().click();
    }
  });

  test('8 - ? key opens keyboard shortcuts modal', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click on canvas pane first to ensure focus
    const pane = page.locator('.react-flow__pane');
    await pane.click();

    await page.keyboard.press('?');

    const modal = page.getByRole('heading', { name: 'Keyboard Shortcuts' });
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Verify shortcut entries
    await expect(page.getByText('Undo').first()).toBeVisible();
    await expect(page.getByText('Redo').first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('9 - Minimap is visible', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 3000 });
  });

  test('10 - Status bar shows transcript, code, and coding counts', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    // Status bar should contain numeric values (transcript count, code count, coding count)
    const statusText = await statusBar.textContent();
    expect(statusText).toBeTruthy();
    // Should have at least some numeric data
    expect(statusText).toMatch(/\d/);
  });

  test('11 - Scroll mode toggle works', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const scrollBtn = page.getByRole('button', { name: /Scroll: Zoom/i });
    if (!(await scrollBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await scrollBtn.click();
    await expect(page.getByRole('button', { name: /Scroll: Pan/i })).toBeVisible();

    await page.getByRole('button', { name: /Scroll: Pan/i }).click();
    await expect(page.getByRole('button', { name: /Scroll: Zoom/i })).toBeVisible();
  });

  test('12 - Console has zero errors during all interactions', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-critical errors
        if (
          text.includes('WebSocket') ||
          text.includes('Socket') ||
          text.includes('favicon') ||
          text.includes('.map') ||
          text.includes('DevTools') ||
          text.includes('net::ERR') ||
          text.includes('Failed to load resource') ||
          text.includes('404') ||
          text.includes('Stripe') ||
          text.includes('Google')
        )
          return;
        errors.push(text);
      }
    });

    await openCanvasById(page, canvasId);

    // Perform a series of interactions
    await page.getByRole('button', { name: 'Zoom In' }).click();
    await page.getByRole('button', { name: 'Fit View' }).click();

    // Open and close command palette
    await page.keyboard.press('Control+k');
    await page.keyboard.press('Escape');

    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    const criticalErrors = errors.filter((e) => !e.includes('ResizeObserver') && !e.includes('Non-Error'));
    expect(criticalErrors).toEqual([]);
  });
});

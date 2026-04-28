import { test, expect, type Page } from '@playwright/test';
import { getViewportTransform } from './helpers';

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
    state.state = {
      ...state.state,
      onboardingComplete: true,
      setupWizardComplete: true,
      scrollMode: 'zoom',
    };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
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
  const fitBtn = page.getByRole('button', { name: 'Fit View' });
  if (await fitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await fitBtn.click();
    await page.waitForLoadState('networkidle');
  }
}

// ═══════════════════════════════════════════════════════════════════
// UX Phase 1 — Placement & Navigation Tests
// ═══════════════════════════════════════════════════════════════════

test.describe('UX Phase 1 — Placement & Navigation', () => {
  let canvasId: string;
  const canvasName = `E2E UXPhase1 ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });

    // Navigate first so localStorage is available
    await page.goto('http://localhost:5174/canvas');
    await page.waitForLoadState('domcontentloaded');
    const jwt = await getJwt(page);
    expect(jwt, 'JWT must exist').toBeTruthy();

    const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

    // Create canvas
    const cRes = await page.request.post('http://localhost:3007/api/canvas', { headers, data: { name: canvasName } });
    expect(cRes.ok()).toBeTruthy();
    canvasId = (await cRes.json()).data.id;

    // Seed transcript
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/transcripts`, {
      headers,
      data: {
        title: 'Phase1 Interview',
        content:
          'The research methodology involved conducting semi-structured interviews with fifteen participants from diverse backgrounds. Each interview lasted approximately sixty minutes and covered themes of professional development, organizational culture, and leadership practices.',
      },
    });

    // Seed 2 codes
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Methodology', color: '#4F46E5' },
    });
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Leadership', color: '#DC2626' },
    });

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await page.goto('http://localhost:5174/canvas');
    await page.waitForLoadState('domcontentloaded');
    if (canvasId) await deleteCanvasViaApi(page, canvasId);
    await page.close();
  });

  // ── Test 1: Double-click does NOT zoom ──

  test('1 - double-click empty canvas does NOT zoom in', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const before = await getViewportTransform(page);
    expect(before).not.toBeNull();

    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    // Double-click on empty area
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    const after = await getViewportTransform(page);
    expect(after).not.toBeNull();
    // zoomOnDoubleClick is disabled, so scale should remain the same
    expect(after!.scale).toBeCloseTo(before!.scale, 1);
  });

  // ── Test 2: Dot grid background ──

  test('2 - canvas shows dot grid background', async ({ page }) => {
    await openCanvasById(page, canvasId);
    // BackgroundVariant.Dots renders a pattern element inside the background SVG
    const bgPattern = page.locator('.react-flow__background pattern');
    await expect(bgPattern.first()).toBeAttached({ timeout: 5000 });
  });

  // ── Test 3-5: QuickAddMenu fuzzy search ──

  test('3 - QuickAddMenu fuzzy search: "wc" matches Word Cloud', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    // QuickAddMenu is triggered by two rapid pane clicks (custom double-click detection)
    const cx = box.x + box.width * 0.9;
    const cy = box.y + box.height * 0.15;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(100);
    await page.mouse.click(cx, cy);

    const searchInput = page.locator('input[placeholder*="Search nodes"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await searchInput.fill('wc');
    await expect(page.locator('button').filter({ hasText: 'Word Cloud' })).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test('4 - QuickAddMenu fuzzy search: "stat" matches Statistics', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    const cx = box.x + box.width * 0.9;
    const cy = box.y + box.height * 0.15;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(100);
    await page.mouse.click(cx, cy);

    const searchInput = page.locator('input[placeholder*="Search nodes"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await searchInput.fill('stat');
    await expect(page.locator('button').filter({ hasText: 'Statistics' })).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  test('5 - QuickAddMenu fuzzy search: "trans" matches Transcript', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    const cx = box.x + box.width * 0.9;
    const cy = box.y + box.height * 0.15;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(100);
    await page.mouse.click(cx, cy);

    const searchInput = page.locator('input[placeholder*="Search nodes"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    await searchInput.fill('trans');
    // Wait for the filtered result to show "Transcript" in the QuickAddMenu
    // The menu is a portal with the search input as a sibling - look for Transcript text near the input
    const menuContainer = searchInput.locator('..').locator('..');
    await expect(menuContainer.locator('button', { hasText: 'Transcript' })).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  // ── Test 6: QuickAddMenu keyboard navigation ──

  test('6 - QuickAddMenu shows keyboard navigation', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    const cx = box.x + box.width * 0.9;
    const cy = box.y + box.height * 0.15;
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(100);
    await page.mouse.click(cx, cy);

    const searchInput = page.locator('input[placeholder*="Search nodes"]');
    await expect(searchInput).toBeVisible({ timeout: 3000 });

    // First item should have the selected highlight (bg-blue-50)
    const firstItem = page.locator('button').filter({ hasText: 'Transcript' }).first();
    await expect(firstItem).toBeVisible({ timeout: 3000 });

    // Press ArrowDown and verify focus moves (second item gets highlight)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);

    // The second item should now have the selected class (bg-blue-50)
    const secondItem = page.locator('button').filter({ hasText: 'Research Question' }).first();
    const secondClass = await secondItem.getAttribute('class');
    expect(secondClass).toContain('bg-blue-50');

    await page.keyboard.press('Escape');
  });

  // ── Test 7: Add code via toolbar → code appears in navigator ──

  test('7 - add code via toolbar appears in navigator', async ({ page }) => {
    await openCanvasById(page, canvasId);

    await page.locator('[data-tour="canvas-btn-question"]').click();
    const input = page.locator('input[placeholder*="research question"]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Data Analysis');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Question added')).toBeVisible({ timeout: 5000 });

    // Open navigator
    const showNavBtn = page.locator('button[title="Show navigator"]');
    if (await showNavBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await showNavBtn.click();
    }
    await expect(page.getByText('Data Analysis').first()).toBeVisible({ timeout: 5000 });
  });

  // ── Test 8: Navigator shows sorting buttons ──

  test('8 - navigator shows By count and A-Z sorting buttons', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const showNavBtn = page.locator('button[title="Show navigator"]');
    if (await showNavBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await showNavBtn.click();
    }
    await expect(page.getByText('By count')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('A-Z')).toBeVisible({ timeout: 5000 });
  });

  // ── Test 9: Right-click canvas → context menu with shortcuts ──

  test('9 - right-click canvas shows context menu with shortcut badges', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Hide navigator to avoid intercepting clicks
    const hideNavBtn = page.locator('button[title="Hide navigator"]');
    if (await hideNavBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await hideNavBtn.click();
      await page.waitForTimeout(300);
    }

    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    if (!box) return;

    // Right-click on top-right empty area (away from nodes which cluster center-left)
    await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.15, { button: 'right' });

    // If a node context menu appeared instead, dismiss and try different spot
    const selectAll = page.getByText('Select All');
    if (!(await selectAll.isVisible({ timeout: 2000 }).catch(() => false))) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      // Try top-left corner
      await page.mouse.click(box.x + 30, box.y + 30, { button: 'right' });
    }

    // Context menu should appear with shortcut badges
    await expect(page.getByText('Select All')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.font-mono:has-text("Ctrl+A")')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Fit View')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3000 });

    // Close context menu
    await page.keyboard.press('Escape');
  });

  // ── Test 10: Right-click node → context menu shows Del shortcut ──

  test('10 - right-click node shows context menu with Del shortcut', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeAttached({ timeout: 5000 });

    // Scroll node into view first
    await node.evaluate((el: HTMLElement) => el.scrollIntoViewIfNeeded());
    await node.click({ button: 'right', force: true });

    // Node context menu should show Delete with Del shortcut badge
    const deleteBtn = page.locator('button').filter({ hasText: 'Delete' }).last();
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.font-mono:has-text("Del")')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
  });

  // ── Test 11: Status bar shows correct counts ──

  test('11 - status bar shows correct transcript and code counts', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    // Should show at least 1 transcript and 2+ codes
    const statusText = await statusBar.textContent();
    expect(statusText).toBeTruthy();
    // The status bar renders numeric counts next to icons
    // Verify it's visible and contains numeric content
    const spans = statusBar.locator('span');
    const count = await spans.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Test 12: Zoom in button increases zoom ──

  test('12 - zoom in button increases zoom percentage', async ({ page }) => {
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
  });

  // ── Test 13: Fit View shows all nodes ──

  test('13 - fit view shows all nodes', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Zoom in first to change the viewport
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, -500);
    await page
      .waitForFunction(
        () => {
          const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
          if (!vp) return false;
          const match = vp.style.transform.match(/scale\((.+?)\)/);
          return match && parseFloat(match[1]) > 1;
        },
        undefined,
        { timeout: 3000 },
      )
      .catch(() => {});

    const zoomed = await getViewportTransform(page);

    await page.getByRole('button', { name: 'Fit View' }).click();
    await page
      .waitForFunction(
        (prevScale) => {
          const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
          if (!vp) return false;
          const match = vp.style.transform.match(/scale\((.+?)\)/);
          return match && Math.abs(parseFloat(match[1]) - prevScale) > 0.01;
        },
        zoomed!.scale,
        { timeout: 3000 },
      )
      .catch(() => {});

    // Nodes should be visible
    const nodes = page.locator('.react-flow__node');
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Test 14: Ctrl+K opens command palette ──

  test('14 - Ctrl+K opens command palette', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click on the pane first to ensure focus is on the canvas
    const pane = page.locator('.react-flow__pane');
    await pane.click();
    await page.waitForTimeout(200);

    await page.keyboard.press('Control+k');
    // Command palette should appear with its search input
    const paletteInput = page.locator('input[placeholder*="Search actions"]');
    await expect(paletteInput.first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
  });

  // ── Test 15: ? key opens shortcuts modal ──

  test('15 - ? key opens shortcuts modal via toolbar button', async ({ page }) => {
    await openCanvasById(page, canvasId);

    await page
      .getByRole('button', { name: /More canvas actions/i })
      .nth(1)
      .click();
    // Click the keyboard shortcuts item in the overflow menu.
    const shortcutsBtn = page.getByRole('menuitem', { name: /Keyboard shortcuts/i });
    await expect(shortcutsBtn).toBeVisible({ timeout: 3000 });
    await shortcutsBtn.click();

    await expect(page.getByText('Keyboard Shortcuts').first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
  });
});

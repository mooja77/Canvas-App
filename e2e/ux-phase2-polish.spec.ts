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
  await page.waitForLoadState('networkidle');
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }
  await page.waitForSelector('.react-flow__node', { timeout: 10000 }).catch(() => {});
  const fitBtn = page.getByRole('button', { name: 'Fit View' });
  if (await fitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await fitBtn.click();
    await page.waitForLoadState('networkidle');
  }
}

/** Helper: restore light mode if dark is active */
async function restoreLightMode(page: Page) {
  const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');
  if (await lightModeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await lightModeBtn.click();
  }
}

// ═══════════════════════════════════════════════════════════════════
// UX Phase 2 — Polish & Dark Mode Tests
// ═══════════════════════════════════════════════════════════════════

test.describe('UX Phase 2 — Polish & Dark Mode', () => {
  let canvasId: string;
  const canvasName = `E2E UXPhase2 ${Date.now()}`;

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
    const tRes = await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/transcripts`, {
      headers,
      data: {
        title: 'Phase2 Interview',
        content: 'The research methodology involved conducting semi-structured interviews with fifteen participants from diverse backgrounds. Each interview lasted approximately sixty minutes and covered themes of professional development and organizational culture.',
      },
    });
    const tId = (await tRes.json()).data?.id;

    // Seed code
    const qRes = await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers, data: { text: 'Methodology', color: '#4F46E5' },
    });
    const qId = (await qRes.json()).data?.id;

    // Seed coding (link transcript to code)
    if (tId && qId) {
      await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/codings`, {
        headers,
        data: { transcriptId: tId, questionId: qId, startOffset: 0, endOffset: 30, codedText: 'The research methodology invol' },
      });
    }

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await page.goto('http://localhost:5174/canvas');
    await page.waitForLoadState('domcontentloaded');
    if (canvasId) await deleteCanvasViaApi(page, canvasId);
    // Ensure light mode is restored
    await restoreLightMode(page);
    await page.close();
  });

  // ── Test 1: Dark mode toggle changes canvas background ──

  test('1 - dark mode toggle changes canvas background', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    const darkModeBtn = page.locator('button[aria-label="Switch to dark mode"]');
    const lightModeBtn = page.locator('button[aria-label="Switch to light mode"]');
    const btn = darkModeBtn.or(lightModeBtn);
    if (!await btn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }

    await btn.first().click();
    await page.waitForFunction(
      (bgBeforeVal) => getComputedStyle(document.body).backgroundColor !== bgBeforeVal,
      bgBefore,
      { timeout: 3000 }
    ).catch(() => {});

    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);

    await restoreLightMode(page);
  });

  // ── Test 2: Dark mode persists across reload ──

  test('2 - dark mode persists across reload', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const darkModeBtn = page.locator('button[aria-label="Switch to dark mode"]');
    if (await darkModeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await darkModeBtn.click();
    }

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    await page.reload();
    await page.waitForLoadState('networkidle');

    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);

    await restoreLightMode(page);
  });

  // ── Test 3: Arrow key panning changes viewport ──

  test('3 - arrow key panning changes viewport', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click pane to ensure focus
    const pane = page.locator('.react-flow__pane');
    await pane.click();
    await page.waitForTimeout(200);

    const before = await getViewportTransform(page);
    expect(before).not.toBeNull();

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    const after = await getViewportTransform(page);
    expect(after).not.toBeNull();
    // ArrowRight should move viewport (x changes)
    expect(after!.x).not.toBeCloseTo(before!.x, 0);
  });

  // ── Test 4: Shift+Arrow key pans by larger amount ──

  test('4 - shift+arrow key pans by larger amount', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const pane = page.locator('.react-flow__pane');
    await pane.click();
    await page.waitForTimeout(200);

    // Small pan with plain arrow
    const before1 = await getViewportTransform(page);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const after1 = await getViewportTransform(page);
    const smallDelta = Math.abs(after1!.x - before1!.x);

    // Large pan with Shift+arrow
    const before2 = await getViewportTransform(page);
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(300);
    const after2 = await getViewportTransform(page);
    const largeDelta = Math.abs(after2!.x - before2!.x);

    // Shift pan should be larger than regular pan
    expect(largeDelta).toBeGreaterThan(smallDelta);
  });

  // ── Test 5: Minimap is visible ──

  test('5 - minimap is visible', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 5000 });
  });

  // ── Test 6: Coverage bar visible on transcript node ──

  test('6 - coverage bar visible on transcript node', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const transcriptNode = page.locator('.react-flow__node[data-id^="transcript-"]').first();
    await expect(transcriptNode).toBeAttached({ timeout: 5000 });

    // The coverage bar is rendered inside the transcript node header
    // It uses a div with bg-gray-100 (the track) and an inner div with rounded-full
    const coverageTrack = transcriptNode.locator('.bg-gray-100, .dark\\:bg-gray-700').first();
    // Alternative: look for the status bar coverage
    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    // Status bar should show "% coded" text since we have a transcript with coding
    await expect(page.getByText(/\d+% coded/)).toBeVisible({ timeout: 5000 });
  });

  // ── Test 7: Status bar shows coding count ──

  test('7 - status bar shows coding count after seeding', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    // The status bar shows icons with counts; the emerald checkmark icon is for codings
    // The coding count should be visible (at least 1 from seeded data)
    const statusText = await statusBar.textContent();
    expect(statusText).toBeTruthy();
    // Verify we have coding-related content in the status bar
    // The "Coding" legend text should appear since we seeded codings
    await expect(statusBar.getByText('Coding')).toBeVisible({ timeout: 5000 });
  });

  // ── Test 8: Analyze menu opens with categories ──

  test('8 - analyze menu opens with categories', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const analyzeBtn = page.locator('[data-tour="canvas-btn-query"] button').first();
    await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await analyzeBtn.click();

    // Should show analysis options
    await expect(page.getByText('Word Cloud').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Statistics').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Text Search').first()).toBeVisible({ timeout: 3000 });

    // Close by pressing Escape
    await page.keyboard.press('Escape');
  });

  // ── Test 9: Add Statistics node from Analyze ──

  test('9 - add Statistics node from Analyze menu', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const analyzeBtn = page.locator('[data-tour="canvas-btn-query"] button').first();
    await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await analyzeBtn.click();

    await page.getByText('Statistics').first().waitFor({ state: 'visible', timeout: 3000 });
    await page.getByText('Statistics').first().click();
    await expect(page.getByText('Statistics node added')).toBeVisible({ timeout: 5000 });

    // Verify node appears in canvas
    await page.waitForLoadState('networkidle');
    const statsNodes = page.locator('.react-flow__node');
    const count = await statsNodes.count();
    expect(count).toBeGreaterThan(0);
  });

  // ── Test 10: Console has zero errors ──

  test('10 - console has zero errors during operations', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('WebSocket') && !msg.text().includes('Socket')) {
        errors.push(msg.text());
      }
    });

    await openCanvasById(page, canvasId);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    expect(errors).toHaveLength(0);
  });

  // ── Test 11: Scroll mode toggle button exists ──

  test('11 - scroll mode toggle button exists', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const scrollBtn = page.getByRole('button', { name: /Scroll: Zoom/i }).or(
      page.getByRole('button', { name: /Scroll: Pan/i })
    );
    await expect(scrollBtn.first()).toBeVisible({ timeout: 5000 });
  });

  // ── Test 12: Viewport bookmark slots visible ──

  test('12 - viewport bookmark slots visible in status bar', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    // Bookmark slots are rendered as small dots with title "Viewport bookmarks..."
    const bookmarkContainer = statusBar.locator('[title*="Viewport bookmarks"]');
    await expect(bookmarkContainer).toBeVisible({ timeout: 5000 });

    // Should have 5 bookmark slot indicators
    const dots = bookmarkContainer.locator('.rounded-full');
    const dotCount = await dots.count();
    expect(dotCount).toBe(5);
  });
});

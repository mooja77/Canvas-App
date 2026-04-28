import { test, expect, type Page } from '@playwright/test';

// Only run visual regression on Chromium — other browsers render differently
test.skip(({ browserName }) => browserName !== 'chromium', 'Visual regression: Chromium only');

// ═══════════════════════════════════════════════════════════════════
// Visual Regression Tests
// Uses Playwright's built-in screenshot comparison (toHaveScreenshot).
// First run creates baseline snapshots; subsequent runs compare against them.
// Baselines are stored in e2e/visual-regression.spec.ts-snapshots/.
// ═══════════════════════════════════════════════════════════════════

const SCREENSHOT_OPTS = { maxDiffPixels: 250, animations: 'disabled' as const };
const CANVAS_WORKSPACE_SCREENSHOT_OPTS = { ...SCREENSHOT_OPTS, maxDiffPixels: 12000 };
const STANDARD_VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };
const BASE = 'http://localhost:3007/api';
const AUTH_FILE = 'e2e/.auth/user.json';
const VISUAL_CANVAS_NAME = 'Visual Regression Fixture';

async function getJwt(page: Page): Promise<string> {
  if (page.url() === 'about:blank') {
    await page.goto('/canvas');
    await page.waitForLoadState('domcontentloaded');
  }
  return page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
}

async function apiHeaders(page: Page) {
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function deleteCanvas(page: Page, canvasId: string, headers: Record<string, string>) {
  await page.request.delete(`${BASE}/canvas/${canvasId}`, { headers });
  await page.request.delete(`${BASE}/canvas/${canvasId}/permanent`, { headers });
}

async function createVisualCanvas(page: Page): Promise<string> {
  const headers = await apiHeaders(page);

  const listRes = await page.request.get(`${BASE}/canvas`, { headers });
  expect(listRes.ok()).toBeTruthy();
  const canvases = (await listRes.json()).data ?? [];
  const trashRes = await page.request.get(`${BASE}/canvas/trash`, { headers });
  const trashedCanvases = trashRes.ok() ? ((await trashRes.json()).data ?? []) : [];

  for (const canvas of [...canvases, ...trashedCanvases].filter(
    (item: { name?: string }) => item.name === VISUAL_CANVAS_NAME,
  )) {
    await deleteCanvas(page, canvas.id, headers);
  }

  const canvasRes = await page.request.post(`${BASE}/canvas`, {
    headers,
    data: { name: VISUAL_CANVAS_NAME },
  });
  expect(canvasRes.status()).toBe(201);
  const canvasId = (await canvasRes.json()).data.id;

  const transcriptRes = await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
    headers,
    data: {
      title: 'Visual Interview',
      content:
        'This stable visual fixture describes a compact qualitative interview with one coded excerpt for screenshot regression coverage.',
    },
  });
  expect(transcriptRes.status()).toBe(201);
  const transcriptId = (await transcriptRes.json()).data.id;

  const questionRes = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
    headers,
    data: { text: 'Visual Code', color: '#3B82F6' },
  });
  expect(questionRes.status()).toBe(201);
  const questionId = (await questionRes.json()).data.id;

  await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
    headers,
    data: {
      transcriptId,
      questionId,
      startOffset: 5,
      endOffset: 26,
      codedText: 'stable visual fixture',
    },
  });

  const memoRes = await page.request.post(`${BASE}/canvas/${canvasId}/memos`, {
    headers,
    data: { title: 'Visual Memo', content: 'Stable memo content for component screenshots.' },
  });
  expect(memoRes.status()).toBe(201);
  const memoId = (await memoRes.json()).data.id;

  await page.request.put(`${BASE}/canvas/${canvasId}/layout`, {
    headers,
    data: {
      positions: [
        { nodeId: `transcript-${transcriptId}`, nodeType: 'transcript', x: 0, y: 0 },
        { nodeId: `question-${questionId}`, nodeType: 'question', x: 440, y: 80 },
        { nodeId: `memo-${memoId}`, nodeType: 'memo', x: 220, y: 320 },
      ],
    },
  });

  return canvasId;
}

async function openVisualCanvas(page: Page, canvasId: string) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true, scrollMode: 'zoom' };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  const fitViewBtn = page.getByRole('button', { name: 'Fit View' });
  if (await fitViewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fitViewBtn.click();
    await page.waitForTimeout(500);
  }
}

// ─── Page Snapshots (Public Pages) ───────────────────────────────

test.describe('Visual Regression — Public Pages', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('1 - Landing page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('landing-page.png', SCREENSHOT_OPTS);
  });

  test('2 - Login page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login-page.png', SCREENSHOT_OPTS);
  });

  test('3 - Pricing page (above the fold)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('pricing-page.png', SCREENSHOT_OPTS);
  });

  test('4 - Guide page (hero + first section)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/guide');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('guide-page.png', SCREENSHOT_OPTS);
  });

  test('5 - 404 page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('404-page.png', SCREENSHOT_OPTS);
  });
});

// ─── Page Snapshots (Authenticated Pages) ────────────────────────

test.describe.serial('Visual Regression — Authenticated Pages', () => {
  let visualCanvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    visualCanvasId = await createVisualCanvas(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!visualCanvasId) return;
    const page = await browser.newPage({ storageState: AUTH_FILE });
    await deleteCanvas(page, visualCanvasId, await apiHeaders(page));
    await page.close();
  });

  test('6 - Canvas list page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
    await page.goto('/canvas');
    await page.waitForSelector('[data-tour="canvas-list"], h2', { timeout: 10000 });
    await page.getByPlaceholder('Search canvases...').fill(VISUAL_CANVAS_NAME);
    await expect(page.getByText(VISUAL_CANVAS_NAME)).toBeVisible({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('canvas-list-page.png', SCREENSHOT_OPTS);
  });

  test('7 - Canvas workspace', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openVisualCanvas(page, visualCanvasId);
    await expect(page).toHaveScreenshot('canvas-workspace.png', CANVAS_WORKSPACE_SCREENSHOT_OPTS);
  });
});

// ─── Component Snapshots ─────────────────────────────────────────

test.describe.serial('Visual Regression — Component Snapshots', () => {
  let visualCanvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    visualCanvasId = await createVisualCanvas(page);
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!visualCanvasId) return;
    const page = await browser.newPage({ storageState: AUTH_FILE });
    await deleteCanvas(page, visualCanvasId, await apiHeaders(page));
    await page.close();
  });

  test('8 - Toolbar', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openVisualCanvas(page, visualCanvasId);
    const toolbar = page.locator('[data-tour="canvas-toolbar"]');
    await expect(toolbar).toBeVisible({ timeout: 5000 });
    await expect(toolbar).toHaveScreenshot('toolbar.png', SCREENSHOT_OPTS);
  });

  test('9 - Code navigator sidebar', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openVisualCanvas(page, visualCanvasId);
    const navigator = page.locator('[data-tour="canvas-navigator"]');
    // The navigator may already be visible or may need toggling
    if (!(await navigator.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Try clicking a toggle button to open the navigator
      const toggleBtn = page.locator(
        'button[title="Toggle navigator"], button[aria-label="Toggle navigator"], button[title="Navigator"], button[aria-label="Navigator"]',
      );
      if (
        await toggleBtn
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await toggleBtn.first().click();
      }
    }
    await expect(navigator).toBeVisible({ timeout: 5000 });
    await expect(navigator).toHaveScreenshot('code-navigator.png', SCREENSHOT_OPTS);
  });

  test('10 - Command palette (Ctrl+K)', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openVisualCanvas(page, visualCanvasId);
    await page.keyboard.press('Control+k');
    // The command palette should be a dialog or modal with a search input
    const palette = page.locator('[role="dialog"], [data-command-palette], .command-palette').first();
    await expect(palette).toBeVisible({ timeout: 5000 });
    await expect(palette).toHaveScreenshot('command-palette.png', SCREENSHOT_OPTS);
  });

  test('11 - Share modal', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await openVisualCanvas(page, visualCanvasId);
    // Allow extra time for workspace to fully load
    await page.waitForLoadState('networkidle');
    const shareBtn = page.locator('button[title="Share canvas"]');
    await expect(shareBtn).toBeVisible({ timeout: 10000 });
    await shareBtn.click();
    const modal = page.locator('[role="dialog"][aria-label="Share Canvas"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const panel = modal.locator(':scope > div').first();
    await expect(panel).toHaveScreenshot('share-modal.png', SCREENSHOT_OPTS);
  });
});

// ─── Theme & Responsive Snapshots ────────────────────────────────

test.describe('Visual Regression — Theme & Responsive', () => {
  test('12 - Dark mode landing page', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    // Enable dark mode via localStorage before navigation
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, darkMode: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
    // Also add the dark class directly for pages that read it from localStorage
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('dark-mode-landing-page.png', SCREENSHOT_OPTS);
  });

  test('13 - Mobile landing page (375x812)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-landing-page.png', SCREENSHOT_OPTS);
  });

  test('14 - Mobile login page (375x812)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('mobile-login-page.png', SCREENSHOT_OPTS);
  });

  test('15 - Pricing page annual toggle', async ({ page }) => {
    await page.setViewportSize(STANDARD_VIEWPORT);
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    // Click the Annual toggle/button
    const annualToggle = page
      .getByText('Annual')
      .or(page.getByRole('button', { name: /annual/i }))
      .or(page.locator('label:has-text("Annual")'));
    await annualToggle.first().click();
    // Wait for the pricing to update
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('pricing-annual-toggle.png', SCREENSHOT_OPTS);
  });
});

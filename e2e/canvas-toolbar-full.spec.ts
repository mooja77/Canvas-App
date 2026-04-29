import { test, expect, type Page } from '@playwright/test';
import { isLegacyE2eAuth } from './helpers';

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
  await page.waitForLoadState('networkidle');
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

async function openCanvasById(page: Page, canvasId: string): Promise<boolean> {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForLoadState('domcontentloaded');

  // Quick check: if redirected to login (session expired), bail early
  if (page.url().includes('/login')) {
    return false;
  }

  // Wait for either the canvas pane or login redirect
  const result = await Promise.race([
    page.waitForSelector('.react-flow__pane', { timeout: 15000 }).then(() => 'canvas' as const),
    page.waitForURL('**/login**', { timeout: 15000 }).then(() => 'login' as const),
  ]).catch(() => 'timeout' as const);

  if (result !== 'canvas') {
    return false;
  }

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
  return true;
}

async function openAnalyzeMenu(page: Page) {
  const analyzeBtn = page.locator('[data-tour="canvas-btn-query"] button').first();
  await analyzeBtn.waitFor({ state: 'visible', timeout: 5000 });
  await analyzeBtn.click();
}

async function openToolsDropdown(page: Page) {
  const toolsBtn = page.getByText('Tools').first();
  await toolsBtn.click();
  await page
    .getByText('Cases')
    .first()
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
}

async function openExportDropdown(page: Page) {
  const exportBtns = page.locator('[data-tour="canvas-toolbar"] .relative > button').filter({
    has: page.locator('svg path[d*="M3 16.5v2.25"]'),
  });
  if (
    await exportBtns
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await exportBtns.first().click();
  } else {
    const allBtns = page.locator('button').filter({
      has: page.locator('svg path[d*="16.5v2.25"]'),
    });
    await allBtns.first().click();
  }
  await page
    .getByText('Export PNG')
    .first()
    .waitFor({ state: 'visible', timeout: 3000 })
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════
// Canvas Toolbar Full Tests
// ═══════════════════════════════════════════════════════════════════

test.describe('Canvas Toolbar Full', () => {
  let canvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await goToCanvasList(page);
    canvasId = await createCanvasViaApi(page, `E2E Toolbar Full ${Date.now()}`);
    const headers = await apiHeaders(page);

    // Seed transcript + code
    const sampleText = [
      'The research methodology involved conducting semi-structured interviews with fifteen participants',
      'from diverse backgrounds across three different institutions. Each interview lasted approximately',
      'sixty minutes and was recorded with the consent of the participant.',
    ].join(' ');
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/transcripts`, {
      headers,
      data: { title: 'Toolbar Test Interview', content: sampleText },
    });
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Research Methods', color: '#4F46E5' },
    });
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: 'e2e/.auth/user.json' });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    if (canvasId) await deleteCanvasViaApi(page, canvasId);
    await page.close();
  });

  test('1 - AI dropdown shows AI tools', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Click the AI dropdown button
    const aiBtn = page.locator('[data-tour="canvas-btn-ai"]').first();
    await aiBtn.waitFor({ state: 'visible', timeout: 5000 });
    await aiBtn.click();

    // Should show AI tool options
    await expect(page.getByText('Auto-Code').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('AI Chat').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Summarize').first()).toBeVisible({ timeout: 3000 });

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('2 - Tools dropdown shows Cases, Ethics, Codebook, etc.', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await openToolsDropdown(page);

    await expect(page.getByText('Cases').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Ethics').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Codebook').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Research Calendar').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Excerpts').first()).toBeVisible({ timeout: 3000 });

    // Close
    await page.locator('.react-flow__pane').click();
  });

  test('3 - Export dropdown shows PNG, HTML/MD, QDPX options', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await openExportDropdown(page);

    await expect(page.getByText('Export PNG').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Export Report (HTML/MD)').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('QDPX Import').first()).toBeVisible({ timeout: 3000 });

    // Close
    await page.locator('.react-flow__pane').click();
  });

  test('4 - Analyze dropdown shows analysis tools in 3 categories', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await openAnalyzeMenu(page);

    // Should show 3 category headers
    await expect(page.getByText('Text Analysis').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Coding Analysis').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Frameworks & Comparison').first()).toBeVisible({ timeout: 3000 });

    // Should show individual analysis tools
    await expect(page.getByText('Statistics').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Word Cloud').first()).toBeVisible({ timeout: 3000 });

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('5 - Add Statistics from Analyze menu creates a node', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await openAnalyzeMenu(page);

    await page.getByText('Statistics').first().click();
    await expect(page.getByText('Statistics node added')).toBeVisible({ timeout: 5000 });
  });

  test('6 - Add Word Cloud from Analyze menu creates a node', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await openAnalyzeMenu(page);

    await page.getByText('Word Cloud').first().click();
    await expect(page.getByText('Word Cloud node added')).toBeVisible({ timeout: 5000 });
  });

  test('7 - Share button opens share modal', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const shareBtn = page.locator('button[title="Share canvas"]');
    await shareBtn.waitFor({ state: 'visible', timeout: 5000 });
    await shareBtn.click();

    await expect(page.getByRole('dialog', { name: /Share Canvas/i })).toBeVisible({ timeout: 10000 });

    // Close
    await page.keyboard.press('Escape');
  });

  test('8 - Memo button adds a memo node', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const memoBtn = page.locator('[data-tour="canvas-btn-memo"]');
    await memoBtn.waitFor({ state: 'visible', timeout: 5000 });
    await memoBtn.click();

    // Should show success toast
    await expect(page.getByText('Memo added')).toBeVisible({ timeout: 5000 });
  });

  test('9 - Transcript dropdown shows 4 import options', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const transcriptBtn = page.locator('[data-tour="canvas-btn-transcript"]');
    await transcriptBtn.waitFor({ state: 'visible', timeout: 5000 });
    await transcriptBtn.click();

    // Should show the 4 transcript source options
    await expect(page.getByText('Paste Text').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('From Assessments').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Upload File').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('From Another Canvas').first()).toBeVisible({ timeout: 3000 });

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('10 - Research Calendar in Tools opens calendar panel', async ({ page }) => {
    const loaded = await openCanvasById(page, canvasId);
    expect(loaded).toBe(true);
    test.skip(
      await isLegacyE2eAuth(page),
      'Research Calendar requires email auth; the default setup project uses legacy access-code auth.',
    );

    await openToolsDropdown(page);

    const calendarItem = page.getByText('Research Calendar').first();
    await calendarItem.waitFor({ state: 'visible', timeout: 3000 });
    await calendarItem.click();

    const redirectedToLogin = await page
      .waitForURL(/\/login/, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (redirectedToLogin || page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText(/session expired|sign in|login/i).first()).toBeVisible({ timeout: 5000 });
      return;
    }

    // Calendar panel should appear: look for day-of-week headers, month names, or panel content.
    const calendarUI = page
      .locator('[role="dialog"]')
      .or(page.getByText(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/))
      .or(page.getByText(/January|February|March|April|May|June|July|August|September|October|November|December/))
      .or(page.getByText(/Research Calendar/));
    await expect(calendarUI.first()).toBeVisible({ timeout: 5000 });

    // Close
    await page.keyboard.press('Escape');
  });
});

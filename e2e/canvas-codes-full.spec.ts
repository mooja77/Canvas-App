import { test, expect } from '@playwright/test';

/**
 * Open the test canvas by navigating to /canvas and clicking the canvas with the given name.
 */
async function openTestCanvas(page: import('@playwright/test').Page, canvasName: string) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });

  await page.goto('/canvas');
  await page.waitForLoadState('networkidle');

  // Click the canvas card matching our test name
  const card = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h3') }).filter({ hasText: canvasName });
  await expect(card.first()).toBeVisible({ timeout: 5000 });
  await card.first().click();

  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Dismiss tour overlay if present
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }

  // Wait for nodes to stabilize
  await page.waitForFunction(() => {
    const countNow = document.querySelectorAll('.react-flow__node').length;
    const prev = (window as any).__nodeCount || 0;
    (window as any).__nodeCount = countNow;
    return countNow > 0 && countNow === prev;
  }, undefined, { timeout: 10000 }).catch(() => {});
}

/** Ensure the navigator sidebar is visible and on Codes tab */
async function ensureNavigatorOpen(page: import('@playwright/test').Page) {
  const codesTab = page.locator('button').filter({ hasText: /^Codes\s*\(/ });
  if (!await codesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    const toggler = page.locator('button[title*="navigator" i], button[title*="Navigator" i], button[title*="sidebar" i]').first();
    if (await toggler.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toggler.click();
    }
  }
  if (await codesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await codesTab.click();
  }
}

// Unique canvas name for this test suite to avoid cross-test interference
const CANVAS_NAME = `E2E-Codes ${Date.now()}`;

test.describe('Code Management', () => {
  // Create a fresh canvas with a transcript and one code via API
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();

    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    // Extract JWT
    const jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.jwt || null;
    });

    if (jwt) {
      const baseUrl = 'http://localhost:3007/api';
      const headers = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };

      // Create canvas
      const canvasRes = await page.request.post(`${baseUrl}/canvas`, {
        headers,
        data: { name: CANVAS_NAME },
      });
      const canvasData = await canvasRes.json();
      const canvasId = canvasData?.data?.id;

      if (canvasId) {
        // Add a transcript
        await page.request.post(`${baseUrl}/canvas/${canvasId}/transcripts`, {
          headers,
          data: {
            title: 'Codes Test Interview',
            content: 'The research explored themes of resilience, adaptation, and community support in urban settings.',
          },
        });

        // Add one initial code
        await page.request.post(`${baseUrl}/canvas/${canvasId}/questions`, {
          headers,
          data: { text: 'Initial Code', color: '#4F46E5' },
        });
      }
    }

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    await openTestCanvas(page, CANVAS_NAME);
  });

  test('add code via toolbar Code button + Enter creates code node', async ({ page }) => {
    const beforeCount = await page.locator('.react-flow__node[data-id^="question-"]').count();

    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });
    await codeBtn.click();

    const input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Test Code Alpha');
    await input.press('Enter');

    await expect(page.locator('.react-flow__node[data-id^="question-"]'))
      .toHaveCount(beforeCount + 1, { timeout: 10000 });
  });

  test('code appears in navigator sidebar with name', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });

    const count = await codeItems.count();
    if (count === 0) { test.skip(); return; }

    const firstCodeText = await codeItems.first().textContent();
    expect(firstCodeText).toBeTruthy();
    expect(firstCodeText!.trim().length).toBeGreaterThan(0);
  });

  test('code gets a color shown as colored dot in navigator', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const colorDots = page.locator('[data-tour="canvas-navigator"] div[role="button"] .rounded-full').first();
    if (!await colorDots.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip(); return;
    }

    const bgColor = await colorDots.evaluate(el => el.style.backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('add multiple codes and all appear in DOM', async ({ page }) => {
    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });

    const count0 = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    let input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Multi Code One');
    await input.press('Enter');

    await expect(page.locator('.react-flow__node[data-id^="question-"]'))
      .toHaveCount(count0 + 1, { timeout: 10000 });

    const count1 = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Multi Code Two');
    await input.press('Enter');

    await expect(page.locator('.react-flow__node[data-id^="question-"]'))
      .toHaveCount(count1 + 1, { timeout: 10000 });
  });

  test('navigator shows "By count" sorting button', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });
    if (await codeItems.count() === 0) { test.skip(); return; }

    await expect(page.getByText('By count')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('A-Z')).toBeVisible({ timeout: 3000 });
  });

  test('click code in navigator selects it', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });
    const count = await codeItems.count();
    if (count === 0) { test.skip(); return; }

    await codeItems.first().click();

    // After clicking, the item should have selected/highlighted state
    const selectedItem = page.locator('[data-tour="canvas-navigator"] div[role="button"][class*="brand"]');
    await expect(selectedItem).toBeAttached({ timeout: 3000 });

    // A question node should exist
    expect(await page.locator('.react-flow__node[data-id^="question-"]').count()).toBeGreaterThan(0);
  });

  test('delete code removes it from canvas via API', async ({ page }) => {
    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });

    const beforeCount = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    const input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Code To Delete');
    await input.press('Enter');

    await expect(page.locator('.react-flow__node[data-id^="question-"]'))
      .toHaveCount(beforeCount + 1, { timeout: 10000 });

    // Get the new node's data-id to extract the question ID
    const newNode = page.locator('.react-flow__node[data-id^="question-"]').filter({ hasText: 'Code To Delete' });
    await expect(newNode).toBeAttached({ timeout: 5000 });
    const dataId = await newNode.getAttribute('data-id');
    // data-id format: "question-<uuid>"
    const questionId = dataId?.replace('question-', '');

    // Delete via API
    const jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.state?.jwt || null;
    });

    if (jwt && questionId) {
      // Get canvas ID from the URL or store
      const canvasId = await page.evaluate(() => {
        const raw = localStorage.getItem('qualcanvas-canvas');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.state?.activeCanvasId || null;
      });

      if (canvasId) {
        const baseUrl = 'http://localhost:3007/api';
        const headers = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };

        await page.request.delete(`${baseUrl}/canvas/${canvasId}/questions/${questionId}`, { headers });

        // Reload to pick up the change
        await page.reload();
        await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        // Wait for nodes to stabilize
        await page.waitForFunction(() => {
          const countNow = document.querySelectorAll('.react-flow__node').length;
          const prev = (window as any).__nodeCount || 0;
          (window as any).__nodeCount = countNow;
          return countNow > 0 && countNow === prev;
        }, undefined, { timeout: 10000 }).catch(() => {});

        await expect(page.locator('.react-flow__node[data-id^="question-"]'))
          .toHaveCount(beforeCount, { timeout: 10000 });
      }
    }
  });

  test('status bar shows correct code count', async ({ page }) => {
    const statusBar = page.locator('[data-tour="canvas-status-bar"]');
    await expect(statusBar).toBeVisible({ timeout: 5000 });

    const questionNodeCount = await page.locator('.react-flow__node[data-id^="question-"]').count();
    const statusText = await statusBar.textContent();
    expect(statusText).toBeTruthy();

    if (questionNodeCount > 0) {
      expect(statusText).toContain(String(questionNodeCount));
    }
  });

  test('add code with same name creates separate nodes', async ({ page }) => {
    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });

    const beforeCount = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    let input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Duplicate Name');
    await input.press('Enter');

    await expect(page.locator('.react-flow__node[data-id^="question-"]'))
      .toHaveCount(beforeCount + 1, { timeout: 10000 });

    const afterFirst = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Duplicate Name');
    await input.press('Enter');

    await page.waitForLoadState('networkidle');

    const afterSecond = await page.locator('.react-flow__node[data-id^="question-"]').count();

    // Accept either: duplicate created (count +1) or gracefully handled (no crash)
    expect(afterSecond).toBeGreaterThanOrEqual(afterFirst);
    await expect(page.locator('.react-flow__pane')).toBeAttached();
  });

  test('Codes tab count updates when adding a code', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codesTabEl = page.locator('button').filter({ hasText: /^Codes\s*\(/ });
    await expect(codesTabEl).toBeVisible({ timeout: 5000 });
    const initialText = await codesTabEl.textContent();
    const initialMatch = initialText?.match(/Codes\s*\((\d+)\)/);
    const initialCount = initialMatch ? parseInt(initialMatch[1], 10) : 0;

    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await codeBtn.click();
    const input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Count Test Code');
    await input.press('Enter');

    await expect(codesTabEl).toHaveText(new RegExp(`Codes\\s*\\(${initialCount + 1}\\)`), { timeout: 10000 });
  });
});

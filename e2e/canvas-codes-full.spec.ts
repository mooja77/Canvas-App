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
  const card = page
    .locator('[class*="cursor-pointer"]')
    .filter({ has: page.locator('h3') })
    .filter({ hasText: canvasName });
  await expect(card.first()).toBeVisible({ timeout: 5000 });
  await card.first().click();

  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Dismiss tour overlay if present
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (
    await skipBtn
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await skipBtn.first().click();
  }

  // Wait for nodes to stabilize
  await page
    .waitForFunction(
      () => {
        const countNow = document.querySelectorAll('.react-flow__node').length;
        const prev = (window as any).__nodeCount || 0;
        (window as any).__nodeCount = countNow;
        return countNow > 0 && countNow === prev;
      },
      undefined,
      { timeout: 10000 },
    )
    .catch(() => {});
}

/** Ensure the navigator sidebar is visible and on Codes tab */
async function ensureNavigatorOpen(page: import('@playwright/test').Page) {
  const codesTab = page.locator('button').filter({ hasText: /^Codes\s*\(/ });
  if (!(await codesTab.isVisible({ timeout: 2000 }).catch(() => false))) {
    const toggler = page
      .locator('button[title*="navigator" i], button[title*="Navigator" i], button[title*="sidebar" i]')
      .first();
    if (await toggler.isVisible({ timeout: 1000 }).catch(() => false)) {
      await toggler.click();
    }
  }
  if (await codesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await codesTab.click();
  }
}

/** Count code (question) nodes via the API. Counting `.react-flow__node`
 * elements is unreliable: React Flow culls off-screen nodes, so the DOM count
 * tracks only *visible* nodes and jumps around whenever the canvas re-fits.
 * Hits the canvas detail endpoint by id — the list endpoint paginates
 * (default 50, ordered by updatedAt), so a name lookup there is not reliable. */
async function questionCountViaApi(page: import('@playwright/test').Page, canvasId: string) {
  const jwt = await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
  });
  const res = await page.request.get(`http://localhost:3007/api/canvas/${canvasId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const detail = await res.json();
  return ((detail?.data?.questions as unknown[] | undefined)?.length as number | undefined) ?? 0;
}

// Unique canvas name for this test suite to avoid cross-test interference
const CANVAS_NAME = `E2E-Codes ${Date.now()}`;

test.describe('Code Management', () => {
  // Canvas id of the suite's fixture canvas — set in beforeAll, used for
  // viewport-independent question counts via the API.
  let fixtureCanvasId = '';

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
      const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

      // Create canvas
      const canvasRes = await page.request.post(`${baseUrl}/canvas`, {
        headers,
        data: { name: CANVAS_NAME },
      });
      const canvasData = await canvasRes.json();
      const canvasId = canvasData?.data?.id;
      fixtureCanvasId = canvasId ?? '';

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
    // A freshly-added code node spawns at a fixed canvas position that may be
    // outside the viewport, where onlyRenderVisibleElements culls it from the
    // DOM. Fit the whole graph into view before each count so the assertion
    // is culling-independent — including the baseline count.
    const fitView = page.getByRole('button', { name: 'Fit View' });
    const refit = async () => {
      await fitView.click();
      await page.waitForTimeout(800);
    };
    const questionNodes = page.locator('.react-flow__node[data-id^="question-"]');

    await refit();
    const beforeCount = await questionNodes.count();

    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });
    await codeBtn.click();

    const input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Test Code Alpha');
    await input.press('Enter');
    await refit();

    await expect(questionNodes).toHaveCount(beforeCount + 1, {
      timeout: 10000,
    });
  });

  test('code appears in navigator sidebar with name', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });

    const count = await codeItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstCodeText = await codeItems.first().textContent();
    expect(firstCodeText).toBeTruthy();
    expect(firstCodeText!.trim().length).toBeGreaterThan(0);
  });

  test('code gets a color shown as colored dot in navigator', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const colorDots = page.locator('[data-tour="canvas-navigator"] div[role="button"] .rounded-full').first();
    if (!(await colorDots.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const bgColor = await colorDots.evaluate((el) => el.style.backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('add multiple codes and all appear in DOM', async ({ page }) => {
    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await expect(codeBtn).toBeVisible({ timeout: 5000 });

    // A freshly-added code node spawns at a fixed canvas position that may
    // be outside the current viewport, where onlyRenderVisibleElements culls
    // it from the DOM. This test asserts on rendered node count, so fit the
    // whole graph into view before each count — that frames every node and
    // makes the DOM count deterministic regardless of culling.
    const fitView = page.getByRole('button', { name: 'Fit View' });
    const refit = async () => {
      await fitView.click();
      await page.waitForTimeout(800);
    };
    const questionNodes = page.locator('.react-flow__node[data-id^="question-"]');

    await refit();
    const count0 = await questionNodes.count();

    await codeBtn.click();
    let input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Multi Code One');
    await input.press('Enter');
    await refit();

    await expect(questionNodes).toHaveCount(count0 + 1, { timeout: 10000 });

    const count1 = await questionNodes.count();

    await codeBtn.click();
    input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Multi Code Two');
    await input.press('Enter');
    await refit();

    await expect(questionNodes).toHaveCount(count1 + 1, { timeout: 10000 });
  });

  test('navigator shows "By count" sorting button', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });
    if ((await codeItems.count()) === 0) {
      test.skip();
      return;
    }

    await expect(page.getByText('By count')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('A-Z')).toBeVisible({ timeout: 3000 });
  });

  test('click code in navigator selects it', async ({ page }) => {
    await ensureNavigatorOpen(page);

    const codeItems = page.locator('[data-tour="canvas-navigator"] div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });
    const count = await codeItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

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

    // A freshly-added code node spawns at a fixed canvas position that may be
    // outside the viewport, where onlyRenderVisibleElements culls it from the
    // DOM. Fit the whole graph into view before each count / DOM check so the
    // assertions are culling-independent — including the baseline count.
    const fitView = page.getByRole('button', { name: 'Fit View' });
    const refit = async () => {
      await fitView.click();
      await page.waitForTimeout(800);
    };

    await refit();
    const beforeCount = await page.locator('.react-flow__node[data-id^="question-"]').count();

    await codeBtn.click();
    const input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Code To Delete');
    await input.press('Enter');
    await refit();

    await expect(page.locator('.react-flow__node[data-id^="question-"]')).toHaveCount(beforeCount + 1, {
      timeout: 10000,
    });

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
        const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

        await page.request.delete(`${baseUrl}/canvas/${canvasId}/questions/${questionId}`, { headers });

        // Reload to pick up the change
        await page.reload();
        await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
        await page.waitForLoadState('networkidle');

        // Wait for nodes to stabilize
        await page
          .waitForFunction(
            () => {
              const countNow = document.querySelectorAll('.react-flow__node').length;
              const prev = (window as any).__nodeCount || 0;
              (window as any).__nodeCount = countNow;
              return countNow > 0 && countNow === prev;
            },
            undefined,
            { timeout: 10000 },
          )
          .catch(() => {});

        await refit();
        await expect(page.locator('.react-flow__node[data-id^="question-"]')).toHaveCount(beforeCount, {
          timeout: 10000,
        });
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

    // Count via the API — see questionCountViaApi: the DOM count is culled.
    const beforeCount = await questionCountViaApi(page, fixtureCanvasId);

    await codeBtn.click();
    let input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Duplicate Name');
    await input.press('Enter');
    await expect.poll(() => questionCountViaApi(page, fixtureCanvasId), { timeout: 10000 }).toBe(beforeCount + 1);

    await codeBtn.click();
    input = page.locator('input[placeholder="Type your research question..."]');
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Duplicate Name');
    await input.press('Enter');

    // A second code with the same name must create a SEPARATE node, not merge.
    await expect.poll(() => questionCountViaApi(page, fixtureCanvasId), { timeout: 10000 }).toBe(beforeCount + 2);
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

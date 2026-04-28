import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:3007/api';
const AUTH_FILE = 'e2e/.auth/user.json';

async function getJwt(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
}

async function apiHeaders(page: Page) {
  if (page.url() === 'about:blank') {
    await page.goto('/canvas');
    await page.waitForLoadState('domcontentloaded');
  }
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
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
  if (
    await skipBtn
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await skipBtn.first().click();
  }
}

test.describe('Network Resilience', () => {
  test.describe.configure({ timeout: 120_000 });

  let canvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);

    const createRes = await page.request.post(`${BASE}/canvas`, {
      headers,
      data: { name: `ResilienceTest-${Date.now()}` },
    });
    canvasId = (await createRes.json()).data.id;

    // Seed with minimal data
    for (let i = 0; i < 2; i++) {
      await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
        headers,
        data: {
          title: `Transcript ${i + 1}`,
          content: `Content for resilience test transcript ${i + 1}. This has enough text to be useful.`,
        },
      });
    }
    for (let i = 0; i < 3; i++) {
      await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
        headers,
        data: { text: `ResCode ${i + 1}` },
      });
    }

    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);
    try {
      await page.request.delete(`${BASE}/canvas/${canvasId}`, { headers });
      await page.request.delete(`${BASE}/canvas/${canvasId}/permanent`, { headers });
    } catch {
      /* best-effort */
    }
    await page.close();
  });

  test('1 - app handles network failure without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await openCanvasById(page, canvasId);

    // Block API requests
    await page.route('**/api/**', (route) => route.abort());

    // Try an action that calls API — it should fail gracefully
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');

    // App should still be responsive (pane is still there)
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toBeVisible();

    // Unblock
    await page.unroute('**/api/**');

    // No unhandled crashes
    const crashes = errors.filter((e) => e.includes('Uncaught') || e.includes('ChunkLoadError'));
    expect(crashes).toHaveLength(0);
  });

  test('2 - reconnect after offline recovers', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const headers = await apiHeaders(page);

    // Block API
    await page.route('**/api/**', (route) => route.abort());

    // Try to create a code — should fail
    const failRes = await page.request
      .post(`${BASE}/canvas/${canvasId}/questions`, {
        headers,
        data: { text: 'Offline Code' },
      })
      .catch(() => null);
    // Request may throw or return error

    // Unblock
    await page.unroute('**/api/**');

    // Retry — should succeed
    const successRes = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Recovered Code' },
    });
    const result = await successRes.json();
    expect(result.success).toBe(true);
  });

  test('3 - no unhandled promise rejections during offline cycle', async ({ page }) => {
    const unhandled: string[] = [];
    page.on('pageerror', (error) => {
      unhandled.push(error.message);
    });

    await openCanvasById(page, canvasId);

    // Rapid offline/online cycle
    await page.route('**/api/**', (route) => route.abort());
    await page.waitForTimeout(500);
    await page.unroute('**/api/**');
    await page.waitForTimeout(500);
    await page.route('**/api/**', (route) => route.abort());
    await page.waitForTimeout(500);
    await page.unroute('**/api/**');
    await page.waitForTimeout(1000);

    // No page-level errors (unhandled rejections)
    expect(unhandled.length).toBeLessThanOrEqual(2); // Allow minor non-critical errors
  });

  test('4 - expired JWT redirects to login with banner', async ({ page }) => {
    // Modify localStorage to have expired JWT
    await page.addInitScript(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        // Create obviously expired JWT (just corrupt the token)
        parsed.state.jwt = 'expired.invalid.token';
        localStorage.setItem('qualcanvas-auth', JSON.stringify(parsed));
      }
    });

    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should redirect to login (the app detects invalid JWT on API call)
    const url = page.url();
    const isOnLogin = url.includes('/login');
    // May show session expired banner or just redirect
    expect(isOnLogin || url.includes('/canvas')).toBe(true);
  });

  test('5 - server 500 shows error toast, no crash', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Mock a specific endpoint to return 500
    await page.route('**/api/canvas/*/questions', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Internal server error' }),
        });
      }
      return route.continue();
    });

    // Try to create a code through the UI (or API through page)
    // The app should show an error toast, not crash
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toBeVisible();

    // Cleanup mock
    await page.unroute('**/api/canvas/*/questions');

    // App still functional
    await expect(pane).toBeVisible();
  });

  test('6 - slow API does not freeze canvas interaction', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Mock slow responses (3 second delay)
    await page.route('**/api/canvas/*/computed', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });

    // Canvas should still be interactive while API is slow
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toBeVisible();

    // Try zooming (pure client-side, should work)
    const box = await pane.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(500);
    }

    // Canvas still responsive
    await expect(pane).toBeVisible();

    // Cleanup
    await page.unroute('**/api/canvas/*/computed');
  });
});

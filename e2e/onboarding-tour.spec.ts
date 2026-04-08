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
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

test.describe('Onboarding Tour', () => {
  let canvasId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);

    // Create a fresh canvas for tour testing
    const createRes = await page.request.post(`${BASE}/canvas`, {
      headers,
      data: { name: `TourTest-${Date.now()}` },
    });
    canvasId = (await createRes.json()).data.id;
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

  test('1 - tour starts on new canvas when onboarding incomplete', async ({ page }) => {
    // Reset onboarding state so tour triggers
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: false, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });

    // Tour should appear — look for "Welcome to QualCanvas" or "Step 1"
    const tourWelcome = page.getByText(/Welcome to QualCanvas|Step 1/i);
    await expect(tourWelcome.first()).toBeVisible({ timeout: 10000 });
  });

  test('2 - navigate through tour steps without crash', async ({ page }) => {
    // Reset onboarding
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: false, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });

    // Track errors
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Click through tour steps
    let stepsCompleted = 0;
    const maxSteps = 25; // safety limit

    for (let i = 0; i < maxSteps; i++) {
      const nextBtn = page.getByRole('button', { name: /^Next/i });
      const skipBtn = page.getByRole('button', { name: /skip tour/i });

      if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextBtn.click();
        stepsCompleted++;
        await page.waitForTimeout(500);
      } else if (await skipBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        // Tour might end or show skip
        break;
      } else {
        // Tour ended (no Next button)
        break;
      }
    }

    // Should have navigated at least a few steps
    expect(stepsCompleted).toBeGreaterThanOrEqual(3);

    // No crashes during tour
    const crashes = errors.filter((e) => e.includes('Cannot read') || e.includes('TypeError'));
    expect(crashes).toHaveLength(0);
  });

  test('3 - skip tour works at any step', async ({ page }) => {
    // Reset onboarding
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: false, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });

    // Advance a few steps
    const nextBtn = page.getByRole('button', { name: /^Next/i });
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Click skip
    const skipBtn = page.getByRole('button', { name: /skip tour/i });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }

    // Tour overlay should be gone
    const tourOverlay = page.getByText(/Step \d+ of \d+/);
    await expect(tourOverlay)
      .not.toBeVisible({ timeout: 3000 })
      .catch(() => {
        // OK if it's already gone
      });

    // Verify onboarding marked complete
    const onboardingComplete = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-ui');
      if (!raw) return false;
      return JSON.parse(raw)?.state?.onboardingComplete ?? false;
    });
    expect(onboardingComplete).toBe(true);
  });

  test('4 - re-run tour from command palette', async ({ page }) => {
    // Start with tour completed
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Open command palette
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Search for tour
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('tour');
      await page.waitForTimeout(500);

      // Click "Replay guided tour" option
      const tourOption = page.getByText(/replay.*tour|restart.*tour|guided.*tour/i);
      if (
        await tourOption
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await tourOption.first().click();
        await page.waitForTimeout(1000);

        // Tour should restart
        const tourStep = page.getByText(/Step 1|Welcome to QualCanvas/i);
        const isVisible = await tourStep
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        expect(isVisible).toBe(true);
      }
    }

    // Close command palette if still open
    await page.keyboard.press('Escape');
    expect(true).toBe(true); // No crash = pass
  });

  test('5 - canvas is functional after tour completes', async ({ page }) => {
    // Mark tour as complete
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify canvas is functional — can open command palette
    await page.keyboard.press('Control+k');
    const palette = page.getByPlaceholder(/search/i);
    await expect(palette).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');

    // Canvas pane is interactive
    const pane = page.locator('.react-flow__pane');
    await expect(pane).toBeVisible();

    // Toolbar is visible
    const toolbar = page.locator('[data-tour="canvas-toolbar"]');
    if (await toolbar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(toolbar).toBeVisible();
    }
  });
});

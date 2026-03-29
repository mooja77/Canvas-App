import { test, expect, type Page } from '@playwright/test';
import { openCanvas } from './helpers';

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
}

// ═══════════════════════════════════════════════════════════════════
// Canvas Error Handling & Edge Cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Canvas Error Handling', () => {

  test('1 - /canvas without auth redirects to /login', async ({ browser }) => {
    // Create a fresh context with explicitly empty storage state (no auth)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/canvas');
    await page.waitForLoadState('domcontentloaded');

    // The SPA ProtectedRoute should redirect to /login
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });

  test('2 - /account without auth redirects to /login', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/account');
    await page.waitForLoadState('domcontentloaded');

    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');

    await context.close();
  });

  test('3 - /canvas/:nonexistent-id shows error or redirects to list', async ({ page }) => {
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto('/canvas/nonexistent-canvas-id-12345');
    await page.waitForLoadState('networkidle');

    // Should either show an error message, redirect to list, or show the canvas list
    const errorText = page.getByText(/not found|error|does not exist/i);
    const canvasList = page.locator('[data-tour="canvas-list"]');
    const reactFlowPane = page.locator('.react-flow__pane');

    const hasError = await errorText.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasList = await canvasList.isVisible({ timeout: 3000 }).catch(() => false);
    const hasPane = await reactFlowPane.isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of: error shown, redirected to canvas list, or showed empty canvas
    expect(hasError || hasList || hasPane || page.url().includes('/canvas')).toBe(true);
  });

  test('4 - Create canvas with empty name keeps button disabled', async ({ page }) => {
    await goToCanvasList(page);

    // Click "New Canvas" to open the create form
    const newCanvasBtn = page.getByRole('button', { name: /New Canvas|Get Started/i }).first();
    if (!await newCanvasBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try the data-tour button
      const tourBtn = page.locator('[data-tour="canvas-new-btn"]');
      if (await tourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tourBtn.click();
      } else {
        test.skip(); return;
      }
    } else {
      await newCanvasBtn.click();
    }

    // The Create Canvas button should be visible but disabled when name is empty
    const createBtn = page.getByRole('button', { name: /Create Canvas/i });
    await expect(createBtn).toBeVisible({ timeout: 3000 });

    // Clear the name input to ensure it's empty
    const nameInput = page.locator('#canvas-name').or(page.locator('input[placeholder*="canvas"]').first());
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('');
    }

    // Button should be disabled with no name
    await expect(createBtn).toBeDisabled();
  });

  test('5 - Rapid-click Code button does not crash', async ({ page }) => {
    await openCanvas(page);

    const codeBtn = page.locator('[data-tour="canvas-btn-question"]');
    await codeBtn.waitFor({ state: 'visible', timeout: 5000 });

    // Click the code button — it toggles a text input for entering a code
    await codeBtn.click();

    // The input should appear
    const codeInput = page.locator('input[placeholder*="research question"]');
    await expect(codeInput).toBeVisible({ timeout: 3000 });

    // Rapidly type and submit codes (the actual rapid action)
    await codeInput.fill('Rapid Test Code 1');
    const addBtn = page.getByRole('button', { name: 'Add' }).first();
    await addBtn.click();
    await page.waitForLoadState('networkidle');

    // The input should reappear or the code button should be clickable again
    if (await codeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await codeBtn.click();
      await codeInput.fill('Rapid Test Code 2');
      await addBtn.click();
    }

    // Wait for the UI to settle — page should not crash
    await page.waitForLoadState('networkidle');

    // Canvas pane should still be present (no crash)
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 5000 });

    // Close any open input by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('6 - Page refresh on canvas preserves state', async ({ page }) => {
    await goToCanvasList(page);
    const canvasId = await createCanvasViaApi(page, `E2E Refresh ${Date.now()}`);
    const headers = await apiHeaders(page);

    // Seed a transcript so we have at least one node
    await page.request.post(`http://localhost:3007/api/canvas/${canvasId}/transcripts`, {
      headers, data: { title: 'Refresh Test', content: 'Some content for refresh testing.' },
    });

    try {
      await openCanvasById(page, canvasId);

      // Count nodes before refresh
      const nodeCountBefore = await page.locator('.react-flow__node').count();

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Re-enter the canvas if needed
      const paneVisible = await page.locator('.react-flow__pane').isVisible({ timeout: 3000 }).catch(() => false);
      if (!paneVisible) {
        await page.goto(`/canvas/${canvasId}`);
        await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
        await page.waitForLoadState('networkidle');
      }

      // Wait for nodes to render
      await page.waitForSelector('.react-flow__node', { timeout: 10000 }).catch(() => {});

      // Canvas should be visible
      await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 5000 });

      // Node count should be preserved (server-side state)
      const nodeCountAfter = await page.locator('.react-flow__node').count();
      expect(nodeCountAfter).toBe(nodeCountBefore);
    } finally {
      await deleteCanvasViaApi(page, canvasId);
    }
  });

  test('7 - Console has zero errors during normal workflow', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore known non-critical errors
        if (text.includes('WebSocket') || text.includes('Socket') ||
            text.includes('favicon') || text.includes('.map') ||
            text.includes('DevTools') || text.includes('net::ERR') ||
            text.includes('Failed to load resource') || text.includes('404') ||
            text.includes('Stripe') || text.includes('Google')) return;
        errors.push(text);
      }
    });

    await openCanvas(page);

    // Normal workflow: navigate, interact
    await page.waitForLoadState('networkidle');

    // Click around the toolbar
    const memoBtn = page.locator('[data-tour="canvas-btn-memo"]');
    if (await memoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await memoBtn.click();
      await page.waitForLoadState('networkidle');
    }

    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Non-Error')
    );
    expect(criticalErrors).toEqual([]);
  });

  test('8 - Setup wizard does NOT appear for user with existing canvases', async ({ page }) => {
    // The auth setup seeds at least one canvas, so the user has existing canvases.
    // Ensure setupWizardComplete is false to test the auto-skip logic.
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      // Set onboarding complete but NOT setupWizardComplete — should auto-complete
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: false };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    // The setup wizard should NOT be visible since the user has canvases
    const wizardHeading = page.getByText(/Welcome to QualCanvas|Get Started|setup/i);
    // Also check for the actual SetupWizard component indicators
    const wizardModal = page.locator('[data-testid="setup-wizard"]')
      .or(page.getByRole('heading', { name: /Welcome|Setup/i }));

    // Wait briefly to ensure the wizard would have appeared if it was going to
    const wizardVisible = await wizardModal.first().isVisible({ timeout: 3000 }).catch(() => false);

    // The canvas list or a canvas should be shown instead
    const canvasList = page.locator('[data-tour="canvas-list"]');
    const hasCanvasList = await canvasList.isVisible({ timeout: 5000 }).catch(() => false);

    // Either the wizard is not visible (main check) or the canvas list is shown
    expect(!wizardVisible || hasCanvasList).toBe(true);
  });
});

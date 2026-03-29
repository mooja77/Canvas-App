import { test, expect, type Page } from '@playwright/test';

// ─── Helpers ───

const BASE_API = 'http://localhost:3007/api';

async function dismissOnboarding(page: Page) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
}

async function goToCanvasList(page: Page) {
  await dismissOnboarding(page);
  await page.goto('/canvas');
  await page.waitForSelector('[data-tour="canvas-list"], h2', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

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
  const res = await page.request.post(`${BASE_API}/canvas`, { headers, data: { name } });
  expect(res.ok(), `Canvas create failed: ${res.status()}`).toBeTruthy();
  return (await res.json()).data.id;
}

async function deleteCanvasViaApi(page: Page, canvasId: string) {
  const jwt = await getJwt(page);
  const h = { Authorization: `Bearer ${jwt}` };
  await page.request.delete(`${BASE_API}/canvas/${canvasId}`, { headers: h });
  await page.request.delete(`${BASE_API}/canvas/${canvasId}/permanent`, { headers: h });
}

async function cleanupE2ECanvases(page: Page) {
  const jwt = await getJwt(page);
  if (!jwt) return;
  const headers = { Authorization: `Bearer ${jwt}` };
  const res = await page.request.get(`${BASE_API}/canvas`, { headers });
  if (!res.ok()) return;
  for (const c of ((await res.json())?.data || [])) {
    if (c.name?.startsWith('E2E-LC ')) {
      await page.request.delete(`${BASE_API}/canvas/${c.id}`, { headers });
      await page.request.delete(`${BASE_API}/canvas/${c.id}/permanent`, { headers });
    }
  }
  const trashRes = await page.request.get(`${BASE_API}/canvas/trash`, { headers });
  if (trashRes.ok()) {
    for (const c of ((await trashRes.json())?.data || [])) {
      if (c.name?.startsWith('E2E-LC ')) {
        await page.request.delete(`${BASE_API}/canvas/${c.id}/permanent`, { headers });
      }
    }
  }
}

async function openCanvasById(page: Page, canvasId: string) {
  await dismissOnboarding(page);
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Canvas Lifecycle Full (15 tests) — each test is independent
// ═══════════════════════════════════════════════════════════════════

test.describe('Canvas Lifecycle Full', () => {

  test('1 - login lands on canvas list (no setup wizard for existing user)', async ({ page }) => {
    await goToCanvasList(page);
    await expect(page.getByText('Coding Canvases')).toBeVisible({ timeout: 5000 });
    // Setup wizard should not be shown because auth.setup.ts marks it complete
    const wizard = page.getByText('Welcome to QualCanvas');
    const wizardVisible = await wizard.isVisible({ timeout: 1000 }).catch(() => false);
    expect(wizardVisible).toBe(false);
  });

  test('2 - create blank canvas shows workspace with empty state', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const newBtn = page.getByRole('button', { name: /New Canvas/i }).first();
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();

    // Select Blank template (default) and create
    await page.locator('#canvas-name').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('#canvas-name').fill(`E2E-LC Blank ${Date.now()}`);
    await page.getByRole('button', { name: /Create Canvas/i }).click();

    await page.waitForSelector('.react-flow__pane', { timeout: 20000 });
    // Empty canvas should have no question nodes
    expect(await page.locator('.react-flow__node[data-id^="question-"]').count()).toBe(0);
    // Clean up
    await cleanupE2ECanvases(page);
  });

  test('3 - create canvas with Thematic Analysis template shows 5 starter codes', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    await page.reload();
    await page.waitForLoadState('networkidle');

    const newBtn = page.getByRole('button', { name: /New Canvas/i }).first();
    await newBtn.waitFor({ state: 'visible', timeout: 5000 });
    await newBtn.click();

    await page.getByText('Thematic Analysis').first().waitFor({ state: 'visible', timeout: 3000 });
    await page.getByText('Thematic Analysis').first().click();
    await page.locator('#canvas-name').waitFor({ state: 'visible', timeout: 3000 });
    await page.locator('#canvas-name').fill(`E2E-LC Thematic ${Date.now()}`);
    await page.getByRole('button', { name: /Create Canvas/i }).click();

    await expect(page.getByText(/Canvas created with \d+ starter codes/i)).toBeVisible({ timeout: 15000 });
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await expect(page.locator('.react-flow__node[data-id^="question-"]')).toHaveCount(5, { timeout: 10000 });
    await cleanupE2ECanvases(page);
  });

  test('4 - rename canvas via API then title persists', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const origName = `E2E-LC Rename ${Date.now()}`;
    const newName = `E2E-LC Renamed ${Date.now()}`;
    const id = await createCanvasViaApi(page, origName);

    // Rename via API
    const headers = await apiHeaders(page);
    const renameRes = await page.request.put(`${BASE_API}/canvas/${id}`, {
      headers,
      data: { name: newName },
    });
    expect(renameRes.ok()).toBeTruthy();

    // Open the canvas and check the name appears in the toolbar
    await openCanvasById(page, id);
    await expect(page.getByText(newName).first()).toBeVisible({ timeout: 5000 });

    await deleteCanvasViaApi(page, id);
  });

  test('5 - delete canvas moves to trash and disappears from list', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC Del ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.locator(`button[aria-label="Delete canvas ${name}"]`).click();
    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Canvas moved to trash')).toBeVisible({ timeout: 5000 });
    // Name should no longer appear in active canvas list
    await expect(page.getByText(name)).not.toBeVisible({ timeout: 3000 });
    // Clean up permanent
    const jwt = await getJwt(page);
    await page.request.delete(`${BASE_API}/canvas/${id}/permanent`, { headers: { Authorization: `Bearer ${jwt}` } });
  });

  test('6 - open trash shows deleted canvas', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC TrashShow ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);
    // Soft-delete via API
    const jwt = await getJwt(page);
    await page.request.delete(`${BASE_API}/canvas/${id}`, { headers: { Authorization: `Bearer ${jwt}` } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const trashBtn = page.getByRole('button', { name: /Trash/i });
    await trashBtn.waitFor({ state: 'visible', timeout: 5000 });
    await trashBtn.click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
    // Clean up
    await page.request.delete(`${BASE_API}/canvas/${id}/permanent`, { headers: { Authorization: `Bearer ${jwt}` } });
  });

  test('7 - restore from trash returns canvas to list', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC Restore ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);
    const jwt = await getJwt(page);
    await page.request.delete(`${BASE_API}/canvas/${id}`, { headers: { Authorization: `Bearer ${jwt}` } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const trashBtn = page.getByRole('button', { name: /Trash/i });
    await trashBtn.waitFor({ state: 'visible', timeout: 5000 });
    await trashBtn.click();

    await page.locator('button[title="Restore canvas"]').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('button[title="Restore canvas"]').first().click();
    await expect(page.getByText('Canvas restored')).toBeVisible({ timeout: 5000 });
    // Should now be visible in the main list heading
    await expect(page.getByRole('heading', { name })).toBeVisible({ timeout: 5000 });

    await deleteCanvasViaApi(page, id);
  });

  test('8 - permanent delete removes canvas from trash', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC PermDel ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);
    const jwt = await getJwt(page);
    await page.request.delete(`${BASE_API}/canvas/${id}`, { headers: { Authorization: `Bearer ${jwt}` } });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const trashBtn = page.getByRole('button', { name: /Trash/i });
    await trashBtn.waitFor({ state: 'visible', timeout: 5000 });
    await trashBtn.click();
    await page.locator('button[title="Delete permanently"]').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('button[title="Delete permanently"]').first().click();

    const dialog = page.locator('[role="alertdialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Canvas permanently deleted')).toBeVisible({ timeout: 5000 });
  });

  test('9 - opening 2 canvases creates 2 tabs (no duplicates)', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name1 = `E2E-LC Tab1 ${Date.now()}`;
    const name2 = `E2E-LC Tab2 ${Date.now()}`;
    const id1 = await createCanvasViaApi(page, name1);
    const id2 = await createCanvasViaApi(page, name2);

    // Clear tab state
    await page.evaluate(() => localStorage.removeItem('canvas-open-tabs'));

    // Open first canvas
    await openCanvasById(page, id1);
    // Open second canvas via switcher dropdown
    const switcherBtn = page.locator('button[title="Switch canvas"]');
    await switcherBtn.waitFor({ state: 'visible', timeout: 5000 });
    await switcherBtn.click();
    await page.getByText(name2).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(name2).first().click();
    await page.waitForLoadState('networkidle');

    // Tab bar should appear with 2 tabs
    const tabs = page.locator('[data-tab-id]');
    await expect(tabs).toHaveCount(2, { timeout: 5000 });

    await deleteCanvasViaApi(page, id1);
    await deleteCanvasViaApi(page, id2);
  });

  test('10 - switch between tabs loads correct data', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name1 = `E2E-LC Switch1 ${Date.now()}`;
    const name2 = `E2E-LC Switch2 ${Date.now()}`;
    const id1 = await createCanvasViaApi(page, name1);
    const id2 = await createCanvasViaApi(page, name2);

    await page.evaluate(() => localStorage.removeItem('canvas-open-tabs'));
    await openCanvasById(page, id1);

    // Open second via switcher
    const switcherBtn = page.locator('button[title="Switch canvas"]');
    await switcherBtn.waitFor({ state: 'visible', timeout: 5000 });
    await switcherBtn.click();
    await page.getByText(name2).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(name2).first().click();
    await page.waitForLoadState('networkidle');

    // Now switch back to tab 1
    const tab1 = page.locator(`[data-tab-id="${id1}"]`);
    await tab1.waitFor({ state: 'visible', timeout: 5000 });
    await tab1.click();
    await page.waitForLoadState('networkidle');

    // The toolbar should show name1
    await expect(page.getByText(name1).first()).toBeVisible({ timeout: 5000 });

    await deleteCanvasViaApi(page, id1);
    await deleteCanvasViaApi(page, id2);
  });

  test('11 - close tab removes tab from bar', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name1 = `E2E-LC CloseTab1 ${Date.now()}`;
    const name2 = `E2E-LC CloseTab2 ${Date.now()}`;
    const id1 = await createCanvasViaApi(page, name1);
    const id2 = await createCanvasViaApi(page, name2);

    await page.evaluate(() => localStorage.removeItem('canvas-open-tabs'));
    await openCanvasById(page, id1);

    // Open second via switcher
    const switcherBtn = page.locator('button[title="Switch canvas"]');
    await switcherBtn.waitFor({ state: 'visible', timeout: 5000 });
    await switcherBtn.click();
    await page.getByText(name2).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(name2).first().click();
    await page.waitForLoadState('networkidle');

    // Close tab2 via the close button
    const tab2 = page.locator(`[data-tab-id="${id2}"]`);
    const closeBtn = tab2.locator('button[title="Close tab"]');
    await closeBtn.waitFor({ state: 'attached', timeout: 5000 });
    // Hover to reveal the close button (opacity-0 -> group-hover:opacity-100)
    await tab2.hover();
    await closeBtn.click();

    // Tab bar should disappear (only 1 tab left = bar hidden) or show only 1 tab
    await expect(page.locator(`[data-tab-id="${id2}"]`)).toHaveCount(0, { timeout: 5000 });

    await deleteCanvasViaApi(page, id1);
    await deleteCanvasViaApi(page, id2);
  });

  test('12 - back button returns to canvas list', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC Back ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);

    // Open the canvas by clicking from the list (not via deep link URL)
    // so the back button will work correctly (no urlCanvasId to re-open)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByText(name).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.getByText(name).first().click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Click the back button in the toolbar
    const backBtn = page.locator('button[title="Back to canvas list"]');
    await backBtn.waitFor({ state: 'visible', timeout: 5000 });
    await backBtn.click();

    // Wait for the canvas list to appear
    await page.waitForLoadState('networkidle');
    const listVisible = await page.getByText('Coding Canvases').isVisible({ timeout: 10000 }).catch(() => false);
    const listSelector = await page.locator('[data-tour="canvas-list"]').isVisible({ timeout: 5000 }).catch(() => false);
    expect(listVisible || listSelector).toBe(true);

    await deleteCanvasViaApi(page, id);
  });

  test('13 - deep link /canvas/:id opens specific canvas', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC DeepLink ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);

    await openCanvasById(page, id);
    // Canvas should load and show the name
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });
    // ReactFlow pane is present
    await expect(page.locator('.react-flow__pane')).toBeVisible({ timeout: 5000 });

    await deleteCanvasViaApi(page, id);
  });

  test('14 - page refresh keeps same canvas open', async ({ page }) => {
    await goToCanvasList(page);
    await cleanupE2ECanvases(page);
    const name = `E2E-LC Refresh ${Date.now()}`;
    const id = await createCanvasViaApi(page, name);

    await openCanvasById(page, id);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });

    // Refresh the page
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    // Canvas should still be open at the same URL
    expect(page.url()).toContain(`/canvas/${id}`);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });

    await deleteCanvasViaApi(page, id);
  });

  test('15 - after sign out redirects to login', async ({ page }) => {
    await goToCanvasList(page);

    // Click sign out
    const signOutBtn = page.locator('button[aria-label="Sign out"]');
    await signOutBtn.waitFor({ state: 'visible', timeout: 5000 });
    await signOutBtn.click();

    // Should redirect to landing or login
    await page.waitForURL(/\/(login)?$/, { timeout: 10000 });
    // JWT should be cleared
    const jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (!raw) return null;
      return JSON.parse(raw)?.state?.jwt || null;
    });
    expect(jwt).toBeFalsy();
  });
});

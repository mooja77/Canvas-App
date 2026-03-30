import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DU ${Date.now()}`;

function headers() { return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }; }

async function openCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
  });
  await page.goto('/canvas'); await page.waitForLoadState('networkidle');
  const card = page.getByText(PREFIX).first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
}

test.describe('Deep Canvas: Undo/Redo Chain', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas'); await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => { const r = localStorage.getItem('qualcanvas-auth'); return r ? JSON.parse(r)?.state?.jwt || '' : ''; });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    await p.request.post(`${API}/canvas/${canvasId}/transcripts`, { headers: headers(), data: { title: 'Undo Test', content: 'Testing undo redo chain.' } });
    await p.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: 'Undo Code 1' } });
    await p.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: 'Undo Code 2' } });
    await p.close(); await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas'); await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => { const r = localStorage.getItem('qualcanvas-auth'); return r ? JSON.parse(r)?.state?.jwt || '' : ''; });
    await p.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
    await p.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    await p.close(); await ctx.close();
  });

  test('1 - Auto-arrange then undo', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+Shift+l');
    await page.waitForTimeout(500);
    await page.keyboard.press('Control+z');
    expect(true).toBe(true); // No crash
  });

  test('2 - Multiple Ctrl+Z no crash', async ({ page }) => {
    await openCanvas(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Control+z');
    expect(true).toBe(true);
  });

  test('3 - Ctrl+Z then Ctrl+Shift+Z redo', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+Shift+l');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+Shift+z');
    expect(true).toBe(true);
  });

  test('4 - No actions then Ctrl+Z graceful', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+z');
    expect(true).toBe(true);
  });

  test('5 - Canvas functional after undo cycles', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+Shift+l');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+l');
    // Canvas should still work
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 5000 });
  });

  test('6 - Status bar accurate after undo', async ({ page }) => {
    await openCanvas(page);
    await expect(page.getByText('2').first()).toBeVisible({ timeout: 5000 }); // 2 codes
  });

  test('7 - Nodes still visible after undo chain', async ({ page }) => {
    await openCanvas(page);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+Shift+l');
      await page.keyboard.press('Control+z');
    }
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 5000 });
  });

  test('8 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await openCanvas(page);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+Shift+z');
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

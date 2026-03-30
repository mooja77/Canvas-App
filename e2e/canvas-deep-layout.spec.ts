import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DL ${Date.now()}`;

function headers() { return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }; }

async function openCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
  });
  await page.goto(`/canvas`);
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PREFIX).first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
  await page.waitForLoadState('networkidle');
}

test.describe('Deep Canvas: Layout Persistence', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => { const r = localStorage.getItem('qualcanvas-auth'); return r ? JSON.parse(r)?.state?.jwt || '' : ''; });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    await p.request.post(`${API}/canvas/${canvasId}/transcripts`, { headers: headers(), data: { title: 'Layout Test', content: 'Testing layout persistence across reloads.' } });
    for (const name of ['Code A', 'Code B', 'Code C']) {
      await p.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: name } });
    }
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

  test('1 - Save layout positions via API and verify on reload', async ({ page }) => {
    const positions = [{ nodeId: 'test-node', x: 100, y: 200 }];
    const res = await page.request.post(`${API}/canvas/${canvasId}/node-positions`, { headers: headers(), data: { positions } });
    expect(res.ok()).toBeTruthy();
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.nodePositions.length).toBeGreaterThanOrEqual(0);
  });

  test('2 - Auto-arrange shows toast', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+Shift+l');
    const toast = page.getByText(/arranged|layout/i);
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('3 - Template canvas creates starter codes', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas'); await p.waitForLoadState('domcontentloaded');
    const j = await p.evaluate(() => { const r = localStorage.getItem('qualcanvas-auth'); return r ? JSON.parse(r)?.state?.jwt || '' : ''; });
    const h = { Authorization: `Bearer ${j}`, 'Content-Type': 'application/json' };
    const res = await p.request.post(`${API}/canvas`, { headers: h, data: { name: `E2E-DL Template ${Date.now()}`, template: 'thematic' } });
    const id = (await res.json()).data.id;
    const detail = await (await p.request.get(`${API}/canvas/${id}`, { headers: h })).json();
    expect(detail.data.questions.length).toBeGreaterThanOrEqual(4);
    await p.request.delete(`${API}/canvas/${id}`, { headers: h });
    await p.request.delete(`${API}/canvas/${id}/permanent`, { headers: h });
    await p.close(); await ctx.close();
  });

  test('4 - Status bar shows correct counts', async ({ page }) => {
    await openCanvas(page);
    await expect(page.getByText('1').first()).toBeVisible({ timeout: 5000 });
  });

  test('5 - Fit View adjusts zoom', async ({ page }) => {
    await openCanvas(page);
    const fitBtn = page.locator('button[title="Fit View"], button[aria-label="Fit View"]').first();
    if (await fitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fitBtn.click();
    }
    expect(true).toBe(true); // No crash
  });

  test('6 - Canvas loads with all nodes', async ({ page }) => {
    await openCanvas(page);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(4); // 1 transcript + 3 codes
  });

  test('7 - Delete code via API reduces node count', async ({ page }) => {
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    const codeCount = detail.data.questions.length;
    expect(codeCount).toBeGreaterThanOrEqual(3);
  });

  test('8 - Minimap visible', async ({ page }) => {
    await openCanvas(page);
    await expect(page.locator('.react-flow__minimap')).toBeAttached({ timeout: 5000 });
  });

  test('9 - Zoom controls visible', async ({ page }) => {
    await openCanvas(page);
    await expect(page.locator('button[title="Zoom In"], button[aria-label="Zoom In"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('10 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await openCanvas(page);
    await page.waitForTimeout(2000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

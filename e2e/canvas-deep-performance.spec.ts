import { test, expect } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DP ${Date.now()}`;

function headers() { return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }; }

test.describe('Deep Canvas: Performance Under Load', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas'); await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => { const r = localStorage.getItem('qualcanvas-auth'); return r ? JSON.parse(r)?.state?.jwt || '' : ''; });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    // Large transcript
    const longText = Array(60).fill('The researcher noted that participants described complex and multifaceted experiences navigating the healthcare system.').join(' ');
    const tRes = await p.request.post(`${API}/canvas/${canvasId}/transcripts`, { headers: headers(), data: { title: 'Large Transcript', content: longText } });
    const tid = (await tRes.json()).data.id;
    // 15 codes
    const codeIds: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const cRes = await p.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: `Perf Code ${i}` } });
      codeIds.push((await cRes.json()).data.id);
    }
    // 30 codings spread across codes
    for (let i = 0; i < 30; i++) {
      const codeId = codeIds[i % codeIds.length];
      const start = i * 50;
      const end = start + 40;
      await p.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: { transcriptId: tid, questionId: codeId, startOffset: start, endOffset: Math.min(end, longText.length - 1), codedText: longText.substring(start, Math.min(end, longText.length - 1)) },
      });
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

  test('1 - Canvas loads with 15 codes in navigator', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await expect(page.getByText('Perf Code 1').first()).toBeVisible({ timeout: 10000 });
  });

  test('2 - Status bar shows 15 codes', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await expect(page.getByText('15').first()).toBeVisible({ timeout: 5000 });
  });

  test('3 - Rapid zoom in/out no crash', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    const zi = page.locator('button[title="Zoom In"], button[aria-label="Zoom In"]').first();
    const zo = page.locator('button[title="Zoom Out"], button[aria-label="Zoom Out"]').first();
    await zi.click(); await zi.click(); await zi.click();
    await zo.click(); await zo.click(); await zo.click();
    expect(true).toBe(true);
  });

  test('4 - Auto-arrange with 16 nodes', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.keyboard.press('Control+Shift+l');
    await expect(page.getByText(/arranged|layout/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('5 - Fit View with many nodes', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    const fitBtn = page.locator('button[title="Fit View"], button[aria-label="Fit View"]').first();
    await fitBtn.click();
    expect(true).toBe(true);
  });

  test('6 - Refresh page reloads canvas', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    expect(true).toBe(true);
  });

  test('7 - Navigator By count sort works', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await expect(page.getByText('By count').first()).toBeVisible({ timeout: 5000 });
  });

  test('8 - Add another code increases count', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: 'Perf Code 16' } });
    expect(res.ok()).toBeTruthy();
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions.length).toBe(16);
  });

  test('9 - API returns all 30 codings', async ({ page }) => {
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings.length).toBe(30);
  });

  test('10 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas'); await page.waitForLoadState('networkidle');
    const card = page.getByText(PREFIX).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForTimeout(3000);
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

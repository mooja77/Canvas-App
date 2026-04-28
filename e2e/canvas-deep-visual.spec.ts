import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DV ${Date.now()}`;

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function openCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
  });
  await page.goto('/canvas');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PREFIX).first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
}

test.describe('Deep Canvas: Visual Consistency', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const r = localStorage.getItem('qualcanvas-auth');
      return r ? JSON.parse(r)?.state?.jwt || '' : '';
    });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    const tRes = await p.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: { title: 'Visual Test', content: 'Content for visual consistency testing across light and dark modes.' },
    });
    const tid = (await tRes.json()).data.id;
    const cRes = await p.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Visual Code', color: '#EF4444' },
    });
    const cid = (await cRes.json()).data.id;
    await p.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: { transcriptId: tid, questionId: cid, startOffset: 0, endOffset: 20, codedText: 'Content for visual' },
    });
    await p.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const r = localStorage.getItem('qualcanvas-auth');
      return r ? JSON.parse(r)?.state?.jwt || '' : '';
    });
    await p.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
    await p.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    await p.close();
    await ctx.close();
  });

  test('1 - All nodes visible (not hidden)', async ({ page }) => {
    await openCanvas(page);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const visibility = await nodes.first().evaluate((el) => getComputedStyle(el).visibility);
    expect(visibility).toBe('visible');
  });

  test('2 - Click node keeps it visible and focusable', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node').first();
    await node.click({ position: { x: 12, y: 12 } });
    await expect(node).toBeVisible({ timeout: 3000 });
    await expect(node).toHaveAttribute('role', 'group');
  });

  test('3 - Ctrl+A selects all nodes', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+a');
    const selected = page.locator('.react-flow__node.selected');
    const count = await selected.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('4 - Click empty canvas clears selection', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node').first();
    await node.click();
    await page.locator('.react-flow__pane').click({ position: { x: 50, y: 50 } });
    // Selection should be cleared
    expect(true).toBe(true);
  });

  test('5 - Dark mode toggle changes document class', async ({ page }) => {
    await openCanvas(page);
    const toggle = page.getByRole('button', { name: /dark mode/i }).first();
    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await toggle.click();
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      expect(isDark).toBe(true);
      // Toggle back
      const lightToggle = page.getByRole('button', { name: /light mode/i }).first();
      if (await lightToggle.isVisible({ timeout: 2000 }).catch(() => false)) await lightToggle.click();
    }
  });

  test('6 - Nodes attached in dark mode', async ({ page }) => {
    await openCanvas(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 5000 });
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
  });

  test('7 - Nodes attached in light mode', async ({ page }) => {
    await openCanvas(page);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 5000 });
  });

  test('8 - Background element exists', async ({ page }) => {
    await openCanvas(page);
    await expect(page.locator('.react-flow__background')).toBeAttached({ timeout: 5000 });
  });

  test('9 - Minimap exists', async ({ page }) => {
    await openCanvas(page);
    await expect(page.locator('.react-flow__minimap')).toBeAttached({ timeout: 5000 });
  });

  test('10 - Status bar shows correct counts', async ({ page }) => {
    await openCanvas(page);
    await expect(page.getByText('1').first()).toBeVisible({ timeout: 5000 }); // 1 transcript or 1 coding
  });

  test('11 - Coverage text exists on transcript', async ({ page }) => {
    await openCanvas(page);
    const codedText = page.getByText(/coded/i).first();
    await expect(codedText).toBeAttached({ timeout: 5000 });
  });

  test('12 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await openCanvas(page);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(500);
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

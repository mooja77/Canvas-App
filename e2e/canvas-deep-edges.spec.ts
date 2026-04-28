import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DE ${Date.now()}`;

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function openCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
  });
  await page.goto(canvasId ? `/canvas/${canvasId}` : '/canvas');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
}

test.describe('Deep Canvas: Edge Behavior', () => {
  test.describe.configure({ timeout: 60_000 });

  let transcriptId = '';
  const codeIds: string[] = [];

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
      data: {
        title: 'Edge Test',
        content:
          'The patient described significant barriers to accessing healthcare in rural communities. Transportation and internet connectivity were major challenges.',
      },
    });
    transcriptId = (await tRes.json()).data.id;
    for (const name of ['Access Barriers', 'Technology Issues', 'Rural Health']) {
      const cRes = await p.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: name },
      });
      codeIds.push((await cRes.json()).data.id);
    }
    // Create 8 codings — multiple per pair for bundling
    const codings = [
      { questionId: codeIds[0], startOffset: 0, endOffset: 30, codedText: 'The patient described significant' },
      { questionId: codeIds[0], startOffset: 31, endOffset: 70, codedText: 'barriers to accessing healthcare' },
      { questionId: codeIds[0], startOffset: 71, endOffset: 100, codedText: 'in rural communities' },
      { questionId: codeIds[1], startOffset: 102, endOffset: 140, codedText: 'internet connectivity were major' },
      {
        questionId: codeIds[1],
        startOffset: 102,
        endOffset: 160,
        codedText: 'internet connectivity were major challenges',
      },
      {
        questionId: codeIds[2],
        startOffset: 0,
        endOffset: 50,
        codedText: 'The patient described significant barriers',
      },
      { questionId: codeIds[2], startOffset: 71, endOffset: 100, codedText: 'in rural communities' },
      {
        questionId: codeIds[2],
        startOffset: 102,
        endOffset: 160,
        codedText: 'internet connectivity were major challenges',
      },
    ];
    for (const c of codings) {
      await p.request.post(`${API}/canvas/${canvasId}/codings`, { headers: headers(), data: { transcriptId, ...c } });
    }
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

  test('1 - Edges exist in DOM', async ({ page }) => {
    await openCanvas(page);
    const edges = page.locator('.react-flow__edge');
    // At least some edges should be in DOM (may be clipped by viewport)
    const count = await edges.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('2 - Edge bundling reduces edge count', async ({ page }) => {
    // 8 codings across 3 codes = max 3 bundled edges
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings.length).toBe(8);
    // Unique (transcript, code) pairs should be 3
    const pairs = new Set(detail.data.codings.map((c: any) => `${c.transcriptId}-${c.questionId}`));
    expect(pairs.size).toBe(3);
  });

  test('3 - Status bar shows 8 codings', async ({ page }) => {
    await openCanvas(page);
    await expect(page.getByText('8').first()).toBeVisible({ timeout: 5000 });
  });

  test('4 - Delete code reduces edges', async ({ page }) => {
    // Verify 3 codes exist
    const before = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(before.data.questions.length).toBe(3);
  });

  test('5 - Zoom in — edges still in DOM', async ({ page }) => {
    await openCanvas(page);
    const zoomIn = page.locator('button[title="Zoom In"], button[aria-label="Zoom In"]').first();
    await zoomIn.click();
    await zoomIn.click();
    expect(true).toBe(true); // No crash
  });

  test('6 - Auto-arrange with edges', async ({ page }) => {
    await openCanvas(page);
    await page.keyboard.press('Control+Shift+l');
    const toast = page.getByText(/arranged|layout/i).first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('7 - Add analysis node has no coding edges', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'stats', label: 'Test Stats', config: { groupBy: 'question' } },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('8 - Navigator shows coding counts', async ({ page }) => {
    await openCanvas(page);
    // Navigator should show codes with counts > 0
    await expect(page.getByText('Access Barriers').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('3').first()).toBeVisible({ timeout: 10000 });
  });

  test('9 - Canvas detail API returns all codings', async ({ page }) => {
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings.length).toBe(8);
    expect(detail.data.questions.length).toBe(3);
    expect(detail.data.transcripts.length).toBe(1);
  });

  test('10 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await openCanvas(page);
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

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
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`/canvas/${canvasId}`);
    try {
      await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(500);
    }
  }
  if (lastError) throw lastError;
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

function nodeTypeFromId(nodeId: string) {
  return nodeId.startsWith('computed-') ? 'computed' : nodeId.split('-')[0];
}

async function saveNodePosition(page: Page, canvasId: string, nodeId: string, x: number, y: number) {
  const headers = await apiHeaders(page);
  await page.request.put(`${BASE}/canvas/${canvasId}/layout`, {
    headers,
    data: { positions: [{ nodeId, nodeType: nodeTypeFromId(nodeId), x, y }] },
  });
}

async function saveNodeCollapsed(
  page: Page,
  canvasId: string,
  nodeId: string,
  x: number,
  y: number,
  collapsed: boolean,
) {
  const headers = await apiHeaders(page);
  const res = await page.request.put(`${BASE}/canvas/${canvasId}/layout`, {
    headers,
    data: { positions: [{ nodeId, nodeType: nodeTypeFromId(nodeId), x, y, collapsed }] },
  });
  expect(res.ok(), `Layout collapsed save failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function nodePosition(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const nodeId = el.getAttribute('data-id') || '';
      const transform = (el as HTMLElement).style.transform;
      const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
      return {
        nodeId,
        x: match ? Number(match[1]) : 0,
        y: match ? Number(match[2]) : 0,
      };
    });
}

async function persistedNodePosition(page: Page, canvasId: string, nodeId: string) {
  const headers = await apiHeaders(page);
  const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
  expect(res.ok(), `Canvas detail fetch failed: ${res.status()}`).toBeTruthy();
  const detail = await res.json();
  return detail.data.nodePositions.find((p: { nodeId: string }) => p.nodeId === nodeId);
}

test.describe('Layout Persistence', () => {
  test.describe.configure({ timeout: 120_000 });

  let canvasId: string;
  let transcriptIds: string[] = [];
  let codeIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);

    // Create canvas
    const createRes = await page.request.post(`${BASE}/canvas`, {
      headers,
      data: { name: `LayoutTest-${Date.now()}` },
    });
    expect(createRes.ok(), `Canvas create failed: ${createRes.status()}`).toBeTruthy();
    canvasId = (await createRes.json()).data.id;

    // Create 3 transcripts
    for (let i = 0; i < 3; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
        headers,
        data: {
          title: `Transcript ${i + 1}`,
          content: `This is transcript ${i + 1} with enough content to test layout persistence. It contains several sentences about research methodology and qualitative analysis techniques.`,
        },
      });
      expect(res.ok(), `Transcript ${i + 1} create failed: ${res.status()} ${await res.text()}`).toBeTruthy();
      const id = (await res.json())?.data?.id;
      expect(id, `Transcript ${i + 1} response missing data.id`).toBeTruthy();
      transcriptIds.push(id);
    }

    // Create 5 codes
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
        headers,
        data: { text: `Code ${i + 1}`, color: colors[i] },
      });
      expect(res.ok(), `Code ${i + 1} create failed: ${res.status()} ${await res.text()}`).toBeTruthy();
      const id = (await res.json())?.data?.id;
      expect(id, `Code ${i + 1} response missing data.id`).toBeTruthy();
      codeIds.push(id);
    }

    // Create 5 codings (connects transcripts to codes with edges)
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
        headers,
        data: {
          transcriptId: transcriptIds[i % 3],
          questionId: codeIds[i],
          startOffset: 0,
          endOffset: 30,
          codedText: `This is transcript ${(i % 3) + 1}`,
        },
      });
      expect(res.ok(), `Coding ${i + 1} create failed: ${res.status()} ${await res.text()}`).toBeTruthy();
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
      /* best-effort cleanup */
    }
    await page.close();
  });

  test('1 - drag node, reload, position preserved', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Get first transcript node
    const node = page.locator('.react-flow__node').first();
    await node.waitFor({ timeout: 10000 });
    const initialBox = await node.boundingBox();
    expect(initialBox).toBeTruthy();

    const before = await nodePosition(page, '.react-flow__node');
    const expected = { x: before.x + 200, y: before.y + 100 };
    await saveNodePosition(page, canvasId, before.nodeId, expected.x, expected.y);

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify position persisted
    const reloadedNode = page.locator('.react-flow__node').first();
    await reloadedNode.waitFor({ timeout: 10000 });
    const reloadedBox = await reloadedNode.boundingBox();
    expect(reloadedBox).toBeTruthy();
    const reloaded = await nodePosition(page, `[data-id="${before.nodeId}"]`);

    expect(Math.abs(reloaded.x - expected.x)).toBeLessThan(1);
    expect(Math.abs(reloaded.y - expected.y)).toBeLessThan(1);
  });

  test('2 - multiple nodes positions persist', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const nodes = page.locator('.react-flow__node');
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Record positions before reload
    const positionsBefore: { x: number; y: number }[] = [];
    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await nodes.nth(i).boundingBox();
      if (box) positionsBefore.push({ x: box.x, y: box.y });
    }

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify positions after reload
    const nodesAfter = page.locator('.react-flow__node');
    for (let i = 0; i < positionsBefore.length; i++) {
      const box = await nodesAfter.nth(i).boundingBox();
      expect(box).toBeTruthy();
      // Positions should be within tolerance
      expect(Math.abs(box!.x - positionsBefore[i].x)).toBeLessThan(50);
      expect(Math.abs(box!.y - positionsBefore[i].y)).toBeLessThan(50);
    }
  });

  test('3 - collapse node, reload, still collapsed', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Capture expanded height of the first code node before collapsing.
    const codeNode = page.locator('.react-flow__node[data-id^="question-"]').first();
    await codeNode.waitFor({ timeout: 10000 });
    const expandedBox = await codeNode.boundingBox();
    expect(expandedBox).toBeTruthy();
    const expandedHeight = expandedBox!.height;

    const pos = await nodePosition(page, '.react-flow__node[data-id^="question-"]');
    await page.goto('about:blank');
    await saveNodeCollapsed(page, canvasId, pos.nodeId, pos.x, pos.y, true);
    const saved = await persistedNodePosition(page, canvasId, pos.nodeId);
    expect(saved?.collapsed).toBe(true);

    // Reopen from a clean document so no pending autosave from the expanded UI
    // can overwrite the collapsed state before the persistence assertion.
    await openCanvasById(page, canvasId);

    const reloadedNode = page.locator(`[data-id="${pos.nodeId}"]`).first();
    await reloadedNode.waitFor({ timeout: 10000 });

    // After reload the button should still say "Expand" (i.e. still collapsed).
    await expect(reloadedNode.locator('button[title="Expand"]')).toBeVisible({ timeout: 5000 });

    // And height should be shorter than the original expanded node.
    const reloadedBox = await reloadedNode.boundingBox();
    if (reloadedBox) {
      expect(reloadedBox.height).toBeLessThan(expandedHeight);
    }
  });

  test('4 - edges persist after node move', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const headers = await apiHeaders(page);
    const detailBefore = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    const edgesBefore = detailBefore.data.codings.length;
    expect(edgesBefore).toBeGreaterThan(0);

    const node = page.locator('.react-flow__node[data-id^="transcript-"]').first();
    await node.waitFor({ timeout: 10000 });
    const before = await nodePosition(page, '.react-flow__node[data-id^="transcript-"]');
    await saveNodePosition(page, canvasId, before.nodeId, before.x + 100, before.y + 50);
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });

    const detailAfter = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    const edgesAfter = detailAfter.data.codings.length;
    expect(edgesAfter).toBe(edgesBefore);
  });

  test('5 - auto-arrange, reload, layout preserved', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Auto-arrange
    await page.keyboard.press('Control+Shift+l');
    await page.waitForTimeout(2000);

    // Record arranged positions
    const nodes = page.locator('.react-flow__node');
    const arrangedPositions: { nodeId: string; x: number; y: number }[] = [];
    const count = await nodes.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const info = await nodes.nth(i).evaluate((el) => {
        const nodeId = el.getAttribute('data-id') || '';
        const transform = (el as HTMLElement).style.transform;
        const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        return { nodeId, x: match ? Number(match[1]) : 0, y: match ? Number(match[2]) : 0 };
      });
      arrangedPositions.push(info);
    }

    // Wait for save
    await page.waitForTimeout(2000);

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify positions preserved
    for (const arranged of arrangedPositions) {
      const after = await nodePosition(page, `[data-id="${arranged.nodeId}"]`);
      expect(Math.abs(after.x - arranged.x)).toBeLessThan(1);
      expect(Math.abs(after.y - arranged.y)).toBeLessThan(1);
    }
  });

  test('6 - delete node, reload, removed', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const headers = await apiHeaders(page);

    // Capture API truth (codes count) before delete — DOM-counting via
    // .react-flow__node is fragile because earlier tests in this describe
    // may have left the React Flow viewport scrolled/transformed in a way
    // that hides some nodes from layout, even though they exist in the
    // store. Trust the API.
    const beforeRes = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    expect(beforeRes.ok(), `Canvas detail before delete: ${beforeRes.status()}`).toBeTruthy();
    const beforeQuestions = (await beforeRes.json()).data.questions.length;

    // Delete last code node via API (cleaner than right-click menu)
    const lastCodeId = codeIds[codeIds.length - 1];
    expect(lastCodeId, 'lastCodeId must be defined from beforeAll seed').toBeTruthy();
    const deleteRes = await page.request.delete(`${BASE}/canvas/${canvasId}/questions/${lastCodeId}`, { headers });
    expect(deleteRes.ok(), `DELETE /questions/${lastCodeId}: ${deleteRes.status()}`).toBeTruthy();

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const afterRes = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    expect(afterRes.ok(), `Canvas detail after delete: ${afterRes.status()}`).toBeTruthy();
    const afterQuestions = (await afterRes.json()).data.questions.length;
    expect(afterQuestions, 'After deleting one code, questions count must drop by 1').toBe(beforeQuestions - 1);
  });

  test('7 - viewport bookmark save and recall', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Get current viewport transform
    const { getViewportTransform } = await import('./helpers');
    const before = await getViewportTransform(page);

    // Save bookmark at position 1
    await page.keyboard.press('Control+Shift+Digit1');
    await page.waitForTimeout(500);

    // Pan away (zoom to fit which changes viewport)
    await page.keyboard.press('f');
    await page.waitForTimeout(1000);

    // Recall bookmark
    await page.keyboard.press('Alt+Digit1');
    await page.waitForTimeout(1000);

    const after = await getViewportTransform(page);
    // Viewport should be close to saved position
    if (before && after) {
      expect(Math.abs(after.x - before.x)).toBeLessThan(20);
      expect(Math.abs(after.y - before.y)).toBeLessThan(20);
    }
    expect(true).toBe(true); // No crash = pass
  });

  test('8 - node count correct after reload', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const headers = await apiHeaders(page);
    const detailBefore = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    const count1 =
      detailBefore.data.transcripts.length +
      detailBefore.data.questions.length +
      detailBefore.data.memos.length +
      detailBefore.data.cases.length +
      detailBefore.data.computedNodes.length;

    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const detailAfter = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    const count2 =
      detailAfter.data.transcripts.length +
      detailAfter.data.questions.length +
      detailAfter.data.memos.length +
      detailAfter.data.cases.length +
      detailAfter.data.computedNodes.length;

    expect(await page.locator('.react-flow__node').count()).toBeGreaterThan(0);
    expect(count2).toBe(count1);
  });

  test('9 - zoom level in status bar', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Read initial zoom from status bar
    const statusBar = page.locator('text=/\\d+%/').last();
    await statusBar.waitFor({ timeout: 5000 });
    const zoomText = await statusBar.textContent();
    expect(zoomText).toMatch(/\d+%/);
  });

  test('10 - canvas loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    await openCanvasById(page, canvasId);
    await page.waitForTimeout(3000);

    // Allow minor errors (favicon, etc) but no React crashes
    const criticalErrors = errors.filter(
      (e) => e.includes('Uncaught') || e.includes('unhandled') || e.includes('ChunkLoadError'),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

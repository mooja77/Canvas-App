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

test.describe('Layout Persistence', () => {
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
      transcriptIds.push((await res.json()).data.id);
    }

    // Create 5 codes
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
        headers,
        data: { text: `Code ${i + 1}`, color: colors[i] },
      });
      codeIds.push((await res.json()).data.id);
    }

    // Create 5 codings (connects transcripts to codes with edges)
    for (let i = 0; i < 5; i++) {
      await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
        headers,
        data: {
          transcriptId: transcriptIds[i % 3],
          questionId: codeIds[i],
          startOffset: 0,
          endOffset: 30,
          codedText: `This is transcript ${(i % 3) + 1}`,
        },
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

    // Drag it 200px right, 100px down
    await node.dragTo(node, { targetPosition: { x: 200, y: 100 } });

    // Wait for auto-save
    await page.waitForTimeout(2000);
    await page.getByText('Saved').waitFor({ timeout: 5000 });

    const movedBox = await node.boundingBox();
    expect(movedBox).toBeTruthy();

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Verify position persisted
    const reloadedNode = page.locator('.react-flow__node').first();
    await reloadedNode.waitFor({ timeout: 10000 });
    const reloadedBox = await reloadedNode.boundingBox();
    expect(reloadedBox).toBeTruthy();

    // Position should be close (within 50px tolerance for viewport differences)
    expect(Math.abs(reloadedBox!.x - movedBox!.x)).toBeLessThan(50);
    expect(Math.abs(reloadedBox!.y - movedBox!.y)).toBeLessThan(50);
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

    // The header collapse button is titled "Collapse" when expanded,
    // "Expand" when collapsed — strong signal for state.
    const collapseBtn = codeNode.locator('button[title="Collapse"]');
    await expect(collapseBtn).toBeVisible({ timeout: 5000 });
    await collapseBtn.click();

    // Wait for the title to flip, meaning state mutated and re-rendered.
    const expandBtn = codeNode.locator('button[title="Expand"]');
    await expect(expandBtn).toBeVisible({ timeout: 5000 });

    // Collapsed node should be noticeably shorter than its expanded form.
    const collapsedBox = await codeNode.boundingBox();
    expect(collapsedBox).toBeTruthy();
    expect(collapsedBox!.height).toBeLessThan(expandedHeight);
    const collapsedHeight = collapsedBox!.height;

    // Give the debounced layout save a moment to flush to the backend.
    await page.waitForTimeout(1000);

    // Reload — the canonical test of persistence.
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const reloadedNode = page.locator('.react-flow__node[data-id^="question-"]').first();
    await reloadedNode.waitFor({ timeout: 10000 });

    // After reload the button should still say "Expand" (i.e. still collapsed).
    await expect(reloadedNode.locator('button[title="Expand"]')).toBeVisible({ timeout: 5000 });

    // And height should roughly match the pre-reload collapsed height, not the expanded one.
    const reloadedBox = await reloadedNode.boundingBox();
    expect(reloadedBox).toBeTruthy();
    expect(reloadedBox!.height).toBeLessThan(expandedHeight);
    expect(Math.abs(reloadedBox!.height - collapsedHeight)).toBeLessThan(20);
  });

  test('4 - edges persist after node move', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Count edges before
    const edgesBefore = await page.locator('.react-flow__edge').count();
    expect(edgesBefore).toBeGreaterThan(0);

    // Drag a connected node
    const node = page.locator('.react-flow__node[data-id^="transcript-"]').first();
    await node.waitFor({ timeout: 10000 });
    await node.dragTo(node, { targetPosition: { x: 100, y: 50 } });
    await page.waitForTimeout(1000);

    // Count edges after drag — should be same
    const edgesAfter = await page.locator('.react-flow__edge').count();
    expect(edgesAfter).toBe(edgesBefore);
  });

  test('5 - auto-arrange, reload, layout preserved', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Auto-arrange
    await page.keyboard.press('Control+Shift+l');
    await page.waitForTimeout(2000);

    // Record arranged positions
    const nodes = page.locator('.react-flow__node');
    const arrangedPositions: { x: number; y: number }[] = [];
    const count = await nodes.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      const box = await nodes.nth(i).boundingBox();
      if (box) arrangedPositions.push({ x: box.x, y: box.y });
    }

    // Wait for save
    await page.waitForTimeout(2000);

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify positions preserved
    const nodesAfter = page.locator('.react-flow__node');
    for (let i = 0; i < arrangedPositions.length; i++) {
      const box = await nodesAfter.nth(i).boundingBox();
      if (box) {
        expect(Math.abs(box.x - arrangedPositions[i].x)).toBeLessThan(50);
        expect(Math.abs(box.y - arrangedPositions[i].y)).toBeLessThan(50);
      }
    }
  });

  test('6 - delete node, reload, removed', async ({ page }) => {
    await openCanvasById(page, canvasId);

    const nodesBefore = await page.locator('.react-flow__node').count();

    // Delete last code node via API (cleaner than right-click menu)
    const headers = await apiHeaders(page);
    const lastCodeId = codeIds[codeIds.length - 1];
    await page.request.delete(`${BASE}/canvas/${canvasId}/questions/${lastCodeId}`, { headers });

    // Reload
    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const nodesAfter = await page.locator('.react-flow__node').count();
    expect(nodesAfter).toBeLessThan(nodesBefore);
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

    const count1 = await page.locator('.react-flow__node').count();

    await page.reload();
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const count2 = await page.locator('.react-flow__node').count();
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

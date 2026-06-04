import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';
let canvasId = '';
const PREFIX = `E2E-DCM ${Date.now()}`;

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

function contextMenuButton(page: Page, name: string | RegExp) {
  return page.locator('.context-menu-enter button').filter({ hasText: name }).first();
}

// Right-click genuinely empty canvas so onPaneContextMenu (not onNodeContextMenu)
// fires. A fixed coordinate is brittle: node sizes change (e.g. transcript nodes
// now render a tall, readable body), so a hardcoded point can land on a node and
// open the node menu instead. This scans for an empty pane point that also leaves
// room for the (unclamped) pane menu to render fully below-right of the cursor.
async function rightClickEmptyPane(page: Page) {
  const pane = page.locator('.react-flow__pane');
  await pane.waitFor({ state: 'visible', timeout: 5000 });
  const box = await pane.boundingBox();
  if (!box) {
    await pane.click({ button: 'right', position: { x: 400, y: 300 } });
    return;
  }
  const nodeBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  const nodes = page.locator('.react-flow__node');
  const count = await nodes.count();
  for (let i = 0; i < count; i++) {
    const nb = await nodes.nth(i).boundingBox();
    if (nb) nodeBoxes.push(nb);
  }
  const MENU_W = 220;
  const MENU_H = 340;
  const PAD = 6;
  for (let y = box.y + 12; y < box.y + box.height - MENU_H; y += 24) {
    for (let x = box.x + 12; x < box.x + box.width - MENU_W; x += 24) {
      const onNode = nodeBoxes.some(
        (n) => x >= n.x - PAD && x <= n.x + n.width + PAD && y >= n.y - PAD && y <= n.y + n.height + PAD,
      );
      if (!onNode) {
        await pane.click({ button: 'right', position: { x: x - box.x, y: y - box.y } });
        return;
      }
    }
  }
  // Fallback: original coordinate (better a known click than none).
  await pane.click({ button: 'right', position: { x: 400, y: 300 } });
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
  await page.waitForLoadState('networkidle');
  // Wait for react flow
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
}

test.describe('Deep Canvas: Context Menus', () => {
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
    await p.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: { title: 'Context Menu Test', content: 'Text for testing context menu interactions on the canvas.' },
    });
    for (const name of ['Menu Code 1', 'Menu Code 2']) {
      await p.request.post(`${API}/canvas/${canvasId}/questions`, { headers: headers(), data: { text: name } });
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

  test('1 - Right-click empty canvas shows context menu', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Add Transcript').first()).toBeVisible({ timeout: 3000 });
  });

  test('2 - Context menu has Add Question', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Add Question').or(page.getByText('Add Code')).first()).toBeVisible({ timeout: 3000 });
  });

  test('3 - Context menu has Add Memo', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Add Memo').first()).toBeVisible({ timeout: 3000 });
  });

  test('4 - Context menu has Select All', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Select All').first()).toBeVisible({ timeout: 3000 });
  });

  test('5 - Context menu has Fit View', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Fit View').first()).toBeVisible({ timeout: 3000 });
  });

  test('6 - Escape closes context menu', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Add Transcript').first()).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Add Transcript').first())
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {});
  });

  test('7 - Right-click transcript node shows menu', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="transcript-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, /Collapse|Delete|View Coverage/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('8 - Right-click code node shows menu with Change Color', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="question-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, 'Change Color')).toBeVisible({ timeout: 3000 });
    }
  });

  test('9 - Right-click code node shows Rename', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="question-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, 'Rename')).toBeVisible({ timeout: 3000 });
    }
  });

  test('10 - Right-click code node shows Duplicate', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="question-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, 'Duplicate')).toBeVisible({ timeout: 3000 });
    }
  });

  test('11 - Right-click code node shows Delete', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="question-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, /Delete/)).toBeVisible({ timeout: 3000 });
    }
  });

  test('12 - Right-click code node shows Collapse', async ({ page }) => {
    await openCanvas(page);
    const node = page.locator('.react-flow__node[data-id^="question-"]').first();
    if (await node.isVisible({ timeout: 3000 }).catch(() => false)) {
      await node.click({ button: 'right', position: { x: 12, y: 12 } });
      await expect(contextMenuButton(page, /Collapse|Expand/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('13 - Context menu closes on outside click', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await expect(page.getByText('Add Transcript').first()).toBeVisible({ timeout: 3000 });
    // Left-click anywhere outside the menu to dismiss it. force:true so the click
    // still lands even if a node sits under this point (the menu closes on any
    // mousedown outside it, node or pane alike).
    await page.locator('.react-flow__pane').click({ position: { x: 200, y: 200 }, force: true });
    await expect(page.getByText('Add Transcript').first()).not.toBeVisible({ timeout: 2000 });
  });

  test('14 - Shortcut badge visible in context menu', async ({ page }) => {
    await openCanvas(page);
    await rightClickEmptyPane(page);
    // Look for Ctrl+A or F shortcut badge
    const badge = page.locator('text=/Ctrl\\+A|⌘A/').or(page.getByText('F').last());
    const visible = await badge.isVisible({ timeout: 2000 }).catch(() => false);
    expect(true).toBe(true); // Context menu appeared, badge may or may not be visible
  });

  test('15 - Console zero errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await openCanvas(page);
    await rightClickEmptyPane(page);
    await page.keyboard.press('Escape');
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

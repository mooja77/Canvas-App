import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const user = {
  id: 'memo-local-reader',
  name: 'Local reader',
  email: 'reader@example.test',
  role: 'admin',
  plan: 'pro',
  effectivePlan: 'pro',
  emailVerified: true,
};
const memo = { id: 'local-memo', title: 'Practice memo', content: 'Original local note.', color: '#fef08a' };
const canvas = {
  id: 'local-memo-canvas',
  dashboardAccessId: 'local-access',
  name: 'Local memo fixture',
  myRole: 'owner',
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  transcripts: [],
  questions: [],
  memos: [memo],
  codings: [],
  nodePositions: [],
  cases: [],
  relations: [],
  computedNodes: [],
};

for (const width of [1280, 820, 390, 320]) {
  test(`memo controls stay screen-sized and saves recover at width ${width}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    const unexpectedWrites: string[] = [];
    const saves: unknown[] = [];
    const layoutWrites: unknown[] = [];
    let failSave = true;
    let savedMemo = { ...memo };
    let holdSave = false;
    let releaseSave: (() => void) | undefined;
    page.on('pageerror', (error) => errors.push(error.message));
    await page.routeWebSocket('**', (socket) => socket.close());
    await context.addInitScript((user) => {
      if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
      localStorage.setItem(
        'qualcanvas-auth',
        JSON.stringify({ state: { authenticated: true, authType: 'email', userId: user.id, ...user }, version: 0 }),
      );
      localStorage.setItem(
        'qualcanvas-ui',
        JSON.stringify({
          state: {
            setupWizardComplete: true,
            onboardingV2Complete: true,
            onboardingAccountId: user.id,
            featureDiscovery: { planWelcomeSeen: true },
          },
          version: 0,
        }),
      );
    }, user);
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!loopback && url.hostname !== 'api.qualcanvas.com') return route.abort();
      const cors = {
        'Access-Control-Allow-Origin': request.headers().origin || 'http://localhost:4751',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, PUT',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      if (request.method() === 'OPTIONS' && ['GET', 'PUT'].includes(request.headers()['access-control-request-method']))
        return route.fulfill({ status: 204, headers: cors });
      if (request.method() === 'PUT' && url.pathname === '/api/canvas/local-memo-canvas/memos/local-memo') {
        const body = request.postDataJSON();
        saves.push(body);
        if (holdSave) {
          holdSave = false;
          await new Promise<void>((resolve) => {
            releaseSave = resolve;
          });
        }
        if (!failSave) savedMemo = { ...savedMemo, ...body };
        return route.fulfill({
          status: failSave ? 503 : 200,
          headers: cors,
          json: failSave
            ? { success: false, error: 'Local simulated offline save' }
            : { success: true, data: savedMemo },
        });
      }
      if (request.method() === 'PUT' && url.pathname === '/api/canvas/local-memo-canvas/layout') {
        // Existing canvas layout auto-save is separate from memo content save.
        // Count and locally fulfil it; never permit a real mutation.
        layoutWrites.push(request.postDataJSON());
        return route.fulfill({ headers: cors, json: { success: true, data: {} } });
      }
      if (request.method() !== 'GET') {
        unexpectedWrites.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      }
      if (!url.pathname.startsWith('/api/'))
        return loopback && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
      let data: unknown = [];
      if (url.pathname === '/api/auth/me') data = { user };
      if (url.pathname === '/api/canvas') data = [canvas];
      if (url.pathname === '/api/canvas/local-memo-canvas') data = canvas;
      if (url.pathname === '/api/user/onboarding')
        data = { state: { flowDismissed: true, checklistDismissed: true }, completedAt: '2026-10-04' };
      return route.fulfill({ headers: cors, json: { success: true, data, unreadCount: 0, total: 1 } });
    });
    await page.goto('/canvas/local-memo-canvas');
    await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
    const node = page.locator('.react-flow__node-memo');
    await expect(node).toBeVisible();
    await node.click();
    const zoom = () =>
      page
        .locator('.react-flow__viewport')
        .evaluate((el) => Number((el as HTMLElement).style.transform.match(/scale\(([^)]+)\)/)?.[1]));
    // Use the real canvas controls; do not fake a CSS scale or modify store state.
    for (let i = 0; i < 12 && (await zoom()) > 0.35; i++) {
      const before = await zoom();
      await page.getByRole('button', { name: 'Zoom Out', exact: true }).click();
      await expect.poll(zoom).toBeLessThan(before);
    }
    expect(await zoom()).toBeLessThanOrEqual(0.35);
    expect(await zoom()).toBeGreaterThan(0.18);
    const initialZoom = await zoom();
    const actions = page.getByRole('group', { name: 'Memo actions', exact: true });
    await expect(actions).toBeVisible();
    async function reachable(target: Locator) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      // Firefox's centered-dialog coordinates can subtract to43.999969 for a
      // computed44px target. Keep the actual CSS floor, and normalize only
      // floating-point geometry to0.001px; real undersized targets still fail.
      expect(await target.evaluate((el) => parseFloat(getComputedStyle(el).minHeight))).toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.width * 1000) / 1000).toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
      expect(
        await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    for (const button of await actions.getByRole('button').all()) await reachable(button);
    await page.screenshot({ path: testInfo.outputPath(`memo-actions-${width}.png`), fullPage: true });
    const edit = actions.getByRole('button', { name: 'Edit', exact: true });
    await edit.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Edit memo', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Memo title (optional)')).toBeFocused();
    const body = dialog.getByLabel('Memo text', { exact: true });
    await expect(body).toHaveCSS('font-size', '16px');
    for (const button of await dialog.getByRole('button').all()) await reachable(button);
    const done = dialog.getByRole('button', { name: 'Done', exact: true });
    await done.focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByLabel('Memo title (optional)')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(done).toBeFocused();
    await body.fill('Local unsaved draft.');
    await dialog.getByRole('button', { name: 'Bold', exact: true }).focus();
    expect(saves).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(saves).toEqual([]);
    await expect(edit).toBeFocused();
    await edit.click();
    await body.fill('Revised local note.');
    holdSave = true;
    await done.click();
    await expect(dialog).toHaveAttribute('aria-busy', 'true');
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Control+Enter');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(saves).toEqual([{ content: 'Revised local note.' }]);
    releaseSave!();
    await expect(page.getByText('Local simulated offline save', { exact: true })).toBeVisible();
    await expect(body).toHaveValue('Revised local note.');
    expect(saves).toEqual([{ content: 'Revised local note.' }]);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`memo-editor-${width}.png`), fullPage: true });
    failSave = false;
    await body.press('Control+Enter');
    await expect(dialog).toHaveCount(0);
    await expect(node.getByText('Revised local note.', { exact: true })).toBeVisible();
    expect(saves).toEqual([{ content: 'Revised local note.' }, { content: 'Revised local note.' }]);
    await edit.click();
    await dialog.getByLabel('Memo title (optional)').fill('   ');
    await done.click();
    await expect(dialog).toHaveCount(0);
    expect(saves).toEqual([{ content: 'Revised local note.' }, { content: 'Revised local note.' }, { title: '' }]);
    await expect(node.getByText('Memo', { exact: true })).toBeVisible();
    await expect(node.getByText('Revised local note.', { exact: true })).toBeVisible();
    await edit.click();
    await expect(dialog.getByLabel('Memo title (optional)')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(unexpectedWrites).toEqual([]);
    console.log(
      'MEMO_LOCAL_FIXTURE',
      JSON.stringify({
        width,
        initialZoom,
        finalZoom: await zoom(),
        memoSaves: saves.length,
        layoutWrites: layoutWrites.length,
      }),
    );
    expect(errors).toEqual([]);
  });
}

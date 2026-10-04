import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const canvas = {
  id: 'local-read-canvas',
  dashboardAccessId: 'local-access',
  name: 'Local notification fixture',
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  myRole: 'viewer',
  transcripts: [],
  questions: [],
  memos: [],
  codings: [],
  nodePositions: [],
  cases: [],
  relations: [],
  computedNodes: [],
};
const user = {
  id: 'local-reader',
  name: 'Local reader',
  email: 'reader@example.test',
  role: 'viewer',
  plan: 'free',
  effectivePlan: 'free',
  emailVerified: true,
};
for (const width of [1280, 390]) {
  test(`notification GET recovery at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let mode: 'failure' | 'malformed' | 'empty' = 'failure';
    let reads = 0;
    let hold = false;
    let release: (() => void) | undefined;
    const writes: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.addInitScript((user) => {
      if (location.hostname !== '127.0.0.1') return;
      localStorage.setItem(
        'qualcanvas-auth',
        JSON.stringify({
          state: {
            authenticated: true,
            authType: 'email',
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            plan: user.plan,
            effectivePlan: user.effectivePlan,
            emailVerified: true,
          },
          version: 0,
        }),
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
      const url = new URL(route.request().url());
      const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname);
      if (!loopback && url.hostname !== 'api.qualcanvas.com') return route.abort();
      if (!url.pathname.startsWith('/api/'))
        return loopback && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
      if (route.request().method() !== 'GET') {
        writes.push(`${route.request().method()} ${url.pathname}`);
        return route.fulfill({ status: 403, json: { success: false } });
      }
      if (url.pathname === '/api/notifications') {
        reads++;
        if (hold) {
          hold = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        if (mode === 'failure')
          return route.fulfill({ status: 503, json: { success: false, error: 'Local failed read' } });
        return route.fulfill({
          json:
            mode === 'malformed'
              ? { success: true, data: [null], unreadCount: '1' }
              : { success: true, data: [], unreadCount: 0 },
        });
      }
      let data: unknown = [];
      if (url.pathname === '/api/auth/me') data = { user };
      else if (url.pathname === '/api/canvas')
        return route.fulfill({ json: { success: true, data: [canvas], total: 1 } });
      else if (url.pathname === '/api/canvas/local-read-canvas') data = canvas;
      else if (url.pathname === '/api/user/onboarding')
        data = { state: { flowDismissed: true, checklistDismissed: true }, completedAt: '2026-10-04' };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/canvas/local-read-canvas');
    const bell = page.getByRole('button', { name: 'Notifications', exact: true });
    await expect(bell).toBeVisible();
    await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
    await bell.focus();
    await page.keyboard.press('Enter');
    const region = page.getByRole('region', { name: 'Notification read recovery' });
    await expect(region.getByRole('alert')).toContainText('Try again');
    await expect(page.getByText('No notifications yet', { exact: true })).toHaveCount(0);
    const retry = region.getByRole('button', { name: 'Try loading notifications again' });
    for (const target of [bell, retry]) {
      const box = await target.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(
        await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    const panel = region.locator('..').locator('..');
    const panelBox = await panel.boundingBox();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(width);
    expect(panelBox!.y).toBeGreaterThanOrEqual(0);
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(900);
    expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    expect(await region.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-label="Notification read recovery"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`notification-recovery-${width}.png`), fullPage: true });
    const baseline = reads;
    mode = 'malformed';
    hold = true;
    await retry.focus();
    await expect(retry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status', { name: 'Loading notifications' })).toBeVisible();
    await page.keyboard.press('Enter');
    expect(reads).toBe(baseline + 1);
    release!();
    await expect(region.getByRole('alert')).toBeVisible();
    mode = 'empty';
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('No notifications yet', { exact: true })).toBeVisible();
    expect(reads).toBe(baseline + 2);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

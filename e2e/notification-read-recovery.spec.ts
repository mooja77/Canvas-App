import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const canvas = {
  id: 'local-read-canvas',
  dashboardAccessId: 'local-access',
  name: 'Local notification fixture',
  createdAt: '2026-10-04T00:00:00Z',
  updatedAt: '2026-10-04T00:00:00Z',
  myRole: 'viewer',
  transcripts: [
    {
      id: 'local-transcript',
      title: 'Fictional interview',
      content: 'A fictional participant described the first visit.',
      sourceType: 'manual',
      createdAt: '2026-10-04T00:00:00Z',
    },
  ],
  questions: [{ id: 'local-code', text: 'First visit', color: '#3B82F6', type: 'CODE' }],
  memos: [
    {
      id: 'local-memo',
      title: 'Reflexive memo prompt',
      content: 'A fictional practice note.',
      color: '#fef08a',
      createdAt: '2026-10-04T00:00:00Z',
    },
  ],
  codings: [
    {
      id: 'local-coding',
      transcriptId: 'local-transcript',
      questionId: 'local-code',
      codedText: 'first visit',
      startOffset: 38,
      endOffset: 49,
      source: 'human',
    },
  ],
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
for (const { width, height } of [
  { width: 1280, height: 900 },
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
]) {
  test(`notification GET recovery and open checklist Help at ${width}x${height}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width, height });
    let mode: 'failure' | 'malformed' | 'empty' = 'failure';
    let reads = 0;
    let hold = false;
    let release: (() => void) | undefined;
    const writes: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.routeWebSocket('**', (socket) => {
      socket.onMessage(() => writes.push('WebSocket client message blocked'));
      socket.close();
    });
    await context.addInitScript((user) => {
      if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
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
      const method = route.request().method();
      if (method === 'OPTIONS' && route.request().headers()['access-control-request-method'] === 'GET') {
        return route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': route.request().headers().origin || 'http://localhost:4751',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
      if (method !== 'GET') {
        writes.push(
          `${method} ${url.origin}${url.pathname} ${route.request().headers()['access-control-request-method'] || ''}`,
        );
        return route.abort();
      }
      const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname);
      if (!loopback && url.hostname !== 'api.qualcanvas.com') return route.abort();
      if (!url.pathname.startsWith('/api/'))
        return loopback && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
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
        data = {
          state: { flowDismissed: true, checklistDismissed: false },
          completedAt: '2026-10-04',
          firstValueAt: '2026-10-04',
          observedSteps: ['first-transcript', 'first-coded-excerpt'],
        };
      return route.fulfill({ json: { success: true, data } });
    });
    await page.goto('/canvas/local-read-canvas');
    const bell = page.getByRole('button', { name: 'Notifications', exact: true });
    await expect(bell).toBeVisible();
    await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
    const memoTitle = page.getByText('Reflexive memo prompt', { exact: true });
    await expect(memoTitle).toBeVisible();
    await expect(memoTitle).toBeInViewport();
    await expect(memoTitle).toHaveCSS('color', 'rgb(55, 65, 81)');
    // Audit the changed title, not a blanket certificate for unchanged,
    // zoom-scaled memo controls. The full onboarding main-region audit stays
    // untouched; the separate low-zoom target-size finding is retained in QA.
    expect(
      (
        await new AxeBuilder({ page })
          .include('.react-flow__node-memo .drag-handle span.truncate')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    const progress = page.getByRole('progressbar', { name: 'Setup progress' });
    await expect(progress).toHaveAttribute('aria-valuenow', '2');
    const checklist = page.getByRole('button', { name: 'Dismiss checklist' }).locator('..').locator('..');
    const toggle = page.getByRole('button', { name: /Get started/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const help = page.getByRole('button', { name: 'Help', exact: true });
    async function checkHelp(state: string) {
      const card = await checklist.boundingBox();
      const footer = await page.locator('[data-tour="canvas-status-bar"]').boundingBox();
      const helpBox = await help.boundingBox();
      const hit = await help.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          reachable: el.contains(top),
          blocker: top?.closest('button')?.getAttribute('aria-label') ?? top?.tagName,
        };
      });
      console.log('CHECKLIST_FOOTER_GEOMETRY', JSON.stringify({ width, height, state, card, footer, helpBox, hit }));
      await page.screenshot({ path: testInfo.outputPath(`checklist-${state}-${width}x${height}.png`), fullPage: true });
      expect(card!.y).toBeGreaterThanOrEqual(0);
      expect(card!.y + card!.height).toBeLessThanOrEqual(footer!.y);
      expect(helpBox!.width).toBeGreaterThanOrEqual(44);
      expect(helpBox!.height).toBeGreaterThanOrEqual(44);
      expect(helpBox!.x).toBeGreaterThanOrEqual(0);
      expect(helpBox!.x + helpBox!.width).toBeLessThanOrEqual(width);
      expect(hit.reachable).toBe(true);
      if (state === 'collapsed') await help.click();
      else {
        await help.focus();
        await expect(help).toBeFocused();
        await page.keyboard.press('Enter');
      }
      const support = page.getByRole('link', { name: 'Email support', exact: true });
      await expect(support).toBeVisible();
      expect(
        await support.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
      await expect(page.getByText(/reply within two business days/)).toBeVisible();
      const helpArea = help.locator('..');
      for (const action of await helpArea.getByRole('button').or(helpArea.getByRole('link')).all()) {
        await expect(action).toBeVisible();
        const geometry = await action.boundingBox();
        expect(geometry!.width).toBeGreaterThanOrEqual(44);
        expect(geometry!.height).toBeGreaterThanOrEqual(44);
        expect(geometry!.x).toBeGreaterThanOrEqual(0);
        expect(geometry!.y).toBeGreaterThanOrEqual(0);
        expect(geometry!.x + geometry!.width).toBeLessThanOrEqual(width);
        expect(geometry!.y + geometry!.height).toBeLessThanOrEqual(height);
        expect(
          await action.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
        ).toBe(true);
        await action.focus();
        await expect(action).toBeFocused();
      }
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-label="Help"]')
            .include('[aria-label="Help"] + div')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`help-open-${state}-${width}x${height}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
    }
    await checkHelp('collapsed');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await checkHelp('expanded');
    for (const action of await checklist.getByRole('button').all()) {
      expect(
        await action.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
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
    expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(height);
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

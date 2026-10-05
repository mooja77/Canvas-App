import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const user = {
  id: 'team-local-reader',
  name: 'Fictional reader',
  email: 'reader@example.test',
  role: 'user',
  plan: 'team',
  emailVerified: true,
};
const team = {
  id: 'fictional-team',
  name: 'Fictional research team',
  ownerId: user.id,
  createdAt: '2026-10-05T08:00:00Z',
  owner: user,
  myRole: 'owner',
  members: [{ id: 'fictional-member', userId: user.id, role: 'owner', joinedAt: '2026-10-05T08:00:00Z', user }],
};

for (const width of [1280, 820, 390])
  for (const boundary of ['list', 'details', 'create'] as const) {
    test(`team ${boundary} recovery at width ${width}`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      const errors: string[] = [];
      const writes: string[] = [];
      let phase: 'error' | 'pending' | 'ready' = 'error';
      let release!: () => void;
      let creations = 0;
      let detailReads = 0;
      page.on('pageerror', (error) => errors.push(error.message));
      await page.routeWebSocket('**', (socket) => socket.close());
      await context.addInitScript((user) => {
        if (!['localhost', '127.0.0.1'].includes(location.hostname)) return;
        localStorage.setItem(
          'qualcanvas-auth',
          JSON.stringify({ state: { authenticated: true, authType: 'email', userId: user.id, ...user }, version: 0 }),
        );
      }, user);
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const local = ['localhost', '127.0.0.1'].includes(url.hostname);
        if (!local && url.hostname !== 'api.qualcanvas.com') return route.abort();
        const headers = {
          'Access-Control-Allow-Origin': request.headers().origin || 'http://localhost:4751',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (request.method() === 'POST' && boundary === 'create' && url.pathname === '/api/teams') {
          creations++;
          expect(request.postDataJSON()).toEqual({ name: team.name });
          return route.fulfill({
            status: 201,
            headers,
            json: {
              success: true,
              data: { id: team.id, name: team.name, members: [{ userId: user.id, role: 'owner' }] },
            },
          });
        }
        if (request.method() !== 'GET') {
          writes.push(`${request.method()} ${url.pathname}`);
          return route.abort();
        }
        if (!url.pathname.startsWith('/api/'))
          return local && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
        if (url.pathname === '/api/auth/me')
          return route.fulfill({
            headers,
            json: {
              success: true,
              data: {
                user,
                authType: 'email',
                subscription: null,
                usage: { canvasCount: 0, totalTranscripts: 0, totalCodes: 0, totalShares: 0 },
              },
            },
          });
        const isList = url.pathname === '/api/teams';
        const isDetail = url.pathname === `/api/teams/${team.id}`;
        if (isList || isDetail) {
          if (isDetail) detailReads++;
          const broken = boundary === 'list' ? isList : isDetail;
          if (boundary !== 'create' && broken && phase === 'error')
            return route.fulfill({
              headers,
              json: { success: true, data: boundary === 'list' ? null : { ...team, members: {} } },
            });
          if (boundary !== 'create' && broken && phase === 'pending')
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          return route.fulfill({
            headers,
            json: { success: true, data: isList ? (boundary === 'create' && creations === 0 ? [] : [team]) : team },
          });
        }
        return route.fulfill({ headers, json: { success: true, data: [] } });
      });
      await page.goto('/team');
      await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
      if (boundary === 'create') {
        await page.getByRole('textbox', { name: 'Team name' }).fill(team.name);
        await page.getByRole('button', { name: 'Create Team', exact: true }).click();
        expect(creations).toBe(1);
      } else {
        const alert = page.getByRole('alert');
        await expect(alert).toContainText("We couldn't read your saved team details");
        await expect(page.getByText(/Set up your team in 3 steps/)).toHaveCount(0);
        expect(
          (
            await new AxeBuilder({ page })
              .include('[role="alert"]')
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`team-${boundary}-error-${width}.png`), fullPage: true });
        const retry = page.getByRole('button', { name: 'Try again', exact: true });
        expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        phase = 'pending';
        await retry.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('status')).toHaveText('Loading...');
        await expect.poll(() => typeof release).toBe('function');
        phase = 'ready';
        release();
      }
      await expect(page.getByText(team.name, { exact: true })).toBeVisible();
      await expect(page.getByText(user.email, { exact: true })).toBeVisible();
      expect(detailReads).toBeGreaterThanOrEqual(1);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`team-${boundary}-ready-${width}.png`), fullPage: true });
    });
  }

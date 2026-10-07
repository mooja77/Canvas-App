import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const owner = {
  id: 'local-owner',
  name: 'Fictional owner',
  email: 'owner@example.test',
  role: 'user',
  plan: 'team',
  emailVerified: true,
};
const colleague = {
  id: 'local-colleague',
  name: 'Fictional colleague',
  email: 'colleague@example.test',
  role: 'user',
  plan: 'team',
  emailVerified: true,
};
const first = {
  id: 'local-team-1',
  name: 'First fictional team',
  ownerId: owner.id,
  createdAt: '2026-10-07T00:00:00Z',
  owner,
  members: [
    { id: 'membership-owner', userId: owner.id, role: 'owner', joinedAt: '2026-10-07T00:00:00Z', user: owner },
    {
      id: 'membership-colleague',
      userId: colleague.id,
      role: 'member',
      joinedAt: '2026-10-07T00:00:00Z',
      user: colleague,
    },
  ],
};
const second = { ...first, id: 'local-team-2', name: 'Remaining fictional team' };

for (const width of [1280, 820, 390]) {
  for (const action of ['add', 'remove', 'delete', 'member-role'] as const) {
    test(`team ${action} action/recovery at ${width}px`, async ({ page, context }, testInfo) => {
      const uiOrigin = new URL(String(testInfo.project.use.baseURL)).origin;
      const uiHost = new URL(uiOrigin).hostname;
      expect(['localhost', '127.0.0.1', 'qualcanvas.com']).toContain(uiHost);
      await page.setViewportSize({ width, height: 844 });
      const user = action === 'member-role' ? colleague : owner;
      const errors: string[] = [];
      const forbidden: string[] = [];
      let mutations = 0;
      let phase: 'before' | 'invalid' | 'ready' = 'before';
      let release!: () => void;
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('dialog', (dialog) => dialog.accept());
      await page.routeWebSocket('**', (socket) => socket.close());
      await context.addInitScript(
        ({ user, uiHost }) => {
          if (location.hostname !== uiHost) return;
          localStorage.setItem(
            'qualcanvas-auth',
            JSON.stringify({ state: { authenticated: true, authType: 'email', userId: user.id, ...user }, version: 0 }),
          );
        },
        { user, uiHost },
      );
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const local = ['localhost', '127.0.0.1'].includes(url.hostname);
        const ui = url.origin === uiOrigin;
        if (!local && !ui && url.hostname !== 'api.qualcanvas.com') return route.abort();
        const headers = {
          'Access-Control-Allow-Origin': request.headers().origin || uiOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type',
        };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        const allowedWrite =
          (action === 'add' && request.method() === 'POST' && url.pathname === `/api/teams/${first.id}/members`) ||
          (action === 'remove' &&
            request.method() === 'DELETE' &&
            url.pathname === `/api/teams/${first.id}/members/${colleague.id}`) ||
          (action === 'delete' && request.method() === 'DELETE' && url.pathname === `/api/teams/${first.id}`);
        if (allowedWrite) {
          mutations++;
          if (action === 'add') expect(request.postDataJSON()).toEqual({ email: 'newmember@example.test' });
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          phase = 'invalid';
          return route.fulfill({
            status: 200,
            headers,
            json: { success: true, data: { id: 'fictional-acknowledgement' } },
          });
        }
        if (request.method() !== 'GET') {
          forbidden.push(`${request.method()} ${url.pathname}`);
          return route.abort();
        }
        if (!url.pathname.startsWith('/api/'))
          return (local || ui) && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
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
        if (url.pathname === '/api/teams') {
          const teamList = action === 'delete' && phase !== 'before' ? [second] : [first, second];
          return route.fulfill({ headers, json: { success: true, data: teamList } });
        }
        if ([`/api/teams/${first.id}`, `/api/teams/${second.id}`].includes(url.pathname)) {
          let actual = url.pathname.endsWith(second.id) ? second : first;
          if (actual.id === first.id && phase === 'ready') {
            if (action === 'remove')
              actual = { ...first, members: first.members.filter((member) => member.userId !== colleague.id) };
            if (action === 'add')
              actual = {
                ...first,
                members: [
                  ...first.members,
                  {
                    ...first.members[1],
                    id: 'new-membership',
                    userId: 'new-local-user',
                    user: {
                      ...colleague,
                      id: 'new-local-user',
                      name: 'New fictional member',
                      email: 'newmember@example.test',
                    },
                  },
                ],
              };
          }
          const data = phase === 'invalid' ? { ...actual, id: 'incorrect-team-id' } : actual;
          return route.fulfill({ headers, json: { success: true, data } });
        }
        return route.fulfill({ headers, json: { success: true, data: [] } });
      });
      await page.goto('/team');
      await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
      await expect(page.getByText(first.name, { exact: true })).toBeVisible();
      if (action === 'member-role') {
        await expect(page.getByRole('button', { name: 'Add member', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Delete Team', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Remove .* from team/ })).toHaveCount(0);
      } else {
        if (action === 'add') {
          await page.getByRole('textbox', { name: "Colleague's email address" }).fill('newmember@example.test');
          await page.getByRole('button', { name: 'Add member', exact: true }).click();
        } else if (action === 'remove') {
          const remove = page.getByRole('button', { name: `Remove ${colleague.name} from team` });
          const box = (await remove.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
          await remove.click();
        } else {
          await page.getByRole('button', { name: 'Delete Team', exact: true }).click();
          await page.getByRole('button', { name: 'Delete Forever', exact: true }).click();
        }
        await expect.poll(() => typeof release).toBe('function');
        await expect(page.getByRole('status')).toContainText('Saving team changes');
        await expect(page.getByRole('textbox', { name: "Colleague's email address" })).toBeDisabled();
        await expect(page.getByRole('button', { name: /^(Add member|Adding\.\.\.)$/ })).toBeDisabled();
        await expect(page.getByRole('button', { name: `Remove ${colleague.name} from team` })).toBeDisabled();
        expect(mutations).toBe(1);
        release();
        const alert = page.getByRole('alert');
        await expect(alert).toContainText('Retry below only reloads');
        await expect(alert).toContainText("We couldn't read your saved team details");
        expect(
          (
            await new AxeBuilder({ page })
              .include('[role="alert"]')
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`team-${action}-recovery-${width}.png`), fullPage: true });
        phase = 'ready';
        await page.getByRole('button', { name: 'Try again', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByText(action === 'delete' ? second.name : first.name, { exact: true })).toBeVisible();
        if (action === 'add') await expect(page.getByText('newmember@example.test', { exact: true })).toBeVisible();
        if (action === 'remove') await expect(page.getByText(colleague.email, { exact: true })).toHaveCount(0);
        if (action === 'delete') await expect(page.getByText(first.name, { exact: true })).toHaveCount(0);
        expect(mutations).toBe(1);
      }
      expect(
        (
          await new AxeBuilder({ page })
            .include('main')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(errors).toEqual([]);
      expect(forbidden).toEqual([]);
      await expect(page.getByRole('complementary', { name: 'Team setup help' })).toContainText(
        'We reply within two working days. No call needed.',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`team-${action}-ready-${width}.png`), fullPage: true });
    });
  }
}

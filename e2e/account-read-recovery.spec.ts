import { expect, test, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const user = {
  id: 'account-local-reader',
  name: 'Local reader',
  email: 'reader@example.test',
  role: 'user',
  plan: 'pro',
  emailVerified: true,
};
const profile = {
  user,
  authType: 'email',
  subscription: null,
  usage: { canvasCount: 0, totalTranscripts: 0, totalCodes: 0, totalShares: 0 },
};

for (const width of [1280, 820, 390, 320]) {
  test(`account read failures recover without writes at width ${width}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    const writes: string[] = [];
    let profileReads = 0;
    let scheduleReads = 0;
    // Development StrictMode can repeat mount reads. A user attempt is a
    // fixture phase, not a request ordinal; retry counts stay independently exact.
    let profilePhase: 'error' | 'pending' | 'ready' = 'error';
    let schedulePhase: 'error' | 'pending' | 'ready' = 'error';
    let releaseProfile!: () => void;
    let releaseSchedules!: () => void;
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
      const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
      if (!loopback && url.hostname !== 'api.qualcanvas.com') return route.abort();
      const cors = {
        'Access-Control-Allow-Origin': request.headers().origin || 'http://localhost:4751',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      if (request.method() === 'OPTIONS' && request.headers()['access-control-request-method'] === 'GET')
        return route.fulfill({ status: 204, headers: cors });
      if (request.method() !== 'GET') {
        writes.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      }
      if (!url.pathname.startsWith('/api/'))
        return loopback && !url.pathname.startsWith('/socket.io') ? route.continue() : route.abort();
      if (url.pathname === '/api/auth/me') {
        profileReads++;
        if (profilePhase === 'error')
          return route.fulfill({
            headers: cors,
            status: width === 390 ? 200 : 503,
            json:
              width === 390
                ? { success: true, data: { user: {} } }
                : { success: false, error: 'Local simulated offline read' },
          });
        if (profilePhase === 'pending')
          await new Promise<void>((resolve) => {
            releaseProfile = resolve;
          });
        return route.fulfill({ headers: cors, json: { success: true, data: profile } });
      }
      if (url.pathname === '/api/reports/schedules') {
        scheduleReads++;
        if (schedulePhase === 'error')
          return route.fulfill({
            headers: cors,
            status: 503,
            json: { success: false, error: 'Local simulated schedule read failure' },
          });
        if (schedulePhase === 'pending')
          await new Promise<void>((resolve) => {
            releaseSchedules = resolve;
          });
        return route.fulfill({ headers: cors, json: { success: true, data: [] } });
      }
      return route.fulfill({ headers: cors, json: { success: true, data: null, integrations: [] } });
    });
    async function reachable(target: Locator) {
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      expect(await target.evaluate((el) => parseFloat(getComputedStyle(el).minHeight))).toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.height * 1000) / 1000).toBeGreaterThanOrEqual(44);
      expect(Math.round(box!.width * 1000) / 1000).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(
        await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
      ).toBe(true);
    }
    await page.goto('/account');
    await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'We couldn’t load your account' })).toBeVisible();
    const retry = page.getByRole('button', { name: 'Try loading account again', exact: true });
    await reachable(retry);
    await reachable(page.getByRole('link', { name: 'Back to canvas', exact: true }));
    await reachable(page.getByRole('link', { name: 'Email for help', exact: true }));
    expect(
      (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`account-read-error-${width}.png`), fullPage: true });
    const initialProfileReads = profileReads;
    const initialScheduleReads = scheduleReads;
    expect(initialProfileReads).toBeGreaterThanOrEqual(1);
    expect(initialScheduleReads).toBeGreaterThanOrEqual(1);
    profilePhase = 'pending';
    await retry.focus();
    await page.keyboard.press('Enter');
    const pending = page.getByRole('button', { name: 'Trying again…', exact: true });
    await expect(pending).toBeDisabled();
    await expect.poll(() => profileReads).toBe(initialProfileReads + 1);
    await page.keyboard.press('Enter');
    expect(profileReads).toBe(initialProfileReads + 1);
    expect(scheduleReads).toBe(initialScheduleReads);
    profilePhase = 'ready';
    releaseProfile();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Local reader');
    await expect(page.getByRole('heading', { name: 'We couldn’t load your account' })).toHaveCount(0);
    await expect(page.getByRole('alert')).toContainText('We couldn’t load your report schedules');
    await expect(page.getByText('No report schedules configured.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add Schedule', exact: true })).toBeDisabled();
    const scheduleRetry = page.getByRole('button', { name: 'Try loading schedules again', exact: true });
    await reachable(scheduleRetry);
    await page.screenshot({ path: testInfo.outputPath(`schedule-read-error-${width}.png`), fullPage: true });
    schedulePhase = 'pending';
    await scheduleRetry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Loading report schedules…', { exact: true })).toBeVisible();
    await expect.poll(() => scheduleReads).toBe(initialScheduleReads + 1);
    await expect(page.getByText('No report schedules configured.', { exact: true })).toHaveCount(0);
    schedulePhase = 'ready';
    releaseSchedules();
    await expect(page.getByText('No report schedules configured.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Schedule', exact: true })).toBeEnabled();
    expect(profileReads).toBe(initialProfileReads + 1);
    expect(scheduleReads).toBe(initialScheduleReads + 1);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    console.log(
      'ACCOUNT_READ_LOCAL_FIXTURE',
      JSON.stringify({
        width,
        initialProfileReads,
        initialScheduleReads,
        profileReads,
        scheduleReads,
        writes: writes.length,
        pageErrors: errors.length,
      }),
    );
  });
}

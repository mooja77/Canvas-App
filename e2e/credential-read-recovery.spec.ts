import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
const user = {
  id: 'credential-local-reader',
  name: 'Local reader',
  email: 'reader@example.test',
  role: 'user',
  plan: 'pro',
  emailVerified: true,
};
for (const width of [1280, 820, 390, 320]) {
  test(`credential reads distinguish unavailable from empty at width ${width}`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const writes: string[] = [];
    const errors: string[] = [];
    let phase: 'error' | 'pending' | 'ready' = 'error';
    let reads = 0;
    let release!: () => void;
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
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      if (request.method() === 'OPTIONS' && request.headers()['access-control-request-method'] === 'GET')
        return route.fulfill({ status: 204, headers });
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
      if (url.pathname === '/api/reports/schedules')
        return route.fulfill({ headers, json: { success: true, data: [] } });
      if (url.pathname === '/api/integrations') {
        reads++;
        if (phase === 'error')
          return route.fulfill({
            headers,
            status: width === 390 ? 200 : 503,
            json: width === 390 ? { integrations: [{}] } : { error: 'Local simulated failed read' },
          });
        if (phase === 'pending')
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        return route.fulfill({ headers, json: { integrations: [] } });
      }
      return route.fulfill({ headers, json: { success: true, data: null, integrations: [] } });
    });
    await page.goto('/account');
    await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
    const heading = page.getByRole('heading', { name: 'Legacy provider credentials', exact: true });
    await heading.scrollIntoViewIfNeeded();
    const alert = page.getByRole('alert').filter({ hasText: 'We couldn’t load your stored credentials' });
    await expect(alert).toBeVisible();
    await expect(page.getByText(/No provider credentials are stored/)).toHaveCount(0);
    const retry = page.getByRole('button', { name: 'Try loading credentials again', exact: true });
    await retry.scrollIntoViewIfNeeded();
    const box = (await retry.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(
      await retry.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="alert"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`credential-read-error-${width}.png`), fullPage: true });
    const initialReads = reads;
    expect(initialReads).toBeGreaterThanOrEqual(1);
    phase = 'pending';
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Loading your stored credentials' })).toBeVisible();
    await expect.poll(() => reads).toBe(initialReads + 1);
    await page.keyboard.press('Enter');
    expect(reads).toBe(initialReads + 1);
    await expect(page.getByText(/No provider credentials are stored/)).toHaveCount(0);
    phase = 'ready';
    release();
    await expect(
      page.getByText('No provider credentials are stored for your account. Nothing to remove.', { exact: true }),
    ).toBeVisible();
    await expect(alert).toHaveCount(0);
    expect(reads).toBe(initialReads + 1);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    console.log(
      'CREDENTIAL_READ_LOCAL_FIXTURE',
      JSON.stringify({ width, initialReads, reads, writes: writes.length, pageErrors: errors.length }),
    );
  });
}

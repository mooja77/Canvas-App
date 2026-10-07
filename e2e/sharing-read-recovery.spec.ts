import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

for (const width of [1280, 820, 390]) {
  test(`sharing read recovery preserves entries without invitations at ${width}px`, async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
      throw new Error('Fictional sharing proof is local only');
    await context.route('**/*', (route) =>
      ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort('blockedbyclient'),
    );
    await page.setViewportSize({ width, height: 900 });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const password = randomBytes(24).toString('base64');
    const headers = { Origin: new URL(baseURL).origin };
    let created = false;
    const sharingWrites: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() !== 'GET' &&
        /\/canvas\/[^/]+\/(shares?|collaborators)(\/|$)/.test(new URL(request.url()).pathname)
      )
        sharingWrites.push(request.method());
    });
    try {
      await page.goto('/login?mode=register');
      const signup = await page.request.post('/api/auth/signup', {
        headers,
        data: {
          name: 'Fictional sharing researcher',
          email: `sharing-e2e-${randomBytes(8).toString('hex')}@example.com`,
          password,
        },
      });
      expect(signup.status()).toBe(201);
      created = true;
      const user = (await signup.json()).data.user;
      await page.evaluate(
        (user) =>
          localStorage.setItem(
            'qualcanvas-auth',
            JSON.stringify({
              state: {
                authenticated: true,
                authType: 'email',
                name: user.name,
                email: user.email,
                role: user.role,
                userId: user.id,
                plan: user.plan,
                emailVerified: false,
              },
              version: 0,
            }),
          ),
        user,
      );
      expect(
        (await page.request.patch('/api/user/onboarding', { headers, data: { state: { flowDismissed: true } } })).ok(),
      ).toBe(true);
      const response = await page.request.post('/api/canvas', { headers, data: { name: 'Fictional sharing proof' } });
      expect(response.ok()).toBe(true);
      const canvas = (await response.json()).data;
      let failShares = true;
      let failCollaborators = true;
      const failed = new Set<string>();
      await page.route(`**/api/canvas/${canvas.id}/shares`, async (route) => {
        if (route.request().method() === 'GET' && failShares) {
          failed.add('shares');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: {} }),
          });
        } else await route.continue();
      });
      await page.route(`**/api/canvas/${canvas.id}/collaborators`, async (route) => {
        if (route.request().method() === 'GET' && failCollaborators) {
          failed.add('collaborators');
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'Fictional read outage' }),
          });
        } else await route.continue();
      });
      await page.goto(`/canvas/${canvas.id}`);
      await expect(page.getByRole('button', { name: 'Tools menu', exact: true })).toBeVisible({ timeout: 30_000 });
      const reject = page.getByRole('button', { name: 'Reject non-essential cookies', exact: true });
      if (await reject.isVisible()) await reject.click();
      if (width < 768) await page.getByRole('button', { name: 'More canvas actions', exact: true }).click();
      await page.getByRole('button', { name: 'Share canvas', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Share Canvas', exact: true });
      await expect(dialog.getByRole('alert', { name: 'Share codes could not be verified' })).toBeVisible();
      await expect(dialog.getByRole('alert', { name: 'Collaborators could not be verified' })).toBeVisible();
      await expect(dialog.getByText('No share codes yet', { exact: true })).toHaveCount(0);
      await dialog.getByLabel("Coder's email address").fill('fictional-colleague@example.com');
      await dialog.getByLabel('Access level').selectOption('viewer');
      await expect(dialog.getByRole('button', { name: 'Invite', exact: true })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Generate Share Code', exact: true })).toBeDisabled();
      const audit = async () => {
        expect(
          (
            await new AxeBuilder({ page })
              .include('[aria-label="Share Canvas"]')
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      };
      await audit();
      failShares = false;
      await dialog.getByRole('button', { name: 'Retry loading share codes' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByText('No share codes yet', { exact: true })).toBeVisible();
      failCollaborators = false;
      await dialog.getByRole('button', { name: 'Retry loading collaborators' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('button', { name: 'Invite', exact: true })).toBeEnabled();
      await expect(dialog.getByLabel("Coder's email address")).toHaveValue('fictional-colleague@example.com');
      await expect(dialog.getByLabel('Access level')).toHaveValue('viewer');
      await expect(dialog.getByText(/No collaborators yet/)).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Read the sharing guide' })).toHaveAttribute(
        'href',
        '/help/sharing.html',
      );
      await audit();
      expect([...failed].sort()).toEqual(['collaborators', 'shares']);
      expect(sharingWrites).toEqual([]);
      expect(pageErrors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`sharing-${width}.png`) });
      await page.setViewportSize({ width, height: 540 });
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
      await dialog.getByRole('region', { name: 'Sharing options' }).focus();
      await page.keyboard.press('End');
      await expect(dialog.getByRole('heading', { name: 'Active Share Codes' })).toBeInViewport();
      await audit();
      await page.setViewportSize({ width, height: 900 });
      const guide = await page.goto('/help/sharing.html');
      expect(guide?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Share safely, one step at a time' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'If a list cannot be checked' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'support@qualcanvas.com' })).toHaveAttribute('href', /^mailto:/);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`sharing-guide-${width}.png`), fullPage: true });
    } finally {
      if (created)
        expect(
          (
            await page.request.delete('/api/auth/account', { headers, data: { password, deleteLegacyCanvases: true } })
          ).status(),
        ).toBe(200);
    }
  });
}

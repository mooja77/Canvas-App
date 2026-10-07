import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

for (const width of [1280, 820, 390]) {
  test(`ethics reads recover without false empty records at ${width}px`, async ({ page, context, baseURL }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
      throw new Error('Fictional-account proof must remain local');
    const errors: string[] = [];
    const forbidden: string[] = [];
    let fault: string | null = 'ethics';
    const failedReadKinds = new Set<string>();
    let created = false;
    const password = randomBytes(24).toString('base64');
    const headers = { Origin: new URL(baseURL).origin };
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort('blockedbyclient');
      const key = url.pathname.endsWith('/audit-log') ? 'audit' : url.pathname.split('/').at(-1);
      if (['ethics', 'consent', 'journal', 'audit'].includes(key ?? '') && request.method() !== 'GET') {
        forbidden.push(request.method() + ' ' + url.pathname);
        return route.abort('blockedbyclient');
      }
      if (key === fault && request.method() === 'GET') {
        // Keep the outage active until the explicit Retry interaction below.
        // Development StrictMode may mount/read twice; a one-shot failure lets
        // the second read recover before the error-screen assertion runs.
        failedReadKinds.add(key);
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'fictional_read_failure' }),
        });
      }
      return route.continue();
    });
    await page.setViewportSize({ width, height: 900 });
    try {
      await page.goto('/login?mode=register');
      await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
      const signup = await page.request.post('/api/auth/signup', {
        headers,
        data: {
          name: 'Fictional ethics researcher',
          email: `ethics-recovery-${randomBytes(8).toString('hex')}@example.com`,
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
      const canvasResponse = await page.request.post('/api/canvas', {
        headers,
        data: { name: 'Fictional ethics recovery' },
      });
      expect(canvasResponse.ok()).toBe(true);
      const canvas = (await canvasResponse.json()).data;
      await page.goto(`/canvas/${canvas.id}`);
      await page.getByRole('button', { name: 'Tools menu', exact: true }).click();
      await page.getByRole('button', { name: 'Ethics', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Ethics & Compliance' });
      await expect(dialog.getByRole('alert')).toContainText('Could not load ethics settings');
      await expect(dialog.getByRole('button', { name: 'Save Settings' })).toHaveCount(0);
      const audit = async () => {
        expect(
          (
            await new AxeBuilder({ page })
              .include('[aria-labelledby="ethics-compliance-title"]')
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      };
      await audit();
      fault = null;
      await dialog.getByRole('button', { name: 'Retry loading ethics settings' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('button', { name: 'Save Settings' })).toBeEnabled();
      await expect(dialog.getByRole('textbox', { name: 'IRB/HREC Approval Number' })).toBeVisible();
      await audit();

      for (const [key, tab, label] of [
        ['consent', 'Consent Registry', 'consent records'],
        ['audit', 'Audit Trail', 'the audit trail'],
        ['journal', 'Reflexivity Journal', 'journal entries'],
      ]) {
        fault = key;
        await dialog.getByRole('button', { name: tab, exact: true }).click();
        await expect(dialog.getByRole('alert')).toContainText(`Could not load ${label}`);
        await expect(
          dialog.getByText(
            key === 'consent'
              ? 'No consent records yet.'
              : key === 'journal'
                ? 'No journal entries yet.'
                : 'No recorded activity matches these filters.',
            { exact: true },
          ),
        ).toHaveCount(0);
        await audit();
        fault = null;
        await dialog.getByRole('button', { name: `Retry loading ${label}` }).focus();
        await page.keyboard.press('Enter');
        await expect(dialog.getByRole('status')).toHaveCount(0);
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        if (key === 'consent') {
          const start = dialog.getByRole('button', { name: 'Enter a participant ID' });
          await expect(start).toBeVisible();
          await start.focus();
          await page.keyboard.press('Enter');
          await expect(dialog.getByRole('textbox', { name: 'Participant ID' })).toBeFocused();
        }
        if (key === 'journal') {
          const start = dialog.getByRole('button', { name: 'Start a journal note' });
          await expect(start).toBeVisible();
          await start.focus();
          await page.keyboard.press('Enter');
          await expect(dialog.getByRole('textbox', { name: 'Journal note' })).toBeFocused();
          await expect(dialog).toContainText('Example: I checked whether my own experience');
        }
        if (key === 'audit') {
          const records = dialog.getByRole('region', { name: 'Audit records' });
          await records.focus();
          await expect(records).toBeFocused();
          await page.keyboard.press('ArrowRight');
          await expect(records).toBeFocused();
        }
        await audit();
      }
      await dialog.getByRole('button', { name: 'Anonymization', exact: true }).click();
      await expect(dialog).toContainText('does not automatically detect names');
      await expect(dialog.getByRole('button', { name: 'Paste or import a transcript' })).toBeVisible();
      await audit();
      await page.screenshot({ path: test.info().outputPath(`ethics-${width}.png`) });
      await dialog.getByRole('button', { name: 'Paste or import a transcript' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Paste Text Type or paste transcript content', exact: true }),
      ).toBeVisible();
      expect([...failedReadKinds].sort()).toEqual(['audit', 'consent', 'ethics', 'journal']);
      expect(forbidden).toEqual([]);
      expect(errors).toEqual([]);
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

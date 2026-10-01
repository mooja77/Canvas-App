import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

test('email fallback and empty research panels recover without an AI key or provider call', async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
    throw new Error('This fictional-account replay is local-only');
  }
  await context.route('**/*', (route) =>
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort('blockedbyclient'),
  );
  await page.goto('/login?mode=register');
  await expect(page).toHaveTitle('Create an account — QualCanvas');
  const googleConfigured = (await page.locator('script[src="https://accounts.google.com/gsi/client"]').count()) > 0;
  if (process.env.QC_REQUIRE_GOOGLE_RECOVERY === 'true') expect(googleConfigured).toBe(true);
  if (googleConfigured) {
    await expect(page.getByRole('status').filter({ hasText: 'Google sign-in is unavailable' })).toContainText(
      'Use email below',
    );
  }
  await expect(page.getByRole('button', { name: 'Create Free Account' })).toBeEnabled();
  expect(await page.locator('input[type="text"], input[type="email"], input[type="password"]').count()).toBe(3);
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  if (await reject.isVisible()) await reject.click();

  const password = randomBytes(24).toString('base64');
  const headers = { Origin: new URL(baseURL).origin };
  let created = false;
  let providerRequests = 0;
  try {
    const signup = await page.request.post('/api/auth/signup', {
      headers,
      data: {
        name: 'Fictional recovery researcher',
        email: `qc-recovery-${randomBytes(8).toString('hex')}@example.com`,
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
              role: user.role,
              email: user.email,
              userId: user.id,
              plan: user.plan,
              emailVerified: false,
            },
            version: 0,
          }),
        ),
      user,
    );
    const dismiss = await page.request.patch('/api/user/onboarding', {
      headers,
      data: { state: { flowDismissed: true } },
    });
    expect(dismiss.ok()).toBe(true);
    const createdCanvas = await page.request.post('/api/canvas', {
      headers,
      data: { name: 'Fictional recovery proof' },
    });
    expect(createdCanvas.ok()).toBe(true);
    const canvas = (await createdCanvas.json()).data;
    await page.route(
      (url) => url.pathname === `/api/canvas/${canvas.id}/ai/summarize`,
      (route) => {
        providerRequests++;
        return route.abort('blockedbyclient');
      },
    );
    await page.goto(`/canvas/${canvas.id}`);
    await expect(page.getByRole('button', { name: 'Tools menu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tools menu', exact: true }).click();
    await page.getByRole('button', { name: 'Hierarchy', exact: true }).click();
    const hierarchy = page.getByRole('dialog', { name: 'Code Hierarchy' });
    await expect(hierarchy).toContainText('Group related codes');
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-labelledby="hierarchy-title"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await hierarchy.getByRole('button', { name: 'Paste or import a transcript' }).click();
    await expect(hierarchy).toBeHidden();
    await expect(page.getByRole('button', { name: 'Paste Text', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    const transcript = await page.request.post(`/api/canvas/${canvas.id}/transcripts`, {
      headers,
      data: {
        title: 'Fictional interview',
        content: 'A fictional participant described travel costs as a barrier to attending appointments.',
      },
    });
    expect(transcript.ok()).toBe(true);
    const transcriptId = (await transcript.json()).data.id;
    await page.reload();
    let summaryReads = 0;
    await page.route(
      (url) => url.pathname === `/api/canvas/${canvas.id}/summaries`,
      (route) => {
        summaryReads++;
        return summaryReads === 1
          ? route.fulfill({
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ success: false, error: 'Fictional read failure' }),
            })
          : route.continue();
      },
    );
    await page.getByRole('button', { name: 'AI menu', exact: true }).click();
    await page.getByRole('button', { name: 'Summarize', exact: true }).click();
    const summary = page.getByRole('complementary', { name: 'Summarize & Paraphrase' });
    await expect(summary.getByRole('alert')).toContainText("We couldn't load your summaries");
    await expect(summary.getByText('No summaries yet', { exact: true })).toHaveCount(0);
    await summary.getByRole('button', { name: 'Try again' }).click();
    await expect(summary.getByText('No summaries yet', { exact: true })).toBeVisible();
    await expect(summary).toContainText('Example only: Travel costs');
    expect(summaryReads).toBe(2);
    expect(providerRequests).toBe(0);
    await summary.getByRole('button', { name: 'Choose a source' }).click();
    await expect(summary.getByLabel('Transcript or code')).toBeFocused();
    await summary.getByLabel('Transcript or code').selectOption(transcriptId);
    expect(
      (
        await new AxeBuilder({ page })
          .include('[aria-labelledby="summary-panel-title"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await summary.getByRole('button', { name: 'Generate Summary' }).click();
    await expect(
      page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Connect your AI account' }) }),
    ).toBeVisible();
    expect(providerRequests).toBe(0);
    await page.keyboard.press('Escape');
    await summary.getByRole('button', { name: 'Close summaries' }).focus();
    await page.keyboard.press('Enter');
    await expect(summary).toBeHidden();
    console.log(
      `RECOVERY_PROOF ${JSON.stringify({ viewport: page.viewportSize(), googleConfigured, summaryReads, providerRequests, networkFailureInjected: true, nativeScreenReader: false })}`,
    );
  } finally {
    if (created) {
      const cleanup = await page.request.delete('/api/auth/account', {
        headers,
        data: { password, deleteLegacyCanvases: true },
      });
      expect(cleanup.status()).toBe(200);
    }
  }
});

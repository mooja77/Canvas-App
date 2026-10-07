import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

for (const width of [1280, 820, 390]) {
  test(`weighting teaches import, real source focus and filter recovery at ${width}px`, async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
      throw new Error('Fictional-account weighting proof is local only');
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await context.route('**/*', (route) =>
      ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort('blockedbyclient'),
    );
    await page.setViewportSize({ width, height: 900 });
    const password = randomBytes(24).toString('base64');
    const headers = { Origin: new URL(baseURL).origin };
    let created = false;
    const openWeights = async () => {
      await page.getByRole('button', { name: 'Tools menu', exact: true }).click();
      await page.getByRole('button', { name: 'Weights', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Code Weighting' });
      await expect(dialog).toBeVisible();
      return dialog;
    };
    const audit = async () => {
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-labelledby="code-weighting-title"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    };
    try {
      await page.goto('/login?mode=register');
      const signup = await page.request.post('/api/auth/signup', {
        headers,
        data: {
          name: 'Fictional weighting researcher',
          email: `weighting-e2e-${randomBytes(8).toString('hex')}@example.com`,
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
      const response = await page.request.post('/api/canvas', { headers, data: { name: 'Fictional weighting proof' } });
      expect(response.ok()).toBe(true);
      const canvas = (await response.json()).data;
      await page.goto(`/canvas/${canvas.id}`);
      await expect(page.getByRole('button', { name: 'Tools menu', exact: true })).toBeVisible({ timeout: 30_000 });
      const reject = page.getByRole('button', { name: 'Reject', exact: true });
      if (await reject.isVisible()) await reject.click();
      let dialog = await openWeights();
      await expect(dialog).toContainText('Stars help you compare how important');
      await expect(dialog.getByRole('link', { name: 'See a coded-passage example' })).toHaveAttribute(
        'href',
        '/help/first-code.html',
      );
      await audit();
      await dialog.getByRole('button', { name: 'Paste or import a transcript' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Paste Text Type or paste transcript content', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');

      const transcriptResponse = await page.request.post(`/api/canvas/${canvas.id}/transcripts`, {
        headers,
        data: {
          title: 'Fictional weighting interview',
          content: 'A fictional participant felt confident after clear instructions.',
        },
      });
      expect(transcriptResponse.ok()).toBe(true);
      const transcript = (await transcriptResponse.json()).data;
      await page.reload();
      dialog = await openWeights();
      await dialog.getByRole('button', { name: 'Open a transcript to code' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toBeHidden();
      await expect(
        page.locator('.select-text').filter({ hasText: 'A fictional participant felt confident' }),
      ).toBeInViewport();

      const questionResponse = await page.request.post(`/api/canvas/${canvas.id}/questions`, {
        headers,
        data: { text: 'Confidence', color: '#3B82F6' },
      });
      expect(questionResponse.ok()).toBe(true);
      const question = (await questionResponse.json()).data;
      const emptyQuestionResponse = await page.request.post(`/api/canvas/${canvas.id}/questions`, {
        headers,
        data: { text: 'Unused code', color: '#3B82F6' },
      });
      expect(emptyQuestionResponse.ok()).toBe(true);
      const emptyQuestion = (await emptyQuestionResponse.json()).data;
      expect(
        (
          await page.request.post(`/api/canvas/${canvas.id}/codings`, {
            headers,
            data: {
              transcriptId: transcript.id,
              questionId: question.id,
              startOffset: 0,
              endOffset: 23,
              codedText: 'A fictional participant',
            },
          })
        ).status(),
      ).toBe(201);
      await page.reload();
      dialog = await openWeights();
      await dialog.getByRole('combobox', { name: 'Filter by code' }).selectOption(emptyQuestion.id);
      await expect(dialog).toContainText('Your saved codings have not been removed');
      await audit();
      await dialog.getByRole('button', { name: 'Show all codings' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('combobox', { name: 'Filter by code' })).toHaveValue('');
      await expect(dialog).toContainText('A fictional participant');
      await expect(dialog.getByRole('combobox', { name: 'Sort codings' })).toBeVisible();
      await audit();
      const rating = await dialog.getByRole('button', { name: 'Rate 1 star', exact: true }).boundingBox();
      expect(Math.min(rating?.height ?? 0, rating?.width ?? 0)).toBeGreaterThanOrEqual(24);
      expect(pageErrors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`weighting-${width}.png`) });
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

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

test('excerpt guidance, filter recovery and keyword search work without changing saved research', async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname))
    throw new Error('Local fictional-account proof only');
  const database = new URL(process.env.DATABASE_URL ?? '');
  const owned =
    database.hostname === '127.0.0.1' &&
    database.port === '4759' &&
    database.pathname.startsWith('/qualcanvas_fullstack_codex_');
  const ci =
    process.env.E2E_TEST === 'true' &&
    database.hostname === 'localhost' &&
    database.port === '55432' &&
    database.pathname === '/qualcanvas_e2e';
  if (!owned && !ci) throw new Error('Explicit disposable database required');
  await context.route('**/*', (route) =>
    ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort('blockedbyclient'),
  );
  const password = randomBytes(24).toString('base64');
  const headers = { Origin: new URL(baseURL).origin };
  let created = false;
  try {
    const signup = await page.request.post('/api/auth/signup', {
      headers,
      data: {
        name: 'Fictional excerpt researcher',
        email: `qc-excerpt-${randomBytes(8).toString('hex')}@example.com`,
        password,
      },
    });
    expect(signup.status()).toBe(201);
    created = true;
    const user = (await signup.json()).data.user;
    await page.goto('/login');
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
    expect(
      (await page.request.patch('/api/user/onboarding', { headers, data: { state: { flowDismissed: true } } })).ok(),
    ).toBe(true);
    const canvasResponse = await page.request.post('/api/canvas', {
      headers,
      data: { name: 'Fictional excerpt proof' },
    });
    expect(canvasResponse.ok()).toBe(true);
    const canvas = (await canvasResponse.json()).data;
    const open = async () => {
      await page.goto(`/canvas/${canvas.id}`);
      await page.getByRole('button', { name: 'Tools menu', exact: true }).click({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Excerpts', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Excerpt Browser' })).toBeVisible();
    };
    const dialog = page.getByRole('dialog', { name: 'Excerpt Browser' });
    const checkAccess = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const button of await dialog.getByRole('button').all()) {
        const box = await button.boundingBox();
        if (box) expect(box.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        (
          await new AxeBuilder({ page })
            .include('[aria-labelledby="excerpt-browser-title"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
    };
    await open();
    await expect(dialog).toContainText('Keep meaningful passages together');
    await expect(dialog.getByRole('link', { name: /See a coded-passage example/ })).toHaveAttribute(
      'href',
      '/help/first-code.html',
    );
    await expect(dialog.getByRole('button', { name: 'Copy All' })).toBeDisabled();
    await checkAccess();
    await dialog.getByRole('link', { name: /See a coded-passage example/ }).focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Excerpts', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('link', { name: /See a coded-passage example/ })).toBeFocused();
    await dialog.getByRole('button', { name: 'Paste or import a transcript' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Paste Text Type or paste transcript content', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    const post = async (path: string, data: unknown) => {
      const response = await page.request.post(`/api/canvas/${canvas.id}/${path}`, { headers, data });
      expect(response.status()).toBe(201);
      return (await response.json()).data;
    };
    const transcript = await post('transcripts', {
      title: 'Fictional interview',
      content: 'My commute is easier now.',
    });
    const code = await post('questions', { text: 'Travel', color: '#3B82F6' });
    await post('codings', {
      transcriptId: transcript.id,
      questionId: code.id,
      startOffset: 3,
      endOffset: 10,
      codedText: 'commute',
    });
    const saved = (await (await page.request.get(`/api/canvas/${canvas.id}`)).json()).data;
    const mutations: string[] = [];
    const layoutSaves: Record<string, unknown>[] = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith(`/api/canvas/${canvas.id}/`) || request.method() === 'GET') return;
      // The existing canvas auto-saves node positions on mount. Record that
      // exact endpoint separately; it is not a research-content mutation.
      if (path === `/api/canvas/${canvas.id}/layout` && request.method() === 'PUT')
        layoutSaves.push(request.postDataJSON());
      else mutations.push(`${request.method()} ${path}`);
    });
    await open();
    await expect(dialog.getByText('commute', { exact: true })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Search excerpts' }).fill('no-matching-word');
    await expect(dialog).toContainText('No excerpts match your filters.');
    await dialog.getByRole('button', { name: 'Clear filters' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('textbox', { name: 'Search excerpts' })).toBeFocused();
    await expect(dialog.getByText('commute', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Copy excerpt from Fictional interview' }).focus();
    await expect(
      dialog.getByRole('button', { name: 'Remove excerpt from Fictional interview' }).locator('..'),
    ).toHaveCSS('opacity', '1');
    await checkAccess();
    await dialog.getByRole('button', { name: 'KWIC', exact: true }).click();
    await dialog.getByRole('textbox', { name: 'Keyword in context' }).fill(' commute ');
    await expect(dialog.getByRole('table', { name: 'Keyword occurrences' })).toContainText('commute');
    await dialog.getByRole('textbox', { name: 'Keyword in context' }).fill('easier');
    await expect(dialog.getByRole('table', { name: 'Keyword occurrences' })).toContainText('easier');
    await dialog.getByRole('textbox', { name: 'Keyword in context' }).fill('not-present');
    await dialog.getByRole('button', { name: 'Try another word' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('textbox', { name: 'Keyword in context' })).toBeFocused();
    await checkAccess();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(mutations).toEqual([]);
    for (const payload of layoutSaves) expect(Object.keys(payload)).toEqual(['positions']);
    const retained = (await (await page.request.get(`/api/canvas/${canvas.id}`)).json()).data;
    expect(retained.codings).toEqual(saved.codings);
    expect(retained.transcripts).toEqual(saved.transcripts);
    expect(retained.questions).toEqual(saved.questions);
    console.log(
      `EXCERPT_GUIDANCE_PROOF ${JSON.stringify({ viewport: page.viewportSize(), researchMutations: mutations.length, layoutSaves: layoutSaves.length, nativeScreenReader: false })}`,
    );
  } finally {
    if (created)
      expect(
        (
          await page.request.delete('/api/auth/account', { headers, data: { password, deleteLegacyCanvases: true } })
        ).status(),
      ).toBe(200);
  }
});

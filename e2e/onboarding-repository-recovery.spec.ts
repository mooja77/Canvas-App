import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

test('repository and insight reads recover by keyboard without inventing emptiness or writing data', async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname))
    throw new Error('Local fictional-account proof only');
  const database = new URL(process.env.DATABASE_URL ?? '');
  const ownedLocalDatabase =
    database.hostname === '127.0.0.1' &&
    database.port === '4759' &&
    database.pathname.startsWith('/qualcanvas_fullstack_codex_');
  const explicitCiDatabase =
    process.env.E2E_TEST === 'true' &&
    database.hostname === 'localhost' &&
    database.port === '55432' &&
    database.pathname === '/qualcanvas_e2e';
  if (!ownedLocalDatabase && !explicitCiDatabase) throw new Error('Explicit disposable test database required');
  await context.route('**/*', (route) =>
    ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort('blockedbyclient'),
  );
  const prisma = new PrismaClient();
  const password = randomBytes(24).toString('base64');
  const headers = { Origin: new URL(baseURL).origin };
  let created = false;
  try {
    const signup = await page.request.post('/api/auth/signup', {
      headers,
      data: {
        name: 'Fictional repository researcher',
        email: `qc-repository-${randomBytes(8).toString('hex')}@example.com`,
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
    let retryRepositories = false;
    let repositorySuccesses = 0;
    await page.route(
      (url) => url.pathname === '/api/repositories',
      (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        if (!retryRepositories)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"success":false,"error":"Fictional failed read"}',
          });
        repositorySuccesses++;
        return route.continue();
      },
    );
    const businessWrites: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/repositories') && request.method() !== 'GET')
        businessWrites.push(request.method());
    });
    await page.goto('/repository');
    const repoRetry = page.getByRole('button', { name: 'Try loading repositories again' });
    await expect(repoRetry).toBeVisible();
    await expect(page.getByText('No repositories yet', { exact: true })).toHaveCount(0);
    expect((await repoRetry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    retryRepositories = true;
    await repoRetry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('No repositories yet', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Research repositories' })).toBeFocused();
    expect(repositorySuccesses).toBe(1);
    // Seed only the owned disposable database, without changing the user's Free
    // plan: existing saved research must remain readable after a downgrade.
    const repo = await prisma.researchRepository.create({
      data: {
        userId: user.id,
        name: 'Fictional saved findings',
        insights: {
          create: {
            title: 'Fictional travel finding',
            content: 'This is fictional evidence used only in the local recovery test.',
          },
        },
      },
    });
    let retryInsights = false;
    let insightSuccesses = 0;
    await page.route(
      (url) => url.pathname === `/api/repositories/${repo.id}/insights`,
      (route) => {
        if (!retryInsights)
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"success":false,"error":"Fictional failed read"}',
          });
        insightSuccesses++;
        return route.continue();
      },
    );
    await page.reload();
    const select = page.getByRole('button', { name: 'Open repository Fictional saved findings' });
    await expect(select).toBeVisible();
    await select.focus();
    await page.keyboard.press('Enter');
    const insightRetry = page.getByRole('button', { name: 'Try loading insights again' });
    await expect(insightRetry).toBeVisible();
    await expect(page.getByText('No insights yet', { exact: true })).toHaveCount(0);
    expect((await insightRetry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    retryInsights = true;
    await insightRetry.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Fictional travel finding', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Repository insights' })).toBeFocused();
    expect(insightSuccesses).toBe(1);
    await select.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Fictional travel finding', { exact: true })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Loading insights' })).toHaveCount(0);
    expect(insightSuccesses).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(
      (await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(businessWrites).toEqual([]);
    console.log(
      `REPOSITORY_RECOVERY_PROOF ${JSON.stringify({ viewport: page.viewportSize(), repositoryRetrySuccesses: 1, insightSuccesses, businessWrites: 0, nativeScreenReader: false })}`,
    );
  } finally {
    if (created)
      expect(
        (
          await page.request.delete('/api/auth/account', { headers, data: { password, deleteLegacyCanvases: true } })
        ).status(),
      ).toBe(200);
    await prisma.$disconnect();
  }
});

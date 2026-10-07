import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' });
test.describe.configure({ timeout: 120_000 });

for (const width of [1280, 820, 390]) {
  test(`analysis metadata persists, computes and recovers without repeated writes at ${width}px`, async ({
    page,
    context,
    baseURL,
  }) => {
    if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
      throw new Error('Fictional proof is local only');
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('Explicit owned local database required');
    const address = new URL(databaseUrl);
    if (
      address.hostname !== '127.0.0.1' ||
      address.port !== '4759' ||
      !/^\/qc_(activation|team)_/.test(address.pathname)
    )
      throw new Error('Refusing any non-owned database');
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', (route) =>
      ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort('blockedbyclient'),
    );
    await page.setViewportSize({ width, height: 900 });
    const password = randomBytes(24).toString('base64');
    const headers = { Origin: new URL(baseURL).origin };
    const email = `analysis-setup-${randomBytes(8).toString('hex')}@example.com`;
    let created = false;
    const openDetails = async () => {
      await page.getByRole('button', { name: 'Tools menu', exact: true }).click();
      await page.getByRole('button', { name: 'Transcript dates and locations', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Transcript dates and locations' });
      await expect(dialog).toBeVisible();
      return dialog;
    };
    const audit = async (selector = '[aria-labelledby="transcript-details-title"]') => {
      expect(
        (
          await new AxeBuilder({ page })
            .include(selector)
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
        data: { name: 'Fictional analysis researcher', email, password },
      });
      expect(signup.status()).toBe(201);
      created = true;
      const user = (await signup.json()).data.user;
      // Explicit local paid-plan fixture, not a real checkout or free-plan proof.
      const fixture = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(fixture.email).toBe(email);
      await db.user.update({ where: { id: fixture.id }, data: { plan: 'student' } });
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
                plan: 'student',
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
        data: { name: 'Fictional analysis setup' },
      });
      expect(canvasResponse.status()).toBe(201);
      const canvas = (await canvasResponse.json()).data;
      await page.goto(`/canvas/${canvas.id}`);
      await expect(page.getByRole('button', { name: 'Tools menu', exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Cookie consent' })).toBeHidden();
      let dialog = await openDetails();
      await expect(dialog.getByRole('button', { name: 'Paste or import a transcript' })).toBeVisible();
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
          title: 'Fictional event interview',
          content: 'A fictional participant found clear instructions helpful.',
        },
      });
      expect(transcriptResponse.status()).toBe(201);
      const transcript = (await transcriptResponse.json()).data;
      const codes = [];
      for (const text of ['Clear guidance', 'Unused comparison code']) {
        const response = await page.request.post(`/api/canvas/${canvas.id}/questions`, {
          headers,
          data: { text, color: '#6366f1' },
        });
        expect(response.status()).toBe(201);
        codes.push((await response.json()).data);
      }
      const codingResponse = await page.request.post(`/api/canvas/${canvas.id}/codings`, {
        headers,
        data: {
          transcriptId: transcript.id,
          questionId: codes[0].id,
          startOffset: 0,
          endOffset: 12,
          codedText: 'A fictional ',
        },
      });
      expect(codingResponse.status()).toBe(201);
      await page.reload();
      const openCrossCase = async () => {
        await page.getByRole('button', { name: 'Tools menu', exact: true }).click();
        await page.getByRole('button', { name: 'Cross-Case', exact: true }).click();
        return page.getByRole('dialog', { name: 'Cross-Case Analysis' });
      };
      let crossCase = await openCrossCase();
      await expect(crossCase).toContainText('Compare what different groups said');
      await audit('[aria-labelledby="cross-case-title"]');
      await crossCase.getByRole('button', { name: 'Set up cases and assign transcripts' }).focus();
      await page.keyboard.press('Enter');
      await expect(crossCase).toBeHidden();
      const cases = page.getByRole('dialog', { name: 'Cases & Classifications' });
      await expect(cases).toBeVisible();
      await cases.getByLabel('Case name', { exact: true }).fill('Fictional participant');
      await cases.getByLabel('Attributes (optional)', { exact: true }).fill('role: Manager');
      await cases.getByRole('button', { name: 'Create Case', exact: true }).click();
      const assignment = cases.getByRole('checkbox', { name: 'Fictional event interview', exact: true });
      await expect(assignment).toBeVisible();
      // Assignment is server-confirmed, not optimistic. Wait for the real PUT
      // response/state instead of check()'s immediate post-click assertion.
      await assignment.click();
      await expect(assignment).toBeChecked();
      await expect
        .poll(async () => (await db.canvasTranscript.findUniqueOrThrow({ where: { id: transcript.id } })).caseId)
        .not.toBeNull();
      await cases.getByRole('button', { name: 'Close', exact: true }).click();
      crossCase = await openCrossCase();
      await crossCase.getByRole('button', { name: 'Choose a group', exact: true }).focus();
      await page.keyboard.press('Enter');
      const group = crossCase.getByRole('combobox', { name: 'Group by attribute', exact: true });
      await expect(group).toBeFocused();
      await group.selectOption('role');
      await crossCase.getByText('Read passages', { exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(crossCase.getByRole('table')).toContainText('A fictional');
      await audit('[aria-labelledby="cross-case-title"]');
      await crossCase.getByRole('button', { name: 'Excerpts', exact: true }).click();
      await crossCase.getByRole('combobox', { name: 'Filter by code', exact: true }).selectOption(codes[1].id);
      await expect(crossCase).toContainText('Your saved passages have not been removed');
      await crossCase.getByRole('button', { name: 'Clear filters', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(group).toHaveValue('role');
      await expect(crossCase.getByRole('region', { name: 'Cross-case results' })).toContainText('A fictional');
      await audit('[aria-labelledby="cross-case-title"]');
      await page.screenshot({ path: test.info().outputPath(`cross-case-${width}.png`) });
      await crossCase.getByRole('button', { name: 'Close', exact: true }).click();
      dialog = await openDetails();
      await expect(dialog.getByRole('button', { name: 'Save transcript details' })).toBeEnabled();
      await dialog.getByLabel('Event date and time (UTC, optional)').fill('2026-10-07T12:30');
      await dialog.getByLabel('Latitude (optional)').fill('51.9');
      await dialog.getByLabel('Longitude (optional)').fill('-8.5');
      await dialog.getByLabel('Location label (optional)').fill('Fictional Cork event');
      await audit();
      await dialog.getByRole('button', { name: 'Save transcript details' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toContainText('Details saved and checked');
      const stored = await db.canvasTranscript.findUniqueOrThrow({ where: { id: transcript.id } });
      expect(stored.eventDate?.toISOString()).toBe('2026-10-07T12:30:00.000Z');
      expect(stored.latitude).toBe(51.9);
      expect(stored.longitude).toBe(-8.5);
      expect(stored.locationName).toBe('Fictional Cork event');
      expect(stored.content).toBe('A fictional participant found clear instructions helpful.');
      for (const nodeType of ['timeline', 'geomap']) {
        const create = await page.request.post(`/api/canvas/${canvas.id}/computed`, {
          headers,
          data: { nodeType, label: `Fictional ${nodeType}`, config: {} },
        });
        expect(create.status()).toBe(201);
        const node = (await create.json()).data;
        const run = await page.request.post(`/api/canvas/${canvas.id}/computed/${node.id}/run`, { headers });
        expect(run.status()).toBe(200);
        const result = (await run.json()).data.result;
        if (nodeType === 'timeline')
          expect(result.entries).toEqual([
            expect.objectContaining({ transcriptId: transcript.id, date: '2026-10-07T12:30:00.000Z' }),
          ]);
        else
          expect(result.points).toEqual([
            expect.objectContaining({ transcriptId: transcript.id, latitude: 51.9, longitude: -8.5 }),
          ]);
      }
      await page.reload();
      dialog = await openDetails();
      await expect(dialog.getByLabel('Latitude (optional)')).toHaveValue('51.9');
      await expect(dialog.getByLabel('Location label (optional)')).toHaveValue('Fictional Cork event');
      let writes = 0;
      const endpoint = `**/api/canvas/${canvas.id}/transcripts/${transcript.id}`;
      await page.route(endpoint, async (route) => {
        if (route.request().method() !== 'PUT') return route.continue();
        writes++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Fictional unconfirmed response' }),
        });
      });
      await dialog.getByLabel('Location label (optional)').fill('Fictional unsaved change');
      await dialog.getByRole('button', { name: 'Save transcript details' }).click();
      await expect(dialog.getByRole('alert')).toContainText('could not confirm');
      await expect(dialog.getByRole('button', { name: 'Save transcript details' })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Check saved details' }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toContainText('Saved details checked below');
      await expect(dialog.getByLabel('Location label (optional)')).toHaveValue('Fictional unsaved change');
      expect(writes).toBe(1);
      expect((await db.canvasTranscript.findUniqueOrThrow({ where: { id: transcript.id } })).locationName).toBe(
        'Fictional Cork event',
      );
      await audit();
      expect(errors).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`analysis-setup-${width}.png`) });
    } finally {
      if (created)
        expect(
          (
            await page.request.delete('/api/auth/account', { headers, data: { password, deleteLegacyCanvases: true } })
          ).status(),
        ).toBe(200);
      await db.$disconnect();
    }
  });
}

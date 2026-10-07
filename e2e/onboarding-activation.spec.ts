import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';
import { selectExcerptByPointer } from '../scripts/select-excerpt-by-pointer.mjs';

/**
 * The full self-serve onboarding path, as a brand-new researcher meets it:
 *
 *   landing page -> "Start free" -> sign-up (3 fields) -> two optional
 *   personalising questions -> starter template (labelled sample study) ->
 *   setup guide deep link -> own transcript (brought into view) -> first coded
 *   excerpt (the aha moment, recorded server-side as firstValueAt) ->
 *   one-click sample removal, with help reachable throughout.
 *
 * Counts clicks and fields to the aha moment and fails if either regresses
 * past the budget measured for the onboarding SOTA work (11 actions, 7 fields,
 * including the cookie choice and excerpt-selection gesture).
 */

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ timeout: 180_000 });
const fixturePasswords = new WeakMap<Page, string>();

test.afterEach(async ({ page }) => {
  const password = fixturePasswords.get(page);
  if (!password) return;
  try {
    await deleteFixtureAccount(page, password);
  } finally {
    fixturePasswords.delete(page);
  }
});

test.beforeEach(async ({ context }) => {
  // Browser connections do not inherit the Node preload's network guard.
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      ? route.continue()
      : route.abort('blockedbyclient');
  });
});

const TRANSCRIPT = [
  'The fictional participant described finding the appointment system confusing during their first visit.',
  'A fictional support worker then explained each step and the participant felt more confident.',
].join(' ');

// Read-only comparison mode against an archived current-default app source.
// It measures the same real coding outcome without expecting new guide features.
const baseline = process.env.QC_ONBOARDING_BASELINE === 'true';

async function deleteFixtureAccount(page: Page, password: string) {
  const status = await page.evaluate(async (pw) => {
    const response = await fetch('/api/auth/account', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, deleteLegacyCanvases: true }),
    });
    return response.status;
  }, password);
  expect(status).toBe(200);
}

async function selectExcerpt(page: Page, startText: string, characterCount: number) {
  await selectExcerptByPointer(page, startText, characterCount);
}

test('a new researcher reaches a first coded excerpt on their own, then clears the sample study', async ({ page }) => {
  const runId = Date.now();
  const email = `onboarding-e2e-${runId}@example.com`;
  const password = randomBytes(24).toString('base64');
  let clicks = 0;
  let fields = 0;
  const click = async (locator: ReturnType<Page['locator']>) => {
    clicks++;
    await locator.click();
  };
  const fill = async (locator: ReturnType<Page['locator']>, value: string) => {
    fields++;
    await locator.fill(value);
  };

  // ── Website: landing page -> sign-up ──
  const websiteStartedAt = Date.now();
  await page.goto('/');
  const rejectCookies = page.getByRole('button', { name: /^Reject/ });
  if (await rejectCookies.isVisible({ timeout: 3_000 }).catch(() => false)) await click(rejectCookies);
  await click(page.getByRole('button', { name: 'Start free' }).first());
  await expect(page).toHaveURL(/\/login\?mode=register/);

  // Three fields, no card, no verification gate.
  await fill(page.locator('#register-name'), 'Fictional Onboarding Researcher');
  await fill(page.locator('#register-email'), email);
  await fill(page.locator('#register-password'), password);
  const signedUpAt = Date.now();
  const signupResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/auth/signup') && r.request().method() === 'POST',
  );
  await click(page.getByRole('button', { name: /Create Free Account/i }));
  expect((await signupResponse).status()).toBe(201);
  fixturePasswords.set(page, password);
  await page.waitForURL(/\/canvas/, { timeout: 30_000 });

  // ── Two optional questions; the topic names the first project ──
  await expect(page.getByRole('heading', { name: "Let's tailor your workspace" })).toBeVisible({ timeout: 20_000 });
  if (baseline) await click(page.getByRole('button', { name: 'Solo', exact: true }));
  else await expect(page.getByRole('button', { name: 'Solo', exact: true })).toHaveCount(0);
  await fill(page.locator('#onboarding-topic'), `Access to services ${runId}`);
  await click(page.getByRole('button', { name: 'Continue', exact: true }));

  // ── Starter template opens a labelled sample study ──
  await expect(page.getByRole('heading', { name: 'Pick a starting point' })).toBeVisible();
  await click(page.getByRole('button', { name: /Thematic Analysis/i }).first());
  await page.waitForURL(/\/canvas\/[a-zA-Z0-9_-]+/, { timeout: 30_000 });
  await expect(
    page.getByText(baseline ? 'Thematic Analysis (Braun & Clarke)' : `Access to services ${runId}`).first(),
  ).toBeVisible({ timeout: 20_000 });
  const sample = page.getByRole('region', { name: 'Sample data' });
  if (!baseline) await expect(sample).toContainText('sample study');

  // ── Setup guide: progress bar, seeded material ticks nothing ──
  const progress = page.getByRole('progressbar', { name: 'Setup progress' });
  if (!baseline) {
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    await expect(page.getByText('0 of 5 complete')).toBeVisible();
  }

  // Deep link: the guide step opens the transcript picker.
  await click(page.getByRole('button', { name: baseline ? 'Transcript' : 'Add your first transcript', exact: true }));
  await click(page.getByRole('button', { name: /Paste Text/i }));
  const dialog = page.getByRole('dialog', { name: 'Add Transcript' });
  await fill(dialog.getByLabel('Title'), 'Fictional Interview 01');
  await fill(dialog.getByLabel('Transcript Content'), TRANSCRIPT);
  await click(dialog.getByRole('button', { name: 'Add Transcript', exact: true }));
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  // The new transcript is brought into the viewport, not left below the sample.
  const ownText = page.locator('.select-text').filter({ hasText: 'The fictional participant described' }).first();
  if (baseline) await click(page.getByRole('button', { name: 'Fit View', exact: true }));
  await expect(ownText).toBeInViewport({ timeout: 10_000 });
  if (!baseline) await expect(progress).toHaveAttribute('aria-valuenow', '1');

  // ── Aha: first coded excerpt of the researcher's own material ──
  clicks++; // drag-select
  await selectExcerpt(page, 'The fictional participant described', 92);
  const quickCode = page.getByPlaceholder(/Type a name and press Enter to create|Search or create code/i);
  await expect(quickCode).toBeVisible({ timeout: 10_000 });
  await fill(quickCode, 'Access barriers');
  const [coding] = await Promise.all([
    page.waitForResponse((r) => /\/api\/canvas\/[^/]+\/codings$/.test(r.url()) && r.request().method() === 'POST'),
    click(page.getByRole('button', { name: /Create "Access barriers" and code/i })),
  ]);
  expect(coding.status()).toBe(201);
  const savedCoding = (await coding.json()).data;
  const secondsToAha = (Date.now() - signedUpAt) / 1000;
  const websiteSecondsToAha = (Date.now() - websiteStartedAt) / 1000;
  const measurement = {
    clicks,
    pointerClicks: clicks - 1,
    selectionGestures: 1,
    actions: clicks,
    fields,
    secondsToAha,
    websiteSecondsToAha,
    timing:
      'automated local driver with real pointer selection; clicks is the legacy action count including one drag, not a human measurement',
  };
  console.log(
    `${baseline ? 'ONBOARDING_BASELINE_MEASUREMENT' : 'ONBOARDING_MEASUREMENT'} ${JSON.stringify(measurement)}`,
  );
  if (baseline) {
    test.info().annotations.push({ type: 'ttfv-baseline', description: JSON.stringify(measurement) });
    return;
  }
  await expect(progress).toHaveAttribute('aria-valuenow', '2');

  const onboarding = await page.evaluate(async () => {
    const response = await fetch('/api/user/onboarding', { credentials: 'include' });
    return response.json();
  });
  expect(onboarding.data.firstValueAt).toBeTruthy();
  expect(onboarding.data.observedSteps).toEqual(['first-transcript', 'first-coded-excerpt']);
  const forgedStatus = await page.evaluate(
    async () =>
      (
        await fetch('/api/user/onboarding', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: { checklistComplete: ['run-analysis', 'export-csv', 'create-theme'] } }),
        })
      ).status,
  );
  expect(forgedStatus).toBe(400);

  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);

  // Budget from the measured after-state; seconds are machine time, recorded for the PR.
  test.info().annotations.push({ type: 'ttfv', description: JSON.stringify(measurement) });
  expect(clicks).toBeLessThanOrEqual(11);
  expect(fields).toBeLessThanOrEqual(7);
  expect(secondsToAha).toBeLessThan(180);

  // ── Help at the point of need: support contact with a reply time ──
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', /support@qualcanvas\.com/);
  await expect(page.getByRole('link', { name: 'Have us set up your project' })).toBeVisible();
  await expect(page.getByText(/reply within two business days/)).toBeVisible();
  await page.keyboard.press('Escape');

  // Dismiss and restore the guide in the same canvas session. The Help action
  // must clear the account-scoped choice without requiring a page reload.
  await page.getByRole('button', { name: 'Dismiss checklist' }).click();
  await expect(progress).toBeHidden();
  await page.getByRole('button', { name: 'Help', exact: true }).click();
  await page.getByRole('button', { name: 'Resume quick setup' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');

  // Return on a phone: account-scoped progress survives reload and the guide
  // remains reachable without covering the canvas controls.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(progress).toHaveAttribute('aria-valuenow', '2', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
  const hiddenCodeFilter = page.getByPlaceholder('Filter codes...');
  await expect(hiddenCodeFilter).toHaveCount(1); // Keep the navigator's local state, not its hidden focus targets.
  await expect(page.getByRole('textbox').and(hiddenCodeFilter)).toHaveCount(0);
  await hiddenCodeFilter.evaluate((element) => (element as HTMLElement).focus());
  await expect(hiddenCodeFilter).not.toBeFocused();
  const mobileAccessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(mobileAccessibility.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('phone-setup.png') });

  // The overview is for orientation, not microscopic destructive buttons.
  // The setup guide brings the user's transcript back to a usable editing zoom.
  await page.getByRole('button', { name: /Get started/ }).click();
  await page.getByRole('button', { name: 'Use 2 different codes' }).click();
  const ownNode = page.locator('.react-flow__node-transcript').filter({ hasText: 'Fictional Interview 01' });
  const collapse = ownNode.getByRole('button', { name: 'Collapse', exact: true });
  await expect(collapse).toBeVisible();
  await expect(collapse).toBeInViewport();
  await expect
    .poll(async () => {
      const bounds = await collapse.boundingBox();
      return Math.min(bounds?.width ?? 0, bounds?.height ?? 0);
    })
    .toBeGreaterThanOrEqual(24);
  await page.screenshot({ path: test.info().outputPath('phone-editing.png') });

  await page.setViewportSize({ width: 768, height: 1024 });
  const tabletAccessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(tabletAccessibility.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('tablet-setup.png') });
  await page.getByRole('button', { name: 'Help', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Email support' })).toBeVisible();
  await page.keyboard.press('Escape');

  // ── One click removes the sample study; the researcher's work stays ──
  await Promise.all([
    page.waitForResponse((r) => /\/sample-data$/.test(r.url()) && r.request().method() === 'DELETE'),
    sample.getByRole('button', { name: 'Remove sample data' }).click(),
  ]);
  await expect(sample).toBeHidden({ timeout: 10_000 });
  await expect(page.getByText('Fictional Interview 01').first()).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '2');

  // The guide promises coded data, not merely a list of code names. Follow
  // its actual link and inspect the downloaded CSV rather than setting a
  // completion marker from the test.
  await page.getByRole('button', { name: 'Export your codings to CSV', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Codebook & coded data export' });
  await expect(exportDialog).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await exportDialog.getByRole('button', { name: /Download CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^coded-data-.*\.csv$/);
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('The fictional participant described');
  expect(csv).toContain('Access barriers');
  await page.keyboard.press('Escape');
  await expect(progress).toHaveAttribute('aria-valuenow', '3');

  // Complete the remaining guide steps through the real UI, not API shortcuts.
  await page.getByRole('button', { name: 'Use 2 different codes', exact: true }).click();
  await selectExcerpt(page, 'A fictional support worker', 80);
  await expect(quickCode).toBeVisible();
  await quickCode.fill('Confidence');
  const secondCodingResponse = page.waitForResponse(
    (r) => /\/api\/canvas\/[^/]+\/codings$/.test(r.url()) && r.request().method() === 'POST',
  );
  await quickCode.press('Enter');
  const secondCoding = await secondCodingResponse;
  expect(secondCoding.status()).toBe(201);
  expect((await secondCoding.json()).data.questionId).not.toBe(savedCoding.questionId);
  await expect(progress).toHaveAttribute('aria-valuenow', '4');

  await page.getByRole('button', { name: /Run an analysis \(word cloud, frequency/ }).click();
  const createAnalysisResponse = page.waitForResponse(
    (r) => /\/api\/canvas\/[^/]+\/computed$/.test(r.url()) && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Statistics\s+Coding frequency charts$/ }).click();
  const createdAnalysis = await createAnalysisResponse;
  expect(createdAnalysis.status()).toBe(201);
  const analysis = (await createdAnalysis.json()).data;
  expect(analysis.nodeType).toBe('stats');
  const beforeRun = await page.evaluate(
    async () => (await (await fetch('/api/user/onboarding', { credentials: 'include' })).json()).data.observedSteps,
  );
  expect(beforeRun).not.toContain('run-analysis');
  await expect(progress).toHaveAttribute('aria-valuenow', '4');
  const statistics = page.locator('.react-flow__node-stats');
  const run = statistics.getByRole('button', { name: 'Run computation', exact: true });
  await expect(run).toBeVisible();
  await expect(run).toBeEnabled();
  const runResponse = page.waitForResponse(
    (r) => r.url().endsWith(`/computed/${analysis.id}/run`) && r.request().method() === 'POST',
  );
  await run.click();
  const computed = await runResponse;
  expect(computed.status()).toBe(200);
  const result = (await computed.json()).data.result;
  const positive = result.items.filter((item: { count: number }) => item.count > 0);
  expect(positive.map((item: { label: string }) => item.label).sort()).toEqual(['Access barriers', 'Confidence']);
  expect(positive.every((item: { count: number }) => item.count === 1)).toBe(true);
  expect(result.items.every((item: { count: number }) => Number.isFinite(item.count) && item.count >= 0)).toBe(true);
  const counts = statistics.getByRole('table', { name: 'Coding frequency counts' });
  const countsRegion = statistics.getByRole('region', { name: 'All coding counts' });
  await countsRegion.focus();
  await page.keyboard.press('End');
  await expect.poll(() => countsRegion.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(counts.getByRole('row', { name: 'Access barriers 1' })).toBeVisible();
  await expect(counts.getByRole('row', { name: 'Confidence 1' })).toBeVisible();
  await expect(counts.getByRole('row', { name: 'Confidence 1' })).toBeInViewport();
  await expect(progress).toBeHidden();
  const observed = await page.evaluate(
    async () => (await (await fetch('/api/user/onboarding', { credentials: 'include' })).json()).data,
  );
  expect(observed.observedSteps).toEqual([
    'first-transcript',
    'first-coded-excerpt',
    'create-theme',
    'run-analysis',
    'export-csv',
  ]);
  expect(observed.state.checklistComplete).toContain('export-csv');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeVisible();
  await expect(progress).toBeHidden();
  const resumed = await page.evaluate(
    async () => (await (await fetch('/api/user/onboarding', { credentials: 'include' })).json()).data,
  );
  expect(resumed.observedSteps).toEqual(observed.observedSteps);

  // afterEach deletes exactly this account on success AND failed assertions.
});

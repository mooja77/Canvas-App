import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const usageResponse = {
  success: true,
  data: {
    period: '30d',
    since: '2026-08-01T00:00:00.000Z',
    users: { newSignups: 4, activeUsers: 3, signupTrend: { '2026-08-01': 4 } },
    activation: {
      cohortSize: 4,
      activatedUsers: 2,
      activationRate: 50,
      stages: [
        {
          key: 'signup',
          label: 'Signed up',
          users: 4,
          cohortRate: 100,
          previousStepRate: 100,
          medianHoursToReach: 0,
        },
        {
          key: 'canvas',
          label: 'Created a project',
          users: 3,
          cohortRate: 75,
          previousStepRate: 75,
          medianHoursToReach: 1.5,
        },
        {
          key: 'transcript',
          label: 'Added a transcript',
          users: 2,
          cohortRate: 50,
          previousStepRate: 66.7,
          medianHoursToReach: 24,
        },
        {
          key: 'coding',
          label: 'Created a first coding',
          users: 2,
          cohortRate: 50,
          previousStepRate: 100,
          medianHoursToReach: 48,
        },
      ],
    },
    content: { canvasesCreated: 5, transcriptsCreated: 8, codingsCreated: 42, computedNodeRuns: 3 },
    features: { computedNodes: [], aiUsage: [] },
    ai: { totalCostCents: 0, totalInputTokens: 0, totalOutputTokens: 0 },
    actionBreakdown: [],
    topUsers: [],
  },
};

test('admin activation funnel is responsive, accessible and switches cohorts', async ({ page }) => {
  const periods: string[] = [];
  const consoleErrors: string[] = [];

  await page.addInitScript(() => sessionStorage.setItem('admin-api-key', 'synthetic-admin-key'));
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
  );
  await page.route('**/api/admin/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{}}' }),
  );
  await page.route('**/api/admin/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          totalUsers: 0,
          activeUsers: 0,
          newSignups7d: 0,
          mrr: 0,
          planDistribution: {},
          topFeatures: [],
          errorCount24h: 0,
        },
      }),
    }),
  );
  await page.route('**/api/admin/usage**', (route) => {
    periods.push(new URL(route.request().url()).searchParams.get('period') || '');
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(usageResponse) });
  });

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto('/admin', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'QualCanvas Admin' })).toBeVisible();
  await page.getByRole('button', { name: 'Activation' }).click();

  await expect(page.getByRole('heading', { name: 'New-user activation' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: /Created a first coding: 50.0%/ })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  await expect(page.getByText('42')).toBeVisible();
  expect(periods).toContain('30d');

  await page.getByRole('button', { name: '7 days' }).click();
  await expect.poll(() => periods.at(-1)).toBe('7d');

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(consoleErrors).toEqual([]);

  const accessibility = await new AxeBuilder({ page }).analyze();
  const seriousViolations = accessibility.violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(seriousViolations).toEqual([]);
});

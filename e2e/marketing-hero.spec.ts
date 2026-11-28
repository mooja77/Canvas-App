import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('desktop hero puts the workspace beside the heading and links to support', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const heading = page.getByRole('heading', { level: 1 });
  const hero = page.locator('section').filter({ has: heading });
  const workspace = hero.getByRole('img', { name: /^The QualCanvas workspace:/ });
  await expect(workspace).toBeVisible();
  await expect(workspace).toHaveAttribute('fetchpriority', 'high');
  await workspace.evaluate((image: HTMLImageElement) => image.decode());
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const consentBanner = page.locator('#cookie-consent-banner');
  await expect(consentBanner).toBeVisible();
  await consentBanner.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  const start = hero.getByRole('button', { name: 'Start free', exact: true });
  const startBox = (await start.boundingBox())!;
  const consentBox = (await consentBanner.boundingBox())!;
  expect(startBox.y + startBox.height).toBeLessThan(consentBox.y);

  const headingBox = (await heading.boundingBox())!;
  const workspaceBox = (await workspace.boundingBox())!;
  expect(workspaceBox.x).toBeGreaterThan(headingBox.x + headingBox.width);
  expect(workspaceBox.y + workspaceBox.height).toBeLessThan(720);

  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Start free', exact: true })).toHaveAttribute(
    'href',
    '/login?mode=register',
  );
  await expect(footer.getByRole('link', { name: 'Contact', exact: true })).toHaveAttribute(
    'href',
    /^mailto:support@qualcanvas\.com(?:\?|$)/,
  );
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Start free' }).click();
  await expect(page).toHaveURL(/\/login\?mode=register$/);
});

test('phone hero keeps Start free above the workspace without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const hero = page.locator('section').filter({ has: page.getByRole('heading', { level: 1 }) });
  const start = hero.getByRole('button', { name: 'Start free', exact: true });
  const workspace = hero.getByRole('img', { name: /^The QualCanvas workspace:/ });
  await expect(start).toBeInViewport();
  await expect(workspace).toBeVisible();

  const startBox = (await start.boundingBox())!;
  const workspaceBox = (await workspace.boundingBox())!;
  expect(startBox.y + startBox.height).toBeLessThan(workspaceBox.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

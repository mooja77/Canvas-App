import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('training centre is responsive, accessible and private before play', async ({ page }) => {
  const consoleErrors: string[] = [];
  const earlyYouTubeRequests: string[] = [];
  let playChosen = false;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('request', (request) => {
    if (!playChosen && /(?:youtube|googlevideo|ytimg)\./i.test(new URL(request.url()).hostname)) {
      earlyYouTubeRequests.push(request.url());
    }
  });

  await page.goto('/training', { waitUntil: 'networkidle' });

  await expect(page).toHaveTitle(/QualCanvas Training Centre/);
  await expect(page.getByRole('heading', { name: 'Learn one research outcome at a time.' })).toBeVisible();
  await expect(page.locator('#video-library article')).toHaveCount(18);
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(earlyYouTubeRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);

  const thumbnails = page.locator('#video-library img');
  for (let index = 0; index < (await thumbnails.count()); index += 1) {
    await thumbnails.nth(index).scrollIntoViewIfNeeded();
    await expect(thumbnails.nth(index)).toHaveJSProperty('complete', true);
  }
  const imagesAreLoaded = await thumbnails.evaluateAll((images) =>
    images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
  );
  expect(imagesAreLoaded).toBe(true);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const accessibility = await new AxeBuilder({ page }).exclude('iframe').analyze();
  const seriousViolations = accessibility.violations.filter(
    ({ impact }) => impact === 'serious' || impact === 'critical',
  );
  expect(seriousViolations).toEqual([]);

  const playButtons = page.getByRole('button', { name: /^Play .* connects to YouTube\.$/ });
  const playButtonCount = await playButtons.count();
  const publishingLabels = await page.getByText('Publishing shortly').count();
  expect(playButtonCount + publishingLabels).toBe(18);

  if (playButtonCount > 0) {
    playChosen = true;
    await playButtons.first().click();
    const player = page.locator('iframe').first();
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  }
});

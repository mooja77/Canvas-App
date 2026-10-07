import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ storageState: { cookies: [], origins: [] } });
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 820, height: 1024 },
  { width: 390, height: 844 },
]) {
  test(`the current written guide works by keyboard at ${viewport.width}px`, async ({ page, context }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const mutations: string[] = [];
    const blockedAnalytics: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await context.route('**/*', (route) => {
      const request = route.request();
      const address = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) {
        if (request.method() === 'POST' && address.pathname === '/api/v1/events/track') {
          blockedAnalytics.push(address.pathname);
        } else {
          mutations.push(`${request.method()} ${address.pathname}`);
        }
        return route.abort('blockedbyclient');
      }
      if (!['localhost', '127.0.0.1'].includes(address.hostname)) return route.abort('blockedbyclient');
      return route.continue();
    });
    if (viewport.width === 1280) {
      await page.goto('/pricing');
      await page.getByRole('button', { name: 'Reject non-essential cookies', exact: true }).click();
      await page.getByRole('button', { name: 'Monthly', exact: true }).click();
      const plans = page.getByRole('heading', { name: 'QualCanvas plans' }).locator('xpath=following-sibling::div[1]');
      for (const name of ['Free', 'Student', 'Pro', 'Team', 'Institutions']) {
        await expect(plans.getByRole('heading', { name, exact: true })).toBeVisible();
      }
      await plans.screenshot({ path: test.info().outputPath('current-pricing.png') });
    }
    await page.goto('/guide');
    await expect(page.getByRole('heading', { name: 'QualCanvas Guide', exact: true })).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Guide contents', exact: true });
    if (viewport.width < 1024) {
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Enter');
    }
    const contents = page.getByRole('navigation', { name: 'Guide contents' });
    const analysis = contents.getByRole('button', { name: 'Analysis Tools', exact: true });
    await analysis.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Analysis Tools', exact: true })).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Analysis Tools', exact: true })).toBeInViewport();
    await expect(page.getByText(/Run computation.*again after/)).toBeVisible();
    if (viewport.width < 1024) await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('region', { name: 'Need a hand?' })).toContainText('two business days');
    await expect(page.getByRole('link', { name: /89-second captioned coding lesson/ })).toHaveAttribute(
      'href',
      '/help/first-code.html',
    );
    const sectionCount = await page.locator('main section > h2[id^="guide-heading-"]').count();
    expect(sectionCount).toBe(15);
    for (let index = 0; index < sectionCount; index++) {
      if (viewport.width < 1024) {
        await toggle.focus();
        await page.keyboard.press('Enter');
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      }
      await expect(contents.getByRole('button')).toHaveCount(sectionCount);
      const sectionButton = contents.getByRole('button').nth(index);
      const title = (await sectionButton.innerText()).replace(/^\s*\d+\s*/, '').trim();
      await sectionButton.focus();
      await page.keyboard.press('Enter');
      const heading = page.getByRole('heading', { name: title, exact: true });
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
      if (viewport.width < 1024) await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    const imagePaths = await page
      .locator('main img')
      .evaluateAll((images) => images.map((image) => new URL((image as HTMLImageElement).src).pathname));
    for (const path of new Set(imagePaths)) {
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toMatch(/^image\//);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
    expect(mutations).toEqual([]);
    test.info().annotations.push({
      type: 'read-only boundary',
      description: `All non-GET/HEAD requests blocked; ${blockedAnalytics.length} marketing analytics attempts blocked; zero product mutation attempts.`,
    });
    await page.screenshot({ path: test.info().outputPath(`guide-${viewport.width}.png`), fullPage: false });
  });
}

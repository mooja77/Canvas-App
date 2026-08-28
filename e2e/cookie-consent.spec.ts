import { expect, test } from '@playwright/test';

const gtmPattern = 'https://www.googletagmanager.com/gtm.js**';

test.describe('Cookie consent analytics boundary', () => {
  test('does not request GTM until analytics consent is accepted', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('jms_cookie_consent'));

    let gtmRequests = 0;
    await page.route(gtmPattern, async (route) => {
      gtmRequests += 1;
      await route.fulfill({ contentType: 'application/javascript', body: '' });
    });

    await page.goto('/');

    const banner = page.getByRole('region', { name: 'Cookie consent' });
    await expect(banner).toBeVisible();
    await expect(page.locator('script#google-tag-manager')).toHaveCount(0);
    expect(gtmRequests).toBe(0);

    await banner.getByRole('button', { name: 'Accept all cookies' }).click();

    await expect(page.locator('script#google-tag-manager')).toHaveCount(1);
    await expect.poll(() => gtmRequests).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('jms_cookie_consent'))).toBe('accepted');
  });

  test('keeps GTM unloaded after analytics consent is rejected', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('jms_cookie_consent', 'rejected'));

    let gtmRequests = 0;
    await page.route(gtmPattern, async (route) => {
      gtmRequests += 1;
      await route.fulfill({ contentType: 'application/javascript', body: '' });
    });

    await page.goto('/');

    await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);
    await expect(page.locator('script#google-tag-manager')).toHaveCount(0);
    expect(gtmRequests).toBe(0);
  });

  test('reopens settings and withdraws an accepted choice', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('consent-test-seeded') === '1') return;
      sessionStorage.setItem('consent-test-seeded', '1');
      localStorage.setItem('jms_cookie_consent', 'accepted');
      document.cookie = '_ga=test-value; path=/';
    });
    await page.route(gtmPattern, (route) => route.fulfill({ contentType: 'application/javascript', body: '' }));

    await page.goto('/cookies');
    await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Cookie settings' }).click();
    const banner = page.getByRole('region', { name: 'Cookie consent' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('currently on');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      banner.getByRole('button', { name: 'Reject non-essential cookies' }).click(),
    ]);

    await expect(page.getByRole('region', { name: 'Cookie consent' })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('jms_cookie_consent'))).toBe('rejected');
    expect(await page.evaluate(() => document.cookie)).not.toContain('_ga=');
    await expect(page.locator('script#google-tag-manager')).toHaveCount(0);
  });
});

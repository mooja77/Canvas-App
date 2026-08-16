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
});

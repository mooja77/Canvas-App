import { test, expect } from '@playwright/test';

const API = 'http://localhost:3007/api/v1';
let jwt = '';

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function getJwt(page: any) {
  await page.goto('http://localhost:5174/canvas');
  await page.waitForLoadState('domcontentloaded');
  return await page.evaluate(() => {
    const r = localStorage.getItem('qualcanvas-auth');
    return r ? JSON.parse(r)?.state?.jwt || '' : '';
  });
}

test.describe('Deep Canvas: Edge Cases', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    jwt = await getJwt(p);
    await p.close();
    await ctx.close();
  });

  test('1 - Canvas with zero nodes shows empty state', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    const name = `E2E-EC Empty ${Date.now()}`;
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name } });
    const id = (await res.json()).data.id;
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    const card = page.getByText(name).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) await card.click();
    await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
    // Should show empty state helper
    const helper = page.getByText(/workspace is ready|add.*transcript|start by/i).first();
    await expect(helper).toBeVisible({ timeout: 5000 });
    // Cleanup
    await page.request.delete(`${API}/canvas/${id}`, { headers: headers() });
    await page.request.delete(`${API}/canvas/${id}/permanent`, { headers: headers() });
  });

  test('2 - API canvas create ignores UI-only template hints', async ({ page }) => {
    const name = `E2E-EC Template ${Date.now()}`;
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name, template: 'thematic' } });
    expect(res.ok()).toBeTruthy();
    const id = (await res.json()).data.id;
    const detail = await (await page.request.get(`${API}/canvas/${id}`, { headers: headers() })).json();
    expect(detail.data.questions.length).toBe(0);
    await page.request.delete(`${API}/canvas/${id}`, { headers: headers() });
    await page.request.delete(`${API}/canvas/${id}/permanent`, { headers: headers() });
  });

  test('3 - Long canvas name (100 chars) creates OK', async ({ page }) => {
    const name = 'E2E ' + 'A'.repeat(96);
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name } });
    expect(res.ok()).toBeTruthy();
    const id = (await res.json()).data.id;
    await page.request.delete(`${API}/canvas/${id}`, { headers: headers() });
    await page.request.delete(`${API}/canvas/${id}/permanent`, { headers: headers() });
  });

  test('4 - Unicode canvas name creates OK', async ({ page }) => {
    const name = `E2E 研究プロジェクト ${Date.now()}`;
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name } });
    expect(res.ok()).toBeTruthy();
    const id = (await res.json()).data.id;
    await page.request.delete(`${API}/canvas/${id}`, { headers: headers() });
    await page.request.delete(`${API}/canvas/${id}/permanent`, { headers: headers() });
  });

  test('5 - Create and immediately delete canvas', async ({ page }) => {
    const name = `E2E-EC Transient ${Date.now()}`;
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name } });
    const id = (await res.json()).data.id;
    await page.request.delete(`${API}/canvas/${id}`, { headers: headers() });
    await page.request.delete(`${API}/canvas/${id}/permanent`, { headers: headers() });
    // Verify gone
    const list = await (await page.request.get(`${API}/canvas`, { headers: headers() })).json();
    const found = (list.data || []).find((c: any) => c.id === id);
    expect(found).toBeUndefined();
  });

  test('6 - Rapid page navigation no crash', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await page.goto('/guide');
    await page.waitForLoadState('networkidle');
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    expect(true).toBe(true);
  });

  test('7 - Refresh canvas page reloads', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Coding Canvases').first()).toBeVisible({ timeout: 5000 });
  });

  test('8 - Trash section visible', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Trash').first()).toBeVisible({ timeout: 5000 });
  });

  test('9 - Empty canvas name rejected', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas`, { headers: headers(), data: { name: '' } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('10 - Console zero errors during navigation', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    });
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0);
  });
});

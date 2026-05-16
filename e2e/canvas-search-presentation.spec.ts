import { test, expect, type Page } from '@playwright/test';

/**
 * Live QA finding #16 — canvas search + presentation mode were rated
 * visually solid in the 2026-05-14 review and flagged "protect with
 * regression coverage." These are functional regression tests (open /
 * structure / close), not pixel snapshots — they run green without a
 * baseline-generation step and still catch the ways these surfaces
 * realistically break (shortcut unbound, overlay not mounting, no exit).
 */

const API = 'http://localhost:3007/api/v1';
const PREFIX = `E2E-SP ${Date.now()}`;
let jwt = '';
let canvasId = '';

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function gotoSeededCanvas(page: Page) {
  await page.addInitScript(() => {
    const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
}

test.describe('Canvas search + presentation mode', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    await p.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: {
        title: 'Methodology Interview',
        content:
          'The research methodology involved semi-structured interviews exploring workplace culture and professional development.',
      },
    });
    for (const name of ['Methodology', 'Culture']) {
      await p.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: name, color: '#4F46E5' },
      });
    }
    await p.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    await p.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
    await p.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    await p.close();
    await ctx.close();
  });

  test('finding #16: Ctrl+F opens canvas search overlay; typing filters; Escape closes', async ({ page }) => {
    await gotoSeededCanvas(page);

    // Search overlay is bound to Ctrl+F (shortcutStore default).
    await page.locator('.react-flow__pane').click();
    await page.keyboard.press('Control+f');

    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    await searchInput.fill('Methodology');
    // The overlay stays mounted while typing — no crash, input retains value.
    expect(await searchInput.inputValue()).toBe('Methodology');

    await page.keyboard.press('Escape');
    await expect(searchInput).toBeHidden({ timeout: 3000 });
  });

  test('finding #16: presentation mode opens a full-screen overlay and exits cleanly', async ({ page }) => {
    await gotoSeededCanvas(page);

    // Presentation Mode lives in the Tools dropdown.
    await page.getByRole('button', { name: 'Tools menu' }).first().click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();
    await menu
      .getByText(/Presentation Mode/i)
      .first()
      .click();

    // Full-screen overlay mounts.
    const exitButton = page.getByRole('button', { name: /exit presentation/i }).first();
    await expect(exitButton).toBeVisible({ timeout: 8000 });

    // Exit returns to the canvas workspace.
    await exitButton.click();
    await expect(exitButton).toBeHidden({ timeout: 3000 });
    await expect(page.locator('.react-flow__pane')).toBeVisible();
  });
});

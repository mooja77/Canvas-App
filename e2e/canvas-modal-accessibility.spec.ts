import { test, expect, type Page } from '@playwright/test';

/**
 * Sprint 1C — modal accessibility verification (live QA finding #5).
 *
 * Every canvas modal must expose role="dialog" + aria-modal="true" +
 * aria-labelledby, and have a Close control reachable by accessible name.
 * Code Weighting's star-rating buttons must have "Rate N stars" labels.
 *
 * Coverage: the four remaining modals reachable through the Tools dropdown
 * (Weights, Ethics, Excerpts, Codebook). RichExportModal received the
 * identical markup change but lives in the Export dropdown; ShareCanvas
 * already had dialog semantics pre-Sprint-1C. Codebook was added in a
 * follow-up after a prod a11y audit found it missing the same attributes.
 *
 * Project Overview (formerly the Dashboard modal) was converted to a
 * non-modal docked side panel in the F14 follow-up — it has its own
 * separate non-modal a11y assertions below since a complementary landmark
 * is the right semantic, not a dialog.
 */

const API = 'http://localhost:3007/api/v1';
const PREFIX = `E2E-MA ${Date.now()}`;
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

async function openToolsItem(page: Page, itemLabel: string | RegExp) {
  await page.getByRole('button', { name: 'Tools menu' }).first().click();
  const menu = page.getByRole('menu').first();
  await expect(menu).toBeVisible();
  await menu.getByText(itemLabel).first().click();
}

test.describe('Canvas modal accessibility', () => {
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
    const tRes = await p.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: {
        title: 'Modal A11y Interview',
        content:
          'The research methodology involved semi-structured interviews exploring workplace culture and professional development across multiple institutions.',
      },
    });
    const transcriptId = (await tRes.json()).data.id;
    const qRes = await p.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Methodology', color: '#4F46E5' },
    });
    const questionId = (await qRes.json()).data.id;
    // A coding so Code Weighting has a row with star-rating controls.
    await p.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: {
        transcriptId,
        questionId,
        startOffset: 0,
        endOffset: 31,
        codedText: 'The research methodology involved',
      },
    });
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

  const MODALS = [
    { name: 'Code Weighting', toolsItem: /^Weights$/ },
    { name: 'Ethics & Compliance', toolsItem: /^Ethics$/ },
    { name: 'Excerpt Browser', toolsItem: /^Excerpts$/ },
    { name: 'Codebook Export', toolsItem: /^Codebook$/ },
  ] as const;

  for (const modal of MODALS) {
    test(`finding #5: ${modal.name} modal exposes dialog semantics + named Close`, async ({ page }) => {
      await gotoSeededCanvas(page);
      await openToolsItem(page, modal.toolsItem);

      const dialog = page.getByRole('dialog').first();
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
      // aria-labelledby must point at an element that exists.
      const labelledBy = await dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      await expect(page.locator(`#${labelledBy}`)).toHaveCount(1);

      // Close reachable by accessible name.
      const closeBtn = page.getByRole('button', { name: /^Close$/i }).first();
      await expect(closeBtn).toBeVisible();
      await closeBtn.click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }

  test('F14: Project Overview side panel exposes complementary landmark + named Close + Esc-to-close', async ({
    page,
  }) => {
    await gotoSeededCanvas(page);
    await openToolsItem(page, /^Dashboard$/);

    // Non-modal side panel — landmark, not a dialog.
    const panel = page.getByTestId('project-overview-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel).toHaveRole('complementary');
    const labelledBy = await panel.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    await expect(page.locator(`#${labelledBy}`)).toHaveCount(1);

    // No backdrop covers the canvas — the React Flow pane is still hit-testable.
    await expect(page.locator('.react-flow__pane')).toBeVisible();

    // Close by accessible name closes the panel.
    await panel.getByRole('button', { name: /^Close$/i }).click();
    await expect(page.getByTestId('project-overview-panel')).toHaveCount(0);

    // Re-open and verify Esc closes too (matches the dismiss gesture of other panels).
    await openToolsItem(page, /^Dashboard$/);
    await expect(page.getByTestId('project-overview-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('project-overview-panel')).toHaveCount(0);
  });

  test('F14 follow-up: opening the side panel shifts the minimap so it stays visible', async ({ page }) => {
    // Live QA finding (2026-05-20): the minimap was completely covered by the
    // 400px-wide Dashboard panel because both anchor to the bottom-right of the
    // viewport. The CSS `body:has([data-side-panel="right"])` rule translates
    // the minimap left so it sits to the left of the panel.
    await gotoSeededCanvas(page);
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 10000 });
    const beforeBox = await minimap.boundingBox();
    expect(beforeBox).not.toBeNull();

    await openToolsItem(page, /^Dashboard$/);
    const panel = page.getByTestId('project-overview-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Wait for the 200ms transform transition to settle before measuring.
    await page.waitForTimeout(350);
    const afterBox = await minimap.boundingBox();
    const panelBox = await panel.boundingBox();
    expect(afterBox).not.toBeNull();
    expect(panelBox).not.toBeNull();

    // Minimap must have moved left.
    expect(afterBox!.x).toBeLessThan(beforeBox!.x);
    // Minimap right edge must be to the left of the panel left edge — i.e. no overlap.
    expect(afterBox!.x + afterBox!.width).toBeLessThanOrEqual(panelBox!.x);
  });

  test('finding #5: Code Weighting star buttons have Rate N stars labels', async ({ page }) => {
    await gotoSeededCanvas(page);
    await openToolsItem(page, /^Weights$/);
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 10000 });

    // Each star control 1-5 must be reachable by an accessible name.
    for (let stars = 1; stars <= 5; stars++) {
      const label = new RegExp(`Rate ${stars} star${stars === 1 ? '' : 's'}`, 'i');
      await expect(page.getByRole('button', { name: label }).first()).toBeVisible();
    }
  });
});

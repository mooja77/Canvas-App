import type { Page } from '@playwright/test';

const API_BASE = 'http://localhost:3007/api';

async function apiHeaders(page: Page) {
  const jwt = await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function createSeededCanvas(page: Page): Promise<string | null> {
  const headers = await apiHeaders(page);
  if (!headers.Authorization.endsWith(' ')) {
    const createRes = await page.request.post(`${API_BASE}/canvas`, {
      headers,
      data: { name: `E2E Test Canvas ${Date.now()}` },
    });
    if (!createRes.ok()) return null;
    const canvasId = (await createRes.json()).data?.id;
    if (!canvasId) return null;

    const transcriptRes = await page.request.post(`${API_BASE}/canvas/${canvasId}/transcripts`, {
      headers,
      data: {
        title: 'E2E Test Interview',
        content:
          'The research methodology involved semi-structured interviews with participants discussing workplace culture, professional development, and organizational change.',
      },
    });
    const transcriptId = transcriptRes.ok() ? (await transcriptRes.json()).data?.id : null;

    const questionRes = await page.request.post(`${API_BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Research Methods', color: '#4F46E5' },
    });
    const questionId = questionRes.ok() ? (await questionRes.json()).data?.id : null;

    await page.request.post(`${API_BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Participant Demographics', color: '#059669' },
    });

    if (transcriptId && questionId) {
      await page.request.post(`${API_BASE}/canvas/${canvasId}/codings`, {
        headers,
        data: {
          transcriptId,
          questionId,
          startOffset: 0,
          endOffset: 31,
          codedText: 'The research methodology involved',
        },
      });
    }

    return canvasId;
  }
  return null;
}

/**
 * Shared helper to open a canvas for E2E testing.
 * Handles: onboarding dismissal, empty canvas creation, node waiting.
 */
export async function openCanvas(page: Page) {
  // Ensure onboarding tour is dismissed
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = {
      ...state.state,
      onboardingComplete: true,
      setupWizardComplete: true,
      scrollMode: 'zoom',
    };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });

  await page.goto('/canvas');
  await page.waitForLoadState('networkidle');

  // If no canvases, create one via the UI
  const emptyState = page.getByText('Create your first canvas');
  if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
    const canvasId = await createSeededCanvas(page);
    if (canvasId) {
      await page.goto(`/canvas/${canvasId}`);
      await page.waitForLoadState('networkidle');
    } else {
      await page
        .getByRole('button', { name: /New Canvas|Get Started/i })
        .first()
        .click();
      const inputs = page.locator('input[type="text"], input:not([type])');
      for (let i = 0; i < (await inputs.count()); i++) {
        const input = inputs.nth(i);
        const val = await input.inputValue();
        if (!val || val === '') {
          await input.fill('E2E Test Canvas');
          break;
        }
      }
      const createBtn = page.getByRole('button', { name: /Create Canvas/i });
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForLoadState('networkidle');
      }
    }
  }

  // Click first canvas card if on list page
  const heading = page.locator('h3').first();
  const paneAlreadyVisible = await page
    .locator('.react-flow__pane')
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (!paneAlreadyVisible && (await heading.isVisible({ timeout: 3000 }).catch(() => false))) {
    await heading.click();
  }

  // Wait for ReactFlow pane
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // Dismiss any remaining tour overlay
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (
    await skipBtn
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await skipBtn.first().click();
  }
  const overlay = page.locator('.fixed.inset-0.z-\\[10000\\]');
  if (await overlay.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.keyboard.press('Escape');
  }
}

export function getViewportTransform(page: Page) {
  return page.evaluate(() => {
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!vp) return null;
    const match = vp.style.transform.match(/translate\((.+?)px,\s*(.+?)px\)\s*scale\((.+?)\)/);
    if (!match) return null;
    return { x: parseFloat(match[1]), y: parseFloat(match[2]), scale: parseFloat(match[3]) };
  });
}

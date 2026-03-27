import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';

const AUTH_FILE = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  // Expand the "Sign In with Code" disclosure section
  await page.getByText('Sign In with Code').first().click();
  const codeInput = page.locator('input').last();
  await codeInput.waitFor({ state: 'visible' });
  await codeInput.fill('CANVAS-DEMO2025');

  // Click the submit button (type="submit") inside the code form
  const signInBtn = page.locator('button[type="submit"]').filter({ hasText: /Sign In with Code/i });
  await expect(signInBtn).toBeEnabled({ timeout: 5000 });
  await signInBtn.click();

  // Wait for navigation
  await page.waitForURL('**/canvas**', { timeout: 20000 });
  await expect(page.getByText('Coding Canvases')).toBeVisible({ timeout: 5000 });

  // Mark onboarding tour as complete so it doesn't block E2E tests.
  // The uiStore uses Zustand persist with key 'qualcanvas-ui'.
  await page.evaluate(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });

  // ─── Seed test data so E2E tests that require nodes don't skip ───

  // Extract the JWT from the persisted Zustand auth store in localStorage
  const jwt = await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.jwt || null;
  });

  if (jwt) {
    const baseUrl = 'http://localhost:3007/api';
    const headers = {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    };

    // Check if user already has canvases and find one to seed
    const canvasListRes = await page.request.get(`${baseUrl}/canvas`, { headers });
    const canvasList = await canvasListRes.json();
    const canvases = canvasList?.data || [];

    // Find the first canvas (the one openCanvas will click) and ensure it has content.
    // The canvas list is sorted newest-first, so the first canvas is what tests will open.
    const firstCanvas = canvases[0];
    const needsSeeding = !firstCanvas || (firstCanvas._count?.transcripts === 0 && firstCanvas._count?.questions === 0);

    if (needsSeeding) {
      // Determine canvas ID — create one if none exist, otherwise seed the empty first canvas
      let canvasId: string;
      if (!firstCanvas) {
        const createCanvasRes = await page.request.post(`${baseUrl}/canvas`, {
          headers,
          data: { name: 'E2E Test Canvas' },
        });
        const canvasData = await createCanvasRes.json();
        canvasId = canvasData?.data?.id;
      } else {
        canvasId = firstCanvas.id;
      }

      if (canvasId) {
        // Add a transcript with ~100 words
        const sampleText = [
          'The research methodology involved conducting semi-structured interviews with fifteen participants',
          'from diverse backgrounds across three different institutions. Each interview lasted approximately',
          'sixty minutes and was recorded with the consent of the participant. The interviews explored themes',
          'of professional development, workplace culture, and personal motivation. Participants described',
          'their experiences navigating organizational change and adapting to new technologies in their daily',
          'work routines. Several common patterns emerged from the data, including the importance of peer',
          'support networks, the challenge of balancing competing priorities, and the role of institutional',
          'leadership in fostering innovation. These findings suggest that successful adaptation requires both',
          'individual resilience and supportive organizational structures that enable continuous learning',
          'and collaborative problem solving within professional communities.',
        ].join(' ');

        const transcriptRes = await page.request.post(`${baseUrl}/canvas/${canvasId}/transcripts`, {
          headers,
          data: { title: 'E2E Test Interview', content: sampleText },
        });
        const transcriptData = await transcriptRes.json();
        const transcriptId = transcriptData?.data?.id;

        // Add 2 test codes (questions)
        const code1Res = await page.request.post(`${baseUrl}/canvas/${canvasId}/questions`, {
          headers,
          data: { text: 'Professional Development', color: '#4F46E5' },
        });
        const code1Data = await code1Res.json();
        const code1Id = code1Data?.data?.id;

        await page.request.post(`${baseUrl}/canvas/${canvasId}/questions`, {
          headers,
          data: { text: 'Organizational Culture', color: '#059669' },
        });

        // Create a coding linking transcript to a code
        if (transcriptId && code1Id) {
          await page.request.post(`${baseUrl}/canvas/${canvasId}/codings`, {
            headers,
            data: {
              transcriptId,
              questionId: code1Id,
              startOffset: 0,
              endOffset: 91,
              codedText: 'The research methodology involved conducting semi-structured interviews with fifteen participants',
            },
          });
        }
      }
    }

    // Reload so the seeded data is picked up by the canvas page state
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
  }

  // Save auth state (localStorage + cookies)
  await page.context().storageState({ path: AUTH_FILE });
});

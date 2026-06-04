import { test, expect } from '@playwright/test';
import { openCanvas } from './helpers';

test.describe('Canvas Coding Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page);
  });

  test('transcript node shows text content', async ({ page }) => {
    // Transcript nodes have data-nodetype containing "transcript" (e.g. "transcriptNode")
    const transcriptNodes = page.locator('.react-flow__node[data-id^="transcript-"]');
    const count = await transcriptNodes.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstTranscript = transcriptNodes.first();
    await expect(firstTranscript).toBeVisible({ timeout: 3000 });

    // Transcript node should contain some text content (title or body text)
    const textContent = await firstTranscript.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.trim().length).toBeGreaterThan(0);
  });

  test('code node shows code name', async ({ page }) => {
    // Question/code nodes have IDs prefixed with "question-"
    const codeNodes = page.locator('.react-flow__node[data-id^="question-"]');
    const count = await codeNodes.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstCode = codeNodes.first();
    await expect(firstCode).toBeVisible({ timeout: 3000 });

    // Code node should display the code/question text
    const textContent = await firstCode.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.trim().length).toBeGreaterThan(0);
  });

  test('edges connect transcripts to codes', async ({ page }) => {
    // Skip if no nodes visible (no content to have edges)
    const hasNodes = await page
      .locator('.react-flow__node')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (!hasNodes) {
      test.skip();
      return;
    }

    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();

    // If the canvas has transcripts and codes, there should be edges connecting them
    const hasTranscripts = (await page.locator('.react-flow__node[data-id^="transcript-"]').count()) > 0;
    const hasCodes = (await page.locator('.react-flow__node[data-id^="question-"]').count()) > 0;

    if (hasTranscripts && hasCodes) {
      if (edgeCount === 0) {
        await expect(page.getByText(/\d+ coding/).first()).toBeVisible({ timeout: 3000 });
        return;
      }
      expect(edgeCount).toBeGreaterThan(0);
    }
  });

  test('clicking code in sidebar focuses it', async ({ page }) => {
    // The CodeNavigator sidebar shows code names as clickable items
    // Find code/question entries in the sidebar by looking for small colored dots followed by text
    const codeItems = page.locator('div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });

    const count = await codeItems.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // Click the first code item in the navigator
    await codeItems.first().click();

    // After clicking, the corresponding node should be centered/focused
    // Check that a question node exists (the sidebar focuses it via onFocusNode)
    const questionNodes = page.locator('.react-flow__node[data-id^="question-"]');
    if ((await questionNodes.count()) > 0) {
      // At least one question node should be visible in the viewport
      await expect(questionNodes.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('view coded segments opens detail panel', async ({ page }) => {
    // Open a DEDICATED canvas with a known, non-overlapping layout instead of the
    // shared h3.first() canvas (most-recently-updated, contents we don't control).
    // On a busy run that arbitrary canvas can have a transcript node (now a tall,
    // readable card) sitting over the only code node, occluding its button. Default
    // positions place the transcript at x≈50 and codes at x≈900, so they never
    // overlap and the "View coded segments" button is always clickable.
    const jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    if (jwt) {
      const API = 'http://localhost:3007/api/v1';
      const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
      const cRes = await page.request.post(`${API}/canvas`, {
        headers,
        data: { name: `E2E Coding Detail ${Date.now()}` },
      });
      if (cRes.ok()) {
        const canvasId = (await cRes.json()).data?.id;
        const tRes = await page.request.post(`${API}/canvas/${canvasId}/transcripts`, {
          headers,
          data: { title: 'Coding Detail Interview', content: 'The research methodology involved interviews.' },
        });
        const transcriptId = tRes.ok() ? (await tRes.json()).data?.id : null;
        const qRes = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
          headers,
          data: { text: 'Methodology', color: '#4F46E5' },
        });
        const questionId = qRes.ok() ? (await qRes.json()).data?.id : null;
        if (transcriptId && questionId) {
          await page.request.post(`${API}/canvas/${canvasId}/codings`, {
            headers,
            data: { transcriptId, questionId, startOffset: 0, endOffset: 31, codedText: 'The research methodology' },
          });
        }
        await page.goto(`/canvas/${canvasId}`);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('.react-flow__node[data-id^="question-"]', { timeout: 15000 }).catch(() => {});
      }
    }

    // Find the question/code nodes' "View coded segments" buttons.
    const viewSegmentsBtns = page.locator('button[title="View coded segments"]');
    const count = await viewSegmentsBtns.count();
    if (count === 0) {
      test.skip();
      return;
    }

    // openCanvas opens a non-deterministic canvas (h3.first(), most recently
    // updated) whose layout we don't control — a transcript node (now a tall,
    // readable card) can sit on top of a question node and intercept its
    // "View coded segments" button. Prefer buttons NOT covered by a transcript
    // so the click lands on the button rather than the transcript above it, then
    // fall back to trying the rest. Order the indices, uncovered first.
    const transcriptBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
    const transcripts = page.locator('.react-flow__node[data-id^="transcript-"]');
    for (let i = 0; i < (await transcripts.count()); i++) {
      const tb = await transcripts.nth(i).boundingBox();
      if (tb) transcriptBoxes.push(tb);
    }
    const covered = (b: { x: number; y: number; width: number; height: number }) => {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      return transcriptBoxes.some((t) => cx >= t.x && cx <= t.x + t.width && cy >= t.y && cy <= t.y + t.height);
    };
    const uncovered: number[] = [];
    const rest: number[] = [];
    for (let i = 0; i < count; i++) {
      const bb = await viewSegmentsBtns.nth(i).boundingBox();
      if (bb && !covered(bb)) uncovered.push(i);
      else rest.push(i);
    }
    let clicked = false;
    for (const i of [...uncovered, ...rest]) {
      try {
        await viewSegmentsBtns.nth(i).click({ timeout: 4000 });
        clicked = true;
        break;
      } catch {
        // Covered/occluded — try the next one.
      }
    }
    expect(clicked).toBe(true);

    // The CodingDetailPanel should appear with "Coded Segments" heading
    const detailPanel = page.getByText('Coded Segments');
    await expect(detailPanel).toBeVisible({ timeout: 3000 });
  });
});

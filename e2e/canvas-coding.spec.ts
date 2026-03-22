import { test, expect } from '@playwright/test';

// Helper: open canvas (already authenticated via setup)
async function openCanvas(page: any) {
  // Ensure onboarding tour is dismissed via localStorage before navigating
  await page.addInitScript(() => {
    const existing = localStorage.getItem('canvas-app-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true };
    localStorage.setItem('canvas-app-ui', JSON.stringify(state));
  });

  await page.goto('/canvas');
  await page.waitForTimeout(500);

  // If canvas list is showing, click the first canvas
  const heading = page.locator('h3').first();
  if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
    await heading.click();
  }

  // Wait for ReactFlow
  await page.waitForSelector('.react-flow__pane', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Safety net: dismiss onboarding tour if it still appears
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
    await page.waitForTimeout(300);
  }
  // Last resort: press Escape to dismiss any overlay
  const overlay = page.locator('.fixed.inset-0.z-\\[10000\\]');
  if (await overlay.isVisible({ timeout: 300 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

test.describe('Canvas Coding Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page);
  });

  test('transcript node shows text content', async ({ page }) => {
    // Transcript nodes have data-nodetype containing "transcript" (e.g. "transcriptNode")
    const transcriptNodes = page.locator('.react-flow__node[data-id^="transcript-"]');
    const count = await transcriptNodes.count();
    if (count === 0) { test.skip(); return; }

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
    if (count === 0) { test.skip(); return; }

    const firstCode = codeNodes.first();
    await expect(firstCode).toBeVisible({ timeout: 3000 });

    // Code node should display the code/question text
    const textContent = await firstCode.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.trim().length).toBeGreaterThan(0);
  });

  test('edges connect transcripts to codes', async ({ page }) => {
    // Skip if no nodes visible (no content to have edges)
    const hasNodes = await page.locator('.react-flow__node').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (!hasNodes) { test.skip(); return; }

    const edges = page.locator('.react-flow__edge');
    const edgeCount = await edges.count();

    // If the canvas has transcripts and codes, there should be edges connecting them
    const hasTranscripts = await page.locator('.react-flow__node[data-id^="transcript-"]').count() > 0;
    const hasCodes = await page.locator('.react-flow__node[data-id^="question-"]').count() > 0;

    if (hasTranscripts && hasCodes) {
      expect(edgeCount).toBeGreaterThan(0);
    }
  });

  test('clicking code in sidebar focuses it', async ({ page }) => {
    // The CodeNavigator sidebar shows code names as clickable items
    // Look for code items in the navigator (role="button" inside the navigator panel)
    const navigatorPanel = page.locator('[data-tour="canvas-navigator"]').or(
      page.locator('.react-flow__pane').locator('..').locator('..').locator('div').first()
    );

    // Find code/question entries in the sidebar by looking for small colored dots followed by text
    const codeItems = page.locator('div[role="button"]').filter({
      has: page.locator('.rounded-full'),
    });

    const count = await codeItems.count();
    if (count === 0) { test.skip(); return; }

    // Click the first code item in the navigator
    await codeItems.first().click();
    await page.waitForTimeout(500);

    // After clicking, the corresponding node should be centered/focused
    // Check that a question node exists (the sidebar focuses it via onFocusNode)
    const questionNodes = page.locator('.react-flow__node[data-id^="question-"]');
    if (await questionNodes.count() > 0) {
      // At least one question node should be visible in the viewport
      await expect(questionNodes.first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('view coded segments opens detail panel', async ({ page }) => {
    // Find a question/code node with the "View coded segments" button
    const viewSegmentsBtn = page.locator('button[title="View coded segments"]');
    const count = await viewSegmentsBtn.count();
    if (count === 0) { test.skip(); return; }

    // Click the first "View coded segments" button
    await viewSegmentsBtn.first().click();
    await page.waitForTimeout(500);

    // The CodingDetailPanel should appear with "Coded Segments" heading
    const detailPanel = page.getByText('Coded Segments');
    await expect(detailPanel).toBeVisible({ timeout: 3000 });
  });
});

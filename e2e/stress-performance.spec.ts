import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:3007/api';
const AUTH_FILE = 'e2e/.auth/user.json';

async function getJwt(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
}

async function apiHeaders(page: Page) {
  if (page.url() === 'about:blank') {
    await page.goto('/canvas');
    await page.waitForLoadState('domcontentloaded');
  }
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

function generateTranscript(index: number): string {
  const paragraphs = [
    `Interviewer: Can you tell me about your experience with the research process in study ${index}?`,
    `Participant: It has been quite challenging but rewarding. The initial phase involved extensive literature review and methodology design. We spent several months just defining the scope and ensuring our approach was rigorous enough for publication.`,
    `Interviewer: What were the main obstacles you encountered?`,
    `Participant: The biggest challenge was recruitment. Finding participants who met our criteria took longer than expected. We also faced ethical considerations around informed consent and data privacy that required additional protocol revisions.`,
    `Interviewer: How did your team collaborate during the analysis phase?`,
    `Participant: We used a combination of independent coding followed by consensus meetings. Each team member would code the same transcripts separately, then we would compare and discuss discrepancies. This intercoder reliability process was time-consuming but essential for trustworthiness.`,
    `Interviewer: What insights emerged from the analysis?`,
    `Participant: The most surprising finding was the disconnect between what participants said explicitly and their behavioral patterns. Thematic analysis revealed underlying tensions around organizational culture that were not immediately apparent in surface-level responses.`,
  ];
  return paragraphs.join('\n\n');
}

test.describe.serial('Stress Performance', () => {
  test.describe.configure({ timeout: 120_000 });

  let canvasId: string;
  let transcriptIds: string[] = [];
  let codeIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);

    // Create canvas
    const createRes = await page.request.post(`${BASE}/canvas`, {
      headers,
      data: { name: `StressTest-${Date.now()}` },
    });
    canvasId = (await createRes.json()).data.id;

    // Create 20 transcripts (~500 words each)
    for (let i = 0; i < 20; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
        headers,
        data: { title: `Interview ${i + 1}`, content: generateTranscript(i) },
      });
      transcriptIds.push((await res.json()).data.id);
    }

    // Create 30 codes
    const colors = [
      '#EF4444',
      '#F59E0B',
      '#10B981',
      '#3B82F6',
      '#8B5CF6',
      '#EC4899',
      '#6366F1',
      '#14B8A6',
      '#F97316',
      '#84CC16',
    ];
    for (let i = 0; i < 30; i++) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
        headers,
        data: { text: `Theme ${i + 1}`, color: colors[i % 10] },
      });
      codeIds.push((await res.json()).data.id);
    }

    // Create 200 codings (distributed across transcripts and codes)
    const content = generateTranscript(0);
    const contentLen = content.length;
    for (let i = 0; i < 200; i++) {
      const startOffset = Math.floor((i / 200) * (contentLen - 50));
      const endOffset = Math.min(startOffset + 30 + (i % 20), contentLen);
      const codedText = content.substring(startOffset, endOffset);

      await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
        headers,
        data: {
          transcriptId: transcriptIds[i % 20],
          questionId: codeIds[i % 30],
          startOffset,
          endOffset,
          codedText,
        },
      });
    }

    await page.close();
  }, 120000); // 2 minute timeout for setup

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: AUTH_FILE });
    const headers = await apiHeaders(page);
    try {
      await page.request.delete(`${BASE}/canvas/${canvasId}`, { headers });
      await page.request.delete(`${BASE}/canvas/${canvasId}/permanent`, { headers });
    } catch {
      /* best-effort */
    }
    await page.close();
  });

  test('1 - large canvas loads within 30 seconds', async ({ page }) => {
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    const start = Date.now();
    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 30000 });
    const elapsed = Date.now() - start;

    console.log(`Canvas load time: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(30000);

    // Verify the canvas rendered and the large fixture exists. React Flow
    // virtualizes off-screen nodes, so DOM count is not the canonical count.
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBeGreaterThan(0);
    const detail = await (
      await page.request.get(`${BASE}/canvas/${canvasId}`, { headers: await apiHeaders(page) })
    ).json();
    expect(detail.data.transcripts.length + detail.data.questions.length).toBeGreaterThan(40);
  });

  test('2 - zoom is responsive on large canvas', async ({ page }) => {
    await page.addInitScript(() => {
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });

    await page.goto(`/canvas/${canvasId}`);
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const pane = page.locator('.react-flow__pane');
    const box = await pane.boundingBox();
    expect(box).toBeTruthy();

    // Perform 5 zoom actions
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.wheel(0, i % 2 === 0 ? -100 : 100);
      await page.waitForTimeout(200);
    }
    const elapsed = Date.now() - start;

    console.log(`5 zoom operations: ${elapsed}ms`);
    // Should complete all 5 zooms in under 5 seconds
    expect(elapsed).toBeLessThan(5000);

    // Canvas still responsive
    await expect(pane).toBeVisible();
  });

  test('3 - stats analysis completes under 10s', async ({ page }) => {
    const headers = await apiHeaders(page);

    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'stats', label: 'Stress Stats' },
    });
    const nodeId = (await createRes.json()).data.id;

    const start = Date.now();
    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    const elapsed = Date.now() - start;
    const result = await runRes.json();

    console.log(`Stats analysis: ${elapsed}ms, success: ${result.success}`);
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(10000);

    // Cleanup
    await page.request.delete(`${BASE}/canvas/${canvasId}/computed/${nodeId}`, { headers });
  });

  test('4 - wordcloud analysis completes under 10s', async ({ page }) => {
    const headers = await apiHeaders(page);

    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'wordcloud', label: 'Stress WordCloud' },
    });
    const nodeId = (await createRes.json()).data.id;

    const start = Date.now();
    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    const elapsed = Date.now() - start;
    const result = await runRes.json();

    console.log(`WordCloud analysis: ${elapsed}ms, success: ${result.success}`);
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(10000);

    await page.request.delete(`${BASE}/canvas/${canvasId}/computed/${nodeId}`, { headers });
  });

  test('5 - cooccurrence analysis completes under 15s', async ({ page }) => {
    const headers = await apiHeaders(page);

    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'cooccurrence', label: 'Stress Cooccurrence' },
    });
    const nodeId = (await createRes.json()).data.id;

    const start = Date.now();
    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    const elapsed = Date.now() - start;
    const result = await runRes.json();

    console.log(`Co-occurrence analysis: ${elapsed}ms, success: ${result.success}`);
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(15000);

    await page.request.delete(`${BASE}/canvas/${canvasId}/computed/${nodeId}`, { headers });
  });

  test('6 - clustering analysis completes under 15s', async ({ page }) => {
    const headers = await apiHeaders(page);

    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'cluster', label: 'Stress Cluster' },
    });
    const nodeId = (await createRes.json()).data.id;

    const start = Date.now();
    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    const elapsed = Date.now() - start;
    const result = await runRes.json();

    console.log(`Clustering analysis: ${elapsed}ms, success: ${result.success}`);
    expect(result.success).toBe(true);
    expect(elapsed).toBeLessThan(15000);

    await page.request.delete(`${BASE}/canvas/${canvasId}/computed/${nodeId}`, { headers });
  });
});

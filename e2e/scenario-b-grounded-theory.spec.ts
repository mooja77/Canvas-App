import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * Scenario B: Experienced Researcher — Grounded Theory Study of Teacher Burnout
 *
 * Prof. David Okafor studies teacher burnout using grounded theory.
 * He imports 3 transcripts, creates emergent codes, refines through
 * merging/renaming, creates a code hierarchy, and iterates analysis.
 */

const API = 'http://localhost:3007/api';

// ─── Transcript content (~400 words each) ───

const TRANSCRIPT_1 = {
  title: 'High School Teacher, 15 years',
  content:
    'I have been teaching high school math for fifteen years now, and I can tell you the burnout is real. ' +
    'Every year they pile on more responsibilities without taking anything away. Last semester I was teaching six classes, ' +
    'coaching the math team, running after-school tutoring, and serving on three committees. The workload is simply unsustainable. ' +
    'My principal keeps saying we need to do more with less, but at some point you run out of less to give. ' +
    'The administrative pressure is relentless. We have mandatory data tracking meetings every week where we justify our existence ' +
    'through test scores. If a student fails, it is somehow my fault, never the system that puts forty kids in a room designed for twenty-five. ' +
    'I used to love lesson planning, creating activities that would spark curiosity. Now I just follow the scripted curriculum because ' +
    'there is no time for creativity. The emotional exhaustion hits me hardest on Sunday nights. I get this dread in my stomach knowing ' +
    'another week is starting. My wife says I am not the same person she married. I used to be enthusiastic and energetic. Now I just ' +
    'survive from one break to the next. I have developed coping strategies over the years. I meditate in the morning before school. ' +
    'I set boundaries about not checking email after seven PM. But these feel like band-aids on a broken system. ' +
    'I do not feel like a teacher anymore. I feel like a data entry clerk who occasionally gets to interact with young people. ' +
    'The identity erosion is the worst part. I went into this profession to make a difference, and now I wonder if I am making any difference at all.',
};

const TRANSCRIPT_2 = {
  title: 'Elementary Teacher, 8 years',
  content:
    'Teaching second grade has always been my dream, but after eight years the emotional labor is taking its toll. ' +
    'Every day I am not just teaching reading and math, I am counseling children through family crises, mediating playground ' +
    'conflicts, and trying to meet the needs of twenty-four unique little humans. The emotional exhaustion is overwhelming some days. ' +
    'Parent conflict has become a major source of stress. Last month a parent emailed me at eleven PM demanding to know why her child ' +
    'got a B instead of an A on a spelling test. When I did not respond immediately, she went to the principal. The lack of support ' +
    'from administration in these situations is demoralizing. They always side with the parents because they are afraid of complaints. ' +
    'I spend my own money on classroom supplies because the budget was cut again. We got fifty dollars for the entire year. Fifty dollars ' +
    'for art supplies, science materials, books, and everything else. The resource shortage means I am constantly fundraising and begging ' +
    'for donations. Student motivation keeps me going though. When a struggling reader finally decodes a sentence and their face lights up, ' +
    'that is pure magic. But those moments are getting rarer as I become more exhausted. My coping strategies include a teacher support ' +
    'group that meets online every Thursday night. We vent, we share resources, we remind each other why we started. Without that group, ' +
    'I probably would have quit by now. The burnout manifests physically too. I have had three sinus infections this year because my ' +
    'immune system is shot from the stress. I do not feel valued by the system that employs me.',
};

const TRANSCRIPT_3 = {
  title: 'Special Ed Teacher, 12 years',
  content:
    'Special education is a calling, but the systemic issues make it nearly impossible to do the job well. ' +
    'I have a caseload of twenty-eight students with IEPs, which is twelve more than the recommended maximum. The resource shortage ' +
    'in special ed is criminal. I share a classroom aide with two other teachers, so I effectively have support for about ninety minutes ' +
    'a day. For the rest of it, I am alone with students who need intensive one-on-one attention. The systemic issues go deeper than ' +
    'funding. The paperwork for IEP compliance takes about fifteen hours per week. That is fifteen hours I could spend actually helping ' +
    'kids. The lack of support from the district is stunning. They mandate compliance but provide no additional time or staffing to achieve it. ' +
    'The emotional exhaustion in special ed is unique because you form such deep bonds with your students. When a student you have worked ' +
    'with for three years ages out of your program and you know the next placement is inadequate, it breaks your heart. I carry that grief. ' +
    'I have watched colleagues leave one by one. Five special ed teachers have left our district in the past two years. None were replaced ' +
    'with certified special ed teachers. They hired long-term subs instead. The identity erosion happens when you realize the system does ' +
    'not value the students you serve. If they did, they would fund the programs properly. My students deserve better. I stay because ' +
    'leaving feels like abandoning the most vulnerable kids in the building. But staying is destroying my health and my relationships. ' +
    'The burnout in special education is a crisis that nobody wants to talk about.',
};

// ─── State shared across tests ───

let jwt: string;
let canvasId: string;
const codeIds: Record<string, string> = {};
const transcriptIds: string[] = [];
const codingIds: string[] = [];
let statsNodeId: string;
let statsNodeId2: string;

// Helper to get auth headers
function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

// Helper to open a canvas by ID
async function openCanvasById(page: Page, id: string) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto(`/canvas/${id}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  // Dismiss any tour overlay
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }
}

test.describe('Scenario B: Grounded Theory — Teacher Burnout', () => {
  const canvasName = `Teacher Burnout GT ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5174/canvas');
    await page.waitForLoadState('domcontentloaded');
    jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return parsed?.state?.jwt || '';
    });
    await page.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    try {
      await page.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
      await page.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    } catch { /* best-effort */ }
    await page.close();
    await ctx.close();
  });

  // ─── Phase 1: Bulk Import ───

  test('B.1 Create canvas and import 3 transcripts via import-narratives', async ({ page }) => {
    // Create canvas
    const createRes = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    canvasId = createData.data.id;
    expect(canvasId).toBeTruthy();

    // Bulk import
    const importRes = await page.request.post(`${API}/canvas/${canvasId}/import-narratives`, {
      headers: headers(),
      data: { narratives: [TRANSCRIPT_1, TRANSCRIPT_2, TRANSCRIPT_3] },
    });
    expect(importRes.status()).toBe(201);
    const importData = await importRes.json();
    expect(importData.data).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      transcriptIds.push(importData.data[i].id);
      expect(importData.data[i].sortOrder).toBe(i);
    }
  });

  test('B.2 Verify all 3 transcripts in canvas detail', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.data.transcripts).toHaveLength(3);
    expect(data.data.transcripts.map((t: { title: string }) => t.title)).toEqual(
      expect.arrayContaining([TRANSCRIPT_1.title, TRANSCRIPT_2.title, TRANSCRIPT_3.title])
    );
  });

  test('B.3 Verify transcript nodes render', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    // At least 3 transcript nodes should be present
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ─── Phase 2: Emergent Coding ───

  const codeSpecs = [
    { key: 'workload', text: 'Workload', color: '#DC2626' },
    { key: 'adminPressure', text: 'Admin Pressure', color: '#7C3AED' },
    { key: 'emotionalExhaustion', text: 'Emotional Exhaustion', color: '#DB2777' },
    { key: 'parentConflict', text: 'Parent Conflict', color: '#EA580C' },
    { key: 'resourceShortage', text: 'Resource Shortage', color: '#0891B2' },
    { key: 'systemicIssues', text: 'Systemic Issues', color: '#4F46E5' },
    { key: 'copingStrategies', text: 'Coping Strategies', color: '#059669' },
    { key: 'studentMotivation', text: 'Student Motivation', color: '#CA8A04' },
    { key: 'lackOfSupport', text: 'Lack of Support', color: '#BE185D' },
    { key: 'identityErosion', text: 'Identity Erosion', color: '#6D28D9' },
  ];

  test('B.4 Create 10 emergent codes', async ({ page }) => {
    for (const spec of codeSpecs) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: spec.text, color: spec.color },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      codeIds[spec.key] = body.data.id;
    }
    // Verify count
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(10);
  });

  test('B.5 Code transcript 1 with 5 codings', async ({ page }) => {
    const t1Codings = [
      { qKey: 'workload', text: 'The workload is simply unsustainable' },
      { qKey: 'adminPressure', text: 'The administrative pressure is relentless' },
      { qKey: 'emotionalExhaustion', text: 'The emotional exhaustion hits me hardest on Sunday nights' },
      { qKey: 'copingStrategies', text: 'I meditate in the morning before school' },
      { qKey: 'identityErosion', text: 'I do not feel like a teacher anymore' },
    ];
    for (const c of t1Codings) {
      const startOffset = TRANSCRIPT_1.content.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[0],
          questionId: codeIds[c.qKey],
          startOffset,
          endOffset: startOffset + c.text.length,
          codedText: c.text,
        },
      });
      expect(res.status()).toBe(201);
      codingIds.push((await res.json()).data.id);
    }
  });

  test('B.6 Code transcript 2 with 5 codings', async ({ page }) => {
    const t2Codings = [
      { qKey: 'emotionalExhaustion', text: 'The emotional exhaustion is overwhelming some days' },
      { qKey: 'parentConflict', text: 'Parent conflict has become a major source of stress' },
      { qKey: 'lackOfSupport', text: 'The lack of support from administration in these situations is demoralizing' },
      { qKey: 'copingStrategies', text: 'My coping strategies include a teacher support group' },
      { qKey: 'studentMotivation', text: 'Student motivation keeps me going though' },
    ];
    for (const c of t2Codings) {
      const startOffset = TRANSCRIPT_2.content.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[1],
          questionId: codeIds[c.qKey],
          startOffset,
          endOffset: startOffset + c.text.length,
          codedText: c.text,
        },
      });
      expect(res.status()).toBe(201);
      codingIds.push((await res.json()).data.id);
    }
  });

  test('B.7 Code transcript 3 with 5 codings', async ({ page }) => {
    const t3Codings = [
      { qKey: 'resourceShortage', text: 'The resource shortage in special ed is criminal' },
      { qKey: 'systemicIssues', text: 'The systemic issues go deeper than funding' },
      { qKey: 'lackOfSupport', text: 'The lack of support from the district is stunning' },
      { qKey: 'emotionalExhaustion', text: 'The emotional exhaustion in special ed is unique' },
      { qKey: 'identityErosion', text: 'The identity erosion happens when you realize the system does not value the students you serve' },
    ];
    for (const c of t3Codings) {
      const startOffset = TRANSCRIPT_3.content.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[2],
          questionId: codeIds[c.qKey],
          startOffset,
          endOffset: startOffset + c.text.length,
          codedText: c.text,
        },
      });
      expect(res.status()).toBe(201);
      codingIds.push((await res.json()).data.id);
    }
  });

  test('B.8 Verify total: 15 codings', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = await res.json();
    expect(data.data.codings).toHaveLength(15);
  });

  test('B.9 Run statistics to see initial distribution', async ({ page }) => {
    // Create stats node
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'stats', label: 'Initial Stats', config: { groupBy: 'question' } },
    });
    expect(createRes.status()).toBe(201);
    statsNodeId = (await createRes.json()).data.id;

    // Run it
    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${statsNodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.total).toBe(15);

    // Emotional Exhaustion should have 3 (one per transcript)
    const eeItem = result.items.find((i: { name: string }) => i.name === 'Emotional Exhaustion');
    expect(eeItem).toBeTruthy();
    expect(eeItem.count).toBe(3);
  });

  // ─── Phase 3: Code Refinement — Merge, Rename, Hierarchy ───

  test('B.10 Merge "Admin Pressure" into "Systemic Issues"', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions/merge`, {
      headers: headers(),
      data: { sourceId: codeIds.adminPressure, targetId: codeIds.systemicIssues },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.targetId).toBe(codeIds.systemicIssues);
    // Systemic Issues now has 2 codings (1 original + 1 merged)
    expect(body.data.codingCount).toBe(2);

    // Verify questions count decreased
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(9);
  });

  test('B.11 Merge "Parent Conflict" into "Lack of Support"', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions/merge`, {
      headers: headers(),
      data: { sourceId: codeIds.parentConflict, targetId: codeIds.lackOfSupport },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Lack of Support now has 3 (2 original + 1 merged from Parent Conflict)
    expect(body.data.codingCount).toBe(3);

    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(8);
  });

  test('B.12 Rename "Lack of Support" to "External Pressures"', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.lackOfSupport}`, {
      headers: headers(),
      data: { text: 'External Pressures' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.text).toBe('External Pressures');
  });

  test('B.13 Create code hierarchy — set parent codes', async ({ page }) => {
    // Emotional Exhaustion under Identity Erosion
    const res1 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.emotionalExhaustion}`, {
      headers: headers(),
      data: { parentQuestionId: codeIds.identityErosion },
    });
    expect(res1.ok()).toBe(true);
    expect((await res1.json()).data.parentQuestionId).toBe(codeIds.identityErosion);

    // Coping Strategies under Identity Erosion
    const res2 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.copingStrategies}`, {
      headers: headers(),
      data: { parentQuestionId: codeIds.identityErosion },
    });
    expect(res2.ok()).toBe(true);
    expect((await res2.json()).data.parentQuestionId).toBe(codeIds.identityErosion);
  });

  test('B.14 Rename "Identity Erosion" to "Personal Impact"', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.identityErosion}`, {
      headers: headers(),
      data: { text: 'Personal Impact' },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).data.text).toBe('Personal Impact');
  });

  test('B.15 Set hierarchy for systemic codes', async ({ page }) => {
    // Resource Shortage under Systemic Issues
    const res1 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.resourceShortage}`, {
      headers: headers(),
      data: { parentQuestionId: codeIds.systemicIssues },
    });
    expect(res1.ok()).toBe(true);

    // External Pressures under Systemic Issues
    const res2 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.lackOfSupport}`, {
      headers: headers(),
      data: { parentQuestionId: codeIds.systemicIssues },
    });
    expect(res2.ok()).toBe(true);
  });

  test('B.16 Run statistics again after refinement', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'stats', label: 'Post-Merge Stats', config: { groupBy: 'question' } },
    });
    expect(createRes.status()).toBe(201);
    statsNodeId2 = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${statsNodeId2}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    // Total codings is still 15
    expect(result.total).toBe(15);
    // Items should now reflect merged codes (8 codes remain)
    expect(result.items.length).toBe(8);

    // Systemic Issues should have 2 codings after merge
    const siItem = result.items.find((i: { name: string }) => i.name === 'Systemic Issues');
    expect(siItem).toBeTruthy();
    expect(siItem.count).toBe(2);
  });

  test('B.17 Verify canvas renders after merges', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    // Should have transcript + code + computed nodes
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ─── Phase 4: Iterative Analysis ───

  test('B.18 Run clustering to discover sub-themes', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'cluster', label: 'Theme Clusters', config: { k: 4 } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.clusters).toBeInstanceOf(Array);
    expect(result.clusters.length).toBeGreaterThan(0);
    for (const cluster of result.clusters) {
      expect(cluster).toHaveProperty('keywords');
      expect(cluster).toHaveProperty('segments');
    }
  });

  test('B.19 Run word cloud', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'wordcloud', label: 'Burnout Words', config: { maxWords: 30 } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.words).toBeInstanceOf(Array);
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.words.length).toBeLessThanOrEqual(30);
  });

  test('B.20 Run coding query: Emotional Exhaustion across transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: {
        nodeType: 'codingquery',
        label: 'EE Query',
        config: { conditions: [{ questionId: codeIds.emotionalExhaustion, operator: 'AND' }] },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.matches).toBeInstanceOf(Array);
    // All 3 transcripts have Emotional Exhaustion
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
  });

  test('B.21 Run sentiment analysis', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'sentiment', label: 'Sentiment', config: { scope: 'all' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.overall).toHaveProperty('positive');
    expect(result.overall).toHaveProperty('negative');
    expect(result.overall).toHaveProperty('neutral');
    expect(result.overall).toHaveProperty('averageScore');
    expect(typeof result.overall.averageScore).toBe('number');
  });

  test('B.22 Run treemap for theme proportions', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'treemap', label: 'Theme Map', config: { metric: 'count' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.nodes).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThan(0);
  });

  test('B.23 Auto-code: find all mentions of "burnout"', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/auto-code`, {
      headers: headers(),
      data: { questionId: codeIds.emotionalExhaustion, pattern: 'burnout', mode: 'keyword' },
    });
    // Auto-code returns 201 if codings created, 200 if none found
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data).toHaveProperty('created');
    expect(body.data.created).toBeGreaterThanOrEqual(0);
  });

  // ─── Phase 5: Memos and Annotations ───

  test('B.24 Create grounded theory memo', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/memos`, {
      headers: headers(),
      data: {
        title: 'Core Category Emergence',
        content:
          'The central phenomenon emerging from the data is a cycle of institutional neglect leading to personal identity erosion. ' +
          'Teachers across all three contexts describe a progressive loss of professional identity driven by systemic pressures.',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Core Category Emergence');
  });

  test('B.25 Annotate a coding with analytical note', async ({ page }) => {
    const codingId = codingIds[0]; // First coding from transcript 1
    const res = await page.request.put(`${API}/canvas/${canvasId}/codings/${codingId}`, {
      headers: headers(),
      data: { annotation: "In vivo code: 'I don't feel like a teacher anymore'" },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.annotation).toContain('In vivo code');
  });

  test('B.26 Reassign a coding to a different code', async ({ page }) => {
    // Reassign the Student Motivation coding to Coping Strategies
    const codingId = codingIds[9]; // studentMotivation coding from transcript 2
    const res = await page.request.put(`${API}/canvas/${canvasId}/codings/${codingId}/reassign`, {
      headers: headers(),
      data: { newQuestionId: codeIds.copingStrategies },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.questionId).toBe(codeIds.copingStrategies);
  });

  test('B.27 Delete a miscoded coding', async ({ page }) => {
    // Get current count
    const before = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    const countBefore = before.data.codings.length;

    // Delete the last coding we have a reference to
    const codingId = codingIds[codingIds.length - 1];
    const res = await page.request.delete(`${API}/canvas/${canvasId}/codings/${codingId}`, {
      headers: headers(),
    });
    expect(res.ok()).toBe(true);

    // Verify count decreased
    const after = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(after.data.codings.length).toBe(countBefore - 1);
  });
});

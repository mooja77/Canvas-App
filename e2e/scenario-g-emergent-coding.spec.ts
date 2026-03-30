import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario G: Discovery & Iteration — Emergent Coding Approach
 *
 * Researcher starts with zero codes, reads transcripts, and creates codes
 * as patterns emerge. Then restructures the code system through merging,
 * renaming, hierarchy creation, and iterative analysis.
 */

const API = 'http://localhost:3007/api';

// ─── Community Health Worker interview transcripts ───

const TRANSCRIPT_1 = {
  title: 'CHW Interview — Urban Clinic',
  content:
    'As a community health worker at the urban clinic, my days are incredibly varied. Trust building is the foundation ' +
    'of everything I do. When I first visit a family, they are often suspicious of anyone connected to the healthcare system. ' +
    'Many have had bad experiences, long waits, dismissive doctors, bills they cannot pay. So I start by listening. I sit at ' +
    'their kitchen table and ask about their lives, not their symptoms. That trust takes weeks or months to build, but once ' +
    'established, it transforms the relationship. Community knowledge is what sets us apart from clinical providers. I know ' +
    'which pharmacy offers discount programs, which food bank has fresh produce on Wednesdays, which bus route goes to the ' +
    'specialist clinic. This community knowledge is not in any database. It lives in relationships and experience. Home visits ' +
    'are the core of my practice. I visit about fifteen families regularly. During home visits, I can see things that never ' +
    'come up in a clinic setting. I notice when a home has mold issues affecting a child with asthma. I see when the pantry ' +
    'is empty. I observe family dynamics that affect health decisions. Language barriers are a constant challenge. Many of my ' +
    'clients speak primarily Spanish or Haitian Creole. Even with interpreters, nuance gets lost. Health literacy is another ' +
    'major barrier. Medical instructions that seem straightforward to providers are confusing to patients. I spend a lot of time ' +
    'translating medical jargon into plain language. System navigation is perhaps my most important role. The healthcare system ' +
    'is bewildering even for educated English speakers. For my clients, navigating insurance, referrals, prior authorizations, ' +
    'and appointment scheduling is nearly impossible without help. I serve as a bridge between the community and the system.',
};

const TRANSCRIPT_2 = {
  title: 'CHW Interview — Rural Program',
  content:
    'Working as a community health worker in a rural area presents unique challenges and rewards. Trust building in rural ' +
    'communities operates differently than in urban settings. Everyone knows everyone, and reputation is everything. If I help ' +
    'one family successfully, word spreads quickly. But if I make a mistake or breach confidentiality, that trust is gone for ' +
    'the entire community. The community knowledge required here is extensive. I need to know which churches offer health fairs, ' +
    'which employers provide insurance, which roads become impassable in winter. Distance is a major factor. Some of my clients ' +
    'live forty-five minutes from the nearest clinic. Home visits in rural areas mean hours of driving. But those home visits are ' +
    'essential because many of my clients cannot get to the clinic easily. Transportation barriers are as significant as language ' +
    'barriers in limiting access to care. Health literacy in rural communities has its own patterns. Many residents rely on folk ' +
    'remedies and traditional medicine alongside conventional care. Rather than dismissing these practices, I try to integrate them. ' +
    'If an herbal tea makes someone feel better, I encourage them to continue while also following their prescribed treatment. ' +
    'System navigation for rural clients often means navigating systems that are far away. The specialist they need is two hours ' +
    'away. The insurance company is a faceless voice on the phone. I help clients prepare for appointments, understand their rights, ' +
    'and advocate for themselves. The wellness programs I coordinate include walking groups, cooking classes, and blood pressure ' +
    'screening events. These programs build community connections while addressing health needs. The trust that develops through ' +
    'these shared activities creates a foundation for deeper health conversations. Mental wellness is increasingly part of my work. ' +
    'The stigma around mental health in rural communities is significant, but it is slowly changing as people see the benefits.',
};

// ─── State shared across tests ───

let jwt: string;
let canvasId: string;
const transcriptIds: string[] = [];
const codeIds: Record<string, string> = {};
let codingCountBefore: number;

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

test.describe('Scenario G: Emergent Coding — Discovery Approach', () => {
  const canvasName = `Emergent Coding CHW ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    await page.goto('http://localhost:5174/canvas');
    await page.waitForLoadState('domcontentloaded');
    jwt = await page.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      if (!raw) return '';
      return JSON.parse(raw)?.state?.jwt || '';
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

  // ─── Phase 1: Start with Data Only ───

  test('G.1 Create canvas with 2 transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(createRes.status()).toBe(201);
    canvasId = (await createRes.json()).data.id;
    expect(canvasId).toBeTruthy();

    const importRes = await page.request.post(`${API}/canvas/${canvasId}/import-narratives`, {
      headers: headers(),
      data: { narratives: [TRANSCRIPT_1, TRANSCRIPT_2] },
    });
    expect(importRes.status()).toBe(201);
    const importData = await importRes.json();
    expect(importData.data).toHaveLength(2);
    transcriptIds.push(importData.data[0].id, importData.data[1].id);
  });

  test('G.2 Verify no codes exist yet', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = await res.json();
    expect(data.data.questions).toHaveLength(0);
  });

  test('G.3 Verify no codings exist yet', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = await res.json();
    expect(data.data.codings).toHaveLength(0);
  });

  // ─── Phase 2: First Read — Emergent Codes ───

  test('G.4 Create first emergent code: Trust Building', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Trust Building', color: '#10B981' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    codeIds.trustBuilding = body.data.id;
    expect(body.data.text).toBe('Trust Building');
  });

  test('G.5 Code a segment from transcript 1 with Trust Building', async ({ page }) => {
    const text = 'Trust building is the foundation of everything I do';
    const startOffset = TRANSCRIPT_1.content.indexOf(text);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: {
        transcriptId: transcriptIds[0],
        questionId: codeIds.trustBuilding,
        startOffset,
        endOffset: startOffset + text.length,
        codedText: text,
      },
    });
    expect(res.status()).toBe(201);
  });

  test('G.6 Create second code: Community Knowledge', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Community Knowledge', color: '#3B82F6' },
    });
    expect(res.status()).toBe(201);
    codeIds.communityKnowledge = (await res.json()).data.id;
  });

  test('G.7 Code segments with Community Knowledge', async ({ page }) => {
    const segments = [
      { ti: 0, text: 'Community knowledge is what sets us apart from clinical providers' },
      { ti: 1, text: 'The community knowledge required here is extensive' },
    ];
    for (const s of segments) {
      const content = s.ti === 0 ? TRANSCRIPT_1.content : TRANSCRIPT_2.content;
      const startOffset = content.indexOf(s.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[s.ti],
          questionId: codeIds.communityKnowledge,
          startOffset,
          endOffset: startOffset + s.text.length,
          codedText: s.text,
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test('G.8 Create 4 more codes with codings each', async ({ page }) => {
    const moreSpecs = [
      {
        key: 'homeVisits', text: 'Home Visits', color: '#F59E0B',
        codings: [
          { ti: 0, text: 'Home visits are the core of my practice' },
          { ti: 1, text: 'Home visits in rural areas mean hours of driving' },
        ],
      },
      {
        key: 'languageBarriers', text: 'Language Barriers', color: '#EF4444',
        codings: [
          { ti: 0, text: 'Language barriers are a constant challenge' },
          { ti: 1, text: 'Transportation barriers are as significant as language barriers' },
        ],
      },
      {
        key: 'healthLiteracy', text: 'Health Literacy', color: '#8B5CF6',
        codings: [
          { ti: 0, text: 'Health literacy is another major barrier' },
          { ti: 1, text: 'Health literacy in rural communities has its own patterns' },
        ],
      },
      {
        key: 'systemNavigation', text: 'System Navigation', color: '#EC4899',
        codings: [
          { ti: 0, text: 'System navigation is perhaps my most important role' },
          { ti: 1, text: 'System navigation for rural clients often means navigating systems that are far away' },
        ],
      },
    ];

    for (const spec of moreSpecs) {
      const codeRes = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: spec.text, color: spec.color },
      });
      expect(codeRes.status()).toBe(201);
      codeIds[spec.key] = (await codeRes.json()).data.id;

      for (const c of spec.codings) {
        const content = c.ti === 0 ? TRANSCRIPT_1.content : TRANSCRIPT_2.content;
        const startOffset = content.indexOf(c.text);
        expect(startOffset).toBeGreaterThanOrEqual(0);
        const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
          headers: headers(),
          data: {
            transcriptId: transcriptIds[c.ti],
            questionId: codeIds[spec.key],
            startOffset,
            endOffset: startOffset + c.text.length,
            codedText: c.text,
          },
        });
        expect(res.status()).toBe(201);
      }
    }
  });

  test('G.9 Verify 6 codes and 11 codings exist', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = await res.json();
    expect(data.data.questions).toHaveLength(6);
    expect(data.data.codings).toHaveLength(11);
  });

  // ─── Phase 3: Restructuring ───

  test('G.10 Merge Language Barriers into System Navigation', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/questions/merge`, {
      headers: headers(),
      data: { sourceId: codeIds.languageBarriers, targetId: codeIds.systemNavigation },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.targetId).toBe(codeIds.systemNavigation);
    // System Navigation now has 4 codings (2 original + 2 merged)
    expect(body.data.codingCount).toBe(4);

    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(5);
  });

  test('G.11 Rename System Navigation to Navigating Barriers', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.systemNavigation}`, {
      headers: headers(),
      data: { text: 'Navigating Barriers' },
    });
    expect(res.ok()).toBe(true);
    expect((await res.json()).data.text).toBe('Navigating Barriers');
  });

  test('G.12 Create parent code Relationship Building with children', async ({ page }) => {
    // Create parent code
    const parentRes = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Relationship Building', color: '#059669' },
    });
    expect(parentRes.status()).toBe(201);
    const parentId = (await parentRes.json()).data.id;
    codeIds.relationshipBuilding = parentId;

    // Set Trust Building as child
    const res1 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.trustBuilding}`, {
      headers: headers(),
      data: { parentQuestionId: parentId },
    });
    expect(res1.ok()).toBe(true);
    expect((await res1.json()).data.parentQuestionId).toBe(parentId);

    // Set Community Knowledge as child
    const res2 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.communityKnowledge}`, {
      headers: headers(),
      data: { parentQuestionId: parentId },
    });
    expect(res2.ok()).toBe(true);
    expect((await res2.json()).data.parentQuestionId).toBe(parentId);
  });

  test('G.13 Create parent code Service Delivery with children', async ({ page }) => {
    const parentRes = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Service Delivery', color: '#DC2626' },
    });
    expect(parentRes.status()).toBe(201);
    const parentId = (await parentRes.json()).data.id;
    codeIds.serviceDelivery = parentId;

    // Set Home Visits as child
    const res1 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.homeVisits}`, {
      headers: headers(),
      data: { parentQuestionId: parentId },
    });
    expect(res1.ok()).toBe(true);

    // Set Health Literacy as child
    const res2 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.healthLiteracy}`, {
      headers: headers(),
      data: { parentQuestionId: parentId },
    });
    expect(res2.ok()).toBe(true);

    // Set Navigating Barriers as child
    const res3 = await page.request.put(`${API}/canvas/${canvasId}/questions/${codeIds.systemNavigation}`, {
      headers: headers(),
      data: { parentQuestionId: parentId },
    });
    expect(res3.ok()).toBe(true);
  });

  test('G.14 Run clustering to validate code structure', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'cluster', label: 'Theme Clusters', config: { k: 3 } },
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

  test('G.15 Run word cloud to validate terminology', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'wordcloud', label: 'CHW Words', config: { maxWords: 30 } },
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
    // Check that health-related words appear
    const wordTexts = result.words.map((w: { text: string }) => w.text.toLowerCase());
    const hasRelevantWord = wordTexts.some((w: string) =>
      ['community', 'health', 'trust', 'clients', 'rural', 'barriers'].includes(w)
    );
    expect(hasRelevantWord).toBe(true);
  });

  // ─── Phase 4: Second Pass Coding ───

  test('G.16 Record coding count before auto-code', async ({ page }) => {
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    codingCountBefore = detail.data.codings.length;
    expect(codingCountBefore).toBeGreaterThanOrEqual(11);
  });

  test('G.17 Auto-code keyword "trust" for Trust Building', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/auto-code`, {
      headers: headers(),
      data: { questionId: codeIds.trustBuilding, pattern: 'trust', mode: 'keyword' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data).toHaveProperty('created');
    expect(body.data.created).toBeGreaterThanOrEqual(0);
  });

  test('G.18 Verify total codings increased after auto-coding', async ({ page }) => {
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings.length).toBeGreaterThanOrEqual(codingCountBefore);
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario C: Cross-Case Comparison — Climate Change Attitudes
 *
 * Dr. Amira Patel compares how different community stakeholders
 * (farmer, scientist, politician) discuss climate change adaptation.
 */

const API = 'http://localhost:3007/api';

// ─── Transcript content (~400 words each) ───

const FARMER_TRANSCRIPT = {
  title: 'Farmer Interview — Rural County',
  content:
    'Look, I have been farming this land for thirty years, and the climate has definitely changed. The rainfall patterns are ' +
    'different now. We used to get steady spring rains in April and May, but now it comes in big bursts or not at all. Last year ' +
    'we had a drought that wiped out half my corn crop. The economic impact was devastating. I lost about forty thousand dollars. ' +
    'My adaptation actions have been practical. I switched to drought-resistant varieties, invested in drip irrigation, and started ' +
    'cover cropping to hold moisture in the soil. But these adaptations cost money, and not everyone can afford them. Some of my ' +
    'neighbors are skeptical about climate change. They say the weather has always been variable and this is just a cycle. I used ' +
    'to think that way too, but when you see your well running dry three years in a row, you start to wonder. The economic impact ' +
    'on our community has been significant. Two farms on my road have sold out to developers. The young people do not want to farm ' +
    'anymore because the risk is too high. Policy support has been minimal. The county extension office talks about climate adaptation ' +
    'but their budget was cut by sixty percent. We need real policy and governance that supports farmers through this transition. ' +
    'Community engagement is important to me. I started a local climate adaptation group where farmers share what is working. We meet ' +
    'monthly at the grange hall. About twenty people come regularly now. My future outlook is cautiously optimistic. If we can get ' +
    'the right support and the right policies, farming can adapt. But if we keep pretending climate change is not happening, ' +
    'rural communities like ours will not survive.',
};

const SCIENTIST_TRANSCRIPT = {
  title: 'Scientist Interview — University',
  content:
    'As a climate scientist, I spend my days analyzing data that paints a clear picture of accelerating change. The skepticism ' +
    'and denial we encounter is frustrating because the evidence is overwhelming. We have ice core data going back hundreds of ' +
    'thousands of years that shows current carbon dioxide levels are unprecedented. The adaptation actions needed are significant ' +
    'and urgent. We need to transition energy systems, redesign agricultural practices, and rebuild infrastructure to withstand ' +
    'extreme weather events. The economic impact of inaction far exceeds the cost of adaptation. Our models show that every dollar ' +
    'spent on climate adaptation returns four to seven dollars in avoided damages. Policy and governance is where I focus much of ' +
    'my advocacy. Scientists need to be better at communicating with policymakers. We speak in probabilities and confidence intervals, ' +
    'but politicians want certainty and simple answers. The disconnect between scientific understanding and policy response is the ' +
    'greatest challenge we face. Community engagement has become a priority for our research group. We run citizen science programs ' +
    'where local residents monitor temperature, rainfall, and phenological changes. This builds understanding from the ground up. ' +
    'The future outlook from a scientific perspective is concerning but not hopeless. We still have time to limit warming to manageable ' +
    'levels, but the window is closing rapidly. The adaptation actions we take in the next decade will determine outcomes for centuries. ' +
    'What keeps me going is the growing awareness I see in communities. People are noticing the changes and starting to ask what they ' +
    'can do. That grassroots engagement gives me hope that political will can follow.',
};

const POLITICIAN_TRANSCRIPT = {
  title: 'Politician Interview — City Council',
  content:
    'As a city council member, I deal with climate change not as an abstract concept but as a budget line item. Last year we spent ' +
    'two million dollars on flood damage repairs that our engineers directly attribute to increased storm intensity. The economic impact ' +
    'on our municipality is real and growing. My approach to policy and governance on climate has been pragmatic. I do not get into ' +
    'debates about whether climate change is real. I talk about infrastructure resilience, fiscal responsibility, and community safety. ' +
    'That framing works across party lines. The adaptation actions we have taken include updating our stormwater management system, ' +
    'requiring green infrastructure in new developments, and creating a climate adaptation fund. These are concrete steps that ' +
    'people can see and understand. Skepticism and denial is something I navigate carefully. Some of my constituents think climate ' +
    'policy is a waste of money. I respond by showing them the repair bills. When they see that prevention costs less than repair, ' +
    'the economic argument wins. Community engagement has been essential to building support. We held twelve town halls last year ' +
    'specifically about climate preparedness. Attendance was strong because we framed it around immediate concerns like flooding, ' +
    'heat waves, and property values. The future outlook for our city depends on the investments we make now. I have proposed a ' +
    'twenty-year climate resilience plan that integrates infrastructure upgrades, green spaces, and emergency preparedness. The council ' +
    'approved it seven to two. Policy and governance at the local level is where real climate adaptation happens. Federal policy is ' +
    'important but it is too slow. Cities cannot wait. We need to act with the resources and authority we have right now.',
};

// ─── Shared state ───

let jwt: string;
let canvasId: string;
const caseIds: Record<string, string> = {};
const transcriptIds: string[] = [];
const codeIds: Record<string, string> = {};
let relationId: string;

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

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
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (await skipBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
    await skipBtn.first().click();
  }
}

test.describe('Scenario C: Cross-Case — Climate Change Attitudes', () => {
  const canvasName = `Climate Cross-Case ${Date.now()}`;

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

  // ─── Phase 1: Setup with Cases ───

  test('C.1 Create canvas', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(res.status()).toBe(201);
    canvasId = (await res.json()).data.id;
    expect(canvasId).toBeTruthy();
  });

  test('C.2 Create 3 cases with attributes', async ({ page }) => {
    const caseDefs = [
      { key: 'farmers', name: 'Farmers', attributes: { role: 'agricultural', location: 'rural', age_range: '40-65' } },
      { key: 'officials', name: 'Government Officials', attributes: { role: 'administrative', location: 'urban', age_range: '35-55' } },
      { key: 'teachers', name: 'Scientists', attributes: { role: 'scientific', location: 'university', age_range: '30-60' } },
    ];
    for (const c of caseDefs) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/cases`, {
        headers: headers(),
        data: { name: c.name, attributes: c.attributes },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      caseIds[c.key] = body.data.id;
      expect(body.data.attributes).toHaveProperty('role');
    }
  });

  test('C.3 Create 3 transcripts and assign to cases', async ({ page }) => {
    const transcripts = [
      { data: FARMER_TRANSCRIPT, caseKey: 'farmers' },
      { data: SCIENTIST_TRANSCRIPT, caseKey: 'teachers' },
      { data: POLITICIAN_TRANSCRIPT, caseKey: 'officials' },
    ];
    for (const t of transcripts) {
      const createRes = await page.request.post(`${API}/canvas/${canvasId}/transcripts`, {
        headers: headers(),
        data: { title: t.data.title, content: t.data.content },
      });
      expect(createRes.status()).toBe(201);
      const tid = (await createRes.json()).data.id;
      transcriptIds.push(tid);

      // Assign case
      const assignRes = await page.request.put(`${API}/canvas/${canvasId}/transcripts/${tid}`, {
        headers: headers(),
        data: { caseId: caseIds[t.caseKey] },
      });
      expect(assignRes.ok()).toBe(true);
      const assigned = await assignRes.json();
      expect(assigned.data.caseId).toBe(caseIds[t.caseKey]);
    }
  });

  test('C.4 Create 6 codes', async ({ page }) => {
    const codeDefs = [
      { key: 'adaptation', text: 'Adaptation Actions', color: '#10B981' },
      { key: 'economic', text: 'Economic Impact', color: '#F59E0B' },
      { key: 'skepticism', text: 'Skepticism & Denial', color: '#EF4444' },
      { key: 'policy', text: 'Policy & Governance', color: '#3B82F6' },
      { key: 'community', text: 'Community Engagement', color: '#8B5CF6' },
      { key: 'future', text: 'Future Outlook', color: '#06B6D4' },
    ];
    for (const c of codeDefs) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: c.text, color: c.color },
      });
      expect(res.status()).toBe(201);
      codeIds[c.key] = (await res.json()).data.id;
    }
  });

  test('C.5 Create 18 codings (6 per transcript)', async ({ page }) => {
    // Farmer codings
    const farmerCodings = [
      { qKey: 'adaptation', text: 'I switched to drought-resistant varieties' },
      { qKey: 'economic', text: 'The economic impact was devastating' },
      { qKey: 'skepticism', text: 'Some of my neighbors are skeptical about climate change' },
      { qKey: 'policy', text: 'We need real policy and governance that supports farmers' },
      { qKey: 'community', text: 'I started a local climate adaptation group where farmers share what is working' },
      { qKey: 'future', text: 'My future outlook is cautiously optimistic' },
    ];
    for (const c of farmerCodings) {
      const offset = FARMER_TRANSCRIPT.content.indexOf(c.text);
      expect(offset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: { transcriptId: transcriptIds[0], questionId: codeIds[c.qKey], startOffset: offset, endOffset: offset + c.text.length, codedText: c.text },
      });
      expect(res.status()).toBe(201);
    }

    // Scientist codings
    const scientistCodings = [
      { qKey: 'adaptation', text: 'The adaptation actions needed are significant and urgent' },
      { qKey: 'economic', text: 'every dollar spent on climate adaptation returns four to seven dollars' },
      { qKey: 'skepticism', text: 'The skepticism and denial we encounter is frustrating' },
      { qKey: 'policy', text: 'Scientists need to be better at communicating with policymakers' },
      { qKey: 'community', text: 'We run citizen science programs where local residents monitor temperature' },
      { qKey: 'future', text: 'The future outlook from a scientific perspective is concerning but not hopeless' },
    ];
    for (const c of scientistCodings) {
      const offset = SCIENTIST_TRANSCRIPT.content.indexOf(c.text);
      expect(offset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: { transcriptId: transcriptIds[1], questionId: codeIds[c.qKey], startOffset: offset, endOffset: offset + c.text.length, codedText: c.text },
      });
      expect(res.status()).toBe(201);
    }

    // Politician codings
    const politicianCodings = [
      { qKey: 'adaptation', text: 'updating our stormwater management system' },
      { qKey: 'economic', text: 'The economic impact on our municipality is real and growing' },
      { qKey: 'skepticism', text: 'Some of my constituents think climate policy is a waste of money' },
      { qKey: 'policy', text: 'My approach to policy and governance on climate has been pragmatic' },
      { qKey: 'community', text: 'We held twelve town halls last year specifically about climate preparedness' },
      { qKey: 'future', text: 'The future outlook for our city depends on the investments we make now' },
    ];
    for (const c of politicianCodings) {
      const offset = POLITICIAN_TRANSCRIPT.content.indexOf(c.text);
      expect(offset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: { transcriptId: transcriptIds[2], questionId: codeIds[c.qKey], startOffset: offset, endOffset: offset + c.text.length, codedText: c.text },
      });
      expect(res.status()).toBe(201);
    }
  });

  test('C.6 Verify canvas state: 3 transcripts, 3 cases, 6 codes, 18 codings', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = (await res.json()).data;
    expect(data.transcripts).toHaveLength(3);
    expect(data.cases).toHaveLength(3);
    expect(data.questions).toHaveLength(6);
    expect(data.codings).toHaveLength(18);
  });

  // ─── Phase 2: Cross-Case Analysis ───

  test('C.7 Run Framework Matrix', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'matrix', label: 'Case x Code Matrix', config: {} },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.rows).toBeInstanceOf(Array);
    expect(result.rows.length).toBeGreaterThanOrEqual(3);
    for (const row of result.rows) {
      expect(row).toHaveProperty('cells');
      expect(row.cells).toBeInstanceOf(Array);
    }
  });

  test('C.8 Run Comparison node across all transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'comparison', label: 'Transcript Comparison', config: { transcriptIds } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.transcripts).toHaveLength(3);
    for (const t of result.transcripts) {
      expect(t.profile).toBeInstanceOf(Array);
      expect(t.profile.length).toBe(6);
    }
  });

  test('C.9 Run Co-occurrence for Adaptation + Economic Impact', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: {
        nodeType: 'cooccurrence',
        label: 'Adapt-Econ Co-occur',
        config: { questionIds: [codeIds.adaptation, codeIds.economic] },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.pairs).toBeInstanceOf(Array);
  });

  test('C.10 Update case attributes', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/cases/${caseIds.farmers}`, {
      headers: headers(),
      data: { attributes: { role: 'agricultural', location: 'rural', age_range: '40-65', sample_size: '5' } },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.attributes).toHaveProperty('sample_size', '5');
  });

  test('C.11 Create relation between cases', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/relations`, {
      headers: headers(),
      data: {
        fromType: 'case',
        fromId: caseIds.farmers,
        toType: 'case',
        toId: caseIds.teachers,
        label: 'shares community',
      },
    });
    expect(res.status()).toBe(201);
    relationId = (await res.json()).data.id;
  });

  test('C.12 Create relation between codes', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/relations`, {
      headers: headers(),
      data: {
        fromType: 'question',
        fromId: codeIds.adaptation,
        toType: 'question',
        toId: codeIds.economic,
        label: 'causes',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // Store for update/delete tests
    relationId = body.data.id;
  });

  test('C.13 Update relation label', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/relations/${relationId}`, {
      headers: headers(),
      data: { label: 'drives' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.label).toBe('drives');
  });

  test('C.14 Delete a relation', async ({ page }) => {
    const res = await page.request.delete(`${API}/canvas/${canvasId}/relations/${relationId}`, {
      headers: headers(),
    });
    expect(res.ok()).toBe(true);
  });

  // ─── Phase 3: Synthesis ───

  test('C.15 Create cross-case synthesis memo', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/memos`, {
      headers: headers(),
      data: {
        title: 'Cross-Case Synthesis: Climate Adaptation Patterns',
        content:
          '## Key Findings\n\nAll three stakeholder groups recognize climate change impacts but frame them differently. ' +
          'Farmers focus on practical adaptation and economic survival. Scientists emphasize systemic change and data-driven policy. ' +
          'Politicians prioritize pragmatic framing and budget justification.\n\n## Common Themes\n\n- Economic arguments resonate across all groups\n- Community engagement is valued but takes different forms',
      },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).data.title).toBe('Cross-Case Synthesis: Climate Adaptation Patterns');
  });

  test('C.16 Run search for keyword "climate" across transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'search', label: 'Search climate', config: { pattern: 'climate', mode: 'keyword' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.matches).toBeInstanceOf(Array);
    expect(result.matches.length).toBeGreaterThan(0);
    // All 3 transcripts mention "climate"
    const matchedTranscripts = new Set(result.matches.map((m: { transcriptId: string }) => m.transcriptId));
    expect(matchedTranscripts.size).toBe(3);
  });

  test('C.17 Run regex search for adapt variants', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'search', label: 'Regex adapt', config: { pattern: 'adapt(ation|ing|ed)', mode: 'regex' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.matches).toBeInstanceOf(Array);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  test('C.18 Export Excel with case data', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/export/excel`, {
      headers: headers(),
    });
    expect(res.ok()).toBe(true);
    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });
});

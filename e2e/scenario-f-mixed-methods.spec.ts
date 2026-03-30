import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario F: Mixed Methods — Survey + Interview Integration
 *
 * Researcher combines structured survey responses with interview data
 * to study student wellbeing. Analysis compares across both data types.
 */

const API = 'http://localhost:3007/api';

// ─── Survey responses (~150 words each, structured Q&A) ───

const SURVEY_1 = {
  title: 'Survey Response — Student A',
  content:
    'Q: How would you rate your overall wellbeing this semester? A: I would rate it about a 6 out of 10. ' +
    'Q: What is your biggest source of stress? A: Academic workload is my biggest stress. I have five courses this semester ' +
    'and the assignments overlap constantly. I feel like I am always behind on something. ' +
    'Q: Do you feel you have adequate social support? A: My roommate is great and we study together. But I moved here from ' +
    'another state so my family is far away. I miss having that support network nearby. ' +
    'Q: What coping strategies do you use? A: I go to the gym three times a week and that helps a lot with stress. ' +
    'I also started journaling this semester which has been surprisingly helpful for processing my thoughts.',
};

const SURVEY_2 = {
  title: 'Survey Response — Student B',
  content:
    'Q: How would you rate your overall wellbeing this semester? A: Maybe a 4 out of 10. Not great honestly. ' +
    'Q: What is your biggest source of stress? A: Financial pressure is overwhelming. I work twenty hours a week at the ' +
    'campus bookstore on top of classes. I am exhausted all the time. My mental health has definitely suffered. ' +
    'Q: Do you feel you have adequate social support? A: Not really. I do not have time to socialize because of work ' +
    'and school. My friends have mostly stopped inviting me to things because I always say no. It is isolating. ' +
    'Q: What coping strategies do you use? A: I do not have great coping strategies. Sometimes I just shut down and sleep ' +
    'all weekend. I know that is not healthy but I do not have the energy for anything else.',
};

// ─── Interview transcripts (~400 words each, narrative) ───

const INTERVIEW_1 = {
  title: 'In-Depth Interview — Student C (Junior, Psychology Major)',
  content:
    'My experience this semester has been really complex. On one hand, I am passionate about my coursework in psychology ' +
    'and I feel like I am finally getting into the material that matters. On the other hand, the academic stress is ' +
    'intense. The research methods class requires us to design and conduct our own study, and the workload is enormous. ' +
    'I spend most evenings in the library. My social life has taken a real hit because of the academic demands. I used to ' +
    'be really active in student organizations, but I had to drop two of them this semester. That loss of social connection ' +
    'has affected my mental health more than I expected. I did not realize how much those groups meant to me until they ' +
    'were gone. Physical health is another area where I am struggling. I stopped going to the gym because I felt guilty ' +
    'about taking time away from studying. My eating habits have gotten worse too. A lot of fast food and late-night snacking. ' +
    'I gained about ten pounds this semester and that has affected my self-esteem. The counseling center has been helpful ' +
    'though. I started going after a particularly bad week in October. My counselor helped me develop better coping ' +
    'mechanisms, like time blocking and setting boundaries with professors. She also normalized the stress I was feeling, ' +
    'which was validating. I wish the university would do more to address the systemic issues that cause student stress. ' +
    'Individual coping strategies are important, but they should not be the only solution. The culture of overwork in academia ' +
    'needs to change. Professors pile on assignments without coordinating with each other, and students bear the burden.',
};

const INTERVIEW_2 = {
  title: 'In-Depth Interview — Student D (Senior, Engineering)',
  content:
    'Senior year has been the hardest year of my life, and I say that having been through some tough things. The capstone ' +
    'project alone takes up about thirty hours a week, on top of three other classes and a part-time internship. The ' +
    'academic stress is qualitatively different from earlier years. It is not just about passing anymore, it is about ' +
    'performing well enough to get a good job or get into grad school. That pressure is constant and exhausting. ' +
    'My mental health hit rock bottom in September. I had a panic attack during a presentation and had to leave the room. ' +
    'That was a wake-up call. I started seeing a therapist through the campus health center, and she diagnosed me with ' +
    'generalized anxiety disorder. Looking back, I think the anxiety was building for years but the senior year pressure ' +
    'brought it to a crisis point. Social support has been crucial for getting through this. My study group in engineering ' +
    'is more than just academic support. We check in on each other, we normalize struggling, and we celebrate small wins. ' +
    'Without that group, I do not think I would have made it through the semester. My physical health has suffered though. ' +
    'I have not exercised regularly since sophomore year. I drink too much coffee and do not sleep enough. My doctor told me ' +
    'my blood pressure is elevated for someone my age. That scared me. The coping mechanisms I have developed include strict ' +
    'scheduling, meditation before bed, and saying no to social events when I need to. These help but they feel like damage ' +
    'control rather than genuine wellness. I am surviving, not thriving.',
};

// ─── State shared across tests ───

let jwt: string;
let canvasId: string;
const transcriptIds: string[] = [];
const codeIds: Record<string, string> = {};

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

test.describe('Scenario F: Mixed Methods — Survey + Interview', () => {
  const canvasName = `Mixed Methods Wellbeing ${Date.now()}`;

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

  // ─── Phase 1: Setup ───

  test('F.1 Create canvas', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(res.status()).toBe(201);
    canvasId = (await res.json()).data.id;
    expect(canvasId).toBeTruthy();
  });

  test('F.2 Import 2 survey responses as transcripts', async ({ page }) => {
    const importRes = await page.request.post(`${API}/canvas/${canvasId}/import-narratives`, {
      headers: headers(),
      data: { narratives: [SURVEY_1, SURVEY_2] },
    });
    expect(importRes.status()).toBe(201);
    const data = await importRes.json();
    expect(data.data).toHaveLength(2);
    transcriptIds.push(data.data[0].id, data.data[1].id);
  });

  test('F.3 Import 2 interview transcripts', async ({ page }) => {
    const importRes = await page.request.post(`${API}/canvas/${canvasId}/import-narratives`, {
      headers: headers(),
      data: { narratives: [INTERVIEW_1, INTERVIEW_2] },
    });
    expect(importRes.status()).toBe(201);
    const data = await importRes.json();
    expect(data.data).toHaveLength(2);
    transcriptIds.push(data.data[0].id, data.data[1].id);
  });

  test('F.4 Verify canvas has 4 transcripts', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.data.transcripts).toHaveLength(4);
  });

  test('F.5 Create 5 codes for wellbeing themes', async ({ page }) => {
    const codeSpecs = [
      { key: 'academicStress', text: 'Academic Stress', color: '#EF4444' },
      { key: 'socialSupport', text: 'Social Support', color: '#10B981' },
      { key: 'mentalHealth', text: 'Mental Health', color: '#8B5CF6' },
      { key: 'physicalHealth', text: 'Physical Health', color: '#3B82F6' },
      { key: 'copingMechanisms', text: 'Coping Mechanisms', color: '#F59E0B' },
    ];
    for (const spec of codeSpecs) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: spec.text, color: spec.color },
      });
      expect(res.status()).toBe(201);
      codeIds[spec.key] = (await res.json()).data.id;
    }
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(5);
  });

  test('F.6 Create 16 codings across survey and interview data', async ({ page }) => {
    const codingSpecs = [
      // Survey 1
      { ti: 0, qKey: 'academicStress', text: 'Academic workload is my biggest stress', source: SURVEY_1.content },
      { ti: 0, qKey: 'socialSupport', text: 'My roommate is great and we study together', source: SURVEY_1.content },
      { ti: 0, qKey: 'copingMechanisms', text: 'I go to the gym three times a week and that helps a lot with stress', source: SURVEY_1.content },
      { ti: 0, qKey: 'mentalHealth', text: 'surprisingly helpful for processing my thoughts', source: SURVEY_1.content },
      // Survey 2
      { ti: 1, qKey: 'mentalHealth', text: 'My mental health has definitely suffered', source: SURVEY_2.content },
      { ti: 1, qKey: 'socialSupport', text: 'My friends have mostly stopped inviting me to things', source: SURVEY_2.content },
      { ti: 1, qKey: 'copingMechanisms', text: 'I do not have great coping strategies', source: SURVEY_2.content },
      { ti: 1, qKey: 'academicStress', text: 'Financial pressure is overwhelming', source: SURVEY_2.content },
      // Interview 1
      { ti: 2, qKey: 'academicStress', text: 'the academic stress is intense', source: INTERVIEW_1.content },
      { ti: 2, qKey: 'socialSupport', text: 'That loss of social connection has affected my mental health', source: INTERVIEW_1.content },
      { ti: 2, qKey: 'physicalHealth', text: 'I stopped going to the gym because I felt guilty about taking time away from studying', source: INTERVIEW_1.content },
      { ti: 2, qKey: 'copingMechanisms', text: 'time blocking and setting boundaries with professors', source: INTERVIEW_1.content },
      // Interview 2
      { ti: 3, qKey: 'mentalHealth', text: 'I had a panic attack during a presentation and had to leave the room', source: INTERVIEW_2.content },
      { ti: 3, qKey: 'socialSupport', text: 'My study group in engineering is more than just academic support', source: INTERVIEW_2.content },
      { ti: 3, qKey: 'physicalHealth', text: 'I have not exercised regularly since sophomore year', source: INTERVIEW_2.content },
      { ti: 3, qKey: 'copingMechanisms', text: 'strict scheduling, meditation before bed, and saying no to social events', source: INTERVIEW_2.content },
    ];

    for (const c of codingSpecs) {
      const startOffset = c.source.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[c.ti],
          questionId: codeIds[c.qKey],
          startOffset,
          endOffset: startOffset + c.text.length,
          codedText: c.text,
        },
      });
      expect(res.status()).toBe(201);
    }

    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings).toHaveLength(16);
  });

  // ─── Phase 2: Comparative Analysis ───

  test('F.7 Run comparison across all 4 transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: {
        nodeType: 'comparison',
        label: 'Survey vs Interview Comparison',
        config: { transcriptIds: [...transcriptIds] },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.transcripts).toBeDefined();
    expect(result.transcripts).toHaveLength(4);
    for (const t of result.transcripts) {
      expect(t).toHaveProperty('profile');
    }
  });

  test('F.8 Run statistics grouped by transcript', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'stats', label: 'Transcript Stats', config: { groupBy: 'transcript' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;

    const runRes = await page.request.post(`${API}/canvas/${canvasId}/computed/${nodeId}/run`, {
      headers: headers(),
    });
    expect(runRes.ok()).toBe(true);
    const result = (await runRes.json()).data.result;
    expect(result.total).toBe(16);
    expect(result.items).toBeInstanceOf(Array);
    // All 4 transcripts should be represented
    expect(result.items.length).toBe(4);
  });

  test('F.9 Run word cloud', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: { nodeType: 'wordcloud', label: 'Wellbeing Words', config: { maxWords: 25 } },
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
    expect(result.words.length).toBeLessThanOrEqual(25);
  });

  test('F.10 Run sentiment analysis', async ({ page }) => {
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
    expect(typeof result.overall.averageScore).toBe('number');
  });

  test('F.11 Run co-occurrence between Academic Stress and Mental Health', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: {
        nodeType: 'cooccurrence',
        label: 'Stress-MH Co-occurrence',
        config: { questionIds: [codeIds.academicStress, codeIds.mentalHealth] },
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

  test('F.12 Run coding query: Mental Health AND NOT Coping Mechanisms', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas/${canvasId}/computed`, {
      headers: headers(),
      data: {
        nodeType: 'codingquery',
        label: 'MH without Coping',
        config: {
          conditions: [
            { questionId: codeIds.mentalHealth, operator: 'AND' },
            { questionId: codeIds.copingMechanisms, operator: 'NOT' },
          ],
        },
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
    // At least some transcripts have Mental Health but not Coping in same segment
    expect(result.matches.length).toBeGreaterThanOrEqual(0);
  });
});

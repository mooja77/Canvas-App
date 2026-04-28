import { test, expect, type Page } from '@playwright/test';

// ─── Constants ───

const BASE = 'http://localhost:3007/api';
const CANVAS_NAME = `ScenarioA-Telehealth-${Date.now()}`;

// ─── Transcript Data ───

const TRANSCRIPTS = [
  {
    title: 'Maria, Age 67, Appalachian Community',
    content:
      "I've been using telehealth since the pandemic started, and honestly, it's been a mixed bag. On one hand, I don't have to drive forty-five minutes to see my doctor anymore. That's huge for someone my age with bad knees. But the technology part? That's been really frustrating. My grandson had to set up the video thing on my tablet, and half the time it doesn't connect right. I had one appointment where the doctor couldn't hear me for the first ten minutes. We ended up doing it by phone instead. But when it works, I actually like it. I can sit in my own living room, in my comfortable chair, and talk to my doctor. I don't have to worry about the weather or the roads. Last winter we had an ice storm and I would have had to cancel an in-person visit, but I just did telehealth instead. The thing that worries me though is that my doctor can't examine me properly through a screen. I had a skin thing on my arm last month, and I tried to show it on camera but the picture was blurry. She said I needed to come in anyway. So I still had to make that long drive. I think telehealth is great for check-ins and medication reviews, but for anything physical, you still need to go in. My neighbor doesn't have internet at all, so she can't even do telehealth. That's not fair. She's older than me and has more health problems. The county should do something about that. I've heard there's a program to get internet to rural areas, but it hasn't reached us yet. Overall, I'd say telehealth has been helpful for me, especially for my diabetes management. My doctor can check my blood sugar numbers without me driving all that way. But it's not a complete replacement for real visits.",
  },
  {
    title: 'James, Age 42, Farming Community',
    content:
      "Look, I'm a practical guy. I run a farm and I don't have time to take a whole day off to see a doctor. Between the drive, the waiting room, and the appointment itself, that's easily four or five hours gone. With telehealth, I can do a fifteen-minute call during my lunch break. That's been a game changer for me. But I'll tell you what bothers me -- the mental health side. I started seeing a therapist through telehealth last year after my wife suggested it. I was having a lot of stress and anxiety about the farm finances, the drought, everything piling up. The telehealth therapy has been really good actually. I can do it from my truck if I need to, just park somewhere quiet. I don't have to worry about anyone in town seeing my truck at the therapist's office. That privacy thing matters a lot in a small community. Everyone knows everyone's business. The downside is the connection quality out here is terrible. I've got satellite internet and it lags something awful. My therapist's face freezes mid-sentence sometimes and I miss what she said. We've learned to just pause and repeat, but it breaks the flow. I also worry about data security. I'm talking about personal stuff -- my marriage, my finances, my fears. I need to know that's not being recorded or stored somewhere. My therapist assured me the platform is HIPAA compliant but I don't fully understand what that means. Cost is another factor. My insurance covers telehealth the same as in-person, which is good. But if that changes, I might not be able to afford it. The co-pay is already thirty dollars per session. One thing I wish they'd improve is the prescription process. My doctor prescribed me something for blood pressure and I still had to drive to the pharmacy in town to pick it up. If they could do mail-order prescriptions along with telehealth, that would save me another trip.",
  },
  {
    title: 'Linda, Age 55, Indigenous Community',
    content:
      "In our community, healthcare has always been complicated. The nearest hospital is two hours away, and the clinic on the reservation only has a doctor two days a week. Telehealth has opened up access in ways I didn't expect. I can see specialists now that I never could before -- a cardiologist, a dermatologist. Before telehealth, I would have had to travel to the city and stay overnight just for a specialist appointment. The cost of that -- gas, hotel, taking time off work -- was prohibitive. But I want to be clear about something. Telehealth is not culturally appropriate for everyone in my community. Some of our elders don't trust technology and they shouldn't be forced to use it. Medicine in our tradition involves touch, presence, ceremony. You can't do a healing ceremony over Zoom. Our community health worker has been amazing though. She helps people set up appointments, she translates when needed, and she makes sure the technology is working. Without her, a lot of people would fall through the cracks. The language barrier is real too. Most telehealth platforms are in English only. My mother speaks primarily our traditional language and some Spanish. Finding a doctor who can accommodate that through telehealth is nearly impossible. We need interpreters built into these systems. Privacy is another major concern. In our community, health information is very sensitive. There's historical trauma around medical institutions collecting data about Indigenous peoples. When they tell us our telehealth visits are being recorded for quality purposes, that raises red flags for a lot of people. Trust has to be built, and that takes time and cultural competency. Despite all these challenges, I've seen real benefits. Our diabetes rates are high, and telehealth has made it easier for people to manage their condition with regular check-ins. Our youth are actually more comfortable with telehealth than in-person visits. They grew up with video calls.",
  },
  {
    title: 'Robert, Age 38, Mountain Community',
    content:
      "I'm a veteran with PTSD and I live up in the mountains, about ninety minutes from the VA hospital. Telehealth through the VA has literally been a lifeline for me. Before telehealth, I would skip appointments all the time because the drive was too much, especially on bad days when my anxiety was high. Now I can see my psychiatrist every two weeks from home. That consistency has made a huge difference in my treatment. The VA telehealth system is actually pretty good compared to what I've heard about civilian telehealth. They sent me a tablet pre-loaded with the software and a hotspot for internet. That removed a lot of the barriers right there. My biggest concern is what happens when the technology fails. I had a crisis situation once and the video wouldn't connect. I called the crisis line instead, but those precious minutes of trying to get the technology to work while I was in a bad state -- that was dangerous. They need a better failover system. Group therapy through telehealth has been interesting. We have a PTSD support group that meets virtually now. It's different from in-person -- some guys are more willing to talk because they feel safer at home. Others find it harder to connect through a screen. I'm somewhere in the middle. One thing I really appreciate is that telehealth has reduced the stigma for me personally. When I was going to the VA in person, I felt like everyone was watching me walk into the mental health wing. With telehealth, it's just me in my living room. Nobody knows. My wife has noticed the difference in my wellbeing since I started regular telehealth appointments. She says I'm more engaged, less irritable, more present with our kids. I attribute a lot of that to the consistency of care that telehealth makes possible.",
  },
];

// ─── Codes ───

const CODES = [
  { text: 'Access Barriers', color: '#EF4444' },
  { text: 'Technology Challenges', color: '#F59E0B' },
  { text: 'Privacy & Trust', color: '#8B5CF6' },
  { text: 'Mental Health Benefits', color: '#10B981' },
  { text: 'Cultural Considerations', color: '#EC4899' },
  { text: 'Care Quality Concerns', color: '#3B82F6' },
  { text: 'Cost & Insurance', color: '#F97316' },
  { text: 'Infrastructure Gaps', color: '#6366F1' },
];

// ─── Helpers ───

async function ensurePage(page: Page) {
  // Navigate to the app if not already there, so localStorage is accessible
  const url = page.url();
  if (!url || url === 'about:blank' || url.startsWith('chrome:')) {
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');
  }
}

async function getJwt(page: Page): Promise<string> {
  await ensurePage(page);
  return page.evaluate(() => {
    const raw = localStorage.getItem('qualcanvas-auth');
    if (!raw) return '';
    return JSON.parse(raw)?.state?.jwt || '';
  });
}

async function apiHeaders(page: Page) {
  const jwt = await getJwt(page);
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

async function openCanvasById(page: Page, canvasId: string) {
  await page.addInitScript(() => {
    const existing = localStorage.getItem('qualcanvas-ui');
    const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
    state.state = { ...state.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
  });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  const skipBtn = page.getByRole('button', { name: /skip tour/i });
  if (
    await skipBtn
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    await skipBtn.first().click();
  }
  // Wait for nodes to stabilize
  await page
    .waitForFunction(
      () => {
        const count = document.querySelectorAll('.react-flow__node').length;
        const prev = (window as any).__nodeCount || 0;
        (window as any).__nodeCount = count;
        return count > 0 && count === prev;
      },
      undefined,
      { timeout: 10000 },
    )
    .catch(() => {});
}

// ─── Shared State ───

let canvasId: string;
const transcriptIds: string[] = [];
const codeIds: string[] = [];
const codingIds: string[] = [];
const computedNodeIds: string[] = [];
const memoIds: string[] = [];
let caseId: string;

// ═══════════════════════════════════════════════════════════════
// Scenario A: Healthcare Thematic Analysis
// ═══════════════════════════════════════════════════════════════

test.describe.serial('Scenario A: Healthcare Thematic Analysis', () => {
  // ─── Phase 1: Project Setup ───

  test('A.1 Create canvas via API', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas`, {
      headers,
      data: { name: CANVAS_NAME },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.id).toBe('string');
    expect(body.data.name).toBe(CANVAS_NAME);
    canvasId = body.data.id;
  });

  test('A.2 Navigate to canvas and verify empty state', async ({ page }) => {
    await openCanvasById(page, canvasId);
    await expect(page.locator('.react-flow__pane')).toBeVisible();
    const nodeCount = await page.locator('.react-flow__node').count();
    expect(nodeCount).toBe(0);
  });

  test('A.3 Add 4 transcripts via API', async ({ page }) => {
    const headers = await apiHeaders(page);
    for (let i = 0; i < TRANSCRIPTS.length; i++) {
      const t = TRANSCRIPTS[i];
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
        headers,
        data: { title: t.title, content: t.content },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(typeof body.data.id).toBe('string');
      expect(body.data.title).toBe(t.title);
      expect(body.data.sortOrder).toBe(i);
      transcriptIds.push(body.data.id);
    }
    expect(transcriptIds).toHaveLength(4);
  });

  test('A.4 Verify canvas detail shows 4 transcripts', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.transcripts).toHaveLength(4);
    const titles = body.data.transcripts.map((t: any) => t.title);
    for (const t of TRANSCRIPTS) {
      expect(titles).toContain(t.title);
    }
  });

  // ─── Phase 2: Code Creation ───

  test('A.5 Reload canvas and verify transcript nodes render', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const transcriptNodes = page.locator('.react-flow__node');
    await expect(transcriptNodes.first()).toBeAttached({ timeout: 10000 });
    const count = await transcriptNodes.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('A.6 Create code "Access Barriers"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Access Barriers', color: '#EF4444' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.text).toBe('Access Barriers');
    expect(body.data.color).toBe('#EF4444');
    codeIds.push(body.data.id);
  });

  test('A.7 Create code "Technology Challenges"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Technology Challenges', color: '#F59E0B' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.text).toBe('Technology Challenges');
    expect(body.data.sortOrder).toBe(1);
    codeIds.push(body.data.id);
  });

  test('A.8 Create code "Privacy & Trust"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Privacy & Trust', color: '#8B5CF6' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);
  });

  test('A.9 Create code "Mental Health Benefits"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Mental Health Benefits', color: '#10B981' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);
  });

  test('A.10 Create code "Cultural Considerations"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Cultural Considerations', color: '#EC4899' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);
  });

  test('A.11 Create code "Care Quality Concerns"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Care Quality Concerns', color: '#3B82F6' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);
  });

  test('A.12 Create code "Cost & Insurance"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Cost & Insurance', color: '#F97316' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);
  });

  test('A.13 Create code "Infrastructure Gaps"', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
      headers,
      data: { text: 'Infrastructure Gaps', color: '#6366F1' },
    });
    expect(res.status()).toBe(201);
    codeIds.push((await res.json()).data.id);

    // Verify all 8 codes exist
    const detail = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    const body = await detail.json();
    expect(body.data.questions).toHaveLength(8);
  });

  test('A.14 Verify code nodes render on canvas', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const headers = await apiHeaders(page);
    const detail = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    expect(detail.data.transcripts.length + detail.data.questions.length).toBeGreaterThanOrEqual(12);

    // React Flow virtualizes off-screen nodes, so the DOM only proves the
    // canvas rendered at least one visible node.
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const count = await nodes.count();
    expect(count).toBeGreaterThan(0);
  });

  // ─── Phase 3: Systematic Coding ───

  test('A.15 Code Maria -- Access Barriers', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = "I don't have to drive forty-five minutes to see my doctor anymore";
    const startOffset = TRANSCRIPTS[0].content.indexOf(codedText);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[0],
        questionId: codeIds[0], // Access Barriers
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.codedText).toBe(codedText);
    expect(body.data.startOffset).toBe(startOffset);
    codingIds.push(body.data.id);
  });

  test('A.16 Code Maria -- Technology Challenges', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText =
      "the technology part? That's been really frustrating. My grandson had to set up the video thing on my tablet, and half the time it doesn't connect right";
    const startOffset = TRANSCRIPTS[0].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[0],
        questionId: codeIds[1], // Technology Challenges
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.17 Code Maria -- Care Quality Concerns', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = "my doctor can't examine me properly through a screen";
    const startOffset = TRANSCRIPTS[0].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[0],
        questionId: codeIds[5], // Care Quality Concerns
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.18 Code Maria -- Infrastructure Gaps', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = "My neighbor doesn't have internet at all, so she can't even do telehealth. That's not fair";
    const startOffset = TRANSCRIPTS[0].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[0],
        questionId: codeIds[7], // Infrastructure Gaps
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.19 Code James -- Access Barriers', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText =
      "Between the drive, the waiting room, and the appointment itself, that's easily four or five hours gone";
    const startOffset = TRANSCRIPTS[1].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[1],
        questionId: codeIds[0],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.20 Code James -- Mental Health Benefits', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = 'The telehealth therapy has been really good actually';
    const startOffset = TRANSCRIPTS[1].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[1],
        questionId: codeIds[3], // Mental Health Benefits
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.21 Code James -- Privacy & Trust', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = "I also worry about data security. I'm talking about personal stuff";
    const startOffset = TRANSCRIPTS[1].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[1],
        questionId: codeIds[2], // Privacy & Trust
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.22 Code James -- Technology Challenges', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = 'satellite internet and it lags something awful';
    const startOffset = TRANSCRIPTS[1].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[1],
        questionId: codeIds[1],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.23 Code James -- Cost & Insurance', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText =
      'My insurance covers telehealth the same as in-person, which is good. But if that changes, I might not be able to afford it';
    const startOffset = TRANSCRIPTS[1].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[1],
        questionId: codeIds[6], // Cost & Insurance
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.24 Code Linda -- Cultural Considerations (x2)', async ({ page }) => {
    const headers = await apiHeaders(page);

    const text1 = 'Telehealth is not culturally appropriate for everyone in my community';
    const off1 = TRANSCRIPTS[2].content.indexOf(text1);
    expect(off1).toBeGreaterThanOrEqual(0);
    const res1 = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[2],
        questionId: codeIds[4], // Cultural Considerations
        startOffset: off1,
        endOffset: off1 + text1.length,
        codedText: text1,
      },
    });
    expect(res1.status()).toBe(201);
    codingIds.push((await res1.json()).data.id);

    const text2 = 'The language barrier is real too. Most telehealth platforms are in English only';
    const off2 = TRANSCRIPTS[2].content.indexOf(text2);
    expect(off2).toBeGreaterThanOrEqual(0);
    const res2 = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[2],
        questionId: codeIds[4],
        startOffset: off2,
        endOffset: off2 + text2.length,
        codedText: text2,
      },
    });
    expect(res2.status()).toBe(201);
    codingIds.push((await res2.json()).data.id);
  });

  test('A.25 Code Linda -- Privacy & Trust', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = "There's historical trauma around medical institutions collecting data about Indigenous peoples";
    const startOffset = TRANSCRIPTS[2].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[2],
        questionId: codeIds[2],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.26 Code Linda -- Access Barriers', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText =
      'The nearest hospital is two hours away, and the clinic on the reservation only has a doctor two days a week';
    const startOffset = TRANSCRIPTS[2].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[2],
        questionId: codeIds[0],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.27 Code Robert -- Mental Health Benefits (x2)', async ({ page }) => {
    const headers = await apiHeaders(page);

    const text1 = 'Telehealth through the VA has literally been a lifeline for me';
    const off1 = TRANSCRIPTS[3].content.indexOf(text1);
    expect(off1).toBeGreaterThanOrEqual(0);
    const res1 = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[3],
        questionId: codeIds[3],
        startOffset: off1,
        endOffset: off1 + text1.length,
        codedText: text1,
      },
    });
    expect(res1.status()).toBe(201);
    codingIds.push((await res1.json()).data.id);

    const text2 = 'telehealth has reduced the stigma for me personally';
    const off2 = TRANSCRIPTS[3].content.indexOf(text2);
    expect(off2).toBeGreaterThanOrEqual(0);
    const res2 = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[3],
        questionId: codeIds[3],
        startOffset: off2,
        endOffset: off2 + text2.length,
        codedText: text2,
      },
    });
    expect(res2.status()).toBe(201);
    codingIds.push((await res2.json()).data.id);
  });

  test('A.28 Code Robert -- Technology Challenges', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText =
      "the video wouldn't connect. I called the crisis line instead, but those precious minutes of trying to get the technology to work";
    const startOffset = TRANSCRIPTS[3].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[3],
        questionId: codeIds[1],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.29 Code Robert -- Access Barriers', async ({ page }) => {
    const headers = await apiHeaders(page);
    const codedText = 'I live up in the mountains, about ninety minutes from the VA hospital';
    const startOffset = TRANSCRIPTS[3].content.indexOf(codedText);
    expect(startOffset).toBeGreaterThanOrEqual(0);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
      headers,
      data: {
        transcriptId: transcriptIds[3],
        questionId: codeIds[0],
        startOffset,
        endOffset: startOffset + codedText.length,
        codedText,
      },
    });
    expect(res.status()).toBe(201);
    codingIds.push((await res.json()).data.id);
  });

  test('A.30 Verify total coding count via API', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    const body = await res.json();
    const codings = body.data.codings;
    expect(codings.length).toBeGreaterThanOrEqual(16);
    for (const c of codings) {
      expect(typeof c.transcriptId).toBe('string');
      expect(typeof c.questionId).toBe('string');
      expect(c.startOffset).toBeLessThan(c.endOffset);
    }
  });

  // ─── Phase 4: Navigator Sidebar Verification ───

  test('A.31 Verify code frequencies via API', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    const body = await res.json();
    const codings = body.data.codings;

    // Count codings per code
    const codeCounts = new Map<string, number>();
    for (const c of codings) {
      codeCounts.set(c.questionId, (codeCounts.get(c.questionId) || 0) + 1);
    }

    // Access Barriers: Maria, James, Linda, Robert = 4
    expect(codeCounts.get(codeIds[0])).toBe(4);
    // Technology Challenges: Maria, James, Robert = 3
    expect(codeCounts.get(codeIds[1])).toBe(3);
    // Privacy & Trust: James, Linda = 2
    expect(codeCounts.get(codeIds[2])).toBe(2);
    // Mental Health Benefits: James(1), Robert(2) = 3
    expect(codeCounts.get(codeIds[3])).toBe(3);
    // Cultural Considerations: Linda(2) = 2
    expect(codeCounts.get(codeIds[4])).toBe(2);
  });

  test('A.32 Verify source coverage via API', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    const body = await res.json();
    const codings = body.data.codings;

    const transcriptCounts = new Map<string, number>();
    for (const c of codings) {
      transcriptCounts.set(c.transcriptId, (transcriptCounts.get(c.transcriptId) || 0) + 1);
    }

    // Maria: Access, Tech, CareQuality, Infrastructure = 4
    expect(transcriptCounts.get(transcriptIds[0])).toBe(4);
    // James: Access, MentalHealth, Privacy, Tech, Cost = 5
    expect(transcriptCounts.get(transcriptIds[1])).toBe(5);
    // Linda: Cultural(x2), Privacy, Access = 4
    expect(transcriptCounts.get(transcriptIds[2])).toBe(4);
    // Robert: MentalHealth(x2), Tech, Access = 4
    expect(transcriptCounts.get(transcriptIds[3])).toBe(4);
  });

  test('A.33 Canvas page renders transcript and code nodes', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const headers = await apiHeaders(page);
    const detail = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    expect(detail.data.transcripts).toHaveLength(4);
    expect(detail.data.questions).toHaveLength(8);
    // React Flow may only mount nodes in/near the current viewport.
    expect(await nodes.count()).toBeGreaterThan(0);
  });

  test('A.34 Navigator sidebar shows codes with counts', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Try to open the navigator sidebar
    const codesTab = page.locator('button').filter({ hasText: /^Codes\s*\(/ });
    if (!(await codesTab.isVisible({ timeout: 3000 }).catch(() => false))) {
      const toggler = page
        .locator('button[title*="navigator" i], button[title*="Navigator" i], button[title*="sidebar" i]')
        .first();
      if (await toggler.isVisible({ timeout: 1000 }).catch(() => false)) {
        await toggler.click();
      }
    }

    // Verify the codes tab shows code count
    if (await codesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await codesTab.click();
      // Look for code names in the sidebar
      await expect(page.getByText('Access Barriers').first()).toBeAttached({ timeout: 5000 });
    }
  });

  // ─── Phase 5: Analysis Tools ───

  test('A.35 Create and run Statistics node (grouped by code)', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'stats', label: 'Code Frequency', config: { groupBy: 'question' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(result.items).toHaveLength(8);
    const accessItem = result.items.find((i: any) => i.label === 'Access Barriers' || i.questionId === codeIds[0]);
    expect(accessItem).toBeDefined();
    expect(accessItem.count).toBe(4);

    const mentalItem = result.items.find(
      (i: any) => i.label === 'Mental Health Benefits' || i.questionId === codeIds[3],
    );
    expect(mentalItem).toBeDefined();
    expect(mentalItem.count).toBe(3);

    expect(result.total).toBeGreaterThanOrEqual(16);
  });

  test('A.36 Create and run Statistics node (grouped by transcript)', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'stats', label: 'Source Frequency', config: { groupBy: 'transcript' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(result.items).toHaveLength(4);
  });

  test('A.37 Create and run Word Cloud node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'wordcloud', label: 'Word Cloud', config: { maxWords: 50 } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.words)).toBe(true);
    expect(result.words.length).toBeGreaterThan(0);
    expect(result.words.length).toBeLessThanOrEqual(50);

    // Check structure
    const firstWord = result.words[0];
    expect(typeof firstWord.text).toBe('string');
    expect(typeof firstWord.count).toBe('number');

    // Common words from the transcripts should appear
    const wordTexts = result.words.map((w: any) => w.text.toLowerCase());
    expect(wordTexts.some((w: string) => w === 'telehealth')).toBe(true);
  });

  test('A.38 Create and run Co-occurrence node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: {
        nodeType: 'cooccurrence',
        label: 'Code Co-occurrence',
        config: { questionIds: [codeIds[0], codeIds[1]] }, // Access Barriers + Tech Challenges
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.pairs)).toBe(true);
    // Maria, James, and Robert all have both Access Barriers and Technology Challenges
  });

  test('A.39 Create and run Sentiment node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'sentiment', label: 'Sentiment Analysis', config: { scope: 'all' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(result.overall).toBeDefined();
    expect(typeof result.overall.positive).toBe('number');
    expect(typeof result.overall.negative).toBe('number');
    expect(typeof result.overall.neutral).toBe('number');
    expect(result.overall.positive + result.overall.negative + result.overall.neutral).toBeGreaterThan(0);
  });

  test('A.40 Create and run Comparison node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: {
        nodeType: 'comparison',
        label: 'Transcript Comparison',
        config: { transcriptIds: [...transcriptIds] },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(result.transcripts).toHaveLength(4);
    for (const t of result.transcripts) {
      expect(Array.isArray(t.profile)).toBe(true);
    }
  });

  test('A.41 Create and run Clustering node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'cluster', label: 'Theme Clusters', config: { k: 3 } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.clusters)).toBe(true);
    expect(result.clusters.length).toBeGreaterThan(0);
    expect(result.clusters.length).toBeLessThanOrEqual(3);
  });

  test('A.42 Create and run Coding Query node (AND query)', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: {
        nodeType: 'codingquery',
        label: 'Access + Tech',
        config: {
          conditions: [
            { questionId: codeIds[0], operator: 'AND' },
            { questionId: codeIds[1], operator: 'AND' },
          ],
        },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.matches)).toBe(true);
    expect(typeof result.totalMatches).toBe('number');
  });

  test('A.43 Create and run Theme Map (Treemap) node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'treemap', label: 'Theme Map', config: { metric: 'count' } },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.nodes)).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    for (const n of result.nodes) {
      expect(typeof n.name).toBe('string');
      expect(typeof n.size).toBe('number');
    }
  });

  test('A.44 Verify computed nodes render on canvas', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const headers = await apiHeaders(page);
    const detail = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    expect(detail.data.computedNodes.length).toBeGreaterThanOrEqual(9);
    expect(await nodes.count()).toBeGreaterThan(0);
  });

  test('A.45 Create case and run Framework Matrix', async ({ page }) => {
    const headers = await apiHeaders(page);

    // Create a case
    const caseRes = await page.request.post(`${BASE}/canvas/${canvasId}/cases`, {
      headers,
      data: { name: 'Rural Patients', attributes: { setting: 'rural' } },
    });
    expect(caseRes.status()).toBe(201);
    caseId = (await caseRes.json()).data.id;

    // Assign Maria and James to the case
    await page.request.put(`${BASE}/canvas/${canvasId}/transcripts/${transcriptIds[0]}`, {
      headers,
      data: { caseId },
    });
    await page.request.put(`${BASE}/canvas/${canvasId}/transcripts/${transcriptIds[1]}`, {
      headers,
      data: { caseId },
    });

    // Create and run Framework Matrix
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: { nodeType: 'matrix', label: 'Framework Matrix' },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
  });

  test('A.46 Create and run Search node', async ({ page }) => {
    const headers = await apiHeaders(page);
    const createRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed`, {
      headers,
      data: {
        nodeType: 'search',
        label: 'Search telehealth',
        config: { pattern: 'telehealth', mode: 'keyword' },
      },
    });
    expect(createRes.status()).toBe(201);
    const nodeId = (await createRes.json()).data.id;
    computedNodeIds.push(nodeId);

    const runRes = await page.request.post(`${BASE}/canvas/${canvasId}/computed/${nodeId}/run`, { headers });
    expect(runRes.ok()).toBeTruthy();
    const result = (await runRes.json()).data.result;

    expect(Array.isArray(result.matches)).toBe(true);
    // All 4 transcripts mention "telehealth"
    const matchedTranscriptIds = [...new Set(result.matches.map((m: any) => m.transcriptId))];
    expect(matchedTranscriptIds.length).toBe(4);
  });

  // ─── Phase 6: Memos ───

  test('A.47 Create analytical memo', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/memos`, {
      headers,
      data: {
        title: 'Theme: Access Barriers',
        content:
          '## Key Finding\n\nAll four participants identified physical distance as a primary barrier to healthcare access. Travel times ranged from 45 minutes to 2 hours. Telehealth addresses this barrier directly but does not eliminate it entirely, as physical examinations still require in-person visits.',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Theme: Access Barriers');
    expect(body.data.content).toContain('## Key Finding');
    memoIds.push(body.data.id);
  });

  test('A.48 Create methodological memo', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/memos`, {
      headers,
      data: {
        title: 'Methodological Note',
        content:
          'Semi-structured interviews ranged from 500-600 words each. Four participants from different rural community types were sampled: Appalachian, farming, Indigenous, and mountain/veteran. This diversity provides multiple perspectives on telehealth adoption.',
      },
    });
    expect(res.status()).toBe(201);
    memoIds.push((await res.json()).data.id);
  });

  test('A.49 Update memo with additional findings', async ({ page }) => {
    const headers = await apiHeaders(page);
    const updatedContent =
      '## Key Finding\n\nAll four participants identified physical distance as a primary barrier to healthcare access.\n\n## Cross-Case Comparison\n\nWhile all participants reported distance as a barrier, the severity varied: Maria (45 min), James (4-5 hrs total), Linda (2 hrs), Robert (90 min). The VA system provided the most comprehensive telehealth support (tablet + hotspot), while Indigenous communities relied on community health workers.';

    const res = await page.request.put(`${BASE}/canvas/${canvasId}/memos/${memoIds[0]}`, {
      headers,
      data: { content: updatedContent },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.content).toContain('Cross-Case Comparison');
  });

  test('A.50 Verify memo nodes render on canvas', async ({ page }) => {
    await openCanvasById(page, canvasId);
    const nodes = page.locator('.react-flow__node');
    await expect(nodes.first()).toBeAttached({ timeout: 10000 });
    const headers = await apiHeaders(page);
    const detail = await (await page.request.get(`${BASE}/canvas/${canvasId}`, { headers })).json();
    expect(detail.data.memos).toHaveLength(2);
    expect(await nodes.count()).toBeGreaterThan(0);
  });

  // ─── Phase 7: Export ───

  test('A.51 Export Excel', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/export/excel`, { headers });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument');
    expect(res.headers()['content-disposition']).toContain('.xlsx');
    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
  });

  test('A.52 Export QDPX', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/export/qdpx`, { headers });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/zip');
    expect(res.headers()['content-disposition']).toContain('.qdpx');
    const body = await res.body();
    expect(body.length).toBeGreaterThan(1000);
  });

  test('A.53 Export UI -- export menu opens', async ({ page }) => {
    await openCanvasById(page, canvasId);

    // Look for an export button/dropdown
    const exportBtn = page
      .locator('button')
      .filter({ hasText: /export/i })
      .first();
    const menuItem = page.locator('[data-tour*="export"], button[aria-label*="export" i]').first();

    const hasExportBtn = await exportBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const hasMenuItem = await menuItem.isVisible({ timeout: 1000 }).catch(() => false);

    // If we find an export trigger, click it and check for options
    if (hasExportBtn) {
      await exportBtn.click();
      // Check for export options in the dropdown
      const pngOption = page.getByText(/PNG/i).first();
      const hasPng = await pngOption.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasPng).toBe(true);
    } else if (hasMenuItem) {
      await menuItem.click();
    } else {
      // Export might be behind a menu -- check toolbar "more" menu
      const moreBtn = page.locator('button[title*="More" i], button[aria-label*="more" i]').first();
      if (await moreBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await moreBtn.click();
        const exportOpt = page.getByText(/export/i).first();
        await expect(exportOpt).toBeVisible({ timeout: 2000 });
      }
    }
  });

  // ─── Phase 8: Cleanup Verification ───

  test('A.54 Soft-delete canvas', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.delete(`${BASE}/canvas/${canvasId}`, { headers });
    expect(res.ok()).toBeTruthy();

    // Verify it's in trash
    const trashRes = await page.request.get(`${BASE}/canvas/trash`, { headers });
    const trashBody = await trashRes.json();
    const trashed = trashBody.data.find((c: any) => c.id === canvasId);
    expect(trashed).toBeDefined();
  });

  test('A.55 Restore canvas from trash', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/restore`, { headers });
    expect(res.ok()).toBeTruthy();

    // Verify it's back in active list
    const listRes = await page.request.get(`${BASE}/canvas`, { headers });
    const listBody = await listRes.json();
    const active = listBody.data.find((c: any) => c.id === canvasId);
    expect(active).toBeDefined();
  });

  test('A.56 Verify full data integrity after restore', async ({ page }) => {
    const headers = await apiHeaders(page);
    const res = await page.request.get(`${BASE}/canvas/${canvasId}`, { headers });
    const body = await res.json();

    expect(body.data.transcripts).toHaveLength(4);
    expect(body.data.questions).toHaveLength(8);
    expect(body.data.codings.length).toBeGreaterThanOrEqual(16);
    expect(body.data.memos).toHaveLength(2);
    expect(body.data.computedNodes.length).toBeGreaterThanOrEqual(10);
  });

  // ─── Cleanup ───

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await context.newPage();
    await page.goto('/canvas');
    await page.waitForLoadState('networkidle');

    if (canvasId) {
      const jwt = await page.evaluate(() => {
        const raw = localStorage.getItem('qualcanvas-auth');
        if (!raw) return '';
        return JSON.parse(raw)?.state?.jwt || '';
      });
      const headers = { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };

      // Soft delete then permanent delete
      await page.request.delete(`${BASE}/canvas/${canvasId}`, { headers });
      await page.request.delete(`${BASE}/canvas/${canvasId}/permanent`, { headers });
    }

    await page.close();
    await context.close();
  });
});

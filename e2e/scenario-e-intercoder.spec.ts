import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario E: Team Collaboration — Intercoder Reliability Study
 *
 * A research team of 2 coders independently codes the same transcript,
 * then compares using Cohen's Kappa. Tests sharing, cloning, and
 * intercoder reliability features.
 */

const API = 'http://localhost:3007/api';

// ─── Transcript content ───

const TRANSCRIPT_1 = {
  title: 'Community Organizer Interview',
  content:
    'Community organizing in urban neighborhoods has changed dramatically in the last decade. Social media has become a ' +
    'powerful tool for mobilization, allowing organizers to reach thousands of residents within hours. But technology also creates ' +
    'new challenges. Digital literacy varies widely across communities, and those without reliable internet access are often left out ' +
    'of online organizing efforts. The trust deficit between institutions and communities remains the fundamental barrier. People who ' +
    'have been promised change repeatedly without results are understandably skeptical. Building authentic relationships takes time, ' +
    'showing up consistently, listening before speaking, and following through on commitments. Power dynamics within communities ' +
    'are complex. Longtime residents and newcomers sometimes have conflicting visions for the neighborhood. Gentrification pressures ' +
    'create tensions that organizers must navigate carefully. Youth engagement has been a bright spot in recent years. Young people ' +
    'bring energy, creativity, and a willingness to challenge the status quo. They are less constrained by historical grievances and ' +
    'more focused on building something new. Funding remains precarious for community organizations. Grant cycles create instability, ' +
    'and the pressure to demonstrate measurable outcomes can distort priorities. Some of the most important work in community organizing ' +
    'is invisible and unmeasurable, the quiet conversations, the relationship building, the slow trust that develops over shared meals.',
};

const TRANSCRIPT_2 = {
  title: 'Neighborhood Association Leader',
  content:
    'I have been leading this neighborhood association for seven years now, and the landscape keeps shifting. When I started, our biggest ' +
    'issues were crime and abandoned properties. Now it is affordable housing and displacement. The community engagement strategies ' +
    'that worked five years ago do not work today. People are busier, more distracted, and more cynical about whether their involvement ' +
    'matters. We have had to adapt by meeting people where they are, literally and figuratively. Instead of expecting residents to come ' +
    'to monthly meetings at the community center, we hold pop-up conversations at the grocery store, the laundromat, the bus stop. ' +
    'The institutional trust issue is real. City hall makes promises during election season and then goes silent. Developers come to ' +
    'our meetings with slick presentations about community benefits, but the benefits rarely materialize. We have learned to demand ' +
    'written commitments with enforcement mechanisms. Coalition building across neighborhoods has been essential. No single community ' +
    'can fight displacement alone. We have formed alliances with five other neighborhood associations to advocate for city-wide policies. ' +
    'The power of collective action is something I have witnessed firsthand. When two hundred residents show up at a city council meeting, ' +
    'politicians listen. Youth involvement in our association has transformed our approach. Young members pushed us to use social media, ' +
    'to create multilingual materials, and to address issues like police accountability that the older leadership had avoided.',
};

// ─── State shared across tests ───

let jwt: string;
let canvasId: string;
const transcriptIds: string[] = [];
const codeIds: Record<string, string> = {};
const codingIds: string[] = [];
let shareId1: string;
let shareCode1: string;
let shareId2: string;
let clonedCanvasId: string;

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

test.describe('Scenario E: Intercoder Reliability & Sharing', () => {
  const canvasName = `Intercoder Reliability ${Date.now()}`;

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
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    try {
      if (clonedCanvasId) {
        await page.request.delete(`${API}/canvas/${clonedCanvasId}`, { headers: headers() });
        await page.request.delete(`${API}/canvas/${clonedCanvasId}/permanent`, { headers: headers() });
      }
      if (canvasId) {
        await page.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
        await page.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
      }
    } catch { /* best-effort */ }
    await page.close();
    await ctx.close();
  });

  // ─── Phase 1: Setup ───

  test('E.1 Create canvas with 2 transcripts', async ({ page }) => {
    const createRes = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    canvasId = createData.data.id;
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

  test('E.2 Create 4 codes for reliability testing', async ({ page }) => {
    const codeSpecs = [
      { key: 'trust', text: 'Trust Building', color: '#10B981' },
      { key: 'technology', text: 'Technology Impact', color: '#3B82F6' },
      { key: 'youth', text: 'Youth Engagement', color: '#F59E0B' },
      { key: 'power', text: 'Power Dynamics', color: '#EF4444' },
    ];
    for (const spec of codeSpecs) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: spec.text, color: spec.color },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      codeIds[spec.key] = body.data.id;
    }

    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.questions).toHaveLength(4);
  });

  test('E.3 Create codings simulating Coder A (first batch)', async ({ page }) => {
    const coderACodings = [
      { transcript: 0, qKey: 'trust', text: 'Building authentic relationships takes time' },
      { transcript: 0, qKey: 'technology', text: 'Social media has become a powerful tool for mobilization' },
      { transcript: 0, qKey: 'youth', text: 'Youth engagement has been a bright spot in recent years' },
      { transcript: 0, qKey: 'power', text: 'Power dynamics within communities are complex' },
      { transcript: 1, qKey: 'trust', text: 'The institutional trust issue is real' },
      { transcript: 1, qKey: 'technology', text: 'Young members pushed us to use social media' },
      { transcript: 1, qKey: 'power', text: 'The power of collective action is something I have witnessed firsthand' },
    ];
    for (const c of coderACodings) {
      const content = c.transcript === 0 ? TRANSCRIPT_1.content : TRANSCRIPT_2.content;
      const startOffset = content.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[c.transcript],
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

  test('E.4 Create codings simulating Coder B (second batch)', async ({ page }) => {
    const coderBCodings = [
      { transcript: 0, qKey: 'trust', text: 'the quiet conversations, the relationship building, the slow trust that develops over shared meals' },
      { transcript: 0, qKey: 'technology', text: 'Digital literacy varies widely across communities' },
      { transcript: 0, qKey: 'power', text: 'Longtime residents and newcomers sometimes have conflicting visions' },
      { transcript: 0, qKey: 'youth', text: 'Young people bring energy, creativity, and a willingness to challenge the status quo' },
      { transcript: 1, qKey: 'trust', text: 'We have learned to demand written commitments with enforcement mechanisms' },
      { transcript: 1, qKey: 'youth', text: 'Youth involvement in our association has transformed our approach' },
      { transcript: 1, qKey: 'power', text: 'When two hundred residents show up at a city council meeting, politicians listen' },
      { transcript: 1, qKey: 'technology', text: 'to create multilingual materials' },
    ];
    for (const c of coderBCodings) {
      const content = c.transcript === 0 ? TRANSCRIPT_1.content : TRANSCRIPT_2.content;
      const startOffset = content.indexOf(c.text);
      expect(startOffset).toBeGreaterThanOrEqual(0);
      const res = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId: transcriptIds[c.transcript],
          questionId: codeIds[c.qKey],
          startOffset,
          endOffset: startOffset + c.text.length,
          codedText: c.text,
        },
      });
      expect(res.status()).toBe(201);
      codingIds.push((await res.json()).data.id);
    }

    // Verify total codings
    const detail = await (await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() })).json();
    expect(detail.data.codings).toHaveLength(15);
  });

  // ─── Phase 2: Sharing ───

  test('E.5 Create share code', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/share`, {
      headers: headers(),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    shareId1 = body.data.id;
    shareCode1 = body.data.shareCode;
    expect(shareCode1).toMatch(/^SHARE-/);
    expect(body.data.cloneCount).toBe(0);
  });

  test('E.6 List shares and verify', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/shares`, {
      headers: headers(),
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const found = body.data.find((s: { id: string }) => s.id === shareId1);
    expect(found).toBeTruthy();
    expect(found.shareCode).toBe(shareCode1);
  });

  test('E.7 Create a second share code', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/share`, {
      headers: headers(),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    shareId2 = body.data.id;
    expect(body.data.shareCode).toMatch(/^SHARE-/);
    expect(body.data.shareCode).not.toBe(shareCode1);
  });

  test('E.8 Delete the second share code', async ({ page }) => {
    const res = await page.request.delete(`${API}/canvas/${canvasId}/share/${shareId2}`, {
      headers: headers(),
    });
    expect(res.ok()).toBe(true);

    // Verify it's gone
    const listRes = await page.request.get(`${API}/canvas/${canvasId}/shares`, { headers: headers() });
    const body = await listRes.json();
    const found = body.data.find((s: { id: string }) => s.id === shareId2);
    expect(found).toBeFalsy();
  });

  test('E.9 Clone via share code', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/clone/${shareCode1}`, {
      headers: headers(),
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    clonedCanvasId = body.data.id;
    expect(body.data.name).toContain('(Clone)');

    // Verify clone has same data
    const detail = await (await page.request.get(`${API}/canvas/${clonedCanvasId}`, { headers: headers() })).json();
    expect(detail.data.transcripts).toHaveLength(2);
    expect(detail.data.questions).toHaveLength(4);
    expect(detail.data.codings).toHaveLength(15);
  });

  test('E.10 Verify clone count incremented', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/shares`, { headers: headers() });
    const body = await res.json();
    const share = body.data.find((s: { id: string }) => s.id === shareId1);
    expect(share).toBeTruthy();
    expect(share.cloneCount).toBe(1);
  });

  // ─── Phase 3: Intercoder Reliability ───

  test('E.11 Run intercoder reliability (Kappa)', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/intercoder`, {
      headers: headers(),
      data: { userId: 'coder-b-simulated', transcriptId: transcriptIds[0] },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data).toHaveProperty('kappa');
    expect(typeof body.data.kappa).toBe('number');
    expect(body.data.kappa).toBeGreaterThanOrEqual(-1);
    expect(body.data.kappa).toBeLessThanOrEqual(1);
  });

  test('E.12 Verify Kappa on second transcript', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/intercoder`, {
      headers: headers(),
      data: { userId: 'coder-b-simulated', transcriptId: transcriptIds[1] },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Number.isFinite(body.data.kappa)).toBe(true);
    // Should have segment-level data
    expect(body.data).toHaveProperty('segments');
    expect(Array.isArray(body.data.segments)).toBe(true);
  });

  test('E.13 Create reliability memo', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/memos`, {
      headers: headers(),
      data: {
        title: 'Intercoder Reliability Results',
        content:
          'Kappa analysis completed for both transcripts. The intercoder agreement between Coder A and Coder B ' +
          'shows moderate reliability. Key areas of disagreement include the coding of trust-related segments where ' +
          'coders differed on boundary placement. Reconciliation discussion needed for Technology Impact codes.',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Intercoder Reliability Results');
  });

  test('E.14 Clean up cloned canvas', async ({ page }) => {
    expect(clonedCanvasId).toBeTruthy();
    const delRes = await page.request.delete(`${API}/canvas/${clonedCanvasId}`, { headers: headers() });
    expect(delRes.ok()).toBe(true);
    const permRes = await page.request.delete(`${API}/canvas/${clonedCanvasId}/permanent`, { headers: headers() });
    expect(permRes.ok()).toBe(true);
    clonedCanvasId = ''; // prevent double-delete in afterAll
  });
});

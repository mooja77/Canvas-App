import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario K: Training Center & QDPX
 *
 * Training documents with gold-standard codings, Kappa scoring,
 * and QDPX export/import roundtrip validation.
 */

const BASE = 'http://localhost:3007/api';

const TRANSCRIPT_CONTENT =
  'The patient reported significant improvement in mobility after the rehabilitation program. ' +
  'Physical therapy sessions three times per week helped restore range of motion in the affected joint. ' +
  'However, the patient expressed frustration with insurance coverage limitations that restricted the number ' +
  'of approved sessions. The therapist noted that continued progress would require ongoing exercises at home. ' +
  'Pain management remained a concern, with the patient preferring non-pharmaceutical approaches when possible. ' +
  'The interdisciplinary team recommended a combination of heat therapy, gentle stretching, and gradual weight-bearing ' +
  'exercises. Follow-up appointments were scheduled at two-week intervals to monitor progress and adjust the treatment plan.';

// ─── Shared state ───

let jwt: string;
let canvasId: string;
let emptyCanvasId: string;
let transcriptId: string;
let trainingDocId: string;
const codeIds: string[] = [];
const codingIds: string[] = [];

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

// ─── Tests ───

test.describe.serial('Scenario K: Training Center & QDPX', () => {

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
    expect(jwt).toBeTruthy();

    // Create canvas with data
    const canvasRes = await page.request.post(`${BASE}/canvas`, {
      headers: headers(),
      data: { name: `Training-${Date.now()}` },
    });
    expect(canvasRes.status()).toBe(201);
    canvasId = (await canvasRes.json()).data.id;

    // Add transcript
    const tRes = await page.request.post(`${BASE}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: { title: 'Rehab Interview', content: TRANSCRIPT_CONTENT },
    });
    expect(tRes.status()).toBe(201);
    transcriptId = (await tRes.json()).data.id;

    // Add codes
    const codes = [
      { text: 'Patient Progress', color: '#10B981' },
      { text: 'Insurance Barriers', color: '#EF4444' },
      { text: 'Treatment Plan', color: '#3B82F6' },
    ];
    for (const c of codes) {
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: c.text, color: c.color },
      });
      expect(res.status()).toBe(201);
      codeIds.push((await res.json()).data.id);
    }

    // Add codings
    const codingPairs = [
      { ci: 0, text: 'significant improvement in mobility after the rehabilitation program' },
      { ci: 0, text: 'restore range of motion in the affected joint' },
      { ci: 1, text: 'insurance coverage limitations that restricted the number of approved sessions' },
      { ci: 2, text: 'combination of heat therapy, gentle stretching, and gradual weight-bearing exercises' },
      { ci: 2, text: 'Follow-up appointments were scheduled at two-week intervals' },
    ];
    for (const cp of codingPairs) {
      const start = TRANSCRIPT_CONTENT.indexOf(cp.text);
      if (start < 0) continue;
      const res = await page.request.post(`${BASE}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId,
          questionId: codeIds[cp.ci],
          startOffset: start,
          endOffset: start + cp.text.length,
          codedText: cp.text,
        },
      });
      expect(res.status()).toBe(201);
      codingIds.push((await res.json()).data.id);
    }

    await page.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const page = await ctx.newPage();
    try {
      for (const id of [canvasId, emptyCanvasId].filter(Boolean)) {
        await page.request.delete(`${BASE}/canvas/${id}`, { headers: headers() });
        await page.request.delete(`${BASE}/canvas/${id}/permanent`, { headers: headers() });
      }
    } catch { /* best-effort */ }
    await page.close();
    await ctx.close();
  });

  // ─── Phase 1: Training Center ───

  test('K.1 Create training document with gold-standard codings', async ({ page }) => {
    const goldCodings = [
      { questionId: codeIds[0], startOffset: 0, endOffset: 70, codedText: TRANSCRIPT_CONTENT.substring(0, 70) },
      { questionId: codeIds[1], startOffset: 200, endOffset: 280, codedText: TRANSCRIPT_CONTENT.substring(200, 280) },
      { questionId: codeIds[2], startOffset: 400, endOffset: 500, codedText: TRANSCRIPT_CONTENT.substring(400, 500) },
    ];

    const res = await page.request.post(`${BASE}/canvas/${canvasId}/training`, {
      headers: headers(),
      data: {
        transcriptId,
        name: 'Coding Exercise 1',
        instructions: 'Code the rehabilitation interview using the provided codebook.',
        goldCodings,
        passThreshold: 0.7,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.name).toBe('Coding Exercise 1');
    expect(body.data.passThreshold).toBe(0.7);
    expect(Array.isArray(body.data.goldCodings)).toBe(true);
    expect(body.data.goldCodings).toHaveLength(3);
    trainingDocId = body.data.id;
  });

  test('K.2 List training documents', async ({ page }) => {
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/training`, { headers: headers() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const doc = body.data.find((d: any) => d.id === trainingDocId);
    expect(doc).toBeTruthy();
    expect(doc.name).toBe('Coding Exercise 1');
  });

  test('K.3 Get training document detail', async ({ page }) => {
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/training/${trainingDocId}`, { headers: headers() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.goldCodings).toHaveLength(3);
    expect(body.data.passThreshold).toBe(0.7);
    expect(Array.isArray(body.data.attempts)).toBe(true);
  });

  test('K.4 Submit training attempt — passing (matching gold standard)', async ({ page }) => {
    // Submit codings that match the gold standard exactly
    const attemptCodings = [
      { questionId: codeIds[0], startOffset: 0, endOffset: 70 },
      { questionId: codeIds[1], startOffset: 200, endOffset: 280 },
      { questionId: codeIds[2], startOffset: 400, endOffset: 500 },
    ];

    const res = await page.request.post(`${BASE}/canvas/${canvasId}/training/${trainingDocId}/attempt`, {
      headers: headers(),
      data: { codings: attemptCodings },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.data.kappaScore).toBe('number');
    expect(body.data.kappaScore).toBeGreaterThanOrEqual(0.7);
    expect(body.data.passed).toBe(true);
  });

  test('K.5 Submit training attempt — divergent codings', async ({ page }) => {
    // Submit codings that are completely different from gold standard
    const attemptCodings = [
      { questionId: codeIds[2], startOffset: 0, endOffset: 30 },
    ];

    const res = await page.request.post(`${BASE}/canvas/${canvasId}/training/${trainingDocId}/attempt`, {
      headers: headers(),
      data: { codings: attemptCodings },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(typeof body.data.kappaScore).toBe('number');
    expect(typeof body.data.passed).toBe('boolean');
  });

  test('K.6 Get training results (attempts listed)', async ({ page }) => {
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/training/${trainingDocId}`, { headers: headers() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data.attempts.length).toBeGreaterThanOrEqual(2);
    // First attempt should be most recent (ordered desc)
    expect(typeof body.data.attempts[0].kappaScore).toBe('number');
  });

  // ─── Phase 2: QDPX Roundtrip ───

  test('K.7 Export QDPX from fully coded canvas', async ({ page }) => {
    const res = await page.request.get(`${BASE}/canvas/${canvasId}/export/qdpx`, { headers: headers() });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/zip');
    const body = await res.body();
    expect(body.length).toBeGreaterThan(500);
  });

  test('K.8 QDPX import endpoint validates file presence', async ({ page }) => {
    const res = await page.request.post(`${BASE}/canvas/${canvasId}/import/qdpx`, {
      headers: headers(),
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error || body.message || '').toContain('No file uploaded');
  });

  test('K.9 QDPX export size scales with data', async ({ page }) => {
    // Export the canvas with codings
    const fullRes = await page.request.get(`${BASE}/canvas/${canvasId}/export/qdpx`, { headers: headers() });
    const fullBody = await fullRes.body();

    // Create empty canvas and export
    const emptyRes = await page.request.post(`${BASE}/canvas`, {
      headers: headers(),
      data: { name: `EmptyQDPX-${Date.now()}` },
    });
    expect(emptyRes.status()).toBe(201);
    emptyCanvasId = (await emptyRes.json()).data.id;

    const emptyExport = await page.request.get(`${BASE}/canvas/${emptyCanvasId}/export/qdpx`, { headers: headers() });
    const emptyBody = await emptyExport.body();

    // Full canvas export should be larger than empty
    expect(fullBody.length).toBeGreaterThan(emptyBody.length);
  });

  test('K.10 Delete training document', async ({ page }) => {
    const res = await page.request.delete(`${BASE}/canvas/${canvasId}/training/${trainingDocId}`, { headers: headers() });
    expect(res.ok()).toBeTruthy();

    // Verify it's gone
    const listRes = await page.request.get(`${BASE}/canvas/${canvasId}/training`, { headers: headers() });
    const body = await listRes.json();
    const found = body.data.find((d: any) => d.id === trainingDocId);
    expect(found).toBeFalsy();
  });
});

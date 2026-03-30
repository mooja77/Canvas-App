import { test, expect, type Page } from '@playwright/test';

/**
 * Scenario D: Ethics-First — Sensitive Interview Data
 *
 * Dr. Kim Nakamura studies experiences of workplace harassment.
 * Ethics compliance is critical: IRB approval, informed consent,
 * anonymization, and audit trail.
 */

const API = 'http://localhost:3007/api';

// Transcript containing identifiable names and locations
const SENSITIVE_TRANSCRIPT = {
  title: 'Workplace Harassment Interview — Participant P001',
  content:
    'Sarah Johnson told me that her manager, David Chen, created a hostile work environment at the Riverside Office in Portland. ' +
    'She described incidents where David Chen would publicly criticize her work in front of colleagues. Sarah Johnson said the first ' +
    'incident happened in January when she was presenting quarterly results to the team. David Chen interrupted her repeatedly and ' +
    'told her the analysis was incompetent. After the meeting, Sarah Johnson went to HR but felt her complaint was not taken seriously. ' +
    'The HR director, Lisa Martinez, told her to work things out directly with David Chen. Sarah Johnson felt unsupported and considered ' +
    'leaving the company. She described feelings of anxiety, loss of confidence, and difficulty sleeping. The situation escalated in March ' +
    'when David Chen gave Sarah Johnson a negative performance review that she believes was retaliatory. Colleagues who witnessed the ' +
    'incidents confirmed that David Chen treated Sarah Johnson differently from other team members. One colleague, Mark Thompson, ' +
    'described the behavior as clearly discriminatory. Sarah Johnson eventually filed a formal complaint with the equal employment ' +
    'opportunity commission. She said the process was exhausting but necessary. The emotional toll of the harassment extended beyond ' +
    'work into her personal life. She described strained relationships with family members who did not understand why she could not ' +
    'just leave the job. The financial implications of leaving were significant because Sarah Johnson was the primary income earner.',
};

// ─── Shared state ───

let jwt: string;
let canvasId: string;
let transcriptId: string;
const consentIds: Record<string, string> = {};
const codingIds: string[] = [];
let codeId1: string;
let codeId2: string;
let codeId3: string;

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

test.describe('Scenario D: Ethics-First — Sensitive Interview Data', () => {
  const canvasName = `Workplace Harassment Ethics ${Date.now()}`;

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

  // ─── Phase 1: Ethics Setup ───

  test('D.1 Create canvas', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas`, {
      headers: headers(),
      data: { name: canvasName },
    });
    expect(res.status()).toBe(201);
    canvasId = (await res.json()).data.id;
    expect(canvasId).toBeTruthy();
  });

  test('D.2 Set ethics approval', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/ethics`, {
      headers: headers(),
      data: { ethicsApprovalId: 'IRB-2026-0147', ethicsStatus: 'approved' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.ethicsApprovalId).toBe('IRB-2026-0147');
    expect(body.data.ethicsStatus).toBe('approved');
  });

  test('D.3 Set data retention date', async ({ page }) => {
    const res = await page.request.put(`${API}/canvas/${canvasId}/ethics`, {
      headers: headers(),
      data: { dataRetentionDate: '2028-12-31T00:00:00.000Z' },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.dataRetentionDate).toBeTruthy();
  });

  test('D.4 Record consent for 3 participants', async ({ page }) => {
    const participants = [
      { id: 'P001', notes: 'Signed paper consent form on file' },
      { id: 'P002', notes: 'Electronic consent via email' },
      { id: 'P003', notes: 'Verbal consent recorded and witnessed' },
    ];
    for (const p of participants) {
      const res = await page.request.post(`${API}/canvas/${canvasId}/consent`, {
        headers: headers(),
        data: {
          participantId: p.id,
          consentType: 'informed',
          ethicsProtocol: 'IRB-2026-0147',
          notes: p.notes,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      consentIds[p.id] = body.data.id;
      expect(body.data.consentStatus).toBe('active');
      expect(body.data.consentDate).toBeTruthy();
    }
  });

  test('D.5 Verify consent records list', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/consent`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    for (const record of body.data) {
      expect(record.consentStatus).toBe('active');
    }
  });

  test('D.6 Verify ethics settings combined', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/ethics`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.ethicsApprovalId).toBe('IRB-2026-0147');
    expect(body.data.ethicsStatus).toBe('approved');
    expect(body.data.dataRetentionDate).toBeTruthy();
    expect(body.data.consentRecords).toHaveLength(3);
  });

  // ─── Phase 2: Data with Identifiers ───

  test('D.7 Add transcript with real names', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: { title: SENSITIVE_TRANSCRIPT.title, content: SENSITIVE_TRANSCRIPT.content },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    transcriptId = body.data.id;
    expect(body.data.content).toContain('Sarah Johnson');
    expect(body.data.content).toContain('David Chen');
  });

  test('D.8 Add codings to transcript before anonymization', async ({ page }) => {
    // Create codes first
    const codeRes1 = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Hostile Behavior', color: '#EF4444' },
    });
    codeId1 = (await codeRes1.json()).data.id;

    const codeRes2 = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Institutional Failure', color: '#F59E0B' },
    });
    codeId2 = (await codeRes2.json()).data.id;

    const codeRes3 = await page.request.post(`${API}/canvas/${canvasId}/questions`, {
      headers: headers(),
      data: { text: 'Emotional Impact', color: '#8B5CF6' },
    });
    codeId3 = (await codeRes3.json()).data.id;

    // Coding 1: references Sarah Johnson and David Chen
    const text1 = 'Sarah Johnson told me that her manager, David Chen, created a hostile work environment';
    const offset1 = SENSITIVE_TRANSCRIPT.content.indexOf(text1);
    const res1 = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: { transcriptId, questionId: codeId1, startOffset: offset1, endOffset: offset1 + text1.length, codedText: text1 },
    });
    expect(res1.status()).toBe(201);
    codingIds.push((await res1.json()).data.id);

    // Coding 2: references Lisa Martinez
    const text2 = 'The HR director, Lisa Martinez, told her to work things out directly with David Chen';
    const offset2 = SENSITIVE_TRANSCRIPT.content.indexOf(text2);
    const res2 = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: { transcriptId, questionId: codeId2, startOffset: offset2, endOffset: offset2 + text2.length, codedText: text2 },
    });
    expect(res2.status()).toBe(201);
    codingIds.push((await res2.json()).data.id);

    // Coding 3: emotional impact
    const text3 = 'She described feelings of anxiety, loss of confidence, and difficulty sleeping';
    const offset3 = SENSITIVE_TRANSCRIPT.content.indexOf(text3);
    const res3 = await page.request.post(`${API}/canvas/${canvasId}/codings`, {
      headers: headers(),
      data: { transcriptId, questionId: codeId3, startOffset: offset3, endOffset: offset3 + text3.length, codedText: text3 },
    });
    expect(res3.status()).toBe(201);
    codingIds.push((await res3.json()).data.id);
  });

  test('D.9 Anonymize transcript', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/transcripts/${transcriptId}/anonymize`, {
      headers: headers(),
      data: {
        replacements: [
          { find: 'Sarah Johnson', replace: '[Participant 1]' },
          { find: 'David Chen', replace: '[Manager A]' },
          { find: 'Lisa Martinez', replace: '[HR Director B]' },
          { find: 'Mark Thompson', replace: '[Colleague C]' },
          { find: 'Riverside Office', replace: '[Office Location]' },
          { find: 'Portland', replace: '[City]' },
        ],
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Verify original names are removed
    expect(body.data.content).not.toContain('Sarah Johnson');
    expect(body.data.content).not.toContain('David Chen');
    expect(body.data.content).not.toContain('Lisa Martinez');
    // Verify pseudonyms are present
    expect(body.data.content).toContain('[Participant 1]');
    expect(body.data.content).toContain('[Manager A]');
    expect(body.data.content).toContain('[HR Director B]');
    expect(body.data.isAnonymized).toBe(true);
  });

  test('D.10 Verify codings were updated with anonymized text', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}`, { headers: headers() });
    const data = (await res.json()).data;
    for (const coding of data.codings) {
      expect(coding.codedText).not.toContain('Sarah Johnson');
      expect(coding.codedText).not.toContain('David Chen');
    }
    // Codings that referenced names should now have pseudonyms
    const hostileCoding = data.codings.find((c: { questionId: string }) => c.questionId === codeId1);
    if (hostileCoding) {
      expect(hostileCoding.codedText).toContain('[Participant 1]');
      expect(hostileCoding.codedText).toContain('[Manager A]');
    }
  });

  // ─── Phase 3: Consent Management ───

  test('D.11 Record duplicate consent fails', async ({ page }) => {
    const res = await page.request.post(`${API}/canvas/${canvasId}/consent`, {
      headers: headers(),
      data: { participantId: 'P001', consentType: 'informed' },
    });
    expect(res.status()).toBe(409);
  });

  test('D.12 Withdraw consent for P002', async ({ page }) => {
    const res = await page.request.put(
      `${API}/canvas/${canvasId}/consent/${consentIds['P002']}/withdraw`,
      {
        headers: headers(),
        data: { notes: 'Participant requested withdrawal via email on 2026-03-15' },
      }
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.consentStatus).toBe('withdrawn');
    expect(body.data.withdrawalDate).toBeTruthy();
    expect(body.data.notes).toContain('withdrawal');
  });

  test('D.13 Verify withdrawn consent cannot be withdrawn again', async ({ page }) => {
    const res = await page.request.put(
      `${API}/canvas/${canvasId}/consent/${consentIds['P002']}/withdraw`,
      {
        headers: headers(),
        data: { notes: 'Attempting second withdrawal' },
      }
    );
    expect(res.status()).toBe(400);
  });

  test('D.14 Verify consent list reflects withdrawal', async ({ page }) => {
    const res = await page.request.get(`${API}/canvas/${canvasId}/consent`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const records = (await res.json()).data;
    const p001 = records.find((r: { participantId: string }) => r.participantId === 'P001');
    const p002 = records.find((r: { participantId: string }) => r.participantId === 'P002');
    const p003 = records.find((r: { participantId: string }) => r.participantId === 'P003');
    expect(p001.consentStatus).toBe('active');
    expect(p002.consentStatus).toBe('withdrawn');
    expect(p003.consentStatus).toBe('active');
  });

  // ─── Phase 4: Audit Trail ───

  test('D.15 Query audit log for ethics actions', async ({ page }) => {
    const res = await page.request.get(`${API}/audit-log?action=ethics.update`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    const entry = body.data.entries[0];
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('action', 'ethics.update');
    expect(entry).toHaveProperty('resource');
    expect(entry).toHaveProperty('actorId');
  });

  test('D.16 Query audit log for consent actions', async ({ page }) => {
    const res = await page.request.get(`${API}/audit-log?action=consent.create`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThanOrEqual(3);
  });

  test('D.17 Query audit log for consent withdrawal', async ({ page }) => {
    const res = await page.request.get(`${API}/audit-log?action=consent.withdraw`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
  });

  test('D.18 Query audit log for anonymization', async ({ page }) => {
    const res = await page.request.get(`${API}/audit-log?action=transcript.anonymize`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThanOrEqual(1);
    const entry = body.data.entries[0];
    const meta = typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
    expect(meta).toHaveProperty('replacementCount');
    expect(meta).toHaveProperty('codingsUpdated');
  });

  test('D.19 Query audit log with date range', async ({ page }) => {
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const to = new Date().toISOString();
    const res = await page.request.get(`${API}/audit-log?from=${from}&to=${to}`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThan(0);
  });

  test('D.20 Query audit log for coding actions', async ({ page }) => {
    const res = await page.request.get(`${API}/audit-log?action=coding.create`, { headers: headers() });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.data.entries.length).toBeGreaterThan(0);
  });
});

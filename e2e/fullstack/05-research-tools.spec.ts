import { test, expect } from '@playwright/test';
import { signup, ok, createCanvas, addTranscript, addCode, codeText, getCanvas, subscribe } from './support/api';

const TEXT =
  'Interviewer: Tell me about the clinic. Úna: José ran the night shift and Úna covered weekends. ' +
  'Dr. Kelly said staffing was the main problem. Later, José left and morale dropped.';

test.describe('Ethics: settings, consent, anonymisation, audit trail, journal', () => {
  test('ethics settings and consent records (create, duplicate, withdraw)', async () => {
    const s = await signup('ethics', { verify: true });
    const id = await createCanvas(s);
    await ok(
      await s.ctx.put(`canvas/${id}/ethics`, { data: { ethicsApprovalId: 'REC-2026-001', ethicsStatus: 'approved' } }),
    );
    const consent = (
      await ok(
        await s.ctx.post(`canvas/${id}/consent`, { data: { participantId: 'P01', consentType: 'written' } }),
        201,
      )
    ).data;
    expect((await s.ctx.post(`canvas/${id}/consent`, { data: { participantId: 'P01' } })).status()).toBe(409);
    await ok(await s.ctx.put(`canvas/${id}/consent/${consent.id}/withdraw`, { data: { notes: 'Asked to withdraw' } }));
    const ethics = (await ok(await s.ctx.get(`canvas/${id}/ethics`))).data;
    expect(ethics.ethicsApprovalId).toBe('REC-2026-001');
    expect(ethics.consentRecords[0].consentStatus ?? ethics.consentRecords[0].status).toMatch(/withdrawn/i);
  });

  test('regression: anonymising keeps codings on the same words and handles accented names', async () => {
    const s = await signup('anon', { verify: true });
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Clinic', TEXT);
    const staffing = await addCode(s, id, 'Staffing');
    const morale = await addCode(s, id, 'Morale');
    await codeText(s, id, t, staffing, TEXT, 'staffing was the main problem');
    await codeText(s, id, t, morale, TEXT, 'José left and morale dropped');

    await ok(
      await s.ctx.post(`canvas/${id}/transcripts/${t}/anonymize`, {
        data: {
          replacements: [
            { find: 'Úna', replace: '[P1]' },
            { find: 'José', replace: '[Participant 2]' },
            { find: 'Dr. Kelly', replace: '[Clinician]' },
          ],
        },
      }),
    );
    const canvas = await getCanvas(s, id);
    const content: string = canvas.transcripts[0].content;
    expect(canvas.transcripts[0].isAnonymized).toBe(true);
    expect(content).not.toMatch(/Úna|José|Kelly/);
    expect(content).toContain('[P1] covered weekends');
    for (const c of canvas.codings) {
      // Every coding's stored text is exactly what its offsets select.
      expect(content.slice(c.startOffset, c.endOffset)).toBe(c.codedText);
    }
    const texts = canvas.codings.map((c: any) => c.codedText).sort();
    expect(texts).toEqual(['[Participant 2] left and morale dropped', 'staffing was the main problem']);
  });

  test("regression: an email user's audit-log export contains their own activity; bad dates are 400", async () => {
    const s = await signup('audit', { verify: true });
    const id = await createCanvas(s, 'Audited');
    await addTranscript(s, id, 'T', 'Some text for the audit trail.');
    await expect
      .poll(async () => (await ok(await s.ctx.get('audit-log'))).data.total, { timeout: 10_000 })
      .toBeGreaterThan(0);
    const log = (await ok(await s.ctx.get('audit-log?limit=200'))).data;
    expect(log.entries.every((e: any) => e.actorId === s.userId || e.actorType === 'researcher')).toBe(true);
    expect((await s.ctx.get('audit-log?from=garbage')).status()).toBe(400);
    expect((await s.ctx.get('audit-log?action=a&action=b')).status()).toBe(400);
  });

  test('reflexivity journal: add, list, delete', async () => {
    const s = await signup('journal', { verify: true });
    const id = await createCanvas(s);
    const entry = (
      await ok(await s.ctx.post(`canvas/${id}/journal`, { data: { content: 'My positionality note.' } }), 201)
    ).data;
    expect((await ok(await s.ctx.get(`canvas/${id}/journal`))).data.map((e: any) => e.id)).toContain(entry.id);
    await ok(await s.ctx.delete(`canvas/${id}/journal/${entry.id}`));
    expect((await s.ctx.post(`canvas/${id}/journal`, { data: { content: '  ' } })).status()).toBe(400);
  });

  test('Free plan: ethics tools are gated', async () => {
    const s = await signup('ethicsfree');
    const id = await createCanvas(s);
    expect((await s.ctx.post(`canvas/${id}/consent`, { data: { participantId: 'P1' } })).status()).toBe(403);
  });
});

test.describe('Training: gold-standard practice', () => {
  test('regression: a trainee never receives the answer key until they pass; the owner always does', async () => {
    const owner = await signup('trainowner', { verify: true });
    const trainee = await signup('trainee', { verify: true });
    const id = await createCanvas(owner);
    const t = await addTranscript(owner, id, 'Clinic', TEXT);
    const q = await addCode(owner, id, 'Staffing');
    const start = TEXT.indexOf('staffing was the main problem');
    const gold = [{ questionId: q, startOffset: start, endOffset: start + 29 }];
    const doc = (
      await ok(
        await owner.ctx.post(`canvas/${id}/training`, { data: { transcriptId: t, name: 'Set 1', goldCodings: gold } }),
        201,
      )
    ).data;
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: trainee.email, role: 'viewer' } }),
      201,
    );

    const listed = (await ok(await trainee.ctx.get(`canvas/${id}/training`))).data[0];
    expect(listed.goldCodings).toBeUndefined();
    const wrong = [{ questionId: q, startOffset: 0, endOffset: 12 }];
    const empty = (
      await ok(await trainee.ctx.post(`canvas/${id}/training/${doc.id}/attempt`, { data: { codings: wrong } }), 201)
    ).data;
    expect(empty.passed).toBe(false);
    expect(empty.goldCodings).toBeUndefined();

    const good = (
      await ok(await trainee.ctx.post(`canvas/${id}/training/${doc.id}/attempt`, { data: { codings: gold } }), 201)
    ).data;
    expect(good.passed).toBe(true);
    expect(good.kappaScore).toBeCloseTo(1, 5);
    expect(good.goldCodings).toHaveLength(1);

    const ownerAttempt = (
      await ok(await owner.ctx.post(`canvas/${id}/training/${doc.id}/attempt`, { data: { codings: wrong } }), 201)
    ).data;
    expect(ownerAttempt.goldCodings).toHaveLength(1);
    // Trainees only see their own attempts; the owner sees all.
    expect((await ok(await trainee.ctx.get(`canvas/${id}/training/${doc.id}/attempts`))).data).toHaveLength(2);
    expect((await ok(await owner.ctx.get(`canvas/${id}/training/${doc.id}/attempts`))).data).toHaveLength(3);
  });
});

test.describe('Analysis nodes', () => {
  async function codedCanvas(tag: string, verify = true) {
    const s = await signup(tag, { verify });
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Clinic', TEXT);
    const a = await addCode(s, id, 'Staffing');
    const b = await addCode(s, id, 'Morale');
    await codeText(s, id, t, a, TEXT, 'staffing was the main problem');
    await codeText(s, id, t, b, TEXT, 'morale dropped');
    await codeText(s, id, t, b, TEXT, 'ran the night shift');
    return { s, id, a, b };
  }

  test('stats node counts codings per code', async () => {
    const { s, id, a, b } = await codedCanvas('stats');
    const node = (
      await ok(await s.ctx.post(`canvas/${id}/computed`, { data: { nodeType: 'stats', label: 'Stats' } }), 201)
    ).data;
    const run = (await ok(await s.ctx.post(`canvas/${id}/computed/${node.id}/run`))).data;
    const text = JSON.stringify(run);
    expect(text).toContain(a);
    expect(text).toContain(b);
  });

  test('regression: wrong-typed saved settings no longer make a node fail with 500', async () => {
    const { s, id } = await codedCanvas('badcfg');
    for (const [nodeType, config] of [
      ['cluster', { k: 2.5 }],
      ['search', { pattern: 5 }],
      ['stats', { questionIds: 'abc' }],
      ['wordcloud', { stopWords: 'x' }],
    ] as const) {
      const node = (
        await ok(await s.ctx.post(`canvas/${id}/computed`, { data: { nodeType, label: nodeType, config } }), 201)
      ).data;
      const res = await s.ctx.post(`canvas/${id}/computed/${node.id}/run`);
      // A search with no usable pattern is refused (400); everything else runs
      // on defaults. Before the fix every one of these was a 500.
      expect(res.status(), `${nodeType} ${JSON.stringify(config)}`).toBe(nodeType === 'search' ? 400 : 200);
    }
  });

  test('Free plan: only 4 analysis types', async () => {
    const { s, id } = await codedCanvas('freeanalysis', false);
    const res = await s.ctx.post(`canvas/${id}/computed`, { data: { nodeType: 'cluster', label: 'C' } });
    expect(res.status()).toBe(403);
    await ok(await s.ctx.post(`canvas/${id}/computed`, { data: { nodeType: 'wordcloud', label: 'W' } }), 201);
  });

  test('intercoder agreement is a Team feature and computes kappa between two coders', async () => {
    const owner = await signup('icowner');
    await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('iccoder', { verify: true });
    const id = await createCanvas(owner);
    const t = await addTranscript(owner, id, 'Clinic', TEXT);
    const q = await addCode(owner, id, 'Staffing');
    // A second coder is a second Team seat: confirm the charge (07-seats covers the flow).
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, {
        data: { email: coder.email, role: 'editor', confirmSeatCharge: true },
      }),
      201,
    );
    await codeText(owner, id, t, q, TEXT, 'staffing was the main problem');
    await codeText(coder, id, t, q, TEXT, 'staffing was the main problem');
    const res = (
      await ok(
        await owner.ctx.post(`canvas/${id}/intercoder/agreement`, {
          data: { transcriptId: t, userIds: [owner.userId, coder.userId] },
        }),
      )
    ).data;
    expect(res.alpha).toBe(1);
    expect(res.nCoders).toBe(2);

    const pro = await signup('icpro', { verify: true });
    const pid = await createCanvas(pro);
    const pt = await addTranscript(pro, pid, 'x', 'hello world');
    expect(
      (
        await pro.ctx.post(`canvas/${pid}/intercoder/agreement`, {
          data: { transcriptId: pt, userIds: [pro.userId, coder.userId] },
        })
      ).status(),
    ).toBe(403);
  });
});

test.describe('Exports and QDPX round trip', () => {
  test('Excel export downloads a workbook', async () => {
    const s = await signup('xlsx', { verify: true });
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Clinic', TEXT);
    const q = await addCode(s, id, '=HYPERLINK("http://evil")');
    await codeText(s, id, t, q, TEXT, 'morale dropped');
    const res = await s.ctx.get(`canvas/${id}/export/excel`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
    const body = await res.body();
    expect(body.subarray(0, 2).toString()).toBe('PK');
  });

  test('QDPX export imports back into a new canvas with the same codes and codings', async () => {
    const s = await signup('qdpx', { verify: true });
    const id = await createCanvas(s, 'Source');
    const t = await addTranscript(s, id, 'Clinic', TEXT);
    const q = await addCode(s, id, 'Staffing');
    await codeText(s, id, t, q, TEXT, 'staffing was the main problem');
    const exp = await s.ctx.get(`canvas/${id}/export/qdpx`);
    expect(exp.status()).toBe(200);
    const archive = await exp.body();

    const target = await createCanvas(s, 'Target');
    const imp = await s.ctx.post(`canvas/${target}/import/qdpx`, {
      multipart: { file: { name: 'project.qdpx', mimeType: 'application/zip', buffer: archive } },
    });
    expect(imp.status(), await imp.text()).toBeLessThan(300);
    const copy = await getCanvas(s, target);
    expect(copy.transcripts[0].content).toBe(TEXT);
    expect(copy.questions.map((x: any) => x.text)).toContain('Staffing');
    expect(copy.codings).toHaveLength(1);
    const c = copy.codings[0];
    expect(copy.transcripts[0].content.slice(c.startOffset, c.endOffset)).toBe('staffing was the main problem');
  });

  test('Free plan: Excel and QDPX exports are gated', async () => {
    const s = await signup('freeexport');
    const id = await createCanvas(s);
    expect((await s.ctx.get(`canvas/${id}/export/excel`)).status()).toBe(403);
    expect((await s.ctx.get(`canvas/${id}/export/qdpx`)).status()).toBe(403);
  });
});

test.describe('Other workspace tools', () => {
  test('calendar: create, list, bad dates, ICS export', async () => {
    const s = await signup('calendar', { verify: true });
    const ev = (
      await ok(
        await s.ctx.post('calendar/events', {
          data: { title: 'Ethics deadline', startDate: '2026-11-01T09:00:00Z', type: 'deadline' },
        }),
        201,
      )
    ).data;
    expect((await ok(await s.ctx.get('calendar/events'))).data.map((e: any) => e.id)).toContain(ev.id);
    expect((await s.ctx.post('calendar/events', { data: { title: 'x', startDate: 'nope' } })).status()).toBe(400);
    expect(
      (
        await s.ctx.post('calendar/events', { data: { title: 'x', startDate: '2026-11-02', endDate: '2026-11-01' } })
      ).status(),
    ).toBe(400);
    expect((await s.ctx.get('calendar/events?from=garbage')).status()).toBe(400);
    const ics = await s.ctx.get('calendar/export.ics');
    expect(ics.status()).toBe(200);
    expect(await ics.text()).toContain('BEGIN:VCALENDAR');
  });

  test('research repository: create and list (paid), gated on Free', async () => {
    const s = await signup('repo', { verify: true });
    await ok(await s.ctx.post('repositories', { data: { name: 'Insights' } }), 201);
    expect(JSON.stringify(await ok(await s.ctx.get('repositories')))).toContain('Insights');
    const free = await signup('repofree');
    expect((await free.ctx.post('repositories', { data: { name: 'x' } })).status()).toBe(403);
  });

  test('notifications list works for a new account', async () => {
    const s = await signup('notif', { verify: true });
    const res = await ok(await s.ctx.get('notifications'));
    expect(res.success).toBe(true);
  });

  test('AI settings: a stored key is never returned', async () => {
    const fakeKey = `sk-${Date.now().toString(36)}${'0'.repeat(32)}`;
    const s = await signup('aikey', { verify: true });
    const put = await s.ctx.put('ai-settings', {
      data: { provider: 'openai', apiKey: fakeKey, model: 'gpt-4o-mini' },
    });
    expect(put.status()).toBeLessThan(300);
    const got = await s.ctx.get('ai-settings');
    expect(await got.text()).not.toContain(fakeKey);
  });
});

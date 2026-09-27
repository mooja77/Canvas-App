import { test, expect } from '@playwright/test';
import { signup, ok, createCanvas, addTranscript, addCode, codeText, getCanvas } from './support/api';

const INTERVIEW =
  'Interviewer: How did the reorganisation affect you? Participant: Honestly the workload doubled overnight. ' +
  'My manager was supportive but the new software kept crashing. I relied on peer support from colleagues.';

test.describe('Canvases and Free-plan caps', () => {
  test('create, list, rename, trash, restore and permanently delete a canvas', async () => {
    const s = await signup('canvas');
    const id = await createCanvas(s, 'Study A');
    const list = await ok(await s.ctx.get('canvas'));
    expect(list.data.map((c: any) => c.id)).toContain(id);

    await ok(await s.ctx.put(`canvas/${id}`, { data: { name: 'Study A (renamed)' } }));
    expect((await getCanvas(s, id)).name).toBe('Study A (renamed)');

    await ok(await s.ctx.delete(`canvas/${id}`));
    expect((await ok(await s.ctx.get('canvas'))).data.map((c: any) => c.id)).not.toContain(id);
    expect((await ok(await s.ctx.get('canvas/trash'))).data.map((c: any) => c.id)).toContain(id);

    await ok(await s.ctx.post(`canvas/${id}/restore`));
    expect((await ok(await s.ctx.get('canvas'))).data.map((c: any) => c.id)).toContain(id);

    await ok(await s.ctx.delete(`canvas/${id}`));
    await ok(await s.ctx.delete(`canvas/${id}/permanent`));
    expect((await s.ctx.get(`canvas/${id}`)).status()).toBe(404);
  });

  test('error: invalid canvas input is 400, unknown id is 404', async () => {
    const s = await signup('canvaserr');
    expect((await s.ctx.post('canvas', { data: { name: '' } })).status()).toBe(400);
    expect((await s.ctx.post('canvas', { data: { name: 'x'.repeat(201) } })).status()).toBe(400);
    expect((await s.ctx.get('canvas/cjld2cjxh0000qzrmn831i7rn')).status()).toBe(404);
  });

  test('Free plan: 2 live canvases; the trash frees a slot; restore is capped', async () => {
    const s = await signup('freecap');
    const a = await createCanvas(s, 'one');
    await createCanvas(s, 'two');
    const third = await s.ctx.post('canvas', { data: { name: 'three' } });
    expect(third.status()).toBe(403);
    expect((await third.json()).code).toBe('PLAN_LIMIT_EXCEEDED');

    await ok(await s.ctx.delete(`canvas/${a}`));
    const c = await createCanvas(s, 'three');
    expect(c).toBeTruthy();
    // Two live again: restoring the trashed one would make three.
    expect((await s.ctx.post(`canvas/${a}/restore`)).status()).toBe(403);
  });

  test('regression: a template canvas is kept when the other Free slot is in the trash', async () => {
    const s = await signup('tmpltrash');
    const templates = (await ok(await s.ctx.get('canvas/templates'))).data;
    expect(templates.length).toBeGreaterThan(0);
    const keep = await createCanvas(s, 'live');
    const trashed = await createCanvas(s, 'to trash');
    await ok(await s.ctx.delete(`canvas/${trashed}`));
    // 1 live + 1 trashed: the cap check passes. Before the fix the post-create
    // recount counted the trash, saw 3 and deleted the new canvas with a 403.
    const res = await s.ctx.post(`canvas/templates/${templates[0].id}/instantiate`, {
      data: { includeSampleData: true },
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).toBe(201);
    const ids = (await ok(await s.ctx.get('canvas'))).data.map((c: any) => c.id);
    expect(ids).toEqual(expect.arrayContaining([keep, body.data.id]));
  });

  test('Free plan: 5 transcripts per canvas, samples excluded, and "sample" cannot be claimed', async () => {
    const s = await signup('transcap');
    const id = await createCanvas(s);
    for (let i = 1; i <= 5; i++) await addTranscript(s, id, `T${i}`, `Transcript number ${i}.`);
    const sixth = await s.ctx.post(`canvas/${id}/transcripts`, { data: { title: 'T6', content: 'six' } });
    expect(sixth.status()).toBe(403);

    // Regression: labelling a transcript as a template sample used to skip the cap.
    const sneaky = await s.ctx.post(`canvas/${id}/transcripts`, {
      data: { title: 'T6', content: 'six', sourceType: 'sample' },
    });
    expect(sneaky.status()).toBe(400);
    const bulk = await s.ctx.post(`canvas/${id}/import-narratives`, {
      data: { narratives: [{ title: 'N1', content: 'n', sourceType: 'sample' }] },
    });
    expect(bulk.status()).toBe(400);
    expect((await getCanvas(s, id)).transcripts).toHaveLength(5);
  });

  test('Free plan: 10,000 words per transcript', async () => {
    const s = await signup('words');
    const id = await createCanvas(s);
    const ok10k = Array.from({ length: 10_000 }, () => 'word').join(' ');
    await addTranscript(s, id, 'At limit', ok10k);
    const res = await s.ctx.post(`canvas/${id}/transcripts`, { data: { title: 'Over', content: ok10k + ' extra' } });
    expect(res.status()).toBe(403);
  });

  test('Free plan: 10 codes per canvas', async () => {
    const s = await signup('codecap');
    const id = await createCanvas(s);
    for (let i = 1; i <= 10; i++) await addCode(s, id, `Code ${i}`);
    expect((await s.ctx.post(`canvas/${id}/questions`, { data: { text: 'Code 11' } })).status()).toBe(403);
  });
});

test.describe('Transcripts, codes, codings, memos', () => {
  test('code a passage, reassign it, and see it in the canvas', async () => {
    const s = await signup('coding');
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Interview 1', INTERVIEW);
    const workload = await addCode(s, id, 'Workload');
    const support = await addCode(s, id, 'Support');
    const coding = await codeText(s, id, t, workload, INTERVIEW, 'the workload doubled overnight');
    const canvas = await getCanvas(s, id);
    expect(canvas.codings).toHaveLength(1);
    expect(canvas.codings[0].codedText).toBe('the workload doubled overnight');

    await ok(await s.ctx.put(`canvas/${id}/codings/${coding.id}/reassign`, { data: { newQuestionId: support } }));
    expect((await getCanvas(s, id)).codings[0].questionId).toBe(support);
  });

  test('error: a coding whose text does not match its offsets is refused', async () => {
    const s = await signup('offsets');
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Interview', INTERVIEW);
    const q = await addCode(s, id, 'X');
    const res = await s.ctx.post(`canvas/${id}/codings`, {
      data: { transcriptId: t, questionId: q, startOffset: 0, endOffset: 10, codedText: 'not the text' },
    });
    expect(res.status()).toBe(400);
    const beyond = await s.ctx.post(`canvas/${id}/codings`, {
      data: { transcriptId: t, questionId: q, startOffset: 0, endOffset: INTERVIEW.length + 50, codedText: INTERVIEW },
    });
    expect(beyond.status()).toBe(400);
  });

  test('edge: editing transcript text that would move codings is refused; title edits are fine', async () => {
    const s = await signup('edittx');
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Interview', INTERVIEW);
    const q = await addCode(s, id, 'Software');
    await codeText(s, id, t, q, INTERVIEW, 'the new software kept crashing');
    await ok(await s.ctx.put(`canvas/${id}/transcripts/${t}`, { data: { title: 'Renamed' } }));
    const res = await s.ctx.put(`canvas/${id}/transcripts/${t}`, { data: { content: 'Completely different.' } });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect((await getCanvas(s, id)).transcripts[0].content).toBe(INTERVIEW);
  });

  test('code hierarchy: a code cannot become its own ancestor; merge moves codings', async () => {
    const s = await signup('hier');
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Interview', INTERVIEW);
    const parent = await addCode(s, id, 'Parent');
    const child = (
      await ok(await s.ctx.post(`canvas/${id}/questions`, { data: { text: 'Child', parentQuestionId: parent } }), 201)
    ).data.id;
    const cycle = await s.ctx.put(`canvas/${id}/questions/${parent}`, { data: { parentQuestionId: child } });
    expect([400, 409]).toContain(cycle.status());
    await codeText(s, id, t, child, INTERVIEW, 'peer support');
    const merged = await ok(
      await s.ctx.post(`canvas/${id}/questions/merge`, { data: { sourceId: child, targetId: parent } }),
    );
    expect(merged.data.codingCount).toBe(1);
    const canvas = await getCanvas(s, id);
    expect(canvas.questions.map((q: any) => q.id)).not.toContain(child);
    expect(canvas.codings[0].questionId).toBe(parent);
  });

  test('memos: create, update, delete', async () => {
    const s = await signup('memo');
    const id = await createCanvas(s);
    const memo = (await ok(await s.ctx.post(`canvas/${id}/memos`, { data: { content: 'First thought' } }), 201)).data;
    await ok(await s.ctx.put(`canvas/${id}/memos/${memo.id}`, { data: { content: 'Second thought' } }));
    expect((await getCanvas(s, id)).memos[0].content).toBe('Second thought');
    await ok(await s.ctx.delete(`canvas/${id}/memos/${memo.id}`));
    expect((await getCanvas(s, id)).memos).toHaveLength(0);
    expect((await s.ctx.post(`canvas/${id}/memos`, { data: { content: '   ' } })).status()).toBe(400);
  });

  test('deleting a transcript removes its codings', async () => {
    const s = await signup('deltx');
    const id = await createCanvas(s);
    const t = await addTranscript(s, id, 'Interview', INTERVIEW);
    const q = await addCode(s, id, 'X');
    await codeText(s, id, t, q, INTERVIEW, 'peer support');
    await ok(await s.ctx.delete(`canvas/${id}/transcripts/${t}`));
    const canvas = await getCanvas(s, id);
    expect(canvas.transcripts).toHaveLength(0);
    expect(canvas.codings).toHaveLength(0);
  });
});

import { test, expect } from '@playwright/test';
import {
  signup,
  ok,
  createCanvas,
  addTranscript,
  addCode,
  codeText,
  getCanvas,
  subscribe,
  type Session,
} from './support/api';

const TEXT = 'Participant: I felt the team pulled together when the deadline moved. Morale was high.';

async function mp3Upload(s: Session, canvasId: string): Promise<string> {
  const buf = Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0, 0, 0, 0]), Buffer.alloc(2048, 0)]);
  const res = await s.ctx.post(`canvas/${canvasId}/upload/direct`, {
    multipart: { file: { name: 'clip.mp3', mimeType: 'audio/mpeg', buffer: buf } },
  });
  return (await ok(res)).data.id;
}

test.describe('Tenancy isolation', () => {
  test('another user cannot read, change or delete my canvas or its content', async () => {
    const owner = await signup('owner', { verify: true });
    const stranger = await signup('stranger', { verify: true });
    const id = await createCanvas(owner, 'Private study');
    const t = await addTranscript(owner, id, 'Secret', TEXT);
    const q = await addCode(owner, id, 'Morale');
    const coding = await codeText(owner, id, t, q, TEXT, 'Morale was high');

    const attempts = [
      stranger.ctx.get(`canvas/${id}`),
      stranger.ctx.put(`canvas/${id}`, { data: { name: 'pwned' } }),
      stranger.ctx.delete(`canvas/${id}`),
      stranger.ctx.post(`canvas/${id}/transcripts`, { data: { title: 'x', content: 'y' } }),
      stranger.ctx.put(`canvas/${id}/transcripts/${t}`, { data: { title: 'x' } }),
      stranger.ctx.delete(`canvas/${id}/transcripts/${t}`),
      stranger.ctx.delete(`canvas/${id}/codings/${coding.id}`),
      stranger.ctx.get(`canvas/${id}/export/excel`),
      stranger.ctx.post(`canvas/${id}/share`, { data: {} }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect([403, 404], `${res.url()} ${res.status()}`).toContain(res.status());
    }
    // Cross-canvas IDOR: stranger's own canvas id + owner's transcript id.
    const mine = await createCanvas(stranger, 'Mine');
    const idor = await stranger.ctx.put(`canvas/${mine}/transcripts/${t}`, { data: { title: 'hijack' } });
    expect(idor.status()).toBe(404);
    const after = await getCanvas(owner, id);
    expect(after.name).toBe('Private study');
    expect(after.transcripts[0].title).toBe('Secret');
    expect(after.codings).toHaveLength(1);
    // And the stranger's list never shows it.
    expect((await ok(await stranger.ctx.get('canvas'))).data.map((c: any) => c.id)).not.toContain(id);
  });

  test("regression: region codings cannot be deleted through someone else's canvas id", async () => {
    const victim = await signup('regionvictim', { verify: true });
    const attacker = await signup('regionattacker', { verify: true });
    const vc = await createCanvas(victim, 'Victim docs');
    const upload = await mp3Upload(victim, vc);
    const doc = (
      await ok(
        await victim.ctx.post(`canvas/${vc}/documents`, {
          data: { fileUploadId: upload, title: 'Scan', docType: 'pdf' },
        }),
        201,
      )
    ).data;
    const q = await addCode(victim, vc, 'Diagram');
    const region = (
      await ok(
        await victim.ctx.post(`canvas/${vc}/documents/${doc.id}/regions`, {
          data: { questionId: q, x: 10, y: 10, width: 20, height: 20 },
        }),
        201,
      )
    ).data;

    const ac = await createCanvas(attacker, 'Attacker');
    const res = await attacker.ctx.delete(`canvas/${ac}/documents/${doc.id}/regions/${region.id}`);
    expect(res.status()).toBe(404);
    const regions = (await ok(await victim.ctx.get(`canvas/${vc}/documents/${doc.id}/regions`))).data;
    expect(regions.map((r: any) => r.id)).toContain(region.id);
  });

  test('error: malformed document and region bodies are 400, not 500', async () => {
    const s = await signup('docval', { verify: true });
    const c = await createCanvas(s);
    const upload = await mp3Upload(s, c);
    expect(
      (
        await s.ctx.post(`canvas/${c}/documents`, {
          data: { fileUploadId: upload, title: 'x', docType: 'pdf', pageCount: '2' },
        })
      ).status(),
    ).toBe(400);
    const doc = (
      await ok(
        await s.ctx.post(`canvas/${c}/documents`, { data: { fileUploadId: upload, title: 'x', docType: 'image' } }),
        201,
      )
    ).data;
    const q = await addCode(s, c, 'Q');
    expect(
      (
        await s.ctx.post(`canvas/${c}/documents/${doc.id}/regions`, {
          data: { questionId: q, x: '10', y: 1, width: 1, height: 1 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await s.ctx.post(`canvas/${c}/documents/${doc.id}/regions`, {
          data: { questionId: q, x: 10, y: 1, width: 1, height: 101 },
        })
      ).status(),
    ).toBe(400);
  });
});

test.describe('Collaboration roles', () => {
  async function setup() {
    // Coders need Team (Pro is a one-person plan); the seat is confirmed below.
    const owner = await signup('collabowner', { verify: true });
    await subscribe(owner, 'price_qc_team_m');
    const editor = await signup('editor', { verify: true });
    const viewer = await signup('viewer', { verify: true });
    const id = await createCanvas(owner, 'Team study');
    const t = await addTranscript(owner, id, 'Interview', TEXT);
    const q = await addCode(owner, id, 'Teamwork');
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, {
        data: { email: editor.email, role: 'editor', confirmSeatCharge: true },
      }),
      201,
    );
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: viewer.email, role: 'viewer' } }),
      201,
    );
    return { owner, editor, viewer, id, t, q };
  }

  test('an editor can code; a viewer can read but not write', async () => {
    const { editor, viewer, id, t, q } = await setup();
    await codeText(editor, id, t, q, TEXT, 'the team pulled together');
    expect((await getCanvas(viewer, id)).codings).toHaveLength(1);
    const res = await viewer.ctx.post(`canvas/${id}/codings`, {
      data: { transcriptId: t, questionId: q, startOffset: 0, endOffset: 11, codedText: TEXT.slice(0, 11) },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/view-only/i);
  });

  test('regression: a viewer cannot write by changing the case or encoding of the path', async () => {
    const { viewer, id, t, q } = await setup();
    const enc = '%' + id.charCodeAt(0).toString(16) + id.slice(1);
    const body = { transcriptId: t, questionId: q, startOffset: 0, endOffset: 11, codedText: TEXT.slice(0, 11) };
    for (const path of [`CANVAS/${id}/codings`, `Canvas/${id}/codings`, `canvas/${enc}/codings`]) {
      const res = await viewer.ctx.post(path, { data: body });
      expect(res.status(), path).toBe(403);
    }
    for (const path of [`CANVAS/${id}/transcripts/${t}`, `canvas/${enc}/transcripts/${t}`]) {
      expect((await viewer.ctx.delete(path)).status(), path).toBe(403);
    }
    expect((await getCanvas(viewer, id)).codings).toHaveLength(0);
    expect((await getCanvas(viewer, id)).transcripts).toHaveLength(1);
  });

  test('only the owner manages collaborators; removal revokes access', async () => {
    const { owner, editor, viewer, id } = await setup();
    const list = (await ok(await owner.ctx.get(`canvas/${id}/collaborators`))).data;
    expect(list.length).toBe(2);
    expect(
      (await editor.ctx.post(`canvas/${id}/collaborators`, { data: { email: viewer.email, role: 'editor' } })).status(),
    ).toBe(403);
    await ok(await owner.ctx.delete(`canvas/${id}/collaborators/${viewer.userId}`));
    expect([403, 404]).toContain((await viewer.ctx.get(`canvas/${id}`)).status());
  });

  test('error: invalid role and unknown invitee', async () => {
    const owner = await signup('roleerr', { verify: true });
    const other = await signup('roleother', { verify: true });
    const id = await createCanvas(owner);
    expect(
      (await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: other.email, role: 'admin' } })).status(),
    ).toBe(400);
    expect(
      (
        await owner.ctx.post(`canvas/${id}/collaborators`, {
          data: { email: 'nobody-estate@example.com', role: 'editor' },
        })
      ).status(),
    ).toBe(404);
  });

  test('Free plan owner cannot add collaborators', async () => {
    const owner = await signup('freecollab'); // unverified → Free, no trial
    const other = await signup('freecollab2', { verify: true });
    const id = await createCanvas(owner);
    expect(
      (await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: other.email, role: 'editor' } })).status(),
    ).toBe(403);
  });
});

test.describe('Share codes and cloning', () => {
  test('owner shares, another user clones a full copy, revoked codes stop working', async () => {
    const owner = await signup('sharer', { verify: true });
    const cloner = await signup('cloner', { verify: true });
    const id = await createCanvas(owner, 'Shared study');
    const t = await addTranscript(owner, id, 'Interview', TEXT);
    const q = await addCode(owner, id, 'Morale');
    await codeText(owner, id, t, q, TEXT, 'Morale was high');
    const share = (await ok(await owner.ctx.post(`canvas/${id}/share`, { data: {} }), 201)).data;
    expect(share.shareCode).toMatch(/^SHARE-/);

    const clone = (await ok(await cloner.ctx.post(`canvas/clone/${share.shareCode}`), 201)).data;
    const copy = await getCanvas(cloner, clone.id);
    expect(copy.transcripts[0].content).toBe(TEXT);
    expect(copy.questions[0].text).toBe('Morale');
    expect(copy.codings).toHaveLength(1);
    expect(copy.codings[0].questionId).toBe(copy.questions[0].id);
    expect(copy.codings[0].transcriptId).toBe(copy.transcripts[0].id);

    await ok(await owner.ctx.delete(`canvas/${id}/share/${share.id}`));
    expect([403, 404, 410]).toContain((await cloner.ctx.post(`canvas/clone/${share.shareCode}`)).status());
  });

  test('Free plan cannot create share codes; unknown code is 404', async () => {
    const s = await signup('freeshare');
    const id = await createCanvas(s);
    expect((await s.ctx.post(`canvas/${id}/share`, { data: {} })).status()).toBe(403);
    expect((await s.ctx.post('canvas/clone/SHARE-DOESNOTEXIST')).status()).toBe(404);
  });
});

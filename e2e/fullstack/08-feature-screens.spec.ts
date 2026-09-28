import { test, expect, type Page, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  signup,
  ok,
  json,
  createCanvas,
  addTranscript,
  addCode,
  getCanvas,
  outbox,
  subscribe,
  type Session,
} from './support/api';
import { STACK } from './support/env';

// The three screens that used to be backend-only: audio transcription, PDF /
// image region coding and the training centre. Each is driven through the real
// UI in the browser, with API assertions on what the server stored and on the
// ownership rules the screens depend on.

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A short, valid 16-bit mono WAV (silence). */
function wavBytes(seconds = 1): Buffer {
  const rate = 8000;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  return buf;
}

/** A well-formed two-page PDF with correct xref offsets. */
function pdfBytes(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 4 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    null, // 4: page 1 content
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>',
    null, // 6: page 2 content
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = (text: string) => {
    const s = `BT /F1 18 Tf 40 200 Td (${text}) Tj ET`;
    return `<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
  };
  objects[3] = stream('Policy memo - page one');
  objects[5] = stream('Policy memo - page two');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** 1x1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function whisper(params: string): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${STACK.clockPort}/whisper?${params}`, { method: 'POST' });
  expect(res.ok).toBe(true);
}

async function uploadDoc(s: Session, canvasId: string, name: string, mimeType: string, buffer: Buffer, extra = {}) {
  return s.ctx.post(`canvas/${canvasId}/documents/upload`, {
    multipart: { file: { name, mimeType, buffer }, ...extra },
  });
}

/** Sign in through the real login form, skip the first-run tour, open the canvas. */
async function openCanvasAs(page: Page, s: Session, canvasId: string): Promise<void> {
  await page.addInitScript(() => {
    const ui = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
    ui.state = { ...ui.state, onboardingComplete: true, setupWizardComplete: true };
    localStorage.setItem('qualcanvas-ui', JSON.stringify(ui));
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });
  await page.goto('/login');
  const panel = page.locator('#auth-panel-login');
  await panel.getByPlaceholder('you@university.edu').fill(s.email);
  await panel.getByPlaceholder('Enter your password').fill(s.password);
  await panel.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(canvas|onboarding|welcome)/, { timeout: 30_000 });
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 30_000 });
}

async function openTool(page: Page, label: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: 'Tools menu' }).first().click();
  await page.getByRole('button', { name: label }).first().click();
}

async function expectNoSeriousAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

// ─── Audio transcription ─────────────────────────────────────────────────────

test.describe('Audio transcription screen', () => {
  test.afterEach(async () => {
    await whisper('fail=0');
  });

  test('Free plan: allowance says so and uploads are refused', async () => {
    const s = await signup('audiofree'); // unverified = Free, no trial
    const id = await createCanvas(s);
    const allowance = (await ok(await s.ctx.get(`canvas/${id}/transcribe/allowance`))).data;
    expect(allowance).toMatchObject({ plan: 'free', fileUploadEnabled: false, keySource: null });
    expect(allowance).not.toHaveProperty('minutesPerMonth');
    const up = await s.ctx.post(`canvas/${id}/upload/direct`, {
      multipart: { file: { name: 'a.wav', mimeType: 'audio/wav', buffer: wavBytes() } },
    });
    expect(up.status()).toBe(403);
  });

  test('no own key (a decoy server key is set): the screen says connect your AI account and the API refuses before queueing', async ({
    page,
  }) => {
    const s = await signup('audionokey', { verify: true }); // 14-day trial = Pro
    const id = await createCanvas(s);
    const allowance = (await ok(await s.ctx.get(`canvas/${id}/transcribe/allowance`))).data;
    expect(allowance).toMatchObject({
      plan: 'pro',
      fileUploadEnabled: true,
      keySource: null,
      isCanvasOwner: true,
      usageThisMonth: null,
      pricePerMinuteUsd: 0.006,
    });
    for (const gone of ['minutesPerMonth', 'minutesRemaining', 'serverTranscriptionConfigured']) {
      expect(allowance).not.toHaveProperty(gone);
    }
    const upload = (
      await ok(
        await s.ctx.post(`canvas/${id}/upload/direct`, {
          multipart: { file: { name: 'a.wav', mimeType: 'audio/wav', buffer: wavBytes() } },
        }),
      )
    ).data;
    const refused = await s.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: upload.id } });
    expect(refused.status()).toBe(409);
    expect((await json(refused)).code).toBe('TRANSCRIPTION_KEY_REQUIRED');
    expect((await ok(await s.ctx.get(`canvas/${id}/transcribe`))).data).toEqual([]);

    await openCanvasAs(page, s, id);
    await openTool(page, 'Transcribe audio');
    const dialog = page.getByRole('dialog', { name: 'Transcribe audio' });
    await expect(dialog.getByTestId('transcription-needs-key')).toContainText('Connect your AI account to transcribe');
    await expect(dialog.getByRole('button', { name: 'Choose a recording' })).toBeDisabled();
    await expect(dialog.getByText('No recordings transcribed on this canvas yet.')).toBeVisible();
    await expectNoSeriousAxeViolations(page, '[role="dialog"]');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('own OpenAI key: upload, watch it transcribe, add it to the canvas; a failure can be retried', async ({
    page,
  }) => {
    const s = await signup('audiobyo', { verify: true });
    const id = await createCanvas(s);
    await ok(
      await s.ctx.put('ai-settings', {
        data: {
          provider: 'openai',
          apiKey: `sk-byo-${Date.now().toString(36)}${'0'.repeat(24)}`,
          model: 'gpt-4o-mini',
        },
      }),
    );

    await openCanvasAs(page, s, id);
    await openTool(page, 'Transcribe audio');
    const dialog = page.getByRole('dialog', { name: 'Transcribe audio' });
    await expect(dialog.getByTestId('transcription-own-key')).toBeVisible();

    // First attempt fails at the speech API.
    await whisper('fail=1');
    await dialog
      .getByTestId('audio-file-input')
      .setInputFiles({ name: 'Interview 3.wav', mimeType: 'audio/wav', buffer: wavBytes() });
    const job = dialog.getByTestId('transcription-job').first();
    await expect(job).toContainText('Failed', { timeout: 20_000 });
    await expect(job).toContainText(/could not be decoded|failed/i);

    // Retry succeeds without re-uploading.
    await whisper('fail=0');
    await job.getByRole('button', { name: 'Try again' }).click();
    const done = dialog.getByTestId('transcription-job').first();
    await expect(done).toContainText('Ready to add', { timeout: 20_000 });
    await done.getByLabel('Transcript title').fill('Interview 3 — ward sister');
    await done.getByRole('button', { name: 'Add to canvas' }).click();
    await expect(done).toContainText('Added to canvas', { timeout: 15_000 });

    const canvas = await getCanvas(s, id);
    const t = canvas.transcripts.find((x: any) => x.title === 'Interview 3 — ward sister');
    expect(t).toBeTruthy();
    expect(t.content).toContain('it gave me my evenings back');
    // Whisper was called with the researcher's own key, not a server key.
    const calls = outbox().filter((e: any) => e.kind === 'ai' && String(e.path).endsWith('/audio/transcriptions'));
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.every((e: any) => e.keyKind === 'byo')).toBe(true);
    // Accepting again is idempotent.
    const jobs = (await ok(await s.ctx.get(`canvas/${id}/transcribe`))).data;
    const completed = jobs.find((j: any) => j.status === 'completed');
    expect(completed.transcriptId).toBe(t.id);
    const again = await ok(await s.ctx.post(`canvas/${id}/transcribe/${completed.id}/accept`, { data: {} }));
    expect(again.cached).toBe(true);
  });

  test('a document upload can never be sent for transcription', async () => {
    const s = await signup('audiodoc', { verify: true });
    const id = await createCanvas(s);
    await ok(
      await s.ctx.put('ai-settings', {
        data: {
          provider: 'openai',
          apiKey: `sk-byo-${Date.now().toString(36)}${'1'.repeat(24)}`,
          model: 'gpt-4o-mini',
        },
      }),
    );
    const doc = (await ok(await uploadDoc(s, id, 'page.png', 'image/png', PNG), 201)).data;
    const res = await s.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: doc.fileUploadId } });
    expect(res.status()).toBe(400);
  });
});

// ─── Region coding ───────────────────────────────────────────────────────────

test.describe('Documents & region coding screen', () => {
  test('sample page, draw a region, edit it, add one by keyboard, delete one', async ({ page }) => {
    const s = await signup('regions', { verify: true });
    const id = await createCanvas(s);
    await addCode(s, id, 'Workload');
    await addCode(s, id, 'Family contact');

    await openCanvasAs(page, s, id);
    await openTool(page, 'Documents & images');
    const dialog = page.getByRole('dialog', { name: 'Documents & images' });
    await expect(dialog.getByTestId('documents-empty')).toContainText('No documents on this canvas yet');
    await expectNoSeriousAxeViolations(page, '[role="dialog"]');

    await dialog.getByRole('button', { name: 'Try it with a sample page' }).click();
    const stage = dialog.getByTestId('document-stage');
    await expect(stage.locator('img')).toBeVisible({ timeout: 15_000 });

    // Draw a region with the mouse using the default (first) code.
    await dialog.getByLabel('Code to apply to new regions').selectOption({ label: 'Workload' });
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();
    const rows = dialog.getByTestId('region-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('1. Workload');
    await expect(stage.getByRole('button', { name: /Region 1: Workload/ })).toBeVisible();

    // Edit: recode and annotate.
    await rows.first().getByRole('button', { name: /^Edit/ }).click();
    await rows.first().getByLabel('Code').selectOption({ label: 'Family contact' });
    await rows.first().getByLabel('Note').fill('Family pressure on discharge');
    await rows.first().getByRole('button', { name: 'Save' }).click();
    await expect(rows.first()).toContainText('Family contact');
    await expect(rows.first()).toContainText('Family pressure on discharge');

    // Keyboard alternative: type a position.
    await dialog.getByText('Add a region by position (keyboard)').click();
    await dialog.getByLabel('Left (%)').first().fill('55');
    await dialog.getByLabel('Top (%)').first().fill('55');
    await dialog.getByRole('button', { name: /Add region on page 1/ }).click();
    await expect(rows).toHaveCount(2);

    const docs = (await ok(await s.ctx.get(`canvas/${id}/documents`))).data;
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ docType: 'image', regionCount: 2 });
    const regions = (await ok(await s.ctx.get(`canvas/${id}/documents/${docs[0].id}/regions`))).data;
    const edited = regions.find((r: any) => r.note === 'Family pressure on discharge');
    expect(edited.x).toBeGreaterThan(5);
    expect(edited.width).toBeGreaterThan(10);
    expect(regions.find((r: any) => r.x === 55 && r.y === 55)).toBeTruthy();

    // Delete one, with confirmation.
    await rows
      .nth(1)
      .getByRole('button', { name: /^Delete/ })
      .click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(rows).toHaveCount(1);
    expect((await ok(await s.ctx.get(`canvas/${id}/documents/${docs[0].id}/regions`))).data).toHaveLength(1);
  });

  test('a two-page PDF renders page by page; regions stay on their page', async ({ page }) => {
    const s = await signup('pdfregions', { verify: true });
    const id = await createCanvas(s);
    await addCode(s, id, 'Policy');
    await openCanvasAs(page, s, id);
    await openTool(page, 'Documents & images');
    const dialog = page.getByRole('dialog', { name: 'Documents & images' });
    await dialog.getByTestId('document-file-input').setInputFiles({
      name: 'Policy memo.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBytes(),
    });
    await expect(dialog.getByText('PDF · 2 pages')).toBeVisible({ timeout: 20_000 });
    await expect(dialog.getByText('Page 1 of 2')).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'Policy memo, page 1' })).toBeVisible({ timeout: 20_000 });
    await dialog.getByRole('button', { name: 'Next page' }).click();
    await expect(dialog.getByText('Page 2 of 2')).toBeVisible();
    await dialog.getByText('Add a region by position (keyboard)').click();
    await dialog.getByRole('button', { name: /Add region on page 2/ }).click();
    await expect(dialog.getByTestId('region-row')).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Previous page' }).click();
    await expect(dialog.getByTestId('region-row')).toHaveCount(0);
    await expect(dialog.getByText('1 more region(s) on other pages.')).toBeVisible();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });

  test('a region whose code was deleted is flagged and can be re-coded', async ({ page }) => {
    const s = await signup('orphanregion', { verify: true });
    const id = await createCanvas(s);
    const keep = await addCode(s, id, 'Keep');
    const gone = await addCode(s, id, 'Doomed');
    const doc = (await ok(await uploadDoc(s, id, 'p.png', 'image/png', PNG), 201)).data;
    await ok(
      await s.ctx.post(`canvas/${id}/documents/${doc.id}/regions`, {
        data: { questionId: gone, x: 10, y: 10, width: 20, height: 20 },
      }),
      201,
    );
    await ok(await s.ctx.delete(`canvas/${id}/questions/${gone}`));
    const [r] = (await ok(await s.ctx.get(`canvas/${id}/documents/${doc.id}/regions`))).data;
    expect(r.codeMissing).toBe(true);

    await openCanvasAs(page, s, id);
    await openTool(page, 'Documents & images');
    const dialog = page.getByRole('dialog', { name: 'Documents & images' });
    const row = dialog.getByTestId('region-row').first();
    await expect(row).toContainText('Deleted code');
    await expect(row).toContainText('Choose a new code or delete the region.');
    await row.getByRole('button', { name: /^Edit/ }).click();
    await row.getByLabel('Code').selectOption({ label: 'Keep' });
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row).toContainText('1. Keep');
    const [after] = (await ok(await s.ctx.get(`canvas/${id}/documents/${doc.id}/regions`))).data;
    expect(after).toMatchObject({ questionId: keep, codeMissing: false });
  });

  test('ownership, plan and file-type rules on the document API', async () => {
    const owner = await signup('docowner', { verify: true });
    const other = await signup('docother', { verify: true });
    const viewer = await signup('docviewer', { verify: true });
    const free = await signup('docfree');
    const id = await createCanvas(owner);
    const otherCanvas = await createCanvas(other);
    const code = await addCode(owner, id, 'Setting');
    const doc = (await ok(await uploadDoc(owner, id, 'p.png', 'image/png', PNG), 201)).data;
    const region = (
      await ok(
        await owner.ctx.post(`canvas/${id}/documents/${doc.id}/regions`, {
          data: { questionId: code, x: 1, y: 1, width: 5, height: 5 },
        }),
        201,
      )
    ).data;

    // Another tenant pairing their own canvas with this document/region: 404, nothing changed.
    const base = `canvas/${otherCanvas}/documents/${doc.id}`;
    expect((await other.ctx.patch(`${base}/regions/${region.id}`, { data: { note: 'x' } })).status()).toBe(404);
    expect((await other.ctx.delete(`${base}/regions/${region.id}`)).status()).toBe(404);
    expect((await other.ctx.get(`${base}/file`)).status()).toBe(404);
    expect((await other.ctx.get(`canvas/${id}/documents/${doc.id}/file`)).status()).toBe(403);

    // A viewer can read the page and its regions but not change them.
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: viewer.email, role: 'viewer' } }),
      201,
    );
    const file = await viewer.ctx.get(`canvas/${id}/documents/${doc.id}/file`);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toBe('image/png');
    expect(file.headers()['x-content-type-options']).toBe('nosniff');
    expect((await viewer.ctx.get(`canvas/${id}/documents/${doc.id}/regions`)).status()).toBe(200);
    expect(
      (
        await viewer.ctx.patch(`canvas/${id}/documents/${doc.id}/regions/${region.id}`, { data: { note: 'x' } })
      ).status(),
    ).toBe(403);

    // Regions must stay on the page, and codes must belong to the canvas.
    const r = `canvas/${id}/documents/${doc.id}/regions/${region.id}`;
    expect((await owner.ctx.patch(r, { data: { x: 90, width: 20 } })).status()).toBe(400);
    expect((await owner.ctx.patch(r, { data: { pageNumber: 2 } })).status()).toBe(400);
    expect((await owner.ctx.patch(r, { data: { x: 'ten' } })).status()).toBe(400);
    const foreignCode = await addCode(other, otherCanvas, 'Foreign');
    expect((await owner.ctx.patch(r, { data: { questionId: foreignCode } })).status()).toBe(400);

    // Type sniffing: a script dressed as an image, and SVG, are refused.
    const fake = await uploadDoc(owner, id, 'evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
    expect(fake.status()).toBe(415);
    const svg = await uploadDoc(
      owner,
      id,
      'x.svg',
      'image/svg+xml',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    );
    expect(svg.status()).toBe(415);

    // Free has no uploads.
    const freeCanvas = await createCanvas(free);
    expect((await uploadDoc(free, freeCanvas, 'p.png', 'image/png', PNG)).status()).toBe(403);

    // Deleting the document takes its regions and its stored file with it.
    await ok(await owner.ctx.delete(`canvas/${id}/documents/${doc.id}`));
    expect((await owner.ctx.get(`canvas/${id}/documents/${doc.id}/regions`)).status()).toBe(404);
  });
});

// ─── Coder training ──────────────────────────────────────────────────────────

const TRAINING_TEXT =
  'I love the team here. But the night shifts are exhausting and I barely sleep. ' +
  'My manager checks in every week, which helps a lot.';

/** Select [start, end) in the training textarea via the keyboard path the screen listens to. */
async function selectInPad(page: Page, dialogName: string, phrase: string) {
  const area = page.getByRole('dialog', { name: dialogName }).getByTestId('training-transcript');
  const start = TRAINING_TEXT.indexOf(phrase);
  await area.evaluate(
    (el: HTMLTextAreaElement, [s, e]) => {
      el.focus();
      el.setSelectionRange(s, e);
    },
    [start, start + phrase.length + 1] as [number, number],
  );
  // Shrink by one with Shift+ArrowLeft, exactly what a keyboard user does.
  await area.press('Shift+ArrowLeft');
}

test.describe('Coder training screen', () => {
  test('owner writes an exercise; the key stays hidden from a trainee until they pass', async ({ page, browser }) => {
    const owner = await signup('trainowner', { verify: true });
    const trainee = await signup('trainee', { verify: true });
    const id = await createCanvas(owner);
    await addTranscript(owner, id, 'Nurse interview', TRAINING_TEXT);
    await addCode(owner, id, 'Fatigue');
    const support = await addCode(owner, id, 'Support');
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: trainee.email, role: 'viewer' } }),
      201,
    );

    // Owner creates the exercise in the UI.
    await openCanvasAs(page, owner, id);
    await openTool(page, 'Coder training');
    const dialogName = 'Coder training';
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog.getByTestId('training-empty')).toContainText('No training exercises yet');
    await expectNoSeriousAxeViolations(page, '[role="dialog"]');
    await dialog.getByRole('button', { name: 'Create an exercise' }).click();
    const create = page.getByRole('dialog', { name: 'New training exercise' });
    await create.getByLabel('Exercise name').fill('Fatigue practice');
    await create.getByLabel(/Instructions for trainees/).fill('Code every mention of tiredness.');
    await selectInPad(page, 'New training exercise', 'the night shifts are exhausting');
    await create.getByLabel('Code for the selected passage').selectOption({ label: 'Fatigue' });
    await create.getByRole('button', { name: 'Add coding' }).click();
    await expect(create.getByTestId('pad-codings')).toContainText('the night shifts are exhausting');
    await create.getByRole('button', { name: /Create exercise \(1 coding in key\)/ }).click();
    const list = page.getByRole('dialog', { name: dialogName });
    await expect(list.getByTestId('training-exercise')).toContainText('Fatigue practice');
    await expect(list.getByTestId('training-exercise')).toContainText('answer key: 1 coding');

    // The answer key is not on the canvas: no canvas coding was created.
    expect((await getCanvas(owner, id)).codings).toHaveLength(0);

    // Trainee API view: no key anywhere before passing.
    const [ex] = (await ok(await trainee.ctx.get(`canvas/${id}/training`))).data;
    expect(ex.goldCodings).toBeUndefined();
    expect(JSON.stringify(ex)).not.toContain('night shifts');
    expect((await ok(await trainee.ctx.get(`canvas/${id}/training/${ex.id}`))).data.goldCodings).toBeUndefined();
    const miss = (
      await ok(
        await trainee.ctx.post(`canvas/${id}/training/${ex.id}/attempt`, {
          data: { codings: [{ questionId: support, startOffset: 0, endOffset: 20 }] },
        }),
        201,
      )
    ).data;
    expect(miss.passed).toBe(false);
    expect(miss.goldCodings).toBeUndefined();
    expect((await ok(await trainee.ctx.get(`canvas/${id}/training/${ex.id}`))).data.goldCodings).toBeUndefined();

    // Trainee passes in the UI and only then sees the key.
    const tp = await newPage(browser);
    await openCanvasAs(tp, trainee, id);
    await openTool(tp, 'Coder training');
    const tDialog = tp.getByRole('dialog', { name: dialogName });
    await expect(tDialog.getByTestId('training-exercise')).toContainText('Not passed yet');
    await tDialog.getByRole('button', { name: /Try again: Fatigue practice/ }).click();
    const attempt = tp.getByRole('dialog', { name: 'Fatigue practice' });
    await expect(attempt).toContainText('Code every mention of tiredness.');
    await expect(attempt).toContainText('The answer key stays hidden until you pass.');
    await selectInPad(tp, 'Fatigue practice', 'the night shifts are exhausting');
    await attempt.getByLabel('Code for the selected passage').selectOption({ label: 'Fatigue' });
    await attempt.getByRole('button', { name: 'Add coding' }).click();
    await attempt.getByRole('button', { name: 'Submit for scoring' }).click();
    const result = attempt.getByTestId('training-result');
    await expect(result).toContainText('Passed');
    await expect(result.getByTestId('training-comparison')).toContainText('Answer key');
    await expect(result.getByTestId('training-comparison')).toContainText('the night shifts are exhausting');
    const detail = (await ok(await trainee.ctx.get(`canvas/${id}/training/${ex.id}`))).data;
    expect(detail.goldCodings).toHaveLength(1);
    const [after] = (await ok(await trainee.ctx.get(`canvas/${id}/training`))).data;
    expect(after.myProgress).toMatchObject({ attempts: 2, passed: true });
    await tp.context().close();

    // Owner reviews attempts with the trainee named.
    await list.getByRole('button', { name: /Review attempts: Fatigue practice/ }).click();
    const review = page.getByRole('dialog', { name: 'Attempts: Fatigue practice' });
    await expect(review.getByRole('table')).toContainText('Estate trainee');
    await expect(review.getByRole('table')).toContainText('Passed');
    await expect(review.getByRole('table')).toContainText('Not passed');
  });

  test('exercises are owner-authored: collaborators cannot create or delete them', async () => {
    const owner = await signup('trainown2', { verify: true });
    await subscribe(owner, 'price_qc_team_m'); // a coder needs Team (Pro is one person)
    const editor = await signup('traineditor', { verify: true });
    const id = await createCanvas(owner);
    const t = await addTranscript(owner, id, 'T', TRAINING_TEXT);
    const q = await addCode(owner, id, 'Fatigue');
    await ok(
      await owner.ctx.post(`canvas/${id}/collaborators`, {
        data: { email: editor.email, role: 'editor', confirmSeatCharge: true },
      }),
      201,
    );
    const gold = [{ questionId: q, startOffset: 0, endOffset: 10 }];
    expect(
      (
        await editor.ctx.post(`canvas/${id}/training`, { data: { transcriptId: t, name: 'x', goldCodings: gold } })
      ).status(),
    ).toBe(403);
    const ex = (
      await ok(
        await owner.ctx.post(`canvas/${id}/training`, { data: { transcriptId: t, name: 'x', goldCodings: gold } }),
        201,
      )
    ).data;
    expect((await editor.ctx.delete(`canvas/${id}/training/${ex.id}`)).status()).toBe(403);
  });
});

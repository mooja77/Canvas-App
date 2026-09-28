import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { signup, ok, json, createCanvas, outbox, type Session } from './support/api';

// QualCanvas holds no paid AI key (decision 28 Sep 2026). Every AI call runs
// on a customer's own key. The backend in this suite is started WITH a decoy
// OPENAI_API_KEY and HOSTED_AI_ENABLED=true (playwright.fullstack.config.ts),
// so these tests prove a key set on the server by mistake is never used.
//
// Provider traffic is answered by the preload stub: a key containing "sk-bad"
// is rejected (401), "sk-nocredit" has no credit (429 insufficient_quota).
// Test keys are generated at run time; none is written in the source.

const rand = () => Math.random().toString(36).slice(2, 10);
/** A customer's own test key; `tag` lets the outbox say whose key a call used. */
const ownKey = (tag: string) => `sk-own-${tag}-${rand()}${rand()}`;
const badKey = () => `sk-bad-${rand()}${rand()}`;
const noCreditKey = () => `sk-nocredit-${rand()}${rand()}`;

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

async function signIn(page: Page, s: Session): Promise<void> {
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
}

async function openCanvas(page: Page, canvasId: string): Promise<void> {
  await page.goto(`/canvas/${canvasId}`);
  await page.waitForSelector('.react-flow__pane', { timeout: 30_000 });
}

async function openAudio(page: Page) {
  await page.getByRole('button', { name: 'Tools menu' }).first().click();
  await page.getByRole('button', { name: 'Transcribe audio' }).first().click();
  return page.getByRole('dialog', { name: 'Transcribe audio' });
}

async function noSeriousAxe(page: Page, selector: string) {
  const results = await new AxeBuilder({ page }).include(selector).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function upload(s: Session, canvasId: string): Promise<string> {
  const up = await ok(
    await s.ctx.post(`canvas/${canvasId}/upload/direct`, {
      multipart: { file: { name: 'interview.wav', mimeType: 'audio/wav', buffer: wavBytes() } },
    }),
  );
  return up.data.id;
}

async function waitForJob(s: Session, canvasId: string, jobId: string) {
  for (let i = 0; i < 60; i++) {
    const job = (await ok(await s.ctx.get(`canvas/${canvasId}/transcribe/${jobId}`))).data;
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('transcription job did not finish');
}

test.describe('Connect your AI account', () => {
  test('audio upload with no key → wizard (bad key, then good key) → transcribes on the customer’s own key', async ({
    page,
  }) => {
    const s = await signup('wizard', { verify: true }); // trial = Pro, can upload
    const id = await createCanvas(s);
    await signIn(page, s);
    await openCanvas(page, id);

    const audio = await openAudio(page);
    const needs = audio.getByTestId('transcription-needs-key');
    await expect(needs).toContainText('Connect your AI account to transcribe');
    await expect(needs).toContainText('$0.006 a minute');
    await expect(audio.getByRole('button', { name: 'Choose a recording' })).toBeDisabled();
    await needs.getByRole('button', { name: 'Connect your AI account' }).click();

    // Step 1: plain-English explanation and cited cost.
    const wizard = page.getByRole('dialog', { name: 'Connect your AI account' });
    await expect(wizard).toBeVisible();
    const heading = wizard.getByTestId('connect-ai-step');
    await expect(heading).toHaveText('How it works');
    await expect(heading).toBeFocused();
    await expect(wizard).toContainText('You pay the provider directly');
    await expect(wizard.getByRole('link', { name: /OpenAI's pricing page/ })).toHaveAttribute(
      'href',
      'https://developers.openai.com/api/docs/pricing',
    );
    await noSeriousAxe(page, '[aria-labelledby="connect-ai-title"]');
    await wizard.getByRole('button', { name: 'Get started' }).click();

    // Step 2: provider (opened for transcription, so OpenAI is preselected).
    await expect(heading).toHaveText('Choose a provider');
    await expect(wizard.getByRole('radio', { name: /^OpenAI/ })).toBeChecked();
    await wizard.getByRole('button', { name: 'Next' }).click();

    // Step 3: numbered steps with provider links, including a spending limit.
    await expect(heading).toHaveText('Create a key');
    await expect(wizard.getByTestId('connect-ai-steps').locator('li')).toHaveCount(5);
    await expect(wizard.getByRole('link', { name: /Open OpenAI API keys/ })).toHaveAttribute(
      'href',
      'https://platform.openai.com/api-keys',
    );
    await expect(wizard.getByRole('link', { name: /Open OpenAI limits/ })).toBeVisible();
    await noSeriousAxe(page, '[aria-labelledby="connect-ai-title"]');
    await wizard.getByRole('button', { name: 'I have my key' }).click();

    // Step 4: a rejected key shows a clear error and saves nothing.
    await expect(heading).toHaveText('Test your key');
    const keyInput = wizard.getByLabel('OpenAI API key');
    await keyInput.fill(badKey());
    await wizard.getByRole('button', { name: 'Test and save key' }).click();
    const alert = wizard.getByRole('alert');
    await expect(alert).toContainText("That key didn't work.");
    await expect(alert).toContainText('OpenAI did not accept this key');
    await expect(keyInput).toHaveAttribute('aria-invalid', 'true');
    expect((await ok(await s.ctx.get('ai-settings'))).data.hasApiKey).toBe(false);
    await noSeriousAxe(page, '[aria-labelledby="connect-ai-title"]');

    // No credit: explained, with the billing page.
    await keyInput.fill(noCreditKey());
    await wizard.getByRole('button', { name: 'Test and save key' }).click();
    await expect(wizard.getByRole('alert')).toContainText('no credit left');

    // A good key: tested, saved, success step with security + spending limit.
    const good = ownKey('wiz');
    await keyInput.fill(good);
    await wizard.getByRole('button', { name: 'Test and save key' }).click();
    await expect(wizard.getByTestId('connect-ai-success')).toContainText('Your OpenAI account is connected.');
    await expect(wizard).toContainText('stored encrypted');
    await expect(wizard).toContainText('Only your account uses it');
    await expect(wizard).toContainText('remove it at any time');
    await expect(wizard.getByRole('link', { name: /set a monthly spending limit/ })).toBeVisible();
    await expect(wizard).not.toContainText(good);
    await noSeriousAxe(page, '[aria-labelledby="connect-ai-title"]');
    await wizard.getByRole('button', { name: 'Back to transcription' }).click();
    await expect(wizard).toBeHidden();

    // Back on the audio screen: it now says whose key pays, and transcribes.
    await expect(audio.getByTestId('transcription-own-key')).toContainText('your own OpenAI account');
    await audio
      .getByTestId('audio-file-input')
      .setInputFiles({ name: 'Wizard interview.wav', mimeType: 'audio/wav', buffer: wavBytes() });
    await expect(audio.getByTestId('transcription-job').first()).toContainText('Ready to add', { timeout: 20_000 });

    // The key checks and the Whisper call all carried the customer's key.
    const checks = outbox().filter((e: any) => e.kind === 'ai-key-check');
    expect(checks.length).toBeGreaterThanOrEqual(3);
    const whisper = outbox().filter(
      (e: any) => e.kind === 'ai' && String(e.path).endsWith('/audio/transcriptions') && e.keyTag === 'wiz',
    );
    expect(whisper.length).toBe(1);
    // Usage reporting on the customer's own key (no allowance, no cap).
    const allowance = (await ok(await s.ctx.get(`canvas/${id}/transcribe/allowance`))).data;
    expect(allowance.keySource).toBe('own');
    expect(allowance.usageThisMonth.minutes).toBeGreaterThan(0);
  });

  test('Settings → AI opens the same wizard; the key can be removed', async ({ page }) => {
    const s = await signup('settings', { verify: true });
    await signIn(page, s);
    await page.goto('/account#ai');
    const section = page.locator('#ai');
    await expect(section.getByTestId('ai-not-connected')).toBeVisible();
    await section.getByRole('button', { name: 'Connect your AI account' }).click();
    const wizard = page.getByRole('dialog', { name: 'Connect your AI account' });
    await wizard.getByRole('button', { name: 'Get started' }).click();
    await wizard.getByRole('button', { name: 'Next' }).click();
    await wizard.getByRole('button', { name: 'I have my key' }).click();
    await wizard.getByLabel('OpenAI API key').fill(ownKey('settings'));
    await wizard.getByRole('button', { name: 'Test and save key' }).click();
    await wizard.getByRole('button', { name: 'Done' }).click();
    await expect(section.getByTestId('ai-connected')).toContainText('Connected: OpenAI');
    await noSeriousAxe(page, '#ai');
    page.once('dialog', (d) => d.accept());
    await section.getByRole('button', { name: 'Remove key' }).click();
    await expect(section.getByTestId('ai-not-connected')).toBeVisible();
    expect((await ok(await s.ctx.get('ai-settings'))).data.hasApiKey).toBe(false);
  });

  test('an AI feature used without a key answers AI_KEY_REQUIRED (never the server key)', async () => {
    const s = await signup('aifeature', { verify: true });
    const id = await createCanvas(s);
    const before = outbox().length;
    const res = await s.ctx.post(`canvas/${id}/ai/summarize`, { data: { sourceType: 'canvas', sourceId: id } });
    const body = await json(res);
    expect(res.status()).toBe(400);
    expect(body.code).toBe('AI_KEY_REQUIRED');
    expect(body.error).toContain('Connect your AI account');
    expect(
      outbox()
        .slice(before)
        .filter((e: any) => e.kind === 'ai'),
    ).toEqual([]);
  });
});

test.describe('Collaborator key rule', () => {
  async function setup() {
    const owner = await signup('keyowner', { verify: true }); // trial = Pro: coders allowed, not billed
    const coder = await signup('keycoder', { verify: true });
    const id = await createCanvas(owner, 'Shared study');
    await ok(await owner.ctx.post(`canvas/${id}/collaborators`, { data: { email: coder.email, role: 'editor' } }), 201);
    await ok(await owner.ctx.put('ai-settings', { data: { provider: 'openai', apiKey: ownKey('owner') } }));
    return { owner, coder, id };
  }

  test('owner’s key is used by a coder only while the owner allows it, and the owner sees the usage', async ({
    page,
  }) => {
    const { owner, coder, id } = await setup();

    // Default: sharing off → the coder cannot spend the owner's key.
    let allowance = (await ok(await coder.ctx.get(`canvas/${id}/transcribe/allowance`))).data;
    expect(allowance).toMatchObject({
      keySource: null,
      isCanvasOwner: false,
      ownerHasOpenAiKey: true,
      ownerSharesKey: false,
    });
    const fileId = await upload(coder, id);
    const refused = await coder.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: fileId } });
    expect(refused.status()).toBe(409);
    expect((await json(refused)).code).toBe('TRANSCRIPTION_KEY_REQUIRED');
    expect((await json(refused)).error).toContain("hasn't let collaborators use their OpenAI key");

    // Owner allows it (a coder cannot change the owner's setting).
    await ok(await owner.ctx.put('ai-settings/sharing', { data: { shareWithCollaborators: true } }));
    allowance = (await ok(await coder.ctx.get(`canvas/${id}/transcribe/allowance`))).data;
    expect(allowance).toMatchObject({ keySource: 'canvas-owner', canvasOwnerName: 'Estate keyowner' });

    // The coder's screen names whose key pays.
    await signIn(page, coder);
    await openCanvas(page, id);
    const audio = await openAudio(page);
    await expect(audio.getByTestId('transcription-owner-key')).toContainText("Estate keyowner's");
    await noSeriousAxe(page, '[aria-labelledby="audio-transcription-title"]');
    await page.keyboard.press('Escape');

    const started = (await ok(await coder.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: fileId } })))
      .data;
    const job = await waitForJob(coder, id, started.jobId);
    expect(job.status).toBe('completed');
    expect(job.keyOwnerUserId).toBe(owner.userId);
    const calls = outbox().filter((e: any) => e.kind === 'ai' && String(e.path).endsWith('/audio/transcriptions'));
    expect(calls.at(-1)).toMatchObject({ keyKind: 'byo', keyTag: 'owner' });

    // The owner sees what the coder transcribed on their key.
    const settings = (await ok(await owner.ctx.get('ai-settings'))).data;
    expect(settings.shareWithCollaborators).toBe(true);
    expect(settings.collaboratorUsage).toHaveLength(1);
    expect(settings.collaboratorUsage[0]).toMatchObject({ userId: coder.userId });
    expect(settings.collaboratorUsage[0].minutes).toBeGreaterThan(0);

    // Owner blocks it again → refused before queueing.
    await ok(await owner.ctx.put('ai-settings/sharing', { data: { shareWithCollaborators: false } }));
    const second = await upload(coder, id);
    expect((await coder.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: second } })).status()).toBe(409);
  });

  test('a coder with their own key pays for their own transcription, even when the owner shares', async () => {
    const { owner, coder, id } = await setup();
    await ok(await owner.ctx.put('ai-settings/sharing', { data: { shareWithCollaborators: true } }));
    await ok(await coder.ctx.put('ai-settings', { data: { provider: 'openai', apiKey: ownKey('coder') } }));
    expect((await ok(await coder.ctx.get(`canvas/${id}/transcribe/allowance`))).data.keySource).toBe('own');
    const fileId = await upload(coder, id);
    const started = (await ok(await coder.ctx.post(`canvas/${id}/transcribe`, { data: { fileUploadId: fileId } })))
      .data;
    const job = await waitForJob(coder, id, started.jobId);
    expect(job.keyOwnerUserId).toBe(coder.userId);
    const calls = outbox().filter((e: any) => e.kind === 'ai' && String(e.path).endsWith('/audio/transcriptions'));
    expect(calls.at(-1)).toMatchObject({ keyKind: 'byo', keyTag: 'coder' });
  });

  test('a coder cannot switch on sharing for the owner’s key', async () => {
    const { coder } = await setup();
    // Sharing is per account: the coder has no key, so there is nothing of theirs to share.
    const res = await coder.ctx.put('ai-settings/sharing', { data: { shareWithCollaborators: true } });
    expect(res.status()).toBe(409);
  });
});

test('the decoy server key was never sent to a provider during the whole suite', async () => {
  const ai = outbox().filter((e: any) => e.kind === 'ai' || e.kind === 'ai-key-check');
  expect(ai.length).toBeGreaterThan(0);
  expect(ai.filter((e: any) => e.keyKind === 'server')).toEqual([]);
  expect(ai.filter((e: any) => e.keyKind === 'none')).toEqual([]);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const appOrigin = process.env.QUALCANVAS_QA_ORIGIN || 'https://qualcanvas.com';
const apiOrigin = process.env.QUALCANVAS_QA_API_ORIGIN || 'https://api.qualcanvas.com/api';
const runId = Date.now();
const email = process.env.QUALCANVAS_QA_EMAIL || `activation-journey-${runId}@example.com`;
const password = process.env.QUALCANVAS_QA_PASSWORD || `Qc!Activation-${runId}`;
const outputDirectory = process.env.QUALCANVAS_QA_OUTPUT || path.join(os.tmpdir(), `qualcanvas-activation-${runId}`);

const transcript = [
  'The fictional participant described finding the appointment system confusing during their first visit.',
  'A fictional support worker then explained each step and the participant felt more confident continuing.',
  'This synthetic transcript contains no customer, participant, or production information.',
].join(' ');

fs.mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: process.env.QUALCANVAS_QA_HEADFUL !== 'true' });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: 'light',
});
const page = await context.newPage();
const startedAt = Date.now();
const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const apiErrors = [];
const analyticsResponseStatuses = [];
const milestones = {};
let accountCreated = false;
let accountDeleted = false;
let deletionStatus = null;

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
page.on('response', (response) => {
  if (response.url().endsWith('/api/v1/events/track')) analyticsResponseStatuses.push(response.status());
  if (response.url().startsWith(apiOrigin) && response.status() >= 400) {
    apiErrors.push({ method: response.request().method(), status: response.status(), url: response.url() });
  }
});

function mark(name) {
  milestones[name] = Number(((Date.now() - startedAt) / 1000).toFixed(1));
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(outputDirectory, `${name}.png`), fullPage: true });
}

async function selectTranscriptExcerpt(characterCount = 76) {
  const text = page.locator('.select-text').filter({ hasText: 'The fictional participant described' }).first();
  await text.waitFor({ state: 'visible' });
  await text.evaluate((element, length) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textNode = walker.nextNode();
    if (!textNode) throw new Error('Transcript text node was not found');
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(length, textNode.textContent?.length ?? 0));
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const rect = range.getBoundingClientRect();
    element.parentElement?.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top,
      }),
    );
  }, characterCount);
}

try {
  await page.goto(`${appOrigin}/login?mode=register`, { waitUntil: 'networkidle', timeout: 60_000 });
  const rejectCookies = page.getByRole('button', { name: /Reject non-essential cookies|Reject/i });
  if (await rejectCookies.isVisible({ timeout: 1_500 }).catch(() => false)) await rejectCookies.click();
  await screenshot('01-register');

  await page.locator('#register-name').fill('Fictional Rowan Blake');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(password);
  const signupResponse = page.waitForResponse(
    (response) => response.url().includes('/api/auth/signup') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Create Free Account/i }).click();
  const signup = await signupResponse;
  if (signup.status() !== 201) throw new Error(`Signup returned HTTP ${signup.status()}`);
  accountCreated = true;
  await page.waitForURL(/\/canvas(?:\/|$)/, { timeout: 30_000 });
  mark('accountCreatedSeconds');

  const onboardingHeading = page.getByRole('heading', { name: "Let's tailor your workspace" });
  await onboardingHeading.waitFor({ state: 'visible', timeout: 20_000 });
  await screenshot('02-onboarding-personalisation');
  await page.locator('#onboarding-topic').fill('Synthetic access-to-services study');
  await page.getByRole('button', { name: 'Solo', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('heading', { name: 'Pick a starting point' }).waitFor({ state: 'visible' });
  await screenshot('03-onboarding-template');

  const canvasResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/canvas') && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Blank canvas/i }).click();
  const createdCanvas = await canvasResponse;
  if (createdCanvas.status() !== 201) throw new Error(`Blank canvas creation returned HTTP ${createdCanvas.status()}`);
  await page.waitForURL(/\/canvas\/[a-zA-Z0-9_-]+/, { timeout: 30_000 });
  await page.locator('.react-flow__pane').waitFor({ state: 'visible', timeout: 30_000 });
  mark('blankCanvasReadySeconds');
  await screenshot('04-blank-canvas');

  const verificationBannerVisible = await page
    .getByText(/Please verify your email/i)
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  const checklistBefore = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);

  await page.getByTitle('Add transcript').click();
  await page.getByRole('button', { name: /Paste Text/i }).click();
  const transcriptDialog = page.getByRole('dialog', { name: 'Add Transcript' });
  await transcriptDialog.getByLabel('Title').fill('Fictional Interview 01');
  await transcriptDialog.getByLabel('Transcript Content').fill(transcript);
  const transcriptResponse = page.waitForResponse(
    (response) => /\/api\/canvas\/[^/]+\/transcripts$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await transcriptDialog.getByRole('button', { name: 'Add Transcript', exact: true }).click();
  const addedTranscript = await transcriptResponse;
  if (addedTranscript.status() !== 201)
    throw new Error(`Transcript creation returned HTTP ${addedTranscript.status()}`);
  await transcriptDialog.waitFor({ state: 'detached', timeout: 20_000 });
  await page.getByText('Fictional Interview 01', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  mark('transcriptAddedSeconds');
  const checklistAfterTranscript = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  await screenshot('05-transcript-added');

  await selectTranscriptExcerpt();
  const quickCodeInput = page.getByPlaceholder(/Type a name and press Enter to create|Search or create code/i);
  await quickCodeInput.waitFor({ state: 'visible', timeout: 10_000 });
  await quickCodeInput.fill('Access barriers');
  const codingResponse = page.waitForResponse(
    (response) => /\/api\/canvas\/[^/]+\/codings$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Create "Access barriers" and code/i }).click();
  const createdCoding = await codingResponse;
  if (createdCoding.status() !== 201) throw new Error(`Coding creation returned HTTP ${createdCoding.status()}`);
  await page.getByText(/1 segment/).waitFor({ state: 'visible', timeout: 20_000 });
  mark('firstCodingSeconds');
  const checklistAfterCoding = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  await screenshot('06-first-coding');

  const axe = await new AxeBuilder({ page }).analyze();
  const seriousAccessibilityViolations = axe.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodeCount: violation.nodes.length,
      nodes: violation.nodes.slice(0, 20).map((node) => ({
        target: node.target,
        html: node.html.slice(0, 500),
        failureSummary: node.failureSummary?.slice(0, 1_000) ?? null,
      })),
    }));
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );

  const result = {
    success: true,
    appOrigin,
    finalUrl: page.url(),
    milestones,
    verificationBannerVisible,
    checklistBefore,
    checklistAfterTranscript,
    checklistAfterCoding,
    noHorizontalOverflow,
    seriousAccessibilityViolations,
    consoleErrors,
    pageErrors,
    failedRequests,
    analyticsResponseStatuses,
    apiErrors,
    outputDirectory,
  };
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  if (accountCreated) {
    try {
      const deletion = await page.evaluate(
        async ({ apiUrl, accountPassword }) => {
          const response = await fetch(`${apiUrl}/auth/account`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: accountPassword, deleteLegacyCanvases: true }),
          });
          return { status: response.status, ok: response.ok };
        },
        { apiUrl: apiOrigin, accountPassword: password },
      );
      deletionStatus = deletion.status;
      accountDeleted = deletion.ok;
    } catch {
      accountDeleted = false;
    }
  }
  console.log(JSON.stringify({ cleanup: { accountCreated, accountDeleted, deletionStatus } }));
  await context.close();
  await browser.close();
}

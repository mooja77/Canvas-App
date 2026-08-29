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
const researcherName = 'Fictional Rowan Blake';
const studyTitle = 'Synthetic access-to-services study';
const transcriptTitle = 'Fictional Interview 01';

const transcript = [
  'The fictional participant described finding the appointment system confusing during their first visit.',
  'A fictional support worker then explained each step, wrote down the next appointment date, and the participant felt more confident continuing.',
  'The fictional participant suggested that a short welcome guide and a named contact would make the service easier to navigate.',
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

async function selectTranscriptExcerpt(startText, characterCount) {
  const text = page.locator('.select-text').filter({ hasText: startText }).first();
  await text.waitFor({ state: 'visible' });
  await text.evaluate(
    (element, excerpt) => {
      const fullText = element.textContent ?? '';
      const startOffset = fullText.indexOf(excerpt.startText);
      if (startOffset < 0) throw new Error(`Excerpt start text was not found: ${excerpt.startText}`);

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);

      const pointAt = (absoluteOffset) => {
        let consumed = 0;
        for (const textNode of textNodes) {
          const nodeLength = textNode.textContent?.length ?? 0;
          if (absoluteOffset <= consumed + nodeLength) {
            return { node: textNode, offset: Math.max(0, absoluteOffset - consumed) };
          }
          consumed += nodeLength;
        }
        const last = textNodes.at(-1);
        if (!last) throw new Error('Transcript text node was not found');
        return { node: last, offset: last.textContent?.length ?? 0 };
      };

      const start = pointAt(startOffset);
      const end = pointAt(Math.min(startOffset + excerpt.characterCount, fullText.length));
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
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
    },
    { startText, characterCount },
  );
}

try {
  await page.goto(`${appOrigin}/login?mode=register`, { waitUntil: 'networkidle', timeout: 60_000 });
  const rejectCookies = page.getByRole('button', { name: /Reject non-essential cookies|Reject/i });
  if (await rejectCookies.isVisible({ timeout: 1_500 }).catch(() => false)) await rejectCookies.click();
  await screenshot('01-register');

  await page.locator('#register-name').fill(researcherName);
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
  await page.locator('#onboarding-topic').fill(studyTitle);
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
  await transcriptDialog.getByLabel('Title').fill(transcriptTitle);
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
  await page.getByText(transcriptTitle, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  mark('transcriptAddedSeconds');
  const checklistAfterTranscript = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  await screenshot('05-transcript-added');

  await selectTranscriptExcerpt('The fictional participant described', 92);
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

  await selectTranscriptExcerpt('A fictional support worker', 128);
  await quickCodeInput.waitFor({ state: 'visible', timeout: 10_000 });
  await quickCodeInput.fill('Support and navigation');
  const secondCodingResponse = page.waitForResponse(
    (response) => /\/api\/canvas\/[^/]+\/codings$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: /Create "Support and navigation" and code/i }).click();
  const secondCoding = await secondCodingResponse;
  if (secondCoding.status() !== 201) throw new Error(`Second coding creation returned HTTP ${secondCoding.status()}`);
  await page
    .getByText('Support and navigation', { exact: true })
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 });
  mark('secondCodingSeconds');
  const checklistAfterSecondCode = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  await screenshot('07-second-coding');

  await page.getByRole('button', { name: 'Analyze menu' }).click();
  const analysisMenu = page.getByTestId('collision-popover').first();
  await analysisMenu.waitFor({ state: 'visible', timeout: 10_000 });
  const createAnalysisResponse = page.waitForResponse(
    (response) => /\/api\/canvas\/[^/]+\/computed$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await analysisMenu.getByText('Statistics', { exact: true }).click();
  const createdAnalysis = await createAnalysisResponse;
  if (createdAnalysis.status() !== 201)
    throw new Error(`Statistics analysis creation returned HTTP ${createdAnalysis.status()}`);

  const statisticsNode = page
    .locator('.react-flow__node')
    .filter({ hasText: /^Statistics/ })
    .first();
  await statisticsNode.waitFor({ state: 'visible', timeout: 20_000 });
  const runAnalysisResponse = page.waitForResponse(
    (response) =>
      /\/api\/canvas\/[^/]+\/computed\/[^/]+\/run$/.test(response.url()) && response.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await statisticsNode.getByTitle('Run computation').click();
  const ranAnalysis = await runAnalysisResponse;
  if (ranAnalysis.status() !== 200) throw new Error(`Statistics analysis returned HTTP ${ranAnalysis.status()}`);
  await statisticsNode.getByText('2 total', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  mark('analysisRunSeconds');
  const checklistAfterAnalysis = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  await screenshot('08-analysis-run');

  await page.getByRole('button', { name: 'Tools menu' }).click();
  await page.getByRole('button', { name: 'Codebook', exact: true }).click();
  const exportDialog = page.getByRole('dialog', { name: 'Codebook & coded data export' });
  await exportDialog.waitFor({ state: 'visible', timeout: 10_000 });
  await exportDialog.getByRole('button', { name: /All Coded Data/ }).click();
  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  const onboardingPatchPromise = page.waitForResponse(
    (response) => response.url().endsWith('/api/user/onboarding') && response.request().method() === 'PATCH',
    { timeout: 20_000 },
  );
  await exportDialog.getByRole('button', { name: 'Download CSV' }).click();
  const [download, onboardingPatch] = await Promise.all([downloadPromise, onboardingPatchPromise]);
  if (onboardingPatch.status() !== 200)
    throw new Error(`Export checklist persistence returned HTTP ${onboardingPatch.status()}`);
  const downloadedCsvPath = path.join(outputDirectory, 'coded-data-export.csv');
  await download.saveAs(downloadedCsvPath);
  const exportedCsv = fs.readFileSync(downloadedCsvPath, 'utf8');
  for (const expectedValue of [transcriptTitle, 'Access barriers', 'Support and navigation']) {
    if (!exportedCsv.includes(expectedValue)) throw new Error(`CSV export is missing ${expectedValue}`);
  }
  mark('csvExportedSeconds');
  await screenshot('09-csv-exported');
  await exportDialog.getByRole('button', { name: 'Close' }).click();
  await exportDialog.waitFor({ state: 'detached', timeout: 10_000 });
  const checklistAfterExport = await page
    .getByText(/\d+ of \d+ complete/)
    .first()
    .textContent()
    .catch(() => null);
  const checklistHiddenAfterCompletion = (await page.getByText('Get started', { exact: true }).count()) === 0;
  const persistedOnboarding = await page.evaluate(async (apiUrl) => {
    const response = await fetch(`${apiUrl}/user/onboarding`, { credentials: 'include' });
    return { status: response.status, body: await response.json() };
  }, apiOrigin);
  const persistedChecklistComplete = Array.isArray(persistedOnboarding.body?.data?.state?.checklistComplete)
    ? persistedOnboarding.body.data.state.checklistComplete
    : [];
  await screenshot('10-activation-complete');

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

  const activationChecklistComplete =
    checklistAfterExport === '5 of 5 complete' ||
    (checklistHiddenAfterCompletion &&
      checklistAfterAnalysis === '4 of 5 complete' &&
      persistedOnboarding.status === 200 &&
      persistedChecklistComplete.includes('export-csv'));
  const verificationErrors = [
    ...(activationChecklistComplete
      ? []
      : [
          `Activation checklist did not complete (visible state: ${checklistAfterExport ?? 'hidden'}, persisted items: ${persistedChecklistComplete.join(', ') || 'none'})`,
        ]),
    ...(noHorizontalOverflow ? [] : ['The canvas has horizontal overflow']),
    ...(seriousAccessibilityViolations.length === 0
      ? []
      : [`Axe found ${seriousAccessibilityViolations.length} serious or critical violation group(s)`]),
    ...pageErrors.map((error) => `Page error: ${error}`),
    ...apiErrors.map((error) => `App API error: ${error.method} ${error.status} ${error.url}`),
  ];

  const result = {
    success: verificationErrors.length === 0,
    appOrigin,
    finalUrl: page.url(),
    milestones,
    verificationBannerVisible,
    checklistBefore,
    checklistAfterTranscript,
    checklistAfterCoding,
    checklistAfterSecondCode,
    checklistAfterAnalysis,
    checklistAfterExport,
    checklistHiddenAfterCompletion,
    persistedChecklistComplete,
    exportedCsvBytes: Buffer.byteLength(exportedCsv),
    noHorizontalOverflow,
    seriousAccessibilityViolations,
    consoleErrors,
    pageErrors,
    failedRequests,
    analyticsResponseStatuses,
    apiErrors,
    verificationErrors,
    outputDirectory,
  };
  fs.writeFileSync(path.join(outputDirectory, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (verificationErrors.length > 0) throw new Error(verificationErrors.join('; '));
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

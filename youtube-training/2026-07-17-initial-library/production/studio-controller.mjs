import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import { chromium } from '@playwright/test';

const host = '127.0.0.1';
const port = Number(process.env.QUALCANVAS_STUDIO_PORT || 9444);
const profile = process.env.QUALCANVAS_STUDIO_PROFILE || path.join(os.tmpdir(), 'codex-qualcanvas-youtube');
const executablePath = process.env.QUALCANVAS_CHROME_PATH || chromium.executablePath();
const attachedOverCdp = Boolean(process.env.QUALCANVAS_CDP_URL);

let browser;
let context;
if (attachedOverCdp) {
  browser = await chromium.connectOverCDP(process.env.QUALCANVAS_CDP_URL);
  context = browser.contexts()[0];
} else {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    viewport: null,
    args: ['--disable-extensions', '--start-maximized'],
  });
}

let page =
  context.pages().find((candidate) => /(?:studio\.)?youtube\.com/.test(candidate.url())) ||
  context.pages()[0] ||
  (await context.newPage());

if (page.url() === 'about:blank') {
  await page.goto('https://studio.youtube.com', { waitUntil: 'commit' });
}

function currentPage() {
  const pages = context.pages();
  page =
    pages.find((candidate) => candidate.url().startsWith('https://studio.youtube.com')) ||
    pages.find((candidate) => candidate.url().startsWith('https://www.youtube.com')) ||
    pages.at(-1) ||
    page;
  return page;
}

function rootFor(activePage, scope) {
  if (scope === 'dialogLast') return activePage.getByRole('dialog').last();
  if (scope === 'dialogFirst') return activePage.getByRole('dialog').first();
  return activePage;
}

function locatorFor(activePage, step) {
  const root = rootFor(activePage, step.scope);
  if (step.by === 'role') {
    return root.getByRole(step.role, { name: step.name, exact: step.exact ?? false }).nth(step.nth ?? 0);
  }
  if (step.by === 'text') {
    return root.getByText(step.text, { exact: step.exact ?? false }).nth(step.nth ?? 0);
  }
  return root.locator(step.selector).nth(step.nth ?? 0);
}

async function runStep(step) {
  const activePage = currentPage();
  activePage.setDefaultTimeout(step.timeoutMs || 20_000);

  if (step.type === 'goto') {
    await activePage.goto(step.url, { waitUntil: step.waitUntil || 'commit', timeout: step.timeoutMs || 45_000 });
  } else if (step.type === 'wait') {
    await activePage.waitForTimeout(step.ms || 500);
  } else if (step.type === 'click') {
    const locator = locatorFor(activePage, step);
    if (step.dom) await locator.evaluate((element) => element.click());
    else await locator.click({ force: step.force ?? false });
  } else if (step.type === 'fill') {
    await locatorFor(activePage, step).fill(step.value ?? '');
  } else if (step.type === 'press') {
    await locatorFor(activePage, step).press(step.key);
  } else if (step.type === 'setFiles') {
    await locatorFor(activePage, step).setInputFiles(step.paths);
  } else if (step.type === 'scroll') {
    await locatorFor(activePage, step).scrollIntoViewIfNeeded();
  } else {
    throw new Error(`Unsupported action type: ${step.type}`);
  }

  if (step.afterMs) await activePage.waitForTimeout(step.afterMs);
}

async function snapshot(limit = 12_000) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const activePage = currentPage();
      await activePage.waitForTimeout(attempt === 0 ? 0 : 500);
      const [title, body, dialogs, controls] = await Promise.all([
        activePage.title(),
        activePage.locator('body').innerText(),
        activePage.getByRole('dialog').count(),
        activePage.locator('input,textarea,[contenteditable="true"],button').evaluateAll((nodes) =>
          nodes.slice(0, 220).map((node, index) => ({
            index,
            tag: node.tagName,
            type: node.getAttribute('type'),
            aria: node.getAttribute('aria-label'),
            placeholder: node.getAttribute('placeholder'),
            value: 'value' in node ? String(node.value).slice(0, 300) : '',
            text: (node.innerText || '').trim().slice(0, 180),
            disabled: Boolean(node.disabled) || node.getAttribute('aria-disabled') === 'true',
          })),
        ),
      ]);
      return {
        url: activePage.url(),
        title,
        dialogs,
        body: body.slice(0, limit),
        controls,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (request.method === 'GET' && request.url?.startsWith('/state')) {
      const url = new URL(request.url, `http://${host}:${port}`);
      response.end(JSON.stringify(await snapshot(Number(url.searchParams.get('limit')) || 12_000)));
      return;
    }

    if (request.method === 'POST' && request.url === '/action') {
      const payload = await readJson(request);
      const steps = Array.isArray(payload.steps) ? payload.steps : [payload];
      for (const step of steps) await runStep(step);
      response.end(JSON.stringify(await snapshot(payload.limit || 12_000)));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: error.message, stack: error.stack }));
  }
});

server.listen(port, host, () => {
  console.log(`QUALCANVAS_STUDIO_CONTROLLER_READY http://${host}:${port}`);
});

async function shutdown() {
  server.close();
  // Closing a Browser returned by connectOverCDP also closes the owner's
  // signed-in Chrome. Leave an attached browser running and only close a
  // context that this controller launched itself.
  if (!attachedOverCdp) await context.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

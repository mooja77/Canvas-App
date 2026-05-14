#!/usr/bin/env node
/**
 * One-shot generator for apps/frontend/public/og-image.png.
 *
 * Builds the static OG card per docs/refresh/17-og-image-spec.md (Tier 2
 * composition: ochre rule + Fraunces hero + wordmark + URL). Run once and
 * commit the PNG. Phase 4 replaces this with a dynamic Cloudflare Pages
 * Function using Satori; until then this static fallback is the only OG.
 *
 * Usage: node scripts/generate-og-image.mjs
 * Requires: playwright (already in repo via @playwright/test).
 */

import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'apps', 'frontend', 'public', 'og-image.png');

const HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: #F4F6F8;
    font-family: 'Inter', system-ui, sans-serif;
    color: #0B1530;
    padding: 64px 80px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .rule {
    position: absolute;
    top: 64px;
    left: 80px;
    width: 96px;
    height: 4px;
    background: #B7841F;
  }
  .eyebrow {
    margin-top: 24px;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #475569;
  }
  h1 {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    font-size: 96px;
    line-height: 1.05;
    letter-spacing: -0.02em;
    font-variation-settings: 'opsz' 144;
    color: #0B1530;
    margin-top: 24px;
    max-width: 920px;
  }
  .sub {
    margin-top: 32px;
    font-size: 24px;
    line-height: 1.5;
    color: #22304A;
    max-width: 820px;
  }
  .wordmark {
    position: absolute;
    bottom: 56px;
    left: 80px;
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    font-size: 22px;
    color: #0B1530;
    letter-spacing: -0.005em;
  }
  .url {
    position: absolute;
    bottom: 56px;
    right: 80px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: #6A7891;
  }
</style>
</head>
<body>
  <div class="rule"></div>
  <div class="eyebrow">A qualitative workspace</div>
  <h1>Code interviews like you think. Visually.</h1>
  <p class="sub">QualCanvas is a visual workspace for coding transcripts, finding themes, and writing memos you can defend.</p>
  <div class="wordmark">QualCanvas</div>
  <div class="url">qualcanvas.com</div>
</body>
</html>`;

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.setContent(HTML, { waitUntil: 'networkidle' });
  // Give Fraunces an extra beat to render now that the font has loaded.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await writeFile(OUT_PATH, buffer);
  await browser.close();
  console.log(`Wrote ${OUT_PATH} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

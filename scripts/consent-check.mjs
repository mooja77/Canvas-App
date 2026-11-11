// Template: copy into the repo (e.g. scripts/consent-check.mjs), edit CONFIG, keep it self-contained.
// Run:  BASE_URL=http://127.0.0.1:4173 node scripts/consent-check.mjs
//   CHECK=reject  -> fails if any non-essential request fires after Reject (and reload)
//   CHECK=banner  -> fails if the phone banner is taller than maxBannerH or covers the primary CTA at 390x844
//   default       -> both
// Needs the `playwright` package (resolvable from the repo, or NODE_PATH=C:/JM Programs/node_modules).
import { chromium } from 'playwright';

const CONFIG = {
  pages: ['/'], // paths to test
  primaryCta: 'button:has-text("Start free")', // selector of the main Start button (first visible match)
  rejectSelector: '#cc-reject',
  // Hosts allowed after Reject (essential). The base host and localhost are always allowed.
  allowedHosts: ['api.qualcanvas.com'], // our own API (health check etc.) is essential; its analytics endpoint is checked by path below
  analyticsPaths: [/\/events\/track/],
  consentKey: 'jms_cookie_consent',
  maxBannerH: 100,
};

const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:4173');
const mode = process.env.CHECK || 'all';
const failures = [];
const fail = (m) => {
  failures.push(m);
  console.error('FAIL', m);
};

const okHost = (h) =>
  h === base.hostname ||
  h === 'localhost' ||
  h === '127.0.0.1' ||
  h.endsWith('.' + base.hostname) ||
  CONFIG.allowedHosts.some((a) => h === a || h.endsWith('.' + a));

const browser = await chromium.launch({ headless: true });
try {
  for (const path of CONFIG.pages) {
    const url = new URL(path, base).href;

    if (mode === 'all' || mode === 'reject') {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load' });
      const reject = page.locator(CONFIG.rejectSelector).first();
      await reject.waitFor({ state: 'visible', timeout: 10000 });
      await reject.click();
      const seen = new Set();
      page.on('request', (r) => {
        try {
          const u = new URL(r.url());
          if (/^https?:$/.test(u.protocol)) {
            seen.add(u.hostname);
            if (CONFIG.analyticsPaths.some((re) => re.test(u.pathname))) seen.add(u.hostname + u.pathname);
          }
        } catch {}
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(6000); // let lazy tags fire
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(1500);
      const bad = [...seen].filter((h) => !okHost(h.split('/')[0]) || h.includes('/'));
      if (bad.length) fail(`${url}: non-essential hosts contacted after Reject: ${bad.join(', ')}`);
      else console.log(`ok   ${url}: after Reject only ${[...seen].join(', ') || '(nothing)'}`);
      const storedAfter = await page.evaluate((k) => localStorage.getItem(k), CONFIG.consentKey);
      if (storedAfter !== 'rejected') fail(`${url}: stored consent after Reject is ${storedAfter}, expected "rejected"`);
      await ctx.close();
    }

    if (mode === 'all' || mode === 'banner') {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      const banner = page.locator('#cookie-consent-banner, [data-cookie-banner], [aria-label="Cookie consent"]').first();
      await banner.waitFor({ state: 'visible', timeout: 10000 });
      const bb = await banner.boundingBox();
      if (bb.height > CONFIG.maxBannerH) fail(`${url}: phone banner is ${Math.round(bb.height)}px tall (max ${CONFIG.maxBannerH})`);
      const cta = page.locator(CONFIG.primaryCta).locator('visible=true').first();
      const cb = await cta.boundingBox();
      if (!cb) fail(`${url}: primary CTA ${CONFIG.primaryCta} not found/visible`);
      else if (cb.y + cb.height > bb.y)
        fail(`${url}: banner (top ${Math.round(bb.y)}) covers primary CTA (bottom ${Math.round(cb.y + cb.height)})`);
      else console.log(`ok   ${url}: banner ${Math.round(bb.height)}px, CTA bottom ${Math.round(cb.y + cb.height)} <= banner top ${Math.round(bb.y)}`);
      // Reject and Accept equally easy: similar size, both visible
      const rb = await page.locator(CONFIG.rejectSelector).first().boundingBox();
      const ab = await page.locator('#cc-accept, button:has-text("Accept")').first().boundingBox();
      if (!rb || !ab || Math.abs(rb.height - ab.height) > 2 || rb.width < ab.width * 0.8)
        fail(`${url}: Reject is not as prominent as Accept`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\nall checks passed');

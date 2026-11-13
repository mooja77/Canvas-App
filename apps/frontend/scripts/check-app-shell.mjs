// Post-build guard: the built app shell must not load or contain any
// advertising or marketing tag. Runs at the end of `npm run build`.
//
//   node scripts/check-app-shell.mjs [distDir]
//
// Checks dist/app-shell.html (the document served for canvas, account, team,
// repository, admin and token pages), the scripts it references (entry and
// preloaded chunks), and that the marketing shell still has its loader.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? resolve(root, 'dist'));
const failures = [];
const read = (rel) => readFileSync(resolve(dist, rel.replace(/^\//, '')), 'utf8');

const SHELL_FORBIDDEN = [
  /googletagmanager/i,
  /GTM-[A-Z0-9]+/,
  /gtag/i,
  /dataLayer/i,
  /\bfbq\b/,
  /connect\.facebook/i,
  /doubleclick/i,
  /plausible/i,
  /ad_storage|ad_user_data|ad_personalization/i,
  /jms-analytics-container/i,
  /\/cookie-consent\.js/i,
];
const BUNDLE_FORBIDDEN = [
  /googletagmanager/i,
  /GTM-[A-Z0-9]+/,
  /connect\.facebook/i,
  /doubleclick\.net/i,
  /ad_storage|ad_user_data|ad_personalization/i,
];

if (!existsSync(resolve(dist, 'app-shell.html'))) {
  console.error(`check-app-shell: ${dist}/app-shell.html missing (build must emit the app shell)`);
  process.exit(1);
}

// Comments load nothing; the shell's header comment names what is absent.
const shell = read('app-shell.html').replace(/<!--[\s\S]*?-->/g, '');
for (const pattern of SHELL_FORBIDDEN) {
  if (pattern.test(shell)) failures.push(`app-shell.html matches ${pattern}`);
}
if (!shell.includes('data-shell="app"')) failures.push('app-shell.html lacks data-shell="app"');

const assets = new Set(
  [...shell.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|mjs))"/g)]
    .map((m) => m[1])
    .filter((p) => existsSync(resolve(dist, p.slice(1)))),
);
for (const asset of assets) {
  const body = read(asset);
  for (const pattern of BUNDLE_FORBIDDEN) {
    if (pattern.test(body)) failures.push(`${asset} (referenced by app-shell.html) matches ${pattern}`);
  }
}
const bannerBody = read('cookie-consent-app.js').replace(/\/\*[\s\S]*?\*\//g, '');
for (const pattern of SHELL_FORBIDDEN) {
  if (pattern.test(bannerBody)) failures.push(`cookie-consent-app.js matches ${pattern}`);
}

const marketing = read('index.html');
if (!marketing.includes('/cookie-consent.js') || !marketing.includes('data-shell="marketing"')) {
  failures.push('index.html lost the marketing loader or data-shell="marketing"');
}
const worker = read('_worker.js');
if (!worker.includes("'/app-shell'")) failures.push('_worker.js does not route app routes to /app-shell');

if (failures.length) {
  console.error('check-app-shell FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(
  `check-app-shell OK: app-shell.html + ${assets.size} referenced script(s) carry no advertising/marketing tag`,
);

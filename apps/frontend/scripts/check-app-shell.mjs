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
// The JMS support chat widget may be requested only by support-shell.html.
const CHAT_WIDGET = [/jms-admin-portal/i, /workers\.dev/i, /chat\/widget/i, /jms-chat/i];
const BUNDLE_FORBIDDEN = [
  ...CHAT_WIDGET,
  /googletagmanager/i,
  /GTM-[A-Z0-9]+/,
  /connect\.facebook/i,
  /doubleclick\.net/i,
  /ad_storage|ad_user_data|ad_personalization/i,
];

for (const file of ['app-shell.html', 'support-shell.html']) {
  if (!existsSync(resolve(dist, file))) {
    console.error(`check-app-shell: ${dist}/${file} missing (build must emit both app shells)`);
    process.exit(1);
  }
}

const strip = (html) => html.replace(/<!--[\s\S]*?-->/g, ''); // comments load nothing
const assets = new Set(); // scripts of the research shell (must never name the widget)
const supportAssets = new Set(); // scripts of the support shell
const collectAssets = (html, into) => {
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|mjs))"/g)) {
    if (existsSync(resolve(dist, m[1].slice(1)))) into.add(m[1]);
  }
};

// Research shell: no marketing loader, and no chat widget of any kind.
const shell = strip(read('app-shell.html'));
for (const pattern of [...SHELL_FORBIDDEN, ...CHAT_WIDGET]) {
  if (pattern.test(shell)) failures.push(`app-shell.html matches ${pattern}`);
}
if (/<script(?![^>]*\ssrc=)[^>]*>/.test(shell)) failures.push('app-shell.html contains an inline script');
if (!shell.includes('data-shell="app"')) failures.push('app-shell.html lacks data-shell="app"');
collectAssets(shell, assets);

// Support shell: no marketing loader; the only shell that names the widget.
const support = strip(read('support-shell.html'));
for (const pattern of SHELL_FORBIDDEN) {
  if (pattern.test(support)) failures.push(`support-shell.html matches ${pattern}`);
}
if (!support.includes('data-shell="support"')) failures.push('support-shell.html lacks data-shell="support"');
collectAssets(support, supportAssets);

// Vite bundles the support shell's inline loader into its own entry chunk
// (assets/support-shell-*.js). That chunk, and only that chunk, must name the widget.
const widgetChunks = [...supportAssets].filter((a) => /\/support-shell-[^/]*\.js$/.test(a));
if (!widgetChunks.some((a) => /jms-admin-portal\.mooja77\.workers\.dev\/api\/chat\/widget\.js/.test(read(a)))) {
  failures.push('support shell no longer loads the support widget (host not found in its entry chunk)');
}

// Every script the research shell references, and the banner, must be clean: the
// shared bundle is used by research routes, so it must not name the widget host.
// The support shell's scripts must be free of marketing tags, and of the widget
// everywhere except its own entry chunk.
for (const asset of assets) {
  const body = read(asset);
  for (const pattern of BUNDLE_FORBIDDEN) {
    if (pattern.test(body)) failures.push(`${asset} (referenced by the research shell) matches ${pattern}`);
  }
}
for (const asset of supportAssets) {
  if (assets.has(asset) || widgetChunks.includes(asset)) {
    if (assets.has(asset)) continue; // already checked as a research asset
    const body = read(asset);
    for (const pattern of BUNDLE_FORBIDDEN.filter((p) => !CHAT_WIDGET.includes(p))) {
      if (pattern.test(body)) failures.push(`${asset} (support shell entry) matches ${pattern}`);
    }
    continue;
  }
  const body = read(asset);
  for (const pattern of BUNDLE_FORBIDDEN) {
    if (pattern.test(body)) failures.push(`${asset} (referenced by the support shell) matches ${pattern}`);
  }
}
const bannerBody = read('cookie-consent-app.js').replace(/\/\*[\s\S]*?\*\//g, '');
for (const pattern of [...SHELL_FORBIDDEN, ...CHAT_WIDGET]) {
  if (pattern.test(bannerBody)) failures.push(`cookie-consent-app.js matches ${pattern}`);
}

// The marketing shell must not carry the widget either.
const marketing = read('index.html');
if (!marketing.includes('/cookie-consent.js') || !marketing.includes('data-shell="marketing"')) {
  failures.push('index.html lost the marketing loader or data-shell="marketing"');
}
if (/jms-admin-portal|chat\/widget\.js/i.test(strip(marketing))) failures.push('index.html names the chat widget');

// Routing and CSP.
const worker = read('_worker.js');
if (!worker.includes("'/app-shell'") || !worker.includes("'/support-shell'"))
  failures.push('_worker.js does not route research/support routes to their shells');
const researchBlocks = [
  '/canvas*',
  '/repository*',
  '/team*',
  '/admin*',
  '/forgot-password*',
  '/reset-password*',
  '/verify-email*',
];
const headerLines = read('_headers').split(/\r?\n/);
for (const route of researchBlocks) {
  const at = headerLines.findIndex((line) => line.trim() === route);
  const policy = at >= 0 ? (headerLines[at + 1] ?? '') : '';
  if (!policy.includes('Content-Security-Policy')) failures.push(`_headers has no CSP block for ${route}`);
  if (/jms-admin-portal|workers\.dev/.test(policy))
    failures.push(`_headers CSP for research route ${route} allows the chat host`);
}

if (failures.length) {
  console.error('check-app-shell FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log(
  `check-app-shell OK: app-shell + support-shell + ${assets.size} referenced script(s): no advertising/marketing tag; chat widget only in support-shell`,
);

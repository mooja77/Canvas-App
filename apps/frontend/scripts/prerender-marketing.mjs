// Prerender the standalone marketing routes to static HTML.
//
// WHY THIS EXISTS
// ---------------
// qualcanvas.com is a Vite + React Router SPA on Cloudflare Pages with an SPA
// fallback (`/* /index.html 200`). Every route that lives only inside React
// falls through and is served the HOMEPAGE index.html — same <title>, same
// hardcoded site-wide canonical (`<link rel="canonical" href="https://qualcanvas.com/">`
// at index.html:18). So Google is told ~19 distinct URLs are all duplicates of
// the homepage: they get consolidated away and can never be indexed, ranked or
// measured. AI crawlers (which do not run JS) never see the real page at all.
//
// This is the same class of bug and the same fix as scripts/prerender-methodology.mjs.
// The difference: methodology renders pure content modules into a hand-built
// shell. These are full page COMPONENTS (SiteHeader/SiteFooter, hooks, i18n,
// react-router Link/useNavigate), so we render each one to static markup inside
// a StaticRouter with i18n initialised, then splice the real content + a
// route-specific <head> into a copy of the freshly-built dist/index.html.
//
// Because we start from the built index.html, every emitted file:
//   * keeps the hashed CSS + JS + GTM/analytics tags, so a real visitor still
//     gets the fully-styled SPA — main.tsx removes #marketing-root once React
//     mounts at #root (progressive enhancement, exactly like the homepage);
//   * carries its OWN <title> and its OWN canonical, overriding the site-wide
//     canonical baked into index.html:18 — which is the whole point.
//
// Routes covered: /cite /vs /for-institutions /customers /press /colophon
// /trust /trust/ai /changelog /accessibility-statement /guide /pilot
//
// Deliberately EXCLUDED:
//   * /pricing — PricingPage trips on useAuthStore during static render.
//   * /for-teams — imports useNavigate/Link; dropped so it cannot throw the
//     build. (It is not in the covered set; simply not rendered.)
//
// Runs as part of `npm run build`, after prerender-methodology.mjs, so
// deploy-frontend.yml picks it up unchanged.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const ORIGIN = 'https://qualcanvas.com';

// path              -> the route Cloudflare serves (clean URL -> <file>.html)
// file              -> emitted file under dist/
// component         -> default-exported page component in src/pages
// title/description -> mirror each page's own usePageMeta(...) call, so the
//                      crawler-facing head matches what the SPA sets on mount.
const ROUTES = [
  {
    path: '/cite',
    file: 'cite.html',
    component: 'CitePage',
    title: 'How to cite QualCanvas — Citation reference',
    description: 'BibTeX, APA, Chicago, and RIS citation entries for QualCanvas. Send to your advisor before they ask.',
  },
  {
    path: '/vs',
    file: 'vs.html',
    component: 'VsIndexPage',
    title: 'Compare QualCanvas — NVivo, ATLAS.ti, Dedoose',
    description:
      'Honest, sourced comparisons. How QualCanvas stacks up against NVivo, ATLAS.ti, and Dedoose. Pricing, features, migration path.',
  },
  {
    path: '/for-institutions',
    file: 'for-institutions.html',
    component: 'ForInstitutionsPage',
    title: 'For institutions — QualCanvas',
    description:
      'SSO + SCIM, DPA, BAA, custom retention, EU residency, dedicated research desk. Department-wide qualitative research, procurement-ready.',
  },
  {
    path: '/customers',
    file: 'customers.html',
    component: 'CustomersIndexPage',
    title: 'Research stories — QualCanvas',
    description:
      'What researchers do with QualCanvas. Real labs, real methods, real artifacts. Anonymized when participants need it.',
  },
  {
    path: '/press',
    file: 'press.html',
    component: 'PressPage',
    title: 'Press & media — QualCanvas',
    description:
      'Press kit, fact sheet, brand assets, and contact for journalists and library guides covering QualCanvas.',
  },
  {
    path: '/colophon',
    file: 'colophon.html',
    component: 'ColophonPage',
    title: 'Colophon — QualCanvas',
    description: 'The fonts, colors, stack, and studio behind QualCanvas.',
  },
  {
    path: '/trust',
    file: 'trust.html',
    component: 'TrustPage',
    title: 'Trust & Security — QualCanvas',
    description:
      'How QualCanvas handles your research data: hosting, encryption, sub-processors, audit logging, and compliance roadmap.',
  },
  {
    path: '/trust/ai',
    file: 'trust/ai.html',
    component: 'TrustAIPage',
    title: 'AI use policy — QualCanvas',
    description:
      'How AI works in QualCanvas: what is sent, what is stored, what is not. Verified against our actual architecture.',
  },
  {
    path: '/changelog',
    file: 'changelog.html',
    component: 'ChangelogPage',
    title: 'Changelog — QualCanvas',
    description: "What we've shipped, when, with bylines. RSS available. New entry per feature or every two weeks.",
  },
  {
    path: '/accessibility-statement',
    file: 'accessibility-statement.html',
    component: 'AccessibilityStatementPage',
    title: 'Accessibility statement — QualCanvas',
    description: 'WCAG 2.2 AA conformance across marketing pages. Known limitations documented honestly.',
  },
  {
    path: '/guide',
    file: 'guide.html',
    component: 'GuidePage',
    title: 'Guide — QualCanvas',
    description:
      'Complete guide to QualCanvas: transcripts, coding, analysis tools, AI features, collaboration, and more.',
  },
  {
    path: '/pilot',
    file: 'pilot.html',
    component: 'PilotPage',
    title: 'QualCanvas real-user pilot — Test a qualitative research workflow',
    description:
      'Take part in a 20–30 minute QualCanvas usability pilot: complete five research tasks and share structured feedback.',
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Bundle an entry that renders every page to static markup. ---------------
// Each page is wrapped in <StaticRouter location={path}> so react-router hooks
// (Link, useNavigate, useLocation) resolve, and `../src/i18n` is imported for
// its side effect so useTranslation() finds a global i18next instance instead
// of throwing. React and the routing/i18n singletons stay external so there is
// exactly one copy of each.
const entry = `
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import '../src/i18n';
${ROUTES.map((r, i) => `import P${i} from '../src/pages/${r.component}';`).join('\n')}
const routes = [
${ROUTES.map((r, i) => `  { path: ${JSON.stringify(r.path)}, Comp: P${i} }`).join(',\n')}
];
export function renderAll() {
  return routes.map(({ path, Comp }) => {
    try {
      const html = renderToStaticMarkup(
        <StaticRouter location={path}>
          <Comp />
        </StaticRouter>
      );
      return { path, html };
    } catch (err) {
      return { path, error: (err && err.stack) || String(err) };
    }
  });
}
`;

const TMP = resolve(ROOT, 'node_modules', '.prerender-marketing.mjs');
await build({
  stdin: { contents: entry, resolveDir: __dirname, loader: 'jsx' },
  bundle: true,
  format: 'esm',
  outfile: TMP,
  platform: 'node',
  jsx: 'automatic',
  // Vite injects import.meta.env at build time; esbuild/Node has no such
  // object, and analytics.ts reads import.meta.env.VITE_API_URL at module
  // scope. Replace it with an empty object so the `|| '/api'` fallback wins.
  define: { 'import.meta.env': '{}' },
  loader: {
    '.tsx': 'tsx',
    '.ts': 'ts',
    '.css': 'empty',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.svg': 'dataurl',
    '.webp': 'dataurl',
    '.gif': 'dataurl',
  },
  external: [
    'react',
    'react-dom',
    'react-dom/server',
    'react/jsx-runtime',
    'react-router',
    'react-router-dom',
    'react-i18next',
    'i18next',
  ],
});

const mod = await import(pathToFileURL(TMP).href);
const rendered = mod.renderAll();
rmSync(TMP, { force: true });

// --- Template: the freshly-built homepage index.html. ------------------------
const templatePath = resolve(DIST, 'index.html');
if (!existsSync(templatePath)) {
  throw new Error(`prerender-marketing: ${templatePath} not found — run \`vite build\` first.`);
}
const template = readFileSync(templatePath, 'utf8');

// Sanity-check the anchors we rewrite exist, so a future index.html refactor
// fails loudly here rather than silently shipping homepage duplicates.
const REQUIRED_ANCHORS = [
  /<title>[\s\S]*?<\/title>/,
  /<link\s+rel="canonical"[^>]*>/,
  /<meta\s+name="description"[^>]*>/,
  /<main id="marketing-root">[\s\S]*?<\/main>/,
];
for (const re of REQUIRED_ANCHORS) {
  if (!re.test(template)) {
    throw new Error(`prerender-marketing: expected anchor ${re} not found in dist/index.html`);
  }
}

function renderRouteHtml({ title, description, url, body }) {
  let html = template;
  const t = esc(title);
  const d = esc(description);

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`);
  // Own canonical, overriding the site-wide one hardcoded in index.html.
  html = html.replace(/<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`);
  html = html.replace(/<meta\s+name="description"[^>]*>/, `<meta name="description" content="${d}" />`);
  html = html.replace(/<meta\s+property="og:title"[^>]*>/, `<meta property="og:title" content="${t}" />`);
  html = html.replace(/<meta\s+property="og:description"[^>]*>/, `<meta property="og:description" content="${d}" />`);
  html = html.replace(/<meta\s+property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`);
  // Real page content for crawlers + first paint. main.tsx strips
  // #marketing-root once React mounts at #root, so the SPA takes over cleanly.
  html = html.replace(/<main id="marketing-root">[\s\S]*?<\/main>/, `<main id="marketing-root">\n${body}\n    </main>`);
  return html;
}

let count = 0;
const failures = [];

for (const route of ROUTES) {
  const result = rendered.find((r) => r.path === route.path);
  if (!result || result.error) {
    // Do NOT throw — a single bad route must never break the whole build
    // (hard constraint). Skip it; the post-deploy smoke assertion will flag
    // the missing prerender loudly by comparing title/canonical.
    failures.push(route.path);
    console.error(`prerender-marketing: FAILED to render ${route.path} — skipping.\n${result?.error || 'no output'}`);
    continue;
  }

  const url = `${ORIGIN}${route.path}`;
  const outPath = resolve(DIST, route.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    renderRouteHtml({ title: route.title, description: route.description, url, body: result.html }),
    'utf8',
  );
  count++;
}

console.log(
  `prerender-marketing: wrote ${count}/${ROUTES.length} marketing route(s) to dist/` +
    (failures.length ? ` (skipped: ${failures.join(', ')})` : ''),
);

// Failures are non-fatal to the build BY DESIGN (hard constraint: a route must
// never break the whole build). They are logged loudly above; the post-deploy
// smoke assertion is the regression guardrail — a skipped route falls back to
// index.html and fails the smoke's per-route title/canonical checks.

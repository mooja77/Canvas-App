#!/usr/bin/env node
// Regenerate apps/frontend/public/sitemap.xml.
//
// Why this exists: the sitemap was hand-maintained, so every `lastmod` sat
// frozen at 2026-05-14/15 while the pages underneath kept changing. `lastmod`
// is the signal Google uses to decide whether a page is worth recrawling, so a
// frozen date tells Googlebot "nothing here has changed since May" - and it
// duly stopped coming back. Search Console read the sitemap on 24 May 2026 and
// not once in the three months after, which is why shipped SEO work (the
// /methodology/ipa title rewrite of 17 Aug, for one) was never served to
// anyone.
//
// Each `lastmod` is now derived from git: the commit date of the most recent
// commit touching any file that renders the route. Nobody has to remember.
//
// Run: npm run sitemap
//
// NOTE: this reads real git history, so it needs a full clone. Do not move it
// into a CI build step behind `actions/checkout` with the default fetch-depth
// of 1 - every page would collapse onto the checkout commit's date, which is
// the same rot in a new costume.

import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = 'apps/frontend/src';
const OUT = path.join(repoRoot, 'apps/frontend/public/sitemap.xml');

const chapter = (slug) => [`${src}/pages/MethodologyChapterPage.tsx`, `${src}/content/methodology/${slug}.tsx`];

// loc is written exactly as listed. Two of these carry a trailing slash on
// purpose: `public/methodology/` and `public/training/` exist as asset
// directories, so Cloudflare Pages 308-redirects the slashless form. Listing
// the pre-redirect URL made Google class both as "Page with redirect".
const ROUTES = [
  // Conversion path
  { loc: '/', files: [`${src}/pages/LandingPage.tsx`], changefreq: 'weekly', priority: '1.0' },
  {
    loc: '/pricing',
    files: [`${src}/pages/PricingPage.tsx`, 'apps/backend/src/config/plans.ts'],
    changefreq: 'monthly',
    priority: '0.9',
  },
  { loc: '/cite', files: [`${src}/pages/CitePage.tsx`], changefreq: 'monthly', priority: '0.7' },

  // Content surfaces
  { loc: '/methodology/', files: [`${src}/pages/MethodologyIndexPage.tsx`], changefreq: 'weekly', priority: '0.9' },
  { loc: '/methodology/foundations', files: chapter('foundations'), changefreq: 'monthly', priority: '0.8' },
  {
    loc: '/methodology/thematic-analysis',
    files: chapter('thematic-analysis'),
    changefreq: 'monthly',
    priority: '0.8',
  },
  { loc: '/methodology/grounded-theory', files: chapter('grounded-theory'), changefreq: 'monthly', priority: '0.8' },
  { loc: '/methodology/ipa', files: chapter('ipa'), changefreq: 'monthly', priority: '0.8' },
  {
    loc: '/methodology/intercoder-reliability',
    files: chapter('intercoder-reliability'),
    changefreq: 'monthly',
    priority: '0.8',
  },
  {
    loc: '/methodology/ethics-in-practice',
    files: chapter('ethics-in-practice'),
    changefreq: 'monthly',
    priority: '0.8',
  },
  { loc: '/customers', files: [`${src}/pages/CustomersIndexPage.tsx`], changefreq: 'weekly', priority: '0.8' },
  {
    loc: '/changelog',
    files: [`${src}/pages/ChangelogPage.tsx`, 'apps/frontend/public/changelog'],
    changefreq: 'weekly',
    priority: '0.6',
  },
  { loc: '/vs', files: [`${src}/pages/VsIndexPage.tsx`], changefreq: 'monthly', priority: '0.8' },
  { loc: '/guide', files: [`${src}/pages/GuidePage.tsx`], changefreq: 'monthly', priority: '0.8' },
  { loc: '/training/', files: [`${src}/pages/TrainingPage.tsx`], changefreq: 'monthly', priority: '0.9' },
  { loc: '/pilot', files: [`${src}/pages/PilotPage.tsx`, `${src}/App.tsx`], changefreq: 'monthly', priority: '0.7' },
  { loc: '/for-teams', files: [`${src}/pages/ForTeamsPage.tsx`], changefreq: 'monthly', priority: '0.8' },
  { loc: '/for-institutions', files: [`${src}/pages/ForInstitutionsPage.tsx`], changefreq: 'monthly', priority: '0.8' },

  // Trust and legal
  { loc: '/trust', files: [`${src}/pages/TrustPage.tsx`], changefreq: 'monthly', priority: '0.7' },
  { loc: '/trust/ai', files: [`${src}/pages/TrustAIPage.tsx`], changefreq: 'monthly', priority: '0.7' },
  { loc: '/privacy', files: [`${src}/pages/PrivacyPage.tsx`], changefreq: 'yearly', priority: '0.4' },
  { loc: '/terms', files: [`${src}/pages/TermsPage.tsx`], changefreq: 'yearly', priority: '0.4' },
  { loc: '/cookies', files: [`${src}/pages/CookiePolicyPage.tsx`], changefreq: 'yearly', priority: '0.4' },
  {
    loc: '/accessibility-statement',
    files: [`${src}/pages/AccessibilityStatementPage.tsx`],
    changefreq: 'yearly',
    priority: '0.4',
  },
  { loc: '/colophon', files: [`${src}/pages/ColophonPage.tsx`], changefreq: 'yearly', priority: '0.3' },

  // Other entry points
  { loc: '/press', files: [`${src}/pages/PressPage.tsx`], changefreq: 'monthly', priority: '0.5' },
  { loc: '/subscribe', files: [`${src}/pages/SubscribePage.tsx`], changefreq: 'monthly', priority: '0.5' },
];

function lastCommitDate(files) {
  const present = files.filter((f) => existsSync(path.join(repoRoot, f)));
  if (present.length === 0) {
    throw new Error(`No such path(s), so lastmod cannot be derived: ${files.join(', ')}`);
  }
  // %cs is the committer date as strict YYYY-MM-DD, which is exactly the
  // W3C-datetime subset the sitemap spec accepts.
  const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...present], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out)) {
    throw new Error(`git returned no usable date for ${present.join(', ')} (got "${out}"). Shallow clone?`);
  }
  return out;
}

const body = ROUTES.map((r) => {
  const lastmod = lastCommitDate(r.files);
  return `  <url><loc>https://qualcanvas.com${r.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by scripts/generate-sitemap.mjs - run \`npm run sitemap\`. -->
<!-- Do not hand-edit: lastmod comes from git history so it cannot drift. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

writeFileSync(OUT, xml, 'utf8');
console.log(`Wrote ${path.relative(repoRoot, OUT)} with ${ROUTES.length} URLs.`);

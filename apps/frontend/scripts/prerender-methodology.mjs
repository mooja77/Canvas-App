// Prerender the /methodology cluster to static HTML.
//
// WHY THIS EXISTS
// ---------------
// qualcanvas.com is a Vite + React Router SPA served from Cloudflare Pages with an
// SPA fallback. Every route that exists only inside React falls through and serves
// the HOMEPAGE — same <title>, same content. Measured 2026-07-13: ALL 25 URLs in
// sitemap.xml returned an identical copy of the homepage. The whole site was one
// page, 25 times, as far as Google and every AI crawler was concerned.
//
// AI crawlers do not execute JavaScript. So ~9,600 words of genuinely good
// methodology writing (Braun & Clarke, grounded theory, IPA, intercoder
// reliability, research ethics) — the exact "teach the thing people are searching
// for" content that earns citations — was completely invisible.
//
// The same class of bug, and the same fix, as spamshield.dev (see its
// scripts/prerender-guides.mjs). The evidence that this matters: the one app site
// in the portfolio that DOES prerender this content type earns 781 Microsoft
// Copilot citations; the ones that don't earn 0.
//
// This renders each chapter component to static markup with react-dom/server and
// wraps it in the same visual shell as public/use-cases/ux-research.html, with
// Article + BreadcrumbList JSON-LD. The SPA still handles client-side navigation;
// these files are what crawlers and first paint get.
//
// Runs as part of `npm run build`, so deploy-frontend.yml picks it up unchanged.

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const ORIGIN = 'https://qualcanvas.com';

const CHAPTERS = [
  'foundations',
  'thematic-analysis',
  'grounded-theory',
  'ipa',
  'intercoder-reliability',
  'ethics-in-practice',
];

// Bundle an entry that imports every chapter and renders it to static markup.
// Chapters are pure presentational JSX (verified: no <Link>, no window/localStorage
// at render time; ChapterShell's document access is inside useEffect, which does not
// run during static rendering).
const entry = `
import { renderToStaticMarkup } from 'react-dom/server';
${CHAPTERS.map((c, i) => `import Ch${i}, { chapterMeta as m${i}, sections as s${i} } from '../src/content/methodology/${c}';`).join('\n')}
const list = [
${CHAPTERS.map((c, i) => `  { slug: '${c}', meta: m${i}, sections: s${i}, Comp: Ch${i} }`).join(',\n')}
];
export function renderAll() {
  return list.map(({ slug, meta, sections, Comp }) => ({
    slug,
    meta,
    sections,
    html: renderToStaticMarkup(Comp()),
  }));
}
`;

// Bundle to a temp file rather than a data: URL — inlining React blows past the
// data-URL size limit and swallows the real error. React stays external so Node
// resolves it from node_modules.
const TMP = resolve(ROOT, 'node_modules', '.prerender-methodology.mjs');
await build({
  stdin: { contents: entry, resolveDir: __dirname, loader: 'js' },
  bundle: true,
  format: 'esm',
  outfile: TMP,
  platform: 'node',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'react-router-dom'],
});

const mod = await import(pathToFileURL(TMP).href);
const rendered = mod.renderAll();
rmSync(TMP, { force: true });

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
      body { margin: 0; background: #f9fafb; }
      #marketing-root { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; max-width: 760px; margin: 0 auto; padding: 64px 24px 96px; line-height: 1.7; }
      #marketing-root .ss-eyebrow { color: #7c3aed; font-weight: 600; font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase; }
      #marketing-root h1 { font-size: 40px; line-height: 1.15; margin: 12px 0 16px; font-weight: 800; }
      #marketing-root .lede { font-size: 19px; color: #374151; margin: 0 0 32px; }
      #marketing-root h2 { font-size: 26px; margin: 44px 0 12px; font-weight: 700; }
      #marketing-root h3 { font-size: 19px; margin: 28px 0 8px; font-weight: 700; }
      #marketing-root p { margin: 0 0 16px; }
      #marketing-root ul, #marketing-root ol { padding-left: 22px; }
      #marketing-root li { margin-bottom: 8px; }
      #marketing-root blockquote { margin: 24px 0; padding: 16px 20px; border-left: 3px solid #7c3aed; background: #ffffff; border-radius: 0 12px 12px 0; color: #374151; }
      #marketing-root table { border-collapse: collapse; width: 100%; margin: 20px 0; }
      #marketing-root th, #marketing-root td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
      #marketing-root .meta { color: #6b7280; font-size: 14px; }
      #marketing-root .toc { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 32px 0; }
      #marketing-root .toc strong { display: block; margin-bottom: 8px; }
      #marketing-root .cta { display: inline-block; background: #7c3aed; color: #ffffff; padding: 14px 28px; border-radius: 10px; font-weight: 600; text-decoration: none; }
      #marketing-root .cta:hover { background: #6d28d9; }
      #marketing-root a { color: #7c3aed; }
      #marketing-root .footer-links { color: #6b7280; font-size: 14px; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
      #marketing-root .footer-links a { color: #7c3aed; text-decoration: none; margin-right: 16px; }
      #marketing-root .cards { display: grid; grid-template-columns: 1fr; gap: 16px; padding: 0; list-style: none; }
      @media (min-width: 720px) { #marketing-root .cards { grid-template-columns: 1fr 1fr; } }
      #marketing-root .cards li { padding: 16px; border-radius: 12px; background: #ffffff; border: 1px solid #e5e7eb; }
      #marketing-root .cards a { font-weight: 700; text-decoration: none; }`;

const FOOTER = `
      <p class="footer-links">
        <a href="/">Home</a>
        <a href="/methodology">Methodology</a>
        <a href="/features">Features</a>
        <a href="/pricing">Pricing</a>
        <a href="/vs">Compare</a>
      </p>`;

const page = ({ title, description, url, jsonld, body }) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="theme-color" content="#7c3aed" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:site_name" content="QualCanvas" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <script type="application/ld+json">
${jsonld}
    </script>
    <style>${STYLE}
    </style>
  </head>
  <body>
    <main id="marketing-root">
${body}
${FOOTER}
    </main>
  </body>
</html>
`;

mkdirSync(resolve(DIST, 'methodology'), { recursive: true });
let count = 0;

for (const { slug, meta, sections, html } of rendered) {
  const url = `${ORIGIN}/methodology/${slug}`;
  const title = `${meta.title} · QualCanvas Methodology`;
  const description = meta.subtitle;

  const toc = sections?.length
    ? `
      <div class="toc">
        <strong>In this chapter</strong>
        <ol>
${sections.map((s) => `          <li><a href="#${esc(s.id)}">${esc(s.label)}</a></li>`).join('\n')}
        </ol>
      </div>`
    : '';

  const body = `
      <div class="ss-eyebrow">Methodology · Chapter ${esc(meta.number)}</div>
      <h1>${esc(meta.title)}</h1>
      <p class="lede">${esc(meta.subtitle)}</p>
      <p class="meta">${esc(meta.readMin)} min read · Updated ${esc(meta.updated)}</p>
${toc}
${html}

      <p style="margin-top:40px"><a href="/pricing" class="cta">Try QualCanvas free</a></p>`;

  const jsonld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: meta.title,
        description,
        url,
        mainEntityOfPage: url,
        articleSection: 'Qualitative research methodology',
        author: { '@type': 'Organization', name: 'JMS Dev Lab', url: 'https://jmsdevlab.com' },
        publisher: { '@type': 'Organization', name: 'JMS Dev Lab', url: 'https://jmsdevlab.com' },
        isPartOf: {
          '@type': 'SoftwareApplication',
          name: 'QualCanvas',
          applicationCategory: 'BusinessApplication',
          url: ORIGIN,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Methodology', item: `${ORIGIN}/methodology` },
          { '@type': 'ListItem', position: 2, name: meta.title, item: url },
        ],
      },
    ],
  });

  writeFileSync(resolve(DIST, 'methodology', `${slug}.html`), page({ title, description, url, jsonld, body }), 'utf8');
  count++;
}

// /methodology hub — it was serving the homepage too.
const hubBody = `
      <div class="ss-eyebrow">Methodology</div>
      <h1>Qualitative analysis, as it's actually practised</h1>
      <p class="lede">A working guide to the methods behind interview research — thematic analysis, grounded theory, IPA, intercoder reliability and research ethics. Written for the decisions you have to defend, not the textbook summary.</p>
      <ul class="cards">
${rendered
  .map(
    ({ slug, meta }) => `        <li>
          <a href="/methodology/${slug}">${esc(meta.title)}</a>
          <p class="meta">Chapter ${esc(meta.number)} · ${esc(meta.readMin)} min read</p>
          <p>${esc(meta.subtitle)}</p>
        </li>`
  )
  .join('\n')}
      </ul>`;

writeFileSync(
  resolve(DIST, 'methodology', 'index.html'),
  page({
    title: 'Qualitative Research Methodology Guide · QualCanvas',
    description:
      'A working guide to qualitative analysis: thematic analysis, grounded theory, IPA, intercoder reliability and research ethics — written for the decisions you have to defend.',
    url: `${ORIGIN}/methodology`,
    jsonld: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'QualCanvas Methodology',
      url: `${ORIGIN}/methodology`,
      hasPart: rendered.map(({ slug, meta }) => ({
        '@type': 'Article',
        headline: meta.title,
        url: `${ORIGIN}/methodology/${slug}`,
      })),
    }),
    body: hubBody,
  }),
  'utf8'
);

console.log(`prerender-methodology: wrote ${count} chapter(s) + /methodology hub to dist/methodology/`);

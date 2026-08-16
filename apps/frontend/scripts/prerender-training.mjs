import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const temp = resolve(root, 'node_modules', '.prerender-training.mjs');

await build({
  stdin: {
    contents:
      "import { trainingVideos, trainingCategories } from '../src/data/trainingVideos'; export default { trainingVideos, trainingCategories };",
    resolveDir: dirname(fileURLToPath(import.meta.url)),
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  outfile: temp,
  platform: 'node',
  loader: { '.ts': 'ts' },
});

const { default: training } = await import(pathToFileURL(temp).href);
rmSync(temp, { force: true });

const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cards = training.trainingVideos
  .map(
    (video) =>
      `<li><strong>${escapeHtml(video.shortTitle)}</strong>${escapeHtml(video.outcome)} <span>${escapeHtml(video.duration)}</span></li>`,
  )
  .join('');
const body = `<main id="marketing-root">
  <div class="qc-rule"></div>
  <div class="qc-eyebrow">QualCanvas training centre</div>
  <h1>Learn one research outcome at a time.</h1>
  <p class="lede">A practical learning path covering first setup, transcript coding, analysis, collaboration, privacy, export and specialist research workflows.</p>
  <a href="/login?mode=register" class="cta">Start free</a>
  <h2>Training library</h2>
  <ul class="features">${cards}</ul>
  <p class="footer-links"><a href="/">Home</a><a href="/guide">Guide</a><a href="/methodology">Methodology</a><a href="https://www.youtube.com/@QualCanvas">YouTube channel</a></p>
</main>`;

const title = 'QualCanvas Training Centre — Tutorials for Qualitative Research';
const description =
  'Focused QualCanvas tutorials for first setup, transcript coding, analysis, collaboration, privacy, export and complete qualitative-research workflows.';
const canonical = 'https://qualcanvas.com/training';
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'QualCanvas Training Centre',
  url: canonical,
  description,
  hasPart: training.trainingVideos.map((video) => ({
    '@type': 'LearningResource',
    name: video.title,
    description: video.outcome,
  })),
});

let html = readFileSync(resolve(dist, 'index.html'), 'utf8');
html = html
  .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${description}" />`)
  .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonical}" />`)
  .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonical}" />`)
  .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${title}" />`)
  .replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${description}" />`,
  )
  .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${title}" />`)
  .replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${description}" />`,
  )
  .replace('</head>', `<script type="application/ld+json">${jsonLd}</script></head>`)
  .replace(/<main id="marketing-root">[\s\S]*?<\/main>/, body);

mkdirSync(resolve(dist, 'training'), { recursive: true });
writeFileSync(resolve(dist, 'training', 'index.html'), html, 'utf8');
console.log(
  `prerender-training: wrote ${training.trainingVideos.length} learning resources to dist/training/index.html`,
);

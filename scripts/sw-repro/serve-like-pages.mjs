/**
 * Serve a built frontend the way Cloudflare Pages does, so service-worker
 * stale-bundle failures can be reproduced locally.
 *
 * WHY THIS EXISTS
 * Three real defects shipped through green CI in August 2026 (PRs #164, #165,
 * #166) because the failure needs conditions a unit or E2E run does not have:
 * a service worker left over from a PREVIOUS deploy, a runtime cache that has
 * evicted a chunk, and a CDN that answers a purged asset with index.html at
 * HTTP 200 text/html rather than a 404. That last detail is the whole bug -
 * the browser refuses to evaluate HTML as a module, so import() rejects with
 * a message naming the module you REQUESTED, not the transitive dependency
 * that actually failed.
 *
 * WHAT IT MODELS
 *   --root      the current deploy
 *   --overlay   the previous deploy, which Pages retains (served only when the
 *               file is absent from --root)
 *   --purge     assets to treat as aged out of retention, even if present
 *   anything unresolved -> index.html, 200, text/html   <- the poison
 *
 * Every request is logged as `file` or `FALLBACK`, which is how you tell a
 * cache hit (no request at all) from a network fetch that got poisoned.
 *
 * USAGE
 *   node scripts/sw-repro/serve-like-pages.mjs --root <dir> [options]
 *   npm run sw:repro -- --root <dir> [options]
 *
 * See README.md in this directory for the two scenarios worth running.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, basename } from 'node:path';

function parseArgs(argv) {
  const args = { port: 8099, purge: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--root') ((args.root = value), (i += 1));
    else if (flag === '--overlay') ((args.overlay = value), (i += 1));
    else if (flag === '--port') ((args.port = Number(value)), (i += 1));
    else if (flag === '--purge') {
      for (const name of (value ?? '').split(',')) if (name.trim()) args.purge.add(name.trim());
      i += 1;
    } else if (flag === '--help' || flag === '-h') args.help = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.root) {
  console.log(`
Serve a built frontend the way Cloudflare Pages does.

  --root <dir>       required. The current deploy.
  --overlay <dir>    the previous deploy Pages still retains.
  --purge a.js,b.js  basenames to treat as aged out of retention.
  --port <n>         default 8099.

Unresolved paths return index.html at 200 text/html, as Pages does for an SPA.
`);
  process.exit(args.help ? 0 : 2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

async function resolveFile(dir, relPath) {
  if (!dir) return null;
  const target = resolve(dir, `.${relPath}`);
  // Refuse to escape the served directory.
  if (!target.startsWith(resolve(dir))) return null;
  try {
    const info = await stat(target);
    return info.isFile() ? target : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const relPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const purged = args.purge.has(basename(relPath));

  let served = purged ? null : ((await resolveFile(args.root, relPath)) ?? (await resolveFile(args.overlay, relPath)));
  const fellBack = served === null;
  if (fellBack) served = resolve(args.root, 'index.html');

  const type = TYPES[extname(served)] ?? 'application/octet-stream';
  const body = await readFile(served).catch(() => Buffer.from('not found'));

  // no-store so the browser HTTP cache never masks service-worker behaviour.
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);

  console.log(`${fellBack ? 'FALLBACK' : 'file    '} ${relPath} -> ${type}${purged ? '  (purged)' : ''}`);
}).listen(args.port, () => {
  console.log(`root    ${args.root}`);
  if (args.overlay) console.log(`overlay ${args.overlay}`);
  if (args.purge.size) console.log(`purged  ${[...args.purge].join(', ')}`);
  console.log(`serving on http://localhost:${args.port}`);
});

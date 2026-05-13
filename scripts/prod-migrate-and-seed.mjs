#!/usr/bin/env node
/**
 * One-shot helper: apply outstanding Prisma migrations to prod + seed.
 *
 * Use when Sprint F's migration 0022 (or any future migration) needs to
 * be applied to the Railway prod DB without waiting for Railway to redeploy.
 * Bundles `prisma migrate deploy` + the canvas template seed into a single
 * command so the user doesn't have to remember two.
 *
 * Usage:
 *   DATABASE_URL=<paste DATABASE_PUBLIC_URL from Railway> node scripts/prod-migrate-and-seed.mjs
 *
 * Or (cmd.exe / PowerShell):
 *   $env:DATABASE_URL = "<paste DATABASE_PUBLIC_URL>"
 *   node scripts/prod-migrate-and-seed.mjs
 *
 * Safety:
 * - Refuses to run if DATABASE_URL is unset
 * - Refuses if DATABASE_URL points to localhost (forces you to use the
 *   public URL explicitly — guards against accidentally seeding dev)
 * - Confirms the target DB name + hostname back before applying anything
 * - Both `migrate deploy` and the seed are idempotent — re-runs are safe
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const backendDir = path.join(repoRoot, 'apps', 'backend');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set.');
  console.error('Set it to the Railway DATABASE_PUBLIC_URL (Postgres service → Variables → DATABASE_PUBLIC_URL).');
  process.exit(1);
}

if (databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') || databaseUrl.startsWith('file:')) {
  console.error('ERROR: DATABASE_URL looks like a local DB.');
  console.error('This script is for prod. Set DATABASE_URL to a Railway public Postgres URL explicitly.');
  process.exit(1);
}

// Pull a sanitized summary out of the URL so the user can confirm before running.
const summary = (() => {
  try {
    const u = new URL(databaseUrl);
    const dbName = u.pathname.slice(1) || '(unknown)';
    return `${u.hostname}${u.port ? ':' + u.port : ''} / database "${dbName}"`;
  } catch {
    return '(could not parse DATABASE_URL)';
  }
})();

const rl = readline.createInterface({ input, output });
const confirm = (await rl.question(
  `About to run \`prisma migrate deploy\` + canvas template seed against:\n  ${summary}\nProceed? (y/N) `,
)).trim().toLowerCase();
rl.close();

if (confirm !== 'y' && confirm !== 'yes') {
  console.log('Aborted.');
  process.exit(0);
}

function run(label, cmd) {
  console.log(`\n[${label}] ${cmd}`);
  execSync(cmd, { cwd: backendDir, stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } });
}

try {
  run('migrate-deploy', 'npx prisma migrate deploy');
  run('seed', 'npm run db:seed');
  console.log('\nDone. Prod is at the latest schema and the 5 starter templates are seeded.');
} catch (err) {
  console.error('\nFAILED:', err.message);
  process.exit(1);
}

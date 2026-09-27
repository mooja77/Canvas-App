#!/usr/bin/env node
/*
 * QualCanvas 12-month fast-forward simulation — launcher.
 *
 *   node e2e/fullstack/simulation/fast-forward.mjs [--months 12] [--seed 42]
 *
 * Resets the simulation database, then runs sim.ts in ONE node process that
 * hosts the real Express backend (apps/backend/src/index.ts), the Stripe double
 * and the scheduled jobs, all on one controllable clock (support/preload.mjs).
 * Every outbound connection is refused or stubbed by the same preload.
 *
 * Requires a Postgres reachable at QC_SIM_DATABASE_URL (default: the estate
 * container on 127.0.0.1:4919, database qualcanvas_sim — RESET on every run).
 * Writes docs/qa/SIMULATION.md and e2e/fullstack/simulation/.out/results.json.
 */
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const OUT = path.join(HERE, '.out');
fs.mkdirSync(OUT, { recursive: true });

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.QC_SIM_DATABASE_URL ?? 'postgresql://qualcanvas:qualcanvas@127.0.0.1:4919/qualcanvas_sim?schema=public',
  NODE_ENV: 'test', // schedulers are NOT auto-started; the simulation replays them itself
  E2E_TEST: 'true',
  PORT: process.env.QC_SIM_PORT ?? '4916',
  // Per-run throwaway keys for the local backend.
  JWT_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  APP_URL: 'http://127.0.0.1:4913',
  ALLOWED_ORIGINS: 'http://127.0.0.1:4913',
  STRIPE_SECRET_KEY: 'sk_test_sim_stub',
  STRIPE_WEBHOOK_SECRET: `whsec_${randomBytes(24).toString('hex')}`,
  STRIPE_API_HOST: '127.0.0.1',
  STRIPE_API_PORT: process.env.QC_SIM_STRIPE_PORT ?? '4917',
  STRIPE_API_PROTOCOL: 'http',
  RESEND_API_KEY: 're_sim_stub',
  // Optional email is only released once delivery webhooks can be verified.
  RESEND_WEBHOOK_SECRET: `whsec_${randomBytes(24).toString('base64')}`,
  // Lifecycle email refuses any sender outside @qualcanvas.com; every send is
  // captured by the preload's Resend stub, so nothing is delivered.
  SMTP_FROM: 'QualCanvas <noreply@qualcanvas.com>',
  ADMIN_API_KEY: 'sim-admin-key',
  LIFECYCLE_EMAIL_AUTOMATION_ENABLED: 'true',
  LIFECYCLE_EMAIL_SEND_ENABLED: 'true',
  NETGUARD_OUTBOX: path.join(OUT, 'outbox.jsonl'),
  // Start the clock at the simulation start so nothing is stamped in real time.
  CLOCK_OFFSET_MS: String(Date.parse(process.env.QC_SIM_START ?? '2026-10-01T08:00:00Z') - Date.now()),
};
fs.writeFileSync(env.NETGUARD_OUTBOX, '');

const reset = spawnSync(process.execPath, ['e2e/fullstack/support/reset-db.mjs'], { cwd: REPO, env, stdio: 'inherit' });
if (reset.status !== 0) process.exit(reset.status ?? 1);

const child = spawn(
  process.execPath,
  ['--import', './e2e/fullstack/support/preload.mjs', '--import', 'tsx', 'e2e/fullstack/simulation/sim.ts', ...process.argv.slice(2)],
  { cwd: REPO, env, stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));

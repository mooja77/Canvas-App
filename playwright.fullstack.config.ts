import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { STACK } from './e2e/fullstack/support/env';

// Hermetic full-stack estate suite: the real backend + real frontend against a
// throwaway local Postgres database, with every outbound connection refused by
// e2e/fullstack/support/preload.mjs. Stripe is answered by a local stateful
// double; email, event ingest and AI by in-process stubs that record to an
// outbox file the specs read back.
//
//   docker run -d --name qc-fullstack-pg -e POSTGRES_USER=qualcanvas \
//     -e POSTGRES_PASSWORD=qualcanvas -p 127.0.0.1:4919:5432 postgres:16
//   npx playwright test -c playwright.fullstack.config.ts
//
// Ports and the database URL can be overridden with QC_FS_* variables (see
// support/env.ts). The database named in QC_FS_DATABASE_URL is recreated on start by
// support/reset-db.mjs, which only accepts loopback qualcanvas_fullstack*/qualcanvas_sim* names.
const backendEnv: Record<string, string> = {
  NODE_ENV: 'test',
  E2E_TEST: 'true',
  PORT: String(STACK.backendPort),
  DATABASE_URL: STACK.databaseUrl,
  // Per-run throwaway keys for the local backend.
  JWT_SECRET: randomBytes(32).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  APP_URL: STACK.frontendOrigin,
  ALLOWED_ORIGINS: STACK.frontendOrigin,
  // Stripe → local double (honoured only outside production).
  STRIPE_SECRET_KEY: 'sk_test_estate_stub',
  STRIPE_WEBHOOK_SECRET: STACK.webhookSecret,
  STRIPE_API_HOST: '127.0.0.1',
  STRIPE_API_PORT: String(STACK.stripePort),
  STRIPE_API_PROTOCOL: 'http',
  STRIPE_ACADEMIC_COUPON_ID: 'coupon_estate_academic',
  // Email + event ingest go through fetch and are captured by the preload.
  RESEND_API_KEY: 're_estate_stub',
  SMTP_FROM: 'QualCanvas <noreply@example.com>',
  ADMIN_API_KEY: STACK.adminKey,
  NETGUARD_OUTBOX: STACK.outbox,
  // Decoy platform AI key, generated per run. QualCanvas must never use a
  // server key for customer work; the preload tags any call carrying it as
  // keyKind "server" and 11-own-ai-key.spec.ts asserts there are none.
  OPENAI_API_KEY: `sk-server-${randomBytes(12).toString('hex')}`,
  HOSTED_AI_ENABLED: 'true',
  CLOCK_PORT: String(STACK.clockPort),
  DEMO_ACCESS_CODE: STACK.demoCode,
  // Google sign-in: the preload answers the certs request with this key.
  GOOGLE_CLIENT_ID: STACK.googleClientId,
  QC_FS_GOOGLE_KID: STACK.googleKeyId,
  QC_FS_GOOGLE_PUBLIC_PEM: STACK.googlePublicPem,
};

export default defineConfig({
  testDir: './e2e/fullstack',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/fullstack-results.json' }]],
  timeout: 60_000,
  globalSetup: './e2e/fullstack/support/global-setup.ts',
  use: {
    baseURL: STACK.frontendOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'fullstack', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `node e2e/fullstack/support/stripe-stub.mjs ${STACK.stripePort}`,
      url: `http://127.0.0.1:${STACK.stripePort}/__control/calls`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        'node e2e/fullstack/support/reset-db.mjs' +
        ' && npm run db:seed -w apps/backend' +
        ' && npm run build -w shared' +
        ' && node --import ./e2e/fullstack/support/preload.mjs --import tsx apps/backend/src/index.ts',
      url: `http://127.0.0.1:${STACK.backendPort}/ready`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: backendEnv,
    },
    {
      command: 'npm run dev:frontend',
      url: `http://127.0.0.1:${STACK.frontendPort}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        FRONTEND_PORT: String(STACK.frontendPort),
        FRONTEND_HOST: '127.0.0.1',
        BACKEND_URL: STACK.backendOrigin,
        VITE_E2E: 'true',
      },
    },
  ],
});

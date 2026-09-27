import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Generated once in the Playwright runner (which loads the config first) and
// inherited by the backend web server and the test workers through the env.
process.env.QC_FS_WEBHOOK_SECRET ??= `whsec_${randomBytes(24).toString('hex')}`;

const n = (v: string | undefined, d: number) => Number(v ?? d);

/** Port block 4910-4919 is reserved for the estate stack on the shared machine. */
export const STACK = {
  backendPort: n(process.env.QC_FS_BACKEND_PORT, 4912),
  frontendPort: n(process.env.QC_FS_FRONTEND_PORT, 4913),
  stripePort: n(process.env.QC_FS_STRIPE_PORT, 4914),
  clockPort: n(process.env.QC_FS_CLOCK_PORT, 4915),
  databaseUrl:
    process.env.QC_FS_DATABASE_URL ??
    'postgresql://qualcanvas:qualcanvas@127.0.0.1:4919/qualcanvas_fullstack?schema=public',
  webhookSecret: process.env.QC_FS_WEBHOOK_SECRET as string,
  adminKey: 'estate-admin-key-not-for-production',
  demoCode: 'estate-demo-access-code-2026',
  // Not under test-results/: Playwright empties that directory at start-up,
  // after the backend has already written its first line.
  outbox: path.resolve(process.cwd(), 'e2e', 'fullstack', '.out', 'outbox.jsonl'),
  get backendOrigin() {
    return `http://127.0.0.1:${this.backendPort}`;
  },
  get frontendOrigin() {
    return `http://127.0.0.1:${this.frontendPort}`;
  },
  get stripeOrigin() {
    return `http://127.0.0.1:${this.stripePort}`;
  },
};

import path from 'node:path';
import { generateKeyPairSync, randomBytes } from 'node:crypto';

// Generated once in the Playwright runner (which loads the config first) and
// inherited by the backend web server and the test workers through the env.
process.env.QC_FS_WEBHOOK_SECRET ??= `whsec_${randomBytes(24).toString('hex')}`;

// Stand-in for Google's ID-token signing key. The backend's preload serves the
// public half in place of https://www.googleapis.com/oauth2/v1/certs, and the
// specs sign ID tokens with the private half, so /api/auth/google runs the real
// google-auth-library signature, audience, issuer and expiry checks offline.
if (!process.env.QC_FS_GOOGLE_PRIVATE_PEM) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.QC_FS_GOOGLE_PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  process.env.QC_FS_GOOGLE_PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
}

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
  googleClientId: 'estate-google-client.apps.googleusercontent.com',
  googleKeyId: 'estate-google-key-1',
  googlePrivatePem: process.env.QC_FS_GOOGLE_PRIVATE_PEM as string,
  googlePublicPem: process.env.QC_FS_GOOGLE_PUBLIC_PEM as string,
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

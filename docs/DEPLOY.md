# Deployment Guide

## Production topology

- Frontend: Vite static build on Cloudflare Pages, project `qualcanvas`.
- Backend: Node/Express Docker image on Railway.
- Database: PostgreSQL 16 on Railway.
- Public site: `https://qualcanvas.com`.
- API: `https://api.qualcanvas.com/api`.

The deployment definitions are authoritative:

- `.github/workflows/ci.yml` — release gates;
- `.github/workflows/deploy-frontend.yml` — Cloudflare Pages publish;
- `Dockerfile` and `apps/backend/package.json` — Railway image/startup;
- `apps/backend/prisma/migrations/` — database rollout.

## Local development

Prerequisites: Node 20+, npm 9+, PostgreSQL 16+, and Playwright browsers for
E2E work.

```bash
git clone <repo-url>
cd Canvas-App
copy .env.example .env
npm install
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

Use a PostgreSQL URL. SQLite/file URLs are incompatible with the committed
Prisma provider.

```dotenv
DATABASE_URL=postgresql://canvas:canvas_dev_password@localhost:5432/canvas_app?schema=public
JWT_SECRET=<long-random-secret>
ENCRYPTION_KEY=<64-hex-characters>
APP_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:5174
```

The frontend defaults to port 5174 and the backend to 3007.

## Environment groups

Backend essentials:

- `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`;
- `ALLOWED_ORIGINS`, `APP_URL`;
- `ENCRYPTION_KEY` when user-managed AI keys are enabled;
- `REGISTRATION_ENABLED=true` to accept production signups.

Optional backend integrations:

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_ACADEMIC_COUPON_ID`;
- email: `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET` or `SMTP_*`;
- hosted AI: `OPENAI_API_KEY` plus the documented budget limits;
- storage: `S3_BUCKET`, `S3_REGION`, credentials and optional endpoint;
- operations: `ADMIN_API_KEY`, `METRICS_TOKEN`, `SENTRY_DSN`.

Frontend build variables:

- `VITE_API_URL=https://api.qualcanvas.com/api`;
- `VITE_GOOGLE_CLIENT_ID`;
- all `VITE_STRIPE_*_PRICE_ID` values;
- `VITE_SENTRY_DSN` and `VITE_GIT_SHA`.

Keep `VITE_API_URL` on the `api.qualcanvas.com` subdomain. Moving authentication
to a third-party Railway hostname makes the httpOnly session cookie third-party
and breaks sign-in in privacy-focused browsers.

## Release gates

Before pushing:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run build:budget
npm audit --omit=dev --audit-level=high
```

For changes to user journeys, run focused Playwright coverage in Chromium,
Firefox, WebKit, mobile Chrome, and mobile Safari. The CI workflow also builds
the production Docker image and replays migrations on clean PostgreSQL to catch
differences hidden by workspace-only builds.

## Frontend deployment (Cloudflare Pages)

A successful CI run on `main` triggers `deploy-frontend.yml`. It checks out the
exact successful commit, builds the frontend with production variables, and
runs:

```bash
npx wrangler@4 pages deploy apps/frontend/dist \
  --project-name=qualcanvas --branch=main \
  --commit-hash=<sha> --commit-message=<ascii-subject>
```

Required GitHub secrets include `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, Stripe price IDs, Google client ID, and the frontend
Sentry DSN. Cloudflare Pages handles the SPA fallback, TLS, and the
`qualcanvas.com` custom domain.

## Backend deployment (Railway)

Railway builds the repository Dockerfile from `main`. The backend start command
runs pending migrations before Node starts:

```bash
cd apps/backend && npm start
```

The Railway service must expose the API through `api.qualcanvas.com`, have the
PostgreSQL service URL in `DATABASE_URL`, and allow `https://qualcanvas.com` in
`ALLOWED_ORIGINS`. Stripe webhooks target:

```text
https://api.qualcanvas.com/api/billing/webhook
```

Do not seed production unless explicitly creating approved templates or a
temporary demo identity.

## Health and observability

- `GET /health` — liveness and database connectivity.
- `GET /ready` — readiness with dependency status.
- `GET /metrics` — public in development; in production requires
  `Authorization: Bearer <METRICS_TOKEN>` and otherwise intentionally returns 404.

Post-deploy verification:

```bash
npm run smoke:postdeploy
```

Also verify the public landing, login, pricing, training, one authenticated
canvas read/write flow, browser console/network errors, and the live API health
and readiness endpoints. A green local build is not a production verification.

The disposable-account activation check exercises the real signup, onboarding,
transcript, two-code, statistics-analysis, and coded-data CSV export journey. It
confirms the first-user checklist reaches 5/5, validates the downloaded CSV,
runs Axe on the resulting canvas, stores its report and screenshots in the
operating-system temporary directory, and deletes the synthetic account in a
`finally` block:

```bash
npm run qa:production-activation
```

It defaults to `https://qualcanvas.com` with an excluded `@example.com` address.
Use `QUALCANVAS_QA_ORIGIN`, `QUALCANVAS_QA_API_ORIGIN` and
`QUALCANVAS_QA_OUTPUT` only when validating another approved environment.

## Rollback

- Frontend: redeploy the last known-good commit to Cloudflare Pages.
- Backend: redeploy the last known-good Railway image/commit.
- Database: prefer forward-fix additive migrations. Restore a verified Railway
  backup only when a forward fix cannot preserve data.

Do not roll back application code across a migration that removed or changed
required columns without first checking schema compatibility.

## Common failures

| Symptom                         | Check                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Prisma rejects `file:` URL      | Use PostgreSQL; SQLite is not supported.                                          |
| Login works in one browser only | Confirm API is `api.qualcanvas.com`, cookie flags, CORS and CSRF origins.         |
| Cloudflare deploy did not start | Confirm the CI workflow on the same SHA passed.                                   |
| Railway is still on an old SHA  | Inspect image build/start logs and migration output.                              |
| Frontend returns stale assets   | Compare deployed commit hash, service worker version and Pages deployment.        |
| Stripe state drifts             | Check webhook signature secret, delivery history and idempotency rows.            |
| `/metrics` returns 404          | Supply the configured bearer token; this is intentional in production.            |
| Browser E2E cannot start        | Install Playwright browsers and confirm the PostgreSQL E2E service on port 55432. |

Last reviewed: 2026-08-29.

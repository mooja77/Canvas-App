# Deployment Guide

## 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ LTS | Required for build and runtime |
| npm | 9+ | Ships with Node 20 |
| PostgreSQL | 16+ | Production database (Railway provides this) |
| SQLite | any | Local development alternative (zero setup) |
| Docker | 24+ | Optional, for containerized deployment |

## 2. Local Development Setup

```bash
# 1. Clone the repository
git clone <repo-url> && cd canvas-app

# 2. Copy environment files
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env

# 3. Configure local database (choose one):

# Option A — SQLite (zero setup, recommended for local dev)
# In apps/backend/.env, set:
#   DATABASE_URL="file:./canvas-app.db"
# Note: The Prisma schema provider is "postgresql". Prisma accepts a SQLite
# URL at runtime, but `prisma migrate dev` may fail. Use `prisma db push`
# locally, or temporarily change the provider to "sqlite" (do NOT commit).

# Option B — Local PostgreSQL
# In apps/backend/.env, set:
#   DATABASE_URL="postgresql://canvas:password@localhost:5432/canvas_app"

# 4. Install dependencies
npm install

# 5. Run database migrations and seed demo data
npm run db:migrate
npm run db:seed

# 6. Start development servers (backend :3007 + frontend :5174)
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Build shared types, then start backend + frontend concurrently |
| `npm run dev:backend` | Start only the backend dev server |
| `npm run dev:frontend` | Start only the frontend dev server |
| `npm run build` | Production build: shared -> backend -> frontend |
| `npm start` | Start the compiled backend (`apps/backend/dist`) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed demo data (access code: `CANVAS-DEMO2025`) |
| `npm test` | Run all unit tests (234 backend + 131 frontend) |
| `npm run test:e2e` | Run 44 Playwright E2E tests (Chromium) |
| `npm run test:e2e:all` | Run E2E tests across all browsers |
| `npm run test:e2e:firefox` | Run E2E tests on Firefox |
| `npm run test:e2e:webkit` | Run E2E tests on WebKit |
| `npm run test:e2e:mobile` | Run E2E tests on mobile viewports |
| `npm run typecheck` | TypeScript type checking (backend + frontend) |
| `npm run lint` | ESLint across all packages |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier formatting |
| `npm run format:check` | Prettier check (CI-friendly) |

## 3. Environment Variables

Copy `.env.example` to `.env` and configure. Variables are organized by category below.

### Server & Database

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development` or `production` |
| `PORT` | No | `3007` | Backend server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string, or `file:./canvas-app.db` for SQLite |
| `JWT_SECRET` | Yes | — | 32+ char random string for signing JWTs. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENCRYPTION_KEY` | Recommended | — | 32-byte hex key for encrypting user API keys. Generate same as JWT_SECRET |

### CORS & Origins

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | Production | — | Comma-separated frontend URLs for CORS/CSRF |
| `CORS_ORIGIN` | No | — | Alternative CORS origin (also checked by CSRF middleware) |
| `FRONTEND_URL` | No | — | Alternative frontend URL |
| `APP_URL` | Recommended | `http://localhost:5174` | Public app URL for Stripe redirects and password reset links |

### Authentication

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REGISTRATION_ENABLED` | No | `false` | Set to `true` to allow new user signups in production |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID for Google sign-in |

### Stripe / Billing

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | For billing | — | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | For billing | — | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_ACADEMIC_COUPON_ID` | No | — | Stripe coupon ID for 40% academic discount (.edu emails) |

### Email (SMTP)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | For emails | — | SMTP server (e.g., `smtp.resend.com`, `smtp.gmail.com`) |
| `SMTP_PORT` | For emails | `465` | SMTP port (465 for SSL, 587 for TLS) |
| `SMTP_USER` | For emails | — | SMTP username |
| `SMTP_PASS` | For emails | — | SMTP password or app-specific password |
| `SMTP_FROM` | For emails | — | From address (e.g., `QualCanvas <noreply@qualcanvas.com>`) |

If SMTP is not configured, password reset links are logged to the server console (useful for development).

### AI / LLM

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | No | `openai` | AI provider (`openai`, `anthropic`, `google`) |
| `AI_MODEL` | No | `gpt-4o-mini` | Default AI model |
| `OPENAI_API_KEY` | No | — | Server-side fallback API key (users bring their own keys) |

### S3 File Storage

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `S3_BUCKET` | No | — | S3/R2/MinIO bucket name. Omit for local file storage fallback |
| `S3_REGION` | No | `us-east-1` | S3 region |
| `S3_ACCESS_KEY` | No | — | S3 access key |
| `S3_SECRET_KEY` | No | — | S3 secret key |
| `S3_ENDPOINT` | No | — | Custom endpoint for R2/MinIO |

### Frontend (Vite)

These must be prefixed with `VITE_` to be available in the browser.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | No | `/api` | API base URL (use `/api` with Vercel proxy, or `http://localhost:3007/api` for local dev) |
| `VITE_GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID for frontend |
| `VITE_WS_URL` | No | — | WebSocket URL (points to Railway in production) |
| `VITE_STRIPE_PRO_MONTHLY_PRICE_ID` | For billing | — | Stripe price ID for Pro monthly plan |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID` | For billing | — | Stripe price ID for Pro annual plan |
| `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID` | For billing | — | Stripe price ID for Team monthly plan |
| `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID` | For billing | — | Stripe price ID for Team annual plan |

## 4. Database Setup

### PostgreSQL (Production)

The Prisma schema uses `provider = "postgresql"`. In production (Railway), a PostgreSQL 16 instance is provisioned automatically.

```bash
# Run migrations (creates/updates all tables)
npx prisma migrate deploy

# Seed demo data (optional — creates demo access code CANVAS-DEMO2025)
npx prisma db seed
```

### SQLite (Local Development)

For local development without installing PostgreSQL:

```bash
# Set DATABASE_URL in apps/backend/.env
DATABASE_URL="file:./canvas-app.db"

# Use db push instead of migrate (avoids provider validation issues)
npx prisma db push --schema=apps/backend/prisma/schema.prisma

# Or use the npm script which runs migrate
npm run db:migrate
```

> **Important:** The schema provider must remain `"postgresql"` in the committed code. Prisma accepts a SQLite connection string at runtime, but schema-level commands (`migrate dev`, `db push`) may require temporarily switching the provider. Never commit the provider as `"sqlite"`.

## 5. Docker Deployment

### Dockerfile

The multi-stage Dockerfile (`node:20-alpine`) builds in five stages:

1. **deps** — Installs all dependencies (`npm ci --ignore-scripts`)
2. **build-shared** — Compiles shared types package
3. **build-frontend** — Builds the Vite frontend (static bundle)
4. **build-backend** — Compiles the Express backend + copies Prisma schema
5. **production** — Minimal image with production deps only, built artifacts, and Prisma client

Production image features:
- Runs as non-root `node` user for security
- Auto-runs `prisma migrate deploy` on startup before starting the server
- Built-in health check: `wget` to `/health` every 30s (5s timeout, 10s start period, 3 retries)
- Exposes `PORT` (default 3007)

### Build and Run with Docker Compose

```bash
# Build the image
docker build -t qualcanvas .

# Run with docker-compose (starts PostgreSQL 16 + app)
docker-compose up -d
```

The `docker-compose.yml` defines two services:

| Service | Image | Description |
|---------|-------|-------------|
| `db` | `postgres:16-alpine` | PostgreSQL database with persistent volume (`pgdata`) |
| `app` | Built from Dockerfile | Backend + serves frontend, depends on `db` |

Default compose environment:

| Variable | Default | Notes |
|----------|---------|-------|
| `POSTGRES_DB` | `canvas_app` | Database name |
| `POSTGRES_USER` | `canvas` | Database user |
| `POSTGRES_PASSWORD` | `canvas_dev_password` | **Change in production!** |
| `DATABASE_URL` | Auto-constructed | Points to the `db` service |
| `REGISTRATION_ENABLED` | `false` | Set to `true` to allow signups |

> **Security:** Always override default credentials in production:
> ```bash
> POSTGRES_PASSWORD=your_strong_password JWT_SECRET=your_jwt_secret docker-compose up -d
> ```

### Docker Environment Variables

Pass additional env vars to the `app` service in `docker-compose.yml`, via a `.env` file in the project root, or with `docker run -e`:

```bash
docker-compose up -d \
  -e STRIPE_SECRET_KEY=sk_live_... \
  -e SMTP_HOST=smtp.resend.com
```

## 6. Vercel Frontend Deployment

The frontend is deployed as a static Vite site on Vercel. Configuration is in `vercel.json`:

```json
{
  "buildCommand": "npm run build -w shared && npm run build -w apps/frontend",
  "outputDirectory": "apps/frontend/dist",
  "installCommand": "npm install",
  "framework": "vite"
}
```

### Setup Steps

1. Import the GitHub repo on [vercel.com](https://vercel.com)
2. Set **Framework**: Vite
3. Set **Root Directory**: `/` (monorepo root — `vercel.json` handles the rest)
4. Add environment variables in Vercel dashboard:
   - `VITE_API_URL=/api` (uses Vercel rewrites to proxy to Railway)
   - `VITE_GOOGLE_CLIENT_ID` (if using Google OAuth)
   - `VITE_WS_URL` (Railway WebSocket URL, e.g., `wss://your-app.up.railway.app`)
   - All `VITE_STRIPE_*` price IDs (if billing is enabled)
5. Deploy

### Rewrites

Vercel rewrites proxy API and health requests to the Railway backend:

| Source | Destination |
|--------|-------------|
| `/api/:path*` | `https://<railway-url>/api/:path*` |
| `/health` | `https://<railway-url>/health` |
| `/:path*` | `/index.html` (SPA fallback) |

Update the Railway URL in `vercel.json` to match your deployment.

### Custom Domain

1. Add your domain under Vercel Project Settings > Domains
2. Set DNS: `CNAME` to `cname.vercel-dns.com`
3. SSL is handled automatically by Vercel

## 7. Railway Backend Deployment

1. Create a new project at [railway.app](https://railway.app)
2. Add a **PostgreSQL** database service — copy the `DATABASE_URL`
3. Add a **GitHub Repo** service pointing to this repo
4. Configure the service:
   - **Root Directory**: `/` (monorepo root)
   - **Build Command**: `npm run build`
   - **Start Command**: `cd apps/backend && npm start`
5. Add environment variables in the Railway dashboard:
   - `DATABASE_URL` (from the PostgreSQL service)
   - `JWT_SECRET` (generate a strong random string)
   - `NODE_ENV=production`
   - `ALLOWED_ORIGINS=https://your-vercel-domain.com`
   - `APP_URL=https://your-vercel-domain.com`
   - `REGISTRATION_ENABLED=true` (if allowing signups)
   - All Stripe, SMTP, and optional variables as needed
6. Deploy — Railway builds and starts the backend automatically
7. After first deploy, seed the database from the Railway shell:
   ```bash
   cd apps/backend && npx tsx prisma/seed.ts
   ```
8. Note your Railway public URL (e.g., `https://canvas-app-production.up.railway.app`)

### Connecting Frontend and Backend

- Set `VITE_API_URL=/api` on Vercel (rewrites proxy to Railway)
- Set `ALLOWED_ORIGINS=https://your-app.vercel.app` on Railway
- Set `APP_URL=https://your-app.vercel.app` on Railway
- Set `VITE_WS_URL=wss://your-app.up.railway.app` on Vercel (for WebSocket)

Railway auto-deploys on every push to the connected branch.

## 8. CI/CD Pipeline

GitHub Actions runs on every push to `main` and every pull request targeting `main`. The workflow (`.github/workflows/ci.yml`) has three sequential jobs:

### Job 1: Type Check

- Runs `npm run typecheck` (TypeScript compilation check for backend + frontend)
- Uses Node 20 with npm caching
- Must pass before unit tests run

### Job 2: Unit Tests

- Depends on: Type Check
- Uses SQLite (`DATABASE_URL=file:./test.db`) — no external database needed
- Generates Prisma client and runs migrations
- Runs `npm test` (234 backend + 131 frontend tests via Vitest)
- Environment: `JWT_SECRET` and `ENCRYPTION_KEY` set to CI-only values

### Job 3: E2E Tests

- Depends on: Unit Tests
- Installs Chromium via Playwright
- Generates Prisma client, runs migrations, and seeds test data
- Runs `npm run test:e2e` (44 Playwright tests)
- On failure: uploads `test-results/` as an artifact (retained 7 days)

### Pipeline Summary

```
push/PR to main
  |
  v
[typecheck] --> [unit-tests] --> [e2e-tests]
                                      |
                                      +--> (on failure) upload test artifacts
```

All jobs run on `ubuntu-latest` with Node 20 and npm caching.

## 9. Health Checks & Monitoring

The backend exposes three unauthenticated monitoring endpoints:

### `GET /health` — Liveness Check

Returns `200` if the server is running and the database is reachable.

```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

Returns `503` if the database is unreachable.

### `GET /ready` — Readiness Check

Returns `200` with version and uptime when the app is ready to serve traffic.

```json
{ "status": "ready", "version": "1.0.0", "uptime": 123.456 }
```

Use this for load balancer readiness probes.

### `GET /metrics` — Basic Metrics

Returns uptime, request count, and memory usage.

```json
{
  "uptime": 3600,
  "requestCount": 12345,
  "memoryUsage": 67108864,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### Docker Health Check

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3007}/health || exit 1
```

## 10. Troubleshooting

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| `prisma migrate dev` fails with SQLite URL | Provider mismatch: schema says `postgresql`, URL says `file:` | Use `prisma db push` locally, or temporarily change provider to `sqlite` (don't commit) |
| Frontend can't reach API | CORS or proxy misconfiguration | Check `ALLOWED_ORIGINS` on backend, `VITE_API_URL` on frontend, and Vercel rewrites |
| JWT errors after deploy | Missing or mismatched `JWT_SECRET` | Ensure the same `JWT_SECRET` is set in production env vars |
| Password reset emails not sent | SMTP not configured | Set `SMTP_*` env vars, or check server console for logged reset links |
| Stripe webhooks failing | Wrong webhook secret or URL | Verify `STRIPE_WEBHOOK_SECRET` and webhook endpoint URL in Stripe Dashboard |
| `ENCRYPTION_KEY` errors | Key not set or wrong format | Generate a 32-byte hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| Docker build fails on `prisma generate` | Missing schema file in build context | Ensure `apps/backend/prisma/` is not in `.dockerignore` |
| Registration disabled | `REGISTRATION_ENABLED` defaults to `false` | Set `REGISTRATION_ENABLED=true` in production env vars |
| WebSocket connection fails | `VITE_WS_URL` not set or wrong | Set `VITE_WS_URL=wss://your-railway-url.up.railway.app` on Vercel |
| E2E tests fail locally | Playwright browsers not installed | Run `npx playwright install --with-deps chromium` |

### Verifying a Deployment

1. Visit `https://your-domain.com` — should show the landing page
2. Visit `https://your-domain.com/health` — should return `{"status":"ok"}`
3. Visit `https://your-domain.com/ready` — should return `{"status":"ready"}`
4. Log in with `CANVAS-DEMO2025` (if database was seeded)
5. Check `https://your-domain.com/metrics` for request counts and memory usage

### Stripe Setup

1. Create a [Stripe](https://stripe.com) account (use test mode for staging)
2. Create products and prices:
   - **Pro** plan: monthly and annual prices
   - **Team** plan: monthly and annual prices (per-seat)
3. Copy price IDs into `VITE_STRIPE_*` env vars
4. Set `STRIPE_SECRET_KEY` on the backend
5. Configure a webhook endpoint in Stripe Dashboard:
   - URL: `https://your-domain.com/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
6. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`
7. (Optional) Create a coupon for academic discount and set `STRIPE_ACADEMIC_COUPON_ID`

### SSL / Custom Domains

- **Railway and Vercel** handle SSL certificates automatically
- Set `APP_URL` to your production URL for email links and Stripe redirects
- For custom domains:
  - **Vercel**: Add domain under Project Settings > Domains
  - **Railway**: Add custom domain under service Settings > Networking
  - **DNS**: Point your domain to Vercel (`CNAME` to `cname.vercel-dns.com`)
- Update `ALLOWED_ORIGINS` to include your custom domain

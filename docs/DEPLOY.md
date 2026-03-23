# Deployment Guide

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 16+
- **npm** 9+
- A domain name (optional but recommended for production)

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. See the file for descriptions.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | 32+ char random string for signing JWTs. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` for deployed environments |
| `PORT` | Server port (default: `3007`) |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs for CORS |

### Optional

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key for billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_ACADEMIC_COUPON_ID` | Stripe coupon ID for .edu discount |
| `ENCRYPTION_KEY` | 32-byte hex key for encrypting sensitive data |
| `SMTP_HOST` | SMTP server for sending emails |
| `SMTP_PORT` | SMTP port (default: `465`) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From address for outgoing emails |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `OPENAI_API_KEY` | OpenAI API key for AI auto-coding |
| `APP_URL` | Public app URL for email links and Stripe redirects |
| `REGISTRATION_ENABLED` | Set to `true` to allow new user signups |
| `VITE_STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for Pro monthly |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe price ID for Pro annual |
| `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID` | Stripe price ID for Team monthly |
| `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID` | Stripe price ID for Team annual |

## Database Setup

```bash
# Run migrations (creates/updates all tables)
npx prisma migrate deploy

# Seed demo data (optional)
npx prisma db seed
```

## Build

```bash
# Install dependencies
npm install

# Build all packages (shared types, backend, frontend)
npm run build
```

The build produces:
- `shared/dist/` — compiled shared types
- `apps/backend/dist/` — compiled backend
- `apps/frontend/dist/` — static frontend bundle

## Docker Deployment

### Build and run with Docker Compose

```bash
# Build the image
docker build -t canvas-app .

# Run with docker-compose
docker-compose up -d
```

> **IMPORTANT:** Change the default PostgreSQL password in production.
> Set `POSTGRES_PASSWORD` to a strong, unique value before deploying:
> ```bash
> POSTGRES_PASSWORD=your_strong_password JWT_SECRET=your_jwt_secret docker-compose up -d
> ```

The Dockerfile uses a multi-stage build (Node 20 Alpine) that:
1. Installs dependencies
2. Builds shared types, frontend, and backend in parallel stages
3. Produces a minimal production image with only compiled artifacts
4. Runs Prisma migrations automatically on startup
5. Includes a health check (`/health` endpoint)

### Docker environment variables

Pass additional env vars to the `app` service in `docker-compose.yml` or via a `.env` file in the project root.

## Railway Deployment

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** database service — copy the `DATABASE_URL`
3. Add a **GitHub Repo** service pointing to this repo
4. Set **Root Directory** to `/` (monorepo root)
5. Set **Build Command**: `npm run build`
6. Set **Start Command**: `cd apps/backend && npm start`
7. Add environment variables in the Railway dashboard (see table above)
8. Deploy — Railway builds and starts the backend automatically
9. After first deploy, seed the database from the Railway shell:
   ```bash
   cd apps/backend && npx tsx prisma/seed.ts
   ```
10. Note your Railway public URL (e.g., `https://canvas-app-production.up.railway.app`)

Railway auto-deploys on every push to your connected branch.

## Vercel + Railway Split

For best performance, deploy the frontend and backend separately:

### Frontend on Vercel (static site)

1. Import the GitHub repo on [vercel.com](https://vercel.com)
2. Set **Framework**: Vite
3. Set **Root Directory**: `/` (uses `vercel.json` for config)
4. Update `vercel.json` to point API rewrites to your Railway backend URL:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://YOUR-RAILWAY-URL.up.railway.app/api/:path*"
       }
     ]
   }
   ```
5. Deploy

### Backend on Railway (Docker)

Follow the Railway deployment steps above. Set `ALLOWED_ORIGINS` to your Vercel frontend URL.

### Connecting them

- Set `VITE_API_URL=/api` on the frontend (Vercel rewrites proxy `/api/*` to Railway)
- Set `ALLOWED_ORIGINS=https://your-app.vercel.app` on Railway
- Set `APP_URL=https://your-app.vercel.app` on Railway (for email links)

## Health Monitoring

The backend exposes three monitoring endpoints (no authentication required):

### `GET /health` — Basic health check
Returns `200` if the server is running and the database is reachable.
```json
{ "status": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```
Returns `503` if the database is unreachable.

### `GET /ready` — Readiness check
Returns `200` with version and uptime when the app is ready to serve traffic.
```json
{ "status": "ready", "version": "1.0.0", "uptime": 123.456 }
```
Use this for load balancer readiness probes.

### `GET /metrics` — Basic metrics
Returns uptime, total request count, and memory usage.
```json
{
  "uptime": 3600,
  "requestCount": 12345,
  "memoryUsage": 67108864,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Stripe Setup

1. Create a [Stripe](https://stripe.com) account and switch to live mode for production
2. Create products and prices in the Stripe Dashboard:
   - **Pro** plan: monthly and annual prices
   - **Team** plan: monthly and annual prices (per-seat)
3. Copy the price IDs into your environment variables:
   - `VITE_STRIPE_PRO_MONTHLY_PRICE_ID`
   - `VITE_STRIPE_PRO_ANNUAL_PRICE_ID`
   - `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID`
   - `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID`
4. Set `STRIPE_SECRET_KEY` to your Stripe secret key
5. Configure a webhook endpoint in the Stripe Dashboard:
   - URL: `https://your-domain.com/api/billing/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
6. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
7. (Optional) Create a coupon for academic discount and set `STRIPE_ACADEMIC_COUPON_ID`

## SMTP Setup

Configure email sending for password resets and notifications:

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | `smtp.gmail.com` or `email-smtp.us-east-1.amazonaws.com` |
| `SMTP_PORT` | `465` (SSL) or `587` (TLS) |
| `SMTP_USER` | Your SMTP username |
| `SMTP_PASS` | Your SMTP password or app-specific password |
| `SMTP_FROM` | `Canvas App <noreply@your-domain.com>` |

If SMTP is not configured, password reset links are logged to the server console (useful for development).

## SSL / Domain

- **Railway and Vercel** handle SSL certificates automatically — no manual setup needed
- Set `APP_URL` to your production URL (e.g., `https://your-domain.com`) for correct email links and Stripe redirect URLs
- For custom domains:
  - **Vercel**: Add domain under Project Settings > Domains
  - **Railway**: Add custom domain under service Settings > Networking
  - **DNS**: Point your domain to Vercel (`CNAME` to `cname.vercel-dns.com`) or Railway as appropriate
- Update `ALLOWED_ORIGINS` to include your custom domain

## Verify Deployment

1. Visit `https://your-domain.com` — should show the landing page
2. Visit `https://your-domain.com/health` — should return `{"status":"ok"}`
3. Visit `https://your-domain.com/ready` — should return `{"status":"ready"}`
4. Log in with `CANVAS-DEMO2025` (if database was seeded)

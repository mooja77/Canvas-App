# Deployment Guide — Railway + Vercel + Cloudflare

## Architecture

```
Users → Cloudflare DNS → Vercel (frontend)
                              ↓ /api/* (rewrite proxy)
                         Railway (backend + PostgreSQL)
```

## Step 1: Railway (Backend + Database)

### 1a. Create PostgreSQL database
1. Go to [railway.app](https://railway.app), create a new project
2. Click **+ New** → **Database** → **PostgreSQL**
3. Copy the `DATABASE_URL` from the PostgreSQL service variables

### 1b. Deploy backend
1. In the same Railway project, click **+ New** → **GitHub Repo** → select this repo
2. Set **Root Directory** to `/` (monorepo root)
3. Set **Build Command**: `npm run build`
4. Set **Start Command**: `cd apps/backend && npm start`
5. Add environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | *(from PostgreSQL service — use internal URL)* |
| `JWT_SECRET` | *(generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `NODE_ENV` | `production` |
| `PORT` | `3007` |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `REGISTRATION_ENABLED` | `true` *(set to false after creating accounts)* |

6. Deploy. Railway will build and start the backend.

### 1c. Seed the database
After first deploy, open Railway shell and run:
```bash
cd apps/backend && npx tsx prisma/seed.ts
```

### 1d. Note your Railway URL
Copy the public URL (e.g., `https://canvas-app-production.up.railway.app`)

## Step 2: Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com), import this GitHub repo
2. **Framework**: Vite
3. **Root Directory**: `/` (leave default)
4. Vercel will use `vercel.json` for build config automatically
5. **Before deploying**, edit `vercel.json` and replace `YOUR_RAILWAY_APP` with your actual Railway URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-ACTUAL-RAILWAY-URL.up.railway.app/api/:path*"
    }
  ]
}
```

6. Deploy.

## Step 3: Cloudflare DNS

1. In Cloudflare dashboard, add DNS records:
   - `CNAME` → `your-domain.com` → `cname.vercel-dns.com` (for Vercel)
2. In Vercel, add your custom domain under Project Settings → Domains
3. Update `ALLOWED_ORIGINS` in Railway to include your custom domain
4. Update `vercel.json` rewrites if the Railway URL changes

## Verify

- Visit `https://your-domain.com` — should show login page
- Visit `https://your-domain.com/health` — should return `{"status":"ok"}`
- Login with `CANVAS-DEMO2025` (if seeded)

## Environment Variable Reference

### Railway Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 32+ char random string |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3007` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated frontend URLs |
| `REGISTRATION_ENABLED` | No | `true` to allow signups |

### Vercel Frontend
No environment variables needed — API calls are proxied via Vercel rewrites.

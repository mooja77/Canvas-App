# QualCanvas: Vercel Migration Instructions — April 4, 2026

> **Goal:** Move qualcanvas.com frontend from Vercel to Cloudflare Pages (free)

## Context

The `canvas-app` Vercel project serves the QualCanvas frontend SPA at qualcanvas.com. It's a Vite SPA — static files that make API calls to the Railway backend. Perfect for Cloudflare Pages.

The backend API is already on Railway. Only the frontend is on Vercel.

## Task 1: Check for API Rewrites

Before migrating, check if the Vercel project has `vercel.json` rewrites that proxy API calls to Railway. If so, you'll need to handle this differently:

```json
// Look for rewrites like:
{
  "rewrites": [{ "source": "/api/:path*", "destination": "https://your-railway-domain/api/:path*" }]
}
```

If rewrites exist:

- Option A: Update the frontend to call the Railway API directly (change API base URL in env vars)
- Option B: Use Cloudflare Workers to handle the rewrite (more complex but same behaviour)

If NO rewrites (frontend already calls Railway directly):

- Simple migration, proceed to Task 2

## Task 2: Build & Verify

1. Navigate to the frontend directory
2. Run `npm run build`
3. Verify output is static HTML/CSS/JS in `dist/`
4. Set `VITE_API_URL` (or equivalent) to the Railway backend URL

## Task 3: Create Cloudflare Pages Project

```bash
npm run build
npx wrangler pages deploy dist --project-name qualcanvas
```

Or via Dashboard:

1. Cloudflare Pages → Create project → Connect GitHub
2. Build command: `npm install && npm run build`
3. Output: `dist`

## Task 4: Add Custom Domains

1. Add `qualcanvas.com` and `www.qualcanvas.com`
2. Update DNS records

## Task 5: Verify

1. https://qualcanvas.com loads
2. Login works (API calls reach Railway backend)
3. All app features work (canvas, coding, analysis)
4. WebSocket connections still work (if any — check socket.io config)

## Task 6: Clean Up Vercel

Once confirmed working:

1. Remove custom domains from Vercel
2. Delete the `canvas-app` Vercel project

## Important

- Backend stays on Railway — do NOT move it
- Check for WebSocket connections — these need the Railway backend URL, not Vercel
- Environment variables (API URL, auth config) must be set in Cloudflare Pages

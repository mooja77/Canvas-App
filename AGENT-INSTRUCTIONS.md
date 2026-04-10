# QualCanvas — Agent Instructions

**App Name:** QualCanvas
**Current Score:** ~12/16
**Priority:** MEDIUM — solid foundation, needs completion of partial features
**Local Path:** `C:\JM Programs\Canvas App`
**Production URL:** qualcanvas.com
**Reference (Gold Standard):** SmartCash at `C:\JM Programs\CashFlowAppV2` (15/16)

---

## Architecture Context

QualCanvas is a **standalone web app** for qualitative researchers and academics. It is **NOT a Shopify app**. It provides a canvas-based interface for organizing and analyzing qualitative research data. It has a monorepo with `apps/` directory, Docker support, and an existing partial guided tour. Several features are partially implemented and need completion.

**What does NOT apply to this app:**

- Shopify integration (N/A)
- Shopify GDPR webhooks (N/A — but GDPR still applies for user data)
- Shopify App Store submission (N/A)
- App Bridge / Polaris (N/A)

---

## Items Needing Completion (Partial Implementations)

### 1. Guided Tour — Complete Partial Implementation

**Status:** Partial

- [ ] Audit the existing guided tour — identify which steps are implemented and which are missing
- [ ] Add missing tour steps covering all major features: canvas navigation, node creation, connections, analysis tools, export
- [ ] Ensure tour auto-starts on first visit
- [ ] Ensure tour is restartable from settings/help menu
- [ ] Test that tour overlays render correctly over the canvas interface (canvas UIs can be tricky with overlays)
- [ ] **Reference:** SmartCash has a complete tour; GrowthMap uses nextstepjs with 10+ steps

### 2. Tutorial System — Complete

**Status:** Partial

- [ ] Audit existing tutorials — identify gaps
- [ ] Add tutorials for each major workflow: creating a project, building a canvas, coding data, analyzing themes
- [ ] Tutorials should be interactive, highlighting relevant UI elements
- [ ] Accessible from Help section in navigation

### 3. Test Plan Document — Complete

**Status:** Partial

- [ ] Review existing test plan and fill in gaps
- [ ] Cover: canvas operations, data import/export, user management, collaboration features
- [ ] Include edge cases: large datasets, many canvas nodes, concurrent users

### 4. Coverage Reports — Complete

**Status:** Partial

- [ ] Review existing coverage setup and identify what is not being measured
- [ ] Ensure all test suites generate coverage reports
- [ ] Target 80%+ on business logic, 60%+ overall
- [ ] Add coverage badge to README if desired

### 5. Dark Mode — Verify Complete

**Status:** Listed as implemented, but verify

- [ ] Test dark mode on ALL screens (canvas, settings, projects list, analysis views)
- [ ] Verify canvas elements (nodes, connections, labels) render correctly in dark mode
- [ ] Check contrast ratios meet WCAG AA standards
- [ ] Verify toggle persists across sessions

---

## Missing Features

### 6. Setup Wizard — First-Run for New Researchers

**Status:** Missing

- [ ] Add first-run setup flow for new users
- [ ] Steps: welcome, research methodology selection (if applicable), create first project, brief canvas tutorial
- [ ] Show progress indicator (step 1 of N)
- [ ] Offer to import sample data for exploration
- [ ] Skip option for experienced users

### 7. Demo Mode

**Status:** Missing

- [ ] Add auto-advance tour mode for screencast recording
- [ ] Populate with sample qualitative research data (e.g., interview excerpts, codes, themes)
- [ ] Trigger via URL param (`?demo=true`) or hidden setting
- [ ] Auto-advance: 3-5 seconds per step
- [ ] Show a complete research workflow from data import to analysis

---

## Security

### 8. CSRF Protection

**Status:** Missing

- [ ] Add CSRF token validation on all state-changing API endpoints
- [ ] Use `csurf` middleware or custom double-submit cookie pattern
- [ ] Ensure auth token flows are not broken by CSRF protection

### 9. Data Retention Policy

**Status:** Missing

- [ ] Document how long research data is retained
- [ ] Important for academic ethics: researchers may need data kept for specific periods (often 5-10 years)
- [ ] Add retention settings in project settings
- [ ] Document in privacy policy and terms of service
- [ ] Consider: auto-archive (not delete) after inactivity period

---

## Testing & Code Quality

### 10. Pre-commit Hooks

**Status:** Missing

- [ ] Add Husky + lint-staged at project root
- [ ] Pre-commit: ESLint + Prettier on staged files
- [ ] Pre-push: `tsc --noEmit` for type checking

---

## Communication & Collaboration

### 11. Push Notifications

**Status:** Missing (consider for team features)

- [ ] If QualCanvas supports research teams/collaboration:
  - Notify when a team member adds codes or annotations
  - Notify when a shared project is updated
- [ ] Use Web Push API or service worker notifications
- [ ] Make notifications opt-in in user settings
- [ ] Lower priority if app is primarily single-user

### 12. Scheduled Reports

**Status:** Missing (consider for research teams)

- [ ] If research teams use the app:
  - Weekly/monthly progress reports emailed to team leads
  - Summary of coding activity, new themes identified, project milestones
- [ ] Use cron job or scheduled Cloud Function
- [ ] Configurable frequency in project settings
- [ ] Lower priority — implement only if team features are core

### 13. Calendar/iCal Integration

**Status:** Missing (consider for team scheduling)

- [ ] If teams coordinate analysis sessions:
  - Export research deadlines and milestones as iCal events
  - Integrate with Google Calendar or Outlook
- [ ] Lower priority — only if team scheduling is a real use case

---

## Export

### 14. Excel Export

**Status:** Missing

- [ ] Add "Export to Excel" for coded data, theme matrices, and analysis results
- [ ] Use `exceljs` library
- [ ] Researchers commonly use Excel for further analysis — this is important
- [ ] Include: code frequencies, theme hierarchies, data excerpts with codes
- [ ] Format worksheets with headers, filters, and color coding

---

## UI Features

### 15. Charts (Recharts) — Analysis Visualization

**Status:** Missing

- [ ] Add visualization charts for qualitative analysis:
  - Code frequency bar charts
  - Theme hierarchy treemap or sunburst
  - Code co-occurrence matrix heatmap
  - Timeline of coding activity
- [ ] Use `recharts` or `d3` (recharts is simpler)
- [ ] Place in a dedicated "Analysis" or "Visualization" tab
- [ ] Charts should be exportable as images (PNG/SVG)

---

## SEO — qualcanvas.com

### 16. Full SEO Implementation

**Status:** Missing

- [ ] **robots.txt:**
  ```
  User-agent: *
  Allow: /
  Sitemap: https://qualcanvas.com/sitemap.xml
  ```
- [ ] **sitemap.xml** listing all public pages (homepage, features, pricing, about, privacy, terms, blog if any)
- [ ] **Meta tags** on every public page:
  - `<title>QualCanvas - Qualitative Research Analysis Platform</title>`
  - `<meta name="description" content="Visual canvas for qualitative data analysis. Code, organize, and analyze research data with an intuitive drag-and-drop interface.">`
  - `<link rel="canonical" href="https://qualcanvas.com/">`
- [ ] **OG tags:** og:title, og:description, og:url, og:image, og:type
- [ ] **Twitter cards:** twitter:card (summary_large_image), twitter:title, twitter:description, twitter:image
- [ ] **Structured data** (JSON-LD):
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "QualCanvas",
    "applicationCategory": "EducationApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "Qualitative research analysis platform. Visual canvas for coding, organizing, and analyzing interview transcripts, field notes, and documents.",
    "url": "https://qualcanvas.com"
  }
  ```
  (Adjust price if this app has paid tiers)
- [ ] **OG image:** 1200x630px with app name, tagline, and canvas screenshot
- [ ] **Plausible Analytics:** Add privacy-friendly analytics
- [ ] **Google Search Console:** Verify domain, submit sitemap
- [ ] **Reference:** `C:\JM Programs\JMS Dev Lab\SEO-FIXES-PER-APP.md`

---

## Implementation Order (Recommended)

1. **Complete Guided Tour** — partial work exists, finish it
2. **Complete Tutorial System** — partial work exists, finish it
3. **Dark Mode verification** — quick check, may already work
4. **CSRF Protection** — security
5. **SEO** — organic traffic for academic audience
6. **Pre-commit Hooks** — code quality
7. **Setup Wizard** — onboarding for new researchers
8. **Excel Export** — researchers need this
9. **Charts/Visualization** — analysis value
10. **Demo Mode** — needed for marketing
11. **Test Plan + Coverage completion** — quality assurance
12. **Data Retention Policy** — academic ethics compliance
13. **Push Notifications, Scheduled Reports, Calendar** — team features (if applicable)

---

## Academic/Research Context

This app targets qualitative researchers and academics. Keep these considerations in mind:

- **Data sensitivity:** Research data may contain sensitive interview content. Prioritize security and privacy.
- **Academic ethics:** Many institutions require data retention for specific periods. The data retention policy should accommodate this.
- **Export formats:** Researchers need to export to Excel, CSV, and PDF for papers and reports. These are not nice-to-haves.
- **Accessibility:** Academic users may have accessibility needs. Ensure WCAG AA compliance.
- **Terminology:** Use research methodology terms correctly (coding, themes, memos, axial coding, etc.).

---

## Rules & Constraints

- **NOT a Shopify app** — standalone web application for researchers
- **No fake data or placeholder testimonials** — real content only
- **No `killall` command** — strictly forbidden
- **GDPR applies** — any app with EU users must handle data rights
- **SmartCash is the gold standard** for code quality patterns (architecture, testing, hooks)
- **Pricing:** Verify whether QualCanvas has paid tiers or is free — adjust structured data accordingly

---

## Developer Management Portal (NEW)

**Status:** Team admin only. No developer management portal exists.
**Reference spec:** `C:\JM Programs\JMS Dev Lab\docs\standards\75-admin-portal-spec.md`

- [ ] Create `/api/admin/*` routes in Express backend
- [ ] Dashboard: total users, canvases created, transcripts coded, analyses run
- [ ] Billing: Stripe plan distribution (Free/Pro/Team), .edu discounts active
- [ ] Health: API response times, database stats
- [ ] Feature usage: which of the 12 analysis tools are most used
- [ ] Create `/admin` page in React frontend
- [ ] Add ADMIN_API_KEY middleware

---

## PRIORITY: Connect to Master Admin Portal

**Status:** DOWN — returns "Authentication required" when called with x-admin-key
**Portal URL:** https://jms-admin-portal.pages.dev
**This app's Railway URL:** https://canvas-app-production.up.railway.app

### Background

The master portal calls `GET /api/admin/health` with `x-admin-key: <key>` header. QualCanvas has admin routes in `apps/backend/src/routes/adminRoutes.ts` with an `adminAuth` middleware that checks `x-admin-key`. But a global auth middleware is rejecting the request BEFORE `adminAuth` runs.

### Your task — step by step

1. **Open `apps/backend/src/index.ts`**
2. **Find where admin routes are mounted** — look for `app.use('/api/admin', adminRoutes)` (around line 256)
3. **Find any global auth middleware** — look for `app.use(authMiddleware)` or `app.use('/api', auth)` that runs BEFORE the admin mount
4. **Fix: Move the admin route mount BEFORE the global auth**, or add a bypass:

   ```typescript
   // BEFORE any global auth middleware, add:
   app.use('/api/admin', adminRoutes); // Admin routes handle their own auth via x-admin-key

   // Then the existing global auth:
   app.use('/api', authMiddleware); // This now won't affect /api/admin since it's already handled
   ```

5. **Commit and push** — Railway auto-deploys from GitHub

### Environment

- `ADMIN_API_KEY` is already set on Railway (canvas-app-production.up.railway.app)
- The value is in `apps/backend/.env`

### Verification

```bash
curl -H "x-admin-key: $(grep ADMIN_API_KEY apps/backend/.env | cut -d= -f2)" https://canvas-app-production.up.railway.app/api/admin/health
```

Expected: `{"success":true,"data":{"status":"healthy","dbConnected":true,...}}`

---

## URGENT: CI Type Check Failing (Mar 28-29)

CI workflow failing on commit c76c969 — Type Check has 11 errors.

**Action required:**

1. Run `npx tsc --noEmit` locally to see the 11 TypeScript errors
2. Fix all type errors
3. Push to resolve CI

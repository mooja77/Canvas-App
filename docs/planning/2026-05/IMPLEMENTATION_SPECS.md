# QualCanvas — Implementation-Ready Specs

**Date:** 2026-05-13
**Companion to:** V3 master plan, Findings Appendix, Feature Catalogue
**Purpose:** Code-level specs that an engineer can execute against. No more research — just ship instructions.

---

## CONTENTS

1. [3 Prisma cascade fixes (20 minutes)](#prisma)
2. [Voice/copy reconciliation (1 day)](#copy)
3. [DPA + Trust page + audit-read events (3-4 weeks)](#legal)
4. [Krippendorff's α implementation (1-2 weeks)](#kripp)
5. [Pricing restructure (1 day code + experiment plan)](#pricing)
6. [Telemetry events catalogue (1 day)](#telemetry)
7. [85-second onboarding flow (3-4 days)](#onboarding)
8. [VS Code activity bar IA + Cmd+K coverage (5 days)](#ia)
9. [Inline AI tag suggestions on highlight (4 days)](#ai-inline)

---

## EXECUTIVE PRIORITY ORDER

If shipping in sequence:

| #   | Item                      | Effort    | Impact                                              |
| --- | ------------------------- | --------- | --------------------------------------------------- |
| 1   | Prisma cascade fixes      | 20 min    | Prevents data loss (CRITICAL)                       |
| 2   | Voice reconciliation      | 1 day     | Cheap quality signal across the app                 |
| 3   | Telemetry catalogue       | 1 day     | Required to measure everything else                 |
| 4   | Pricing restructure       | 1 day     | +40-60% blended ARPU (biggest single revenue lever) |
| 5   | Krippendorff's α          | 1-2 weeks | Unlocks institutional sales segment                 |
| 6   | DPA + Trust + audit-read  | 3-4 weeks | Unblocks ~70% of EU/enterprise deals                |
| 7   | 85-second onboarding      | 3-4 days  | Activation rate 40%→70%                             |
| 8   | Activity bar + Cmd+K      | 5 days    | Solves 16-feature hidden problem                    |
| 9   | Inline AI tag suggestions | 4 days    | Dovetail's killer feature                           |

**Total to "category-defining product" position: ~6-8 weeks of focused engineering.**

---

<a name="prisma"></a>

## 1. Three Prisma cascade fixes (20 min total)

### 1.1 — `Team.ownerId` missing CASCADE

**File:** `apps/backend/prisma/schema.prisma:694`

```diff
 model Team {
   id        String   @id @default(cuid())
   name      String
   slug      String   @unique
   ownerId   String
   createdAt DateTime @default(now())
   updatedAt DateTime @updatedAt
-  owner     User @relation("TeamOwner", fields: [ownerId], references: [id])
+  owner     User @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: Cascade)
   members   TeamMember[]
 }
```

### 1.2 — `ReportSchedule.teamId` no FK

**File:** `apps/backend/prisma/schema.prisma:616`

```diff
 model ReportSchedule {
   id            String    @id @default(cuid())
   userId        String
   canvasId      String?
-  teamId        String?
+  teamId        String?
   frequency     String    @default("weekly")
   dayOfWeek     Int       @default(1)
   lastSent      DateTime?
   enabled       Boolean   @default(true)
   createdAt     DateTime  @default(now())
   user          User @relation(fields: [userId], references: [id], onDelete: Cascade)
   canvas        CodingCanvas? @relation(fields: [canvasId], references: [id], onDelete: Cascade)
+  team          Team? @relation(fields: [teamId], references: [id], onDelete: Cascade)
 }
```

Also add to `Team`:

```diff
 model Team {
   ...
+  reportSchedules ReportSchedule[]
 }
```

### 1.3 — `TrainingAttempt.userId` no FK

**File:** `apps/backend/prisma/schema.prisma:410`

```diff
 model TrainingAttempt {
   id                 String   @id @default(cuid())
   trainingDocumentId String
-  userId             String
+  userId             String
   codings            String   @default("[]")
   kappaScore         Float
   createdAt          DateTime @default(now())
   document           TrainingDocument @relation(fields: [trainingDocumentId], references: [id], onDelete: Cascade)
+  user               User @relation(fields: [userId], references: [id], onDelete: Cascade)
 }
```

Add to `User`:

```diff
 model User {
   ...
+  trainingAttempts TrainingAttempt[]
 }
```

### Commands

```bash
cd apps/backend
npx prisma migrate dev --name fix_critical_cascades
npm test
git add prisma/
git commit -m "fix(db): add missing CASCADE on Team.ownerId, ReportSchedule.teamId, TrainingAttempt.userId"
```

---

<a name="copy"></a>

## 2. Voice/copy reconciliation (1 day)

### 2.1 — Settle the hero

**Decision:** Use the prerendered HTML voice as canonical. Update React `en.json` to match.

**File:** `apps/frontend/index.html` (already good — keep)
**File:** `apps/frontend/src/i18n/en.json`

```diff
   "landing": {
-    "heroLine1": "Qualitative coding",
-    "heroLine2": "made visual",
-    "heroSubtitle": "Code transcripts, discover patterns, and build theory — all on an infinite, interactive canvas. Built for researchers, by researchers."
+    "heroLine1": "Code transcripts on a visual canvas —",
+    "heroLine2": "not in spreadsheets.",
+    "heroSubtitle": "QualCanvas is a drag-and-drop workspace for coding interviews, spotting patterns across sessions, and building theory you can actually defend. For academics, UX researchers, and qualitative analysts."
   },
```

### 2.2 — Settle `<title>` and OG tags

**File:** `apps/frontend/index.html`

```diff
-  <title>QualCanvas - Qualitative Coding</title>
+  <title>QualCanvas — Visual Coding for Interview Research</title>

-  <meta property="og:title" content="QualCanvas — Qualitative Coding Made Visual" />
+  <meta property="og:title" content="QualCanvas — Visual Coding for Interview Research" />

-  <meta name="description" content="...">
+  <meta name="description" content="Code interview transcripts on a visual canvas. Thematic analysis, IPA, grounded theory. Free tier. .edu discount.">
```

### 2.3 — Pricing CTAs

**File:** `apps/frontend/src/pages/PricingPage.tsx`

```diff
-  "Get Started" (Free CTA)
+  "Start a project"

-  "Upgrade to Pro" (when not logged in)
+  "Try Pro free for 14 days"

-  "Upgrade to Team"
+  "Add your collaborators"

-  "Most Popular" badge
+  "Recommended" or "Best value"
```

### 2.4 — Error message rewrites

**File:** Login error toasts in `apps/frontend/src/pages/LoginPage.tsx`

```diff
-  toast.error('Invalid email or password');
+  toast.error("That email and password don't match. Try again, or reset your password.");
```

**File:** AI banner copy in `apps/frontend/src/components/AiSetupBanner.tsx`

```diff
-  "AI features are part of your plan. Add an OpenAI or Anthropic key to enable code suggestions, auto-coding, and summaries."
+  "Bring your own AI key to turn on coding suggestions and auto-code. We don't proxy or store your key — it goes straight from your browser to OpenAI or Anthropic."
```

### 2.5 — Empty states (5 of them)

See `UX_FINDINGS_APPENDIX.md` section 2 for the full 5 empty-state rewrites. Apply to:

- `apps/frontend/src/components/canvas/panels/CanvasListPanel.tsx:808` (Trash)
- `apps/frontend/src/components/canvas/panels/AiSuggestPanel.tsx` (Suggested codes)
- `apps/frontend/src/components/canvas/panels/CodeNavigator.tsx` (No codes)
- `apps/frontend/src/components/canvas/panels/QuickCodePopover.tsx:352` (In vivo)
- New: Cases panel empty state

### 2.6 — Sentence case sweep

Convert UI labels from Title Case to sentence case:

```
"Most Popular" → "Recommended"
"Maybe Later" → "Maybe later"
"Keep Current Plan" → "Stay on Pro"
"Manage in Account" → "Continue to billing"
"View Plans" → "View plans"
```

Search across `apps/frontend/src/` for the strings and replace.

### Commands

```bash
git add apps/frontend/src/i18n apps/frontend/src/pages apps/frontend/src/components apps/frontend/index.html
git commit -m "copy: reconcile React hero with prerender voice + sentence case sweep"
```

---

<a name="legal"></a>

## 3. DPA + Trust page + audit-read events (3-4 weeks)

### 3.1 — Trust page (`/trust`)

**File:** new `apps/frontend/src/pages/TrustPage.tsx`
**Route:** `/trust` (add to router)

Sections:

1. **At a glance** — uptime %, last incident date, certification status
2. **Hosting & data residency** — Railway US (current), EU region coming Q2 2026
3. **Encryption** — TLS 1.3 in transit, AES-256-GCM at rest (BYOK keys today, transcripts on roadmap)
4. **Authentication** — Email/password, Google OAuth, MFA coming, SAML coming
5. **Sub-processors** — list (table below)
6. **Audit logging** — what's logged, retention (90 days standard)
7. **Compliance status** — In progress: SOC 2 Type I, target Q3 2026
8. **Vulnerability disclosure** — security@qualcanvas.com, response within 48h

Sub-processors table:
| Vendor | Purpose | Location | DPA |
|---|---|---|---|
| Railway | App + DB hosting | US (East) | ✅ signed |
| Cloudflare | CDN + edge + analytics | Global edge, data in US | ✅ signed |
| Stripe | Payments | US | ✅ Stripe BAA-eligible |
| Resend | Transactional email | US | ✅ signed |
| Google | OAuth identity | Global | OAuth only, no data sharing |
| OpenAI/Anthropic | LLM (user's BYO key only) | US | BYO key — direct, no proxy |

### 3.2 — DPA template

**File:** new `apps/frontend/public/dpa.pdf` + signable via DocuSign/PandaDoc link on `/trust`

Use Iubenda or Termly template ($5-10K legal review) — covers GDPR Art. 28, SCCs, sub-processor change notification, breach response.

### 3.3 — Audit-read events

**File:** `apps/backend/src/middleware/auditLog.ts`

Currently logs mutations (POST/PUT/DELETE/PATCH) per HTTP method. Add reads for sensitive resources:

```diff
 function determineAction(method: string, path: string): string {
   if (path.includes('/export')) return 'export';
+  // Read events on PHI-eligible resources (transcripts, codings, memos)
+  const isReadable = /\/canvas\/[^\/]+\/(transcripts|codings|memos)(\/|$)/.test(path);
+  if (method === 'GET' && isReadable) return 'read';
   if (method === 'GET') return null; // don't log all reads
   if (method === 'DELETE') return 'delete';
   if (method === 'POST') return 'write';
   if (method === 'PUT' || method === 'PATCH') return 'update';
   return null;
 }
```

Add new endpoint: `GET /api/v1/canvas/:id/audit` returns audit trail for a canvas (used by user-facing "who accessed this" report).

### 3.4 — Update Privacy Policy

**File:** `apps/frontend/src/pages/PrivacyPage.tsx`

Add sections:

- Lawful basis (legitimate interest for academic research, contract for paid customers)
- Data subject rights (access, deletion, portability, rectification, objection)
- Sub-processors (link to /trust)
- Data retention per data category
- International transfers + SCCs
- DPO/EU rep contact (if appointed; if not, GDPR Art. 27 representative)

### Commands

```bash
git add apps/frontend/src/pages/TrustPage.tsx apps/frontend/src/pages/PrivacyPage.tsx apps/frontend/public/dpa.pdf apps/backend/src/middleware/auditLog.ts
git commit -m "compliance: add trust page, DPA template, audit-read events, GDPR-grade privacy policy"
```

**Cost:** ~$5-10K legal review for DPA template; ~2 weeks eng for the rest.

---

<a name="kripp"></a>

## 4. Krippendorff's α implementation (1-2 weeks)

**Why:** Healthcare and policy researchers will reject Cohen's κ. Atlas.ti publicly says it's the wrong choice.

**File:** `apps/backend/src/utils/intercoder.ts`

Add `computeKrippendorffAlpha` alongside existing `computeCohenKappa`:

```typescript
/**
 * Krippendorff's alpha — agnostic to number of coders, handles missing data,
 * works for nominal/ordinal/interval/ratio measurement scales.
 *
 * Reference: Krippendorff (2018) Content Analysis ch. 12.
 *
 * For nominal data (the qualitative coding case):
 *   α = 1 - (D_o / D_e)
 *   where D_o = observed disagreement, D_e = expected disagreement by chance
 */
export function computeKrippendorffAlpha(
  codings: Array<{ unitId: string; coderId: string; value: string }>,
  scale: 'nominal' | 'ordinal' | 'interval' = 'nominal',
): { alpha: number; n_units: number; n_coders: number; agreementMatrix: number[][] } {
  // Build coincidence matrix (rows = units, cols = coders → value)
  const unitMap = new Map<string, Map<string, string>>(); // unitId → (coderId → value)
  const allValues = new Set<string>();
  const allCoders = new Set<string>();

  for (const c of codings) {
    if (!unitMap.has(c.unitId)) unitMap.set(c.unitId, new Map());
    unitMap.get(c.unitId)!.set(c.coderId, c.value);
    allValues.add(c.value);
    allCoders.add(c.coderId);
  }

  const values = Array.from(allValues);
  const valueIndex = new Map(values.map((v, i) => [v, i]));
  const n_values = values.length;

  // Coincidence matrix: o[v1][v2] = count of times v1 and v2 co-occur within a unit
  const o: number[][] = Array.from({ length: n_values }, () => new Array(n_values).fill(0));
  const n_per_value: number[] = new Array(n_values).fill(0);

  for (const [, coderValues] of unitMap) {
    const vals = Array.from(coderValues.values());
    const m_u = vals.length;
    if (m_u < 2) continue; // need at least 2 coders per unit
    for (let i = 0; i < vals.length; i++) {
      for (let j = 0; j < vals.length; j++) {
        if (i === j) continue;
        const vi = valueIndex.get(vals[i])!;
        const vj = valueIndex.get(vals[j])!;
        o[vi][vj] += 1 / (m_u - 1);
        n_per_value[vi] += 1 / (m_u - 1);
      }
    }
  }

  const n_total = n_per_value.reduce((a, b) => a + b, 0);

  // Disagreement metric (nominal: 1 if different, 0 if same)
  const metric = (v1: number, v2: number) => (v1 === v2 ? 0 : 1);

  // Observed disagreement
  let D_o = 0;
  for (let i = 0; i < n_values; i++) {
    for (let j = 0; j < n_values; j++) {
      D_o += o[i][j] * metric(i, j);
    }
  }
  D_o /= n_total;

  // Expected disagreement
  let D_e = 0;
  for (let i = 0; i < n_values; i++) {
    for (let j = 0; j < n_values; j++) {
      D_e += (n_per_value[i] * n_per_value[j]) / (n_total * (n_total - 1)) * metric(i, j);
    }
  }

  const alpha = D_e === 0 ? 1 : 1 - D_o / D_e;

  return {
    alpha,
    n_units: unitMap.size,
    n_coders: allCoders.size,
    agreementMatrix: o,
  };
}

/**
 * Fleiss' kappa for 3+ coders (Krippendorff α is preferred, but some methods papers ask for Fleiss)
 */
export function computeFleissKappa(/* ... */): { kappa: number; ... } {
  // Implementation per Fleiss (1971)
  // ...
}
```

### 4.1 — Update intercoder route

**File:** `apps/backend/src/routes/codingRoutes.ts` (the existing Kappa endpoint)

```diff
 export async function computeReliability(req, res) {
   const { canvasId, transcriptId } = req.params;
+  const { method = 'kappa' } = req.query;  // kappa | alpha | fleiss
   const codings = await prisma.canvasTextCoding.findMany({ ... });

-  const result = computeCohenKappa(codingsA, codingsB, segments);
+  let result;
+  if (method === 'alpha') {
+    result = computeKrippendorffAlpha(formatForKrippendorff(codings));
+  } else if (method === 'fleiss') {
+    result = computeFleissKappa(formatForFleiss(codings));
+  } else {
+    result = computeCohenKappa(codingsA, codingsB, segments);
+  }
   res.json({ success: true, data: result });
 }
```

### 4.2 — UI: add alpha option to intercoder modal

**File:** `apps/frontend/src/components/canvas/panels/IntercoderReliabilityModal.tsx`

Add a dropdown: "Method: Cohen's κ (2 coders) / Krippendorff's α (any coders) / Fleiss' κ (3+ coders)" with sensible default = α.

Show methodological note: "Krippendorff's α is the recommended choice for >2 coders or missing data (Krippendorff 2018; ATLAS.ti research hub)."

### 4.3 — Tests

**File:** `apps/backend/src/utils/intercoder.test.ts`

Add tests with known-result datasets from Krippendorff (2018) ch. 12 examples. Verify α matches the published values to 4 decimal places.

### Commands

```bash
git add apps/backend/src/utils/intercoder.ts apps/backend/src/routes/codingRoutes.ts apps/frontend/src/components/canvas/panels/IntercoderReliabilityModal.tsx apps/backend/src/utils/intercoder.test.ts
git commit -m "feat(intercoder): add Krippendorff's α and Fleiss' κ alongside Cohen's κ"
```

---

<a name="pricing"></a>

## 5. Pricing restructure (1 day code + Stripe config)

### 5.1 — New tier structure

| Tier                     | Price                      | Annual (20% off) | Positioning                                        |
| ------------------------ | -------------------------- | ---------------- | -------------------------------------------------- |
| Free                     | $0                         | —                | "Start free. Upgrade when your dissertation does." |
| **Pro**                  | **$17/mo**                 | $14/mo ($168/yr) | "For working researchers"                          |
| **Researcher Pro** (NEW) | **$39/mo**                 | $32/mo           | "Unlimited AI + Krippendorff α + advanced exports" |
| **Team**                 | **$49/seat/mo**            | $39/seat         | "Multi-user with intercoder reliability"           |
| Education                | -30% on Pro/Researcher Pro | —                | "Verified .edu, automatic via SheerID"             |

### 5.2 — Free tier expansion

Update `apps/backend/src/config/plans.ts`:

```diff
   free: {
-    maxCanvases: 1,
+    maxCanvases: 2,                              // dissertation needs 2+
-    maxTranscriptsPerCanvas: 2,
+    maxTranscriptsPerCanvas: 5,                  // 1 dissertation chapter worth
-    maxWordsPerTranscript: 5000,
+    maxWordsPerTranscript: 10000,
-    maxCodes: 5,
+    maxCodes: 10,
     autoCodeEnabled: false,
-    allowedAnalysisTypes: ['stats', 'wordcloud'],
+    allowedAnalysisTypes: ['stats', 'wordcloud', 'sentiment', 'search'],  // 4 of 10
     // ... rest unchanged
+    aiTrialCreditsPerDay: 10,  // NEW: 10 free AI calls/day for first 7 days
+    aiTrialDurationDays: 7,
   },
```

### 5.3 — Researcher Pro tier

```typescript
  researcherPro: {
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 100000,  // 2x Pro
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [/* all 10 */, 'krippendorff_alpha'],  // exclusive
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx', 'docx'],
    maxShares: 10,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: true,  // Krippendorff α exclusive (was Team-only)
    aiEnabled: true,
    aiRequestsPerDay: 100,  // generous AI for paying researcher
    aiAdvancedRequestsPerDay: 30,  // Sonnet 4 "Deep Analysis" credits
    fileUploadEnabled: true,
    maxStorageMb: 2000,
    transcriptionMinutesPerMonth: 180,
    maxCollaborators: 5,
    repositoryEnabled: true,
    integrationsEnabled: true,
  },
```

### 5.4 — Stripe products

Create 4 new Stripe Price IDs (monthly + annual × 2 new tiers). Set in Cloudflare Pages GHA secrets:

```
VITE_STRIPE_PRO_MONTHLY_PRICE_ID (existing — update to $17 product)
VITE_STRIPE_PRO_ANNUAL_PRICE_ID (existing — update to $168/yr product)
VITE_STRIPE_RESEARCHER_PRO_MONTHLY_PRICE_ID (NEW)
VITE_STRIPE_RESEARCHER_PRO_ANNUAL_PRICE_ID (NEW)
VITE_STRIPE_TEAM_MONTHLY_PRICE_ID (existing — update to $49 product)
VITE_STRIPE_TEAM_ANNUAL_PRICE_ID (existing — update to $39×12 product)
```

### 5.5 — Grandfather existing $12 Pro users

Add a `User.legacyPricing` boolean. Set to `true` for everyone with `Subscription.createdAt` before the price change. Stripe subscription continues at $12 indefinitely.

### 5.6 — Default annual toggle

**File:** `apps/frontend/src/pages/PricingPage.tsx`

```diff
-  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
+  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
```

### 5.7 — Annual discount

Change from 25% to 20% (more standard, less margin pressure):

- Pro: $17/mo, $14/mo annual ($168/yr) = 18% off
- Researcher Pro: $39/mo, $32/mo annual = 18% off
- Team: $49/seat, $39/seat annual = 20% off

### 5.8 — Pricing experiments to run (Q2)

| #   | Experiment                                  | Method                  | Target                | Duration         |
| --- | ------------------------------------------- | ----------------------- | --------------------- | ---------------- |
| 1   | Pro $12 → $17 (new signups only)            | A/B on new signup IP    | Net new Pro MRR       | 30 days, n=3000  |
| 2   | Default annual toggle to "annual"           | A/B on toggle state     | % annual on new paid  | 14 days, n=1500  |
| 3   | Expand free tier (1→2 canvases, 5→10 codes) | Geo split               | New paid acquisitions | 30 days, n=10000 |
| 4   | Researcher Pro $39 introduction             | Sequential before/after | Tier mix + AI GM      | 60 days, n=1000  |
| 5   | .edu discount 40% → 30% (SheerID verified)  | Sequential              | Academic ARPU         | 60 days, n=800   |

**Expected net result:** Blended new-paid ARPU $14 → $19-22 (+40-60%), AI GM stabilizes at 78-82%, EU/EDU funnel preserves volume.

### Commands

```bash
git add apps/backend/src/config/plans.ts apps/frontend/src/pages/PricingPage.tsx apps/backend/src/middleware/planLimits.ts
git commit -m "feat(billing): introduce Researcher Pro tier, raise Pro to $17, default annual toggle, expand free tier"
```

Then in Stripe dashboard:

1. Create 6 new Price objects
2. Update GHA secrets
3. Verify checkout flow on test card
4. Document rollback (price IDs as env vars = trivial rollback)

---

<a name="telemetry"></a>

## 6. Telemetry events catalogue (1 day)

### 6.1 — Add 8 missing events

**File:** `apps/frontend/src/utils/analytics.ts` extended

```typescript
export type AnalyticsEvent =
  | 'login'
  | 'sign_up'
  | 'pricing_viewed'
  // — NEW —
  | 'first_transcript_uploaded'
  | 'first_code_added'
  | 'first_ai_use'
  | 'first_excerpt_coded'
  | 'first_export'
  | 'upgrade_flow_initiated'
  | 'checkout_completed'
  | 'trial_activated'
  | 'trial_expired'
  | 'plan_limit_hit'
  | 'subscription_canceled'
  | 'team_member_invited'
  | 'team_member_joined'
  | 'ai_moment_triggered'
  | 'canvas_shared';

export function trackEvent(eventName: AnalyticsEvent, params?: Record<string, unknown>) {
  window.gtag?.('event', eventName, params);
  // Also forward to JMS:
  fetch('/api/v1/events/track', {
    method: 'POST',
    body: JSON.stringify({ event: eventName, params }),
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {
    /* best effort */
  });
}
```

### 6.2 — Wire backend equivalents

**File:** `apps/backend/src/lib/jms-events.ts` already exists; add:

```typescript
// On POST /canvas/:id/transcripts (first one)
const count = await prisma.canvasTranscript.count({ where: { userId } });
if (count === 1) {
  trackJmsEvent('first_transcript_uploaded', { userId, canvasId, wordCount });
}

// On POST /canvas/:id/questions (first one)
// Same pattern: count === 1 → trackJmsEvent('first_code_added')

// On any AI route (first call)
// Same pattern with prisma.aiUsage.count

// On Stripe webhook checkout.session.completed
// trackJmsEvent('checkout_completed', { plan, amount, billingCycle })

// On 403 plan-limit-exceeded
// trackJmsEvent('plan_limit_hit', { limit, current, max, userId, plan })
```

### 6.3 — Sentry error context

**File:** `apps/frontend/src/main.tsx`

```diff
 Sentry.init({
   dsn: import.meta.env.VITE_SENTRY_DSN,
   sendDefaultPii: false,
+  beforeSend(event, hint) {
+    // Attach user + canvas context if available
+    const { user, activeCanvasId } = useAuthStore.getState();
+    event.user = { id: user?.id, plan: user?.plan };
+    event.tags = { ...event.tags, canvasId: activeCanvasId };
+    return event;
+  },
 });
```

### 6.4 — Backend cost calculation

**File:** `apps/backend/src/routes/aiRoutes.ts` (every endpoint where AI is called)

```typescript
const pricing = {
  'gpt-4o-mini': { in: 0.15, out: 0.60 },         // per MTok
  'claude-sonnet-4-20250514': { in: 3, out: 15 },
  // ... etc
};

await prisma.aiUsage.create({
  data: {
    userId,
    canvasId,
    feature,
    provider,
    model,
    inputTokens,
    outputTokens,
-    costCents: 0,
+    costCents: Math.round(
+      ((inputTokens * pricing[model].in) + (outputTokens * pricing[model].out))
+      / 1_000_000 * 100
+    ),
  },
});
```

### 6.5 — Dashboard widget: AI spend

**File:** new `apps/frontend/src/components/AccountAiSpendWidget.tsx`

Shows: monthly spend, cost by feature, cost by canvas, comparison to plan limit.

### Commands

```bash
git add apps/frontend/src/utils/analytics.ts apps/backend/src/lib/jms-events.ts apps/backend/src/routes/aiRoutes.ts apps/frontend/src/main.tsx apps/frontend/src/components/AccountAiSpendWidget.tsx
git commit -m "feat(telemetry): add 15-event catalogue, AI cost calculation, Sentry user context"
```

---

<a name="onboarding"></a>

## 7. 85-second onboarding flow (3-4 days)

See `UX_FINDINGS_APPENDIX.md` section 5 for the full 5-screen spec. Implementation outline:

### 7.1 — Schema

```diff
 model User {
   ...
+  onboardingState  String?   @default("{}")  // JSON: { step, completedAt, dismissedTooltips }
+  onboardingCompletedAt DateTime?
 }
```

### 7.2 — Component tree

```
src/components/onboarding/
  OnboardingFlow.tsx          // top-level conditional render
  PersonalizationModal.tsx    // Screen 1
  TemplateGallery.tsx         // Screen 2
  TranscriptIngest.tsx        // Screen 3
  AiCodeReview.tsx            // Screen 4 (AI suggestions panel)
  FirstCodeCelebration.tsx    // Screen 5 (confetti + toast)
  OnboardingChecklist.tsx     // Persistent bottom-right
  JustInTimeTooltip.tsx       // 4 tooltips fire on first hover
```

### 7.3 — Template gallery seeds

Create 5 templates in `apps/backend/prisma/seed.ts`:

```typescript
const templates = [
  { name: 'Thematic Analysis (Braun & Clarke)', method: 'interviews', codes: [...], sampleTranscript: '...' },
  { name: 'Grounded Theory', method: 'interviews', codes: [...], sampleTranscript: '...' },
  { name: 'UXR Pain-Points', method: 'interviews', codes: ['Pain Point', 'Goal', 'Quote', 'Surprise', 'Question'] },
  { name: 'Support-Ticket Mining', method: 'open_ended_survey', codes: [...] },
  { name: 'NPS Theme Extraction', method: 'open_ended_survey', codes: [...] },
];
```

Use new `CanvasTemplate` model from V3 schema.

### 7.4 — Telemetry events

- `onboarding_started` (Screen 1 first view)
- `onboarding_step_completed` (each screen → next)
- `onboarding_skipped` (Skip link clicked)
- `first_excerpt_coded` (Screen 5 success)
- `onboarding_completed_seconds` (total elapsed time)

### 7.5 — Move existing 22-step tour

```bash
git mv apps/frontend/src/components/canvas/panels/OnboardingTour.tsx apps/frontend/src/components/help/FullProductTour.tsx
```

Surface via Help menu (`?` shortcut → "Take the full product tour"). Don't auto-fire.

### Commands

```bash
git add apps/frontend/src/components/onboarding apps/frontend/src/components/help apps/backend/prisma/seed.ts apps/backend/prisma/schema.prisma
git commit -m "feat(onboarding): 85-second flow with templates, AI pre-coding, replaces 22-step tour"
```

---

<a name="ia"></a>

## 8. VS Code activity bar IA + Cmd+K coverage (5 days)

See `UX_ENHANCEMENT_PLAN_V3.md` Sprint A for full spec. Component outline:

### 8.1 — Components

```
src/components/canvas/
  ActivityBar.tsx              // Left rail, 48px, 8 icons
  Sidebar.tsx                  // 240px, swaps per activity
  Inspector.tsx                // 280px right, contextual
  CanvasTabBar.tsx             // (exists, repurpose)
  panels/
    CanvasesPanel.tsx          // Recent / Pinned / All / Shared
    CodebookPanel.tsx          // Code list + hierarchy
    CasesPanel.tsx             // Cases list
    AnalysisPanel.tsx          // 10 tools + history
    AiPanel.tsx                // AI sessions + history
    SharedPanel.tsx            // Team / collaborators
    QualityPanel.tsx           // Kappa / Weights / Ethics
    SchedulePanel.tsx          // Research Calendar
```

### 8.2 — Cmd+K coverage fix

**File:** `apps/frontend/src/stores/shortcutStore.ts`

Add every action that was previously only in dropdowns. Reference list:

```typescript
const actions = [
  // Existing
  { id: 'add_code', label: 'Add new code', shortcut: 'Cmd+Shift+C', category: 'Create' },
  { id: 'add_memo', label: 'Add memo', shortcut: 'M', category: 'Create' },
  // ... add 16 missing:
  { id: 'open_codebook', label: 'Open codebook', category: 'View' },
  { id: 'open_cases', label: 'View cases', category: 'View' },
  { id: 'cross_case_analysis', label: 'Cross-case analysis', category: 'Analyze' },
  { id: 'view_hierarchy', label: 'View code hierarchy', category: 'View' },
  { id: 'compute_kappa', label: 'Compute intercoder reliability', category: 'Quality' },
  { id: 'view_weights', label: 'View code weights', category: 'View' },
  { id: 'toggle_coding_stripes', label: 'Toggle coding stripes', category: 'View' },
  { id: 'open_dashboard', label: 'Open dashboard', category: 'View' },
  { id: 'view_ethics', label: 'Ethics panel', category: 'Quality' },
  { id: 'view_excerpts', label: 'View excerpts', category: 'View' },
  { id: 'open_research_calendar', label: 'Research calendar', category: 'View' },
  { id: 'auto_code', label: 'Run auto-code', category: 'AI' },
  { id: 'ai_chat', label: 'Open AI chat', shortcut: 'Cmd+J', category: 'AI' },
  { id: 'summarize', label: 'Summarize canvas', category: 'AI' },
  // ... etc
];
```

### 8.3 — Mobile responsive

```typescript
// Below 768px: ActivityBar slides off-screen, hamburger triggers it
// Below 480px: Inspector collapses entirely; bottom command bar (4 icons)
```

### Commands

```bash
git add apps/frontend/src/components/canvas/ActivityBar.tsx apps/frontend/src/components/canvas/Sidebar.tsx apps/frontend/src/stores/shortcutStore.ts /* etc */
git commit -m "feat(canvas): VS Code activity bar IA, complete Cmd+K coverage, mobile responsive"
```

---

<a name="ai-inline"></a>

## 9. Inline AI tag suggestions on highlight (4 days)

### 9.1 — Component

**File:** new `apps/frontend/src/components/transcript/InlineCodeSuggester.tsx`

Triggers on text selection inside a TranscriptNode (or expanded transcript view).

```typescript
export function InlineCodeSuggester({ transcriptId, selection }: Props) {
  // Selection: { text, startOffset, endOffset }
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selection?.text || selection.text.length < 5) return;
    setLoading(true);
    suggestCodes({
      transcriptId,
      excerpt: selection.text,
      contextBefore: ..., contextAfter: ...,
      existingCodes: useCanvasQuestions.getState().codes,
    }).then(setSuggestions).finally(() => setLoading(false));
  }, [selection]);

  return (
    <FloatingPopover anchor={selection.rect}>
      {loading ? <Spinner /> : suggestions.map(s => (
        <SuggestionRow key={s.id}>
          <CodeChip color={s.color} />
          <span>{s.label}</span>
          <ConfidenceBar value={s.confidence} />
          <button onClick={() => applyCode(s)}>Apply</button>
        </SuggestionRow>
      ))}
      <input placeholder="Or create new code..." />
    </FloatingPopover>
  );
}
```

### 9.2 — Backend endpoint

`POST /api/v1/canvas/:id/ai/suggest-codes-inline` — uses existing `/suggest-codes` but adds:

- Stream response (token by token) via SSE
- Confidence scores 0-1 (already in schema)
- Caching by transcript hash + selection hash (1h TTL)

### 9.3 — Two-phase tray integration

After accept, add to existing `AiSuggestion` table with `status='accepted'`. Suggestion tray badge increments by 1 (or could opt-into instant-apply on inline accept).

### 9.4 — Telemetry

- `inline_ai_triggered` (text selected, suggestion popover opens)
- `inline_ai_accepted` (user clicked Apply)
- `inline_ai_rejected` (popover dismissed without accept)
- `inline_ai_new_code` (user created new code from suggestion)

### Commands

```bash
git add apps/frontend/src/components/transcript apps/backend/src/routes/aiRoutes.ts
git commit -m "feat(ai): inline code suggestions on text highlight (Dovetail-style)"
```

---

## CLOSING

This document specifies **everything needed to ship the V3 plan**. Each section is independently executable. Recommended order:

**Week 1:** §1 (Prisma fixes) + §2 (voice reconciliation) + §6 (telemetry)
**Week 2:** §5 (pricing restructure) + Stripe config
**Weeks 3-4:** §4 (Krippendorff α) + §3 (DPA + Trust page)
**Weeks 5-6:** §7 (onboarding)
**Weeks 7-8:** §8 (activity bar IA) + §9 (inline AI)

**Total: 8 weeks of focused engineering** to ship V3.

The research phase is complete. ~52,000 words of documentation across 5 plan files + this implementation spec. Subsequent value comes from shipping code, not from more analysis.

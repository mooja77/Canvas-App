# Sprint C — Pricing Restructure

## Goal

Capture +40-60% blended ARPU by raising Pro to $17, introducing a new "Researcher Pro" tier at $39, raising Team to $49, defaulting to annual, expanding free tier, and grandfathering existing users.

## Scope

- Update `plans.ts` with 4 tier definitions (Free + Pro + Researcher Pro + Team)
- Create 6 new Stripe Price objects (3 tiers × monthly + annual)
- Update GHA secrets with new Price IDs
- Default annual toggle on PricingPage
- Grandfather all existing $12 Pro subscribers via `legacyPricing` flag
- Drop academic discount from 40% → 30%
- Expand free tier (2 canvases, 10K words, 4 analyses, 10 AI trial credits/day × 7 days)
- Define 5 A/B experiments with hypotheses + sample sizes

## Out of scope

- AI metering implementation (Sprint H pre-requisite)
- New checkout UI flows
- Refunds for any users who hit the new pricing

## File-level changes

### 1. Plans config

**`C:\JM Programs\QualCanvas\apps\backend\src\config\plans.ts`**

```typescript
export type PlanTier = 'free' | 'pro' | 'researcherPro' | 'team';

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxCanvases: 2, // was 1
    maxTranscriptsPerCanvas: 5, // was 2
    maxWordsPerTranscript: 10000, // was 5000
    maxCodes: 10, // was 5
    autoCodeEnabled: false,
    allowedAnalysisTypes: ['stats', 'wordcloud', 'sentiment', 'search'], // was 2, now 4
    allowedExportFormats: ['csv'],
    maxShares: 0,
    ethicsEnabled: false,
    casesEnabled: false,
    intercoderEnabled: false,
    aiEnabled: false,
    aiRequestsPerDay: 0,
    aiTrialCreditsPerDay: 10, // NEW
    aiTrialDurationDays: 7, // NEW
    fileUploadEnabled: false,
    maxStorageMb: 0,
    transcriptionMinutesPerMonth: 0,
    maxCollaborators: 0,
    repositoryEnabled: false,
    integrationsEnabled: false,
  },
  pro: {
    // raised tier — old subscribers grandfathered via User.legacyPricing
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search',
      'cooccurrence',
      'matrix',
      'stats',
      'comparison',
      'wordcloud',
      'cluster',
      'codingquery',
      'sentiment',
      'treemap',
      'documentportrait',
      'timeline',
      'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx'],
    maxShares: 5,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: false, // NEW: moved to researcherPro
    aiEnabled: true,
    aiRequestsPerDay: 30, // was 1000; now metered
    aiAdvancedRequestsPerDay: 0, // Sonnet 4 gated to researcherPro
    fileUploadEnabled: true,
    maxStorageMb: 500,
    transcriptionMinutesPerMonth: 60,
    maxCollaborators: 3,
    repositoryEnabled: true,
    integrationsEnabled: false,
  },
  researcherPro: {
    // NEW TIER
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 100000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [, /* all 10 */ 'krippendorff_alpha', 'fleiss_kappa'],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx', 'docx'],
    maxShares: 10,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: true, // exclusive to researcherPro + team
    aiEnabled: true,
    aiRequestsPerDay: 100,
    aiAdvancedRequestsPerDay: 30, // Sonnet 4 "Deep Analysis"
    fileUploadEnabled: true,
    maxStorageMb: 2000,
    transcriptionMinutesPerMonth: 180,
    maxCollaborators: 5,
    repositoryEnabled: true,
    integrationsEnabled: true,
  },
  team: {
    // raised from $29 to $49/seat
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      /* all 10 + α + Fleiss */
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'qdpx', 'docx'],
    maxShares: Infinity,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: true,
    aiEnabled: true,
    aiRequestsPerDay: 200, // higher than researcherPro
    aiAdvancedRequestsPerDay: 50,
    fileUploadEnabled: true,
    maxStorageMb: 5000,
    transcriptionMinutesPerMonth: 300,
    maxCollaborators: Infinity,
    repositoryEnabled: true,
    integrationsEnabled: true, // exclusive to team
  },
};
```

### 2. User model grandfather flag

**`C:\JM Programs\QualCanvas\apps\backend\prisma\schema.prisma`**

```diff
 model User {
   ...
+  legacyPricing Boolean @default(false)
   ...
 }
```

Migration:

```bash
npx prisma migrate dev --name add_legacy_pricing
```

Backfill all existing pre-launch users:

```typescript
// apps/backend/src/scripts/backfill-legacy-pricing.ts
const launchDate = new Date('2026-05-13');
await prisma.user.updateMany({
  where: { createdAt: { lt: launchDate } },
  data: { legacyPricing: true },
});
```

### 3. Auth middleware: apply legacy pricing

**`C:\JM Programs\QualCanvas\apps\backend\src\middleware\auth.ts`** (after fetching user):

```diff
 const trialActive = user.plan === 'free' && user.trialEndsAt && user.trialEndsAt.getTime() > Date.now();
 const effectivePlan = trialActive ? 'pro' : user.plan;
+
+// Legacy pricing: existing $12 Pro users keep their tier with original limits
+// They will not see Researcher Pro upsell unless they explicitly cancel and re-subscribe
+req.legacyPricing = user.legacyPricing;
 req.userPlan = effectivePlan;
```

### 4. Stripe Price IDs

Create 6 new Price objects in Stripe Dashboard:

| Tier           | Cadence | Amount                | Stripe Price ID env var                               |
| -------------- | ------- | --------------------- | ----------------------------------------------------- |
| Pro            | Monthly | $17                   | `VITE_STRIPE_PRO_MONTHLY_PRICE_ID` (replace existing) |
| Pro            | Annual  | $168/yr ($14/mo)      | `VITE_STRIPE_PRO_ANNUAL_PRICE_ID` (replace)           |
| Researcher Pro | Monthly | $39                   | `VITE_STRIPE_RESEARCHER_PRO_MONTHLY_PRICE_ID` (NEW)   |
| Researcher Pro | Annual  | $384/yr ($32/mo)      | `VITE_STRIPE_RESEARCHER_PRO_ANNUAL_PRICE_ID` (NEW)    |
| Team           | Monthly | $49/seat              | `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID` (replace)         |
| Team           | Annual  | $468/seat/yr ($39/mo) | `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID` (replace)          |

Set via:

```bash
gh secret set VITE_STRIPE_RESEARCHER_PRO_MONTHLY_PRICE_ID --body "price_xxx"
gh secret set VITE_STRIPE_RESEARCHER_PRO_ANNUAL_PRICE_ID --body "price_xxx"
# Update existing 4:
gh secret set VITE_STRIPE_PRO_MONTHLY_PRICE_ID --body "price_new_17"
# ... etc
```

Update `.github/workflows/deploy-frontend.yml`:

```diff
       - run: npm run build --workspace=apps/frontend
         env:
           VITE_STRIPE_PRO_MONTHLY_PRICE_ID: ${{ secrets.VITE_STRIPE_PRO_MONTHLY_PRICE_ID }}
           VITE_STRIPE_PRO_ANNUAL_PRICE_ID: ${{ secrets.VITE_STRIPE_PRO_ANNUAL_PRICE_ID }}
+          VITE_STRIPE_RESEARCHER_PRO_MONTHLY_PRICE_ID: ${{ secrets.VITE_STRIPE_RESEARCHER_PRO_MONTHLY_PRICE_ID }}
+          VITE_STRIPE_RESEARCHER_PRO_ANNUAL_PRICE_ID: ${{ secrets.VITE_STRIPE_RESEARCHER_PRO_ANNUAL_PRICE_ID }}
           VITE_STRIPE_TEAM_MONTHLY_PRICE_ID: ${{ secrets.VITE_STRIPE_TEAM_MONTHLY_PRICE_ID }}
           VITE_STRIPE_TEAM_ANNUAL_PRICE_ID: ${{ secrets.VITE_STRIPE_TEAM_ANNUAL_PRICE_ID }}
```

### 5. PricingPage default annual

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\PricingPage.tsx`**

```diff
-  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
+  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
```

Add the new Researcher Pro card between Pro and Team.

### 6. Academic discount

**`C:\JM Programs\QualCanvas\apps\backend\src\config\plans.ts`** (or wherever the coupon is configured):

```diff
 STRIPE_ACADEMIC_COUPON_ID=pwJLjyYa  // existing 40% off
+STRIPE_ACADEMIC_COUPON_ID=<new 30% off coupon>
```

Create new 30% off coupon in Stripe Dashboard, swap the env var on next deploy.

## A/B experiments

| #   | Hypothesis                                                                 | Method                               | Sample                     | Duration |
| --- | -------------------------------------------------------------------------- | ------------------------------------ | -------------------------- | -------- |
| 1   | Pro $12 → $17 holds conversion above 85% baseline                          | A/B on new signups (IP-based, 60/40) | 3,000 new signups          | 30 days  |
| 2   | Default annual lifts annual share from 20% → 45%                           | Toggle default state A/B             | 1,500 new paid conversions | 14 days  |
| 3   | Expanded free tier (2 canvases, 10K words) increases activated-paid by 25% | Geo split test                       | 10,000 signups             | 30 days  |
| 4   | Researcher Pro tier captures 15-25% of new paid                            | Sequential before/after launch       | 1,000 new paid conversions | 60 days  |
| 5   | Academic discount 40% → 30% holds uptake above 35%                         | Sequential                           | 800 academic signups       | 60 days  |

## Tests

- E2E: PricingPage renders 4 tiers with correct prices
- E2E: Annual toggle default = "annual" on first load
- Backend: User created before launch date has `legacyPricing = true`
- Backend: Legacy Pro user keeps $12 access (`req.legacyPricing` honored in middleware)
- Stripe webhook: new tier IDs land in checkout flow correctly

## Acceptance criteria

- [ ] All 4 tiers visible on `/pricing`
- [ ] 6 new Stripe Price IDs configured
- [ ] GHA secrets updated, frontend bundle has new Price IDs
- [ ] Annual toggle default = "annual"
- [ ] Existing $12 Pro users continue billing at $12 (verify in Stripe Dashboard)
- [ ] Academic coupon swapped to 30%
- [ ] 5 A/B experiments configured (use GrowthBook or similar) with hypotheses + targets

## Rollback

- Revert `plans.ts` change
- Old Stripe Price IDs still exist; swap secrets back
- New users on Researcher Pro keep their subscription (don't churn them)
- Migration `add_legacy_pricing` is non-destructive — leave it

## Telemetry

Track via events from Sprint B:

- `pricing_viewed` (with `current_tier`, `default_billing`, `legacy_pricing`)
- `upgrade_flow_initiated` (with `source_page`, `plan_selected`, `billing_cycle`)
- `checkout_completed` (with `plan`, `amount`, `billing_cycle`)

## Effort

**1 day code + 1 day Stripe config + experiment setup.**

## Owner

TBD

## Commit message

```
feat(billing): introduce Researcher Pro tier, raise Pro to $17, default annual, expand free tier

- Pro: $12 → $17/mo ($14 annual), existing subs grandfathered
- New Researcher Pro: $39/mo with intercoder reliability, Sonnet credits, advanced exports
- Team: $29 → $49/seat ($39 annual)
- Free: 1→2 canvases, 5→10K words, 5→10 codes, 2→4 analyses, +10 AI trial credits/day × 7 days
- Default billing toggle: monthly → annual
- Academic discount: 40% → 30%
- Migration: 0020_add_legacy_pricing
- Backfill: all pre-2026-05-13 users marked legacyPricing=true

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

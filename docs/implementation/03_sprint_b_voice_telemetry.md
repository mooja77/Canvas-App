# Sprint B — Voice Reconciliation + Telemetry Events

## Goal

Settle the brand voice on the (better) prerender hero copy across the React app + add 15 missing telemetry events for measuring everything that follows.

## Scope

- Reconcile React `en.json` hero with prerendered HTML
- Update `<title>`, OG, Twitter Card tags to match
- Rewrite 5 error messages, 5 empty states, 5 toast notifications
- Sentence case sweep on UI labels
- Add 15 telemetry events (frontend + backend + JMS forwarding)
- Wire AI cost calculation (populates `AiUsage.costCents`)
- Add Sentry user/canvas context

## Out of scope

- Brand color/font changes (Sprint 13)
- Visual identity rollout
- Marketing page redesign

## File-level changes

### 1. Hero copy reconciliation

**`C:\JM Programs\QualCanvas\apps\frontend\src\i18n\en.json`**

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

### 2. Title + OG + meta tags

**`C:\JM Programs\QualCanvas\apps\frontend\index.html`**

```diff
-  <title>QualCanvas - Qualitative Coding</title>
+  <title>QualCanvas — Visual Coding for Interview Research</title>

-  <meta name="description" content="Code transcripts, discover patterns, and build theory — all on an infinite, interactive canvas. Built for researchers, by researchers.">
+  <meta name="description" content="Code interview transcripts on a visual canvas. Thematic analysis, IPA, grounded theory. Free tier. .edu discount.">

-  <meta property="og:title" content="QualCanvas — Qualitative Coding Made Visual" />
+  <meta property="og:title" content="QualCanvas — Visual Coding for Interview Research" />

-  <meta name="twitter:title" content="QualCanvas — Qualitative Coding Made Visual" />
+  <meta name="twitter:title" content="QualCanvas — Visual Coding for Interview Research" />
```

### 3. Pricing CTAs

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\PricingPage.tsx`**

```diff
-  "Get Started"          (Free CTA)        →  "Start a project"
-  "Upgrade to Pro"       (anonymous)       →  "Try Pro free for 14 days"
-  "Upgrade to Team"                        →  "Add your collaborators"
-  "Most Popular" badge                     →  "Recommended"
-  "Keep Current Plan"    (downgrade)       →  "Stay on Pro"
-  "Manage in Account"                      →  "Continue to billing"
-  "View Plans"                             →  "View plans"
-  "Maybe Later"                            →  "Maybe later"
```

### 4. Error messages (5 rewrites)

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\LoginPage.tsx`** (line ~166)

```diff
-  toast.error(err.response?.data?.error || 'Invalid email or password');
+  toast.error(err.response?.data?.error || "That email and password don't match. Try again, or reset your password.");
```

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\AiSetupBanner.tsx`**

```diff
-  "AI features are part of your plan. Add an OpenAI or Anthropic key to enable code suggestions, auto-coding, and summaries."
+  "Bring your own AI key to turn on coding suggestions and auto-code. We don't proxy or store your key — it goes straight from your browser to OpenAI or Anthropic."
```

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\UpgradePrompt.tsx`**

```diff
-  "Plan Limit Reached"
-  + raw API error message
+  Title: "You've hit your Free plan limit"
+  Body: "Free includes 1 canvas, 5 codes, and 2 transcripts per canvas. You're at the ceiling on canvases. Pro lifts every limit and unlocks 10 analysis tools."
+  CTA: "See Pro plans" / "Not yet"
```

**Cross-transcript coding** (find via grep for "different transcript"):

```diff
-  "Selection is from a different transcript"
+  "That quote is from another transcript. Open that transcript first, then drag onto the question."
```

**Export error** (find via grep for "Export failed"):

```diff
-  "Export failed — try zooming to fit first"
+  "Couldn't render the export. Zoom to fit (press F) and try again. Still stuck? File an issue and we'll look within a day."
```

### 5. Empty states (5 rewrites)

| File                       | Before                             | After                                                                                                                                             |
| -------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CanvasListPanel.tsx:808`  | "Trash is empty"                   | "Nothing in the bin. Deleted canvases live here for 30 days before they're gone for good."                                                        |
| `AiSuggestPanel.tsx`       | "Suggested codes will appear here" | "Code 3-5 quotes yourself, then run AI suggestions from the transcript menu. We learn your style from what you've already coded."                 |
| `CodeNavigator.tsx`        | "No codes yet"                     | "Highlight a passage in the transcript to create your first code. Or press Cmd+K and type 'code'."                                                |
| `QuickCodePopover.tsx:352` | "No codes yet. Use 'In Vivo'..."   | "No codes yet. Type a code name above, or hit 'In Vivo' to use the highlighted text verbatim — useful when the participant's words are the code." |
| New (Cases panel)          | (currently empty)                  | "Cases group transcripts by participant, site, or timepoint. Drop a transcript into a case to start comparing patterns across them."              |

### 6. Toast notifications (5 rewrites)

| Toast            | Before                                         | After                                                                                                               |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Question added   | "Question added"                               | Two-line toast with action: "Question added" + "Open it →" (deep-links to new node, selected)                       |
| Stats node added | "Statistics node added"                        | "Stats computed: 4 codes across 2 transcripts. Open →"                                                              |
| Saved            | "Saved"                                        | Remove the toast entirely. Use status-bar tick: "Saved 2s ago".                                                     |
| Group created    | "Group created — double-click title to rename" | Keep. Apply pattern to: "Coding created — drag onto a memo to write a reflection" / "Code merged — undo with Cmd+Z" |
| Bookmark saved   | "Bookmark 3 saved"                             | "Bookmark 3 saved — jump back with Ctrl+3"                                                                          |

### 7. Sentence case sweep

Grep across `apps/frontend/src/` for Title-Case strings on buttons/labels and convert to sentence case:

- "Most Popular" → "Recommended"
- "Maybe Later" → "Maybe later"
- "Keep Current Plan" → "Stay on Pro"
- "Manage in Account" → "Continue to billing"
- "View Plans" → "View plans"
- "Sign In" / "Sign Up" → keep (proper nouns / brand convention)

## Telemetry events to add

**Extend `C:\JM Programs\QualCanvas\apps\frontend\src\utils\analytics.ts`:**

```typescript
export type AnalyticsEvent =
  // Existing (3)
  | 'login'
  | 'sign_up'
  | 'pricing_viewed'
  // NEW (15)
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
  // Frontend GTM
  window.gtag?.('event', eventName, params);
  // Also POST to /api/v1/events/track for JMS forwarding
  fetch('/api/v1/events/track', {
    method: 'POST',
    body: JSON.stringify({ event: eventName, params }),
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  }).catch(() => {
    /* best effort */
  });
}
```

**Wire backend events in `C:\JM Programs\QualCanvas\apps\backend\src\lib\jms-events.ts`:**

```typescript
// New endpoint: POST /api/v1/events/track (creates the event for JMS forwarding)
// Backend-only events (no frontend equivalent):
//   - checkout_completed (Stripe webhook handler)
//   - plan_limit_hit (planLimits middleware on 403)
//   - subscription_canceled (Stripe webhook)
//   - trial_expired (cron job)

// In planLimits middleware, on 403 plan-limit-exceeded:
trackJmsEvent('plan_limit_hit', { userId, plan, limit, current, max });

// In stripeWebhook on checkout.session.completed:
trackJmsEvent('checkout_completed', { userId, plan, amount, billingCycle });

// In canvas/transcript create (first one only):
const count = await prisma.canvasTranscript.count({ where: { userId } });
if (count === 1) {
  trackJmsEvent('first_transcript_uploaded', { userId, canvasId, wordCount });
}

// Same pattern for first_code_added, first_ai_use
```

## AI cost calculation

**`C:\JM Programs\QualCanvas\apps\backend\src\routes\aiRoutes.ts`** (every AI endpoint):

```typescript
const MODEL_PRICING = {
  'gpt-4o-mini': { in: 0.15, out: 0.6 }, // per MTok USD
  'gpt-4o': { in: 2.5, out: 10.0 },
  'claude-sonnet-4-20250514': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5-20251001': { in: 0.8, out: 4.0 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
};

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = MODEL_PRICING[model];
  if (!p) return 0;
  return Math.round(((inputTokens * p.in + outputTokens * p.out) / 1_000_000) * 100);
}

// Replace `costCents: 0` in every AiUsage.create call:
await prisma.aiUsage.create({
  data: {
    userId,
    canvasId,
    feature,
    provider,
    model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(model, inputTokens, outputTokens),
  },
});
```

## Sentry user/canvas context

**`C:\JM Programs\QualCanvas\apps\frontend\src\main.tsx`:**

```diff
 Sentry.init({
   dsn: import.meta.env.VITE_SENTRY_DSN,
   sendDefaultPii: false,
+  beforeSend(event) {
+    const { user, activeCanvasId } = useAuthStore.getState();
+    if (user) event.user = { id: user.id, plan: user.plan };
+    if (activeCanvasId) event.tags = { ...event.tags, canvasId: activeCanvasId };
+    return event;
+  },
 });
```

## Tests

- Smoke test: visit landing, verify new hero copy renders
- E2E: bad login attempt → assert new error toast text
- E2E: empty trash view → assert new empty-state text
- Backend: `costCents` is non-zero after AI call
- Backend: `trackJmsEvent('first_code_added')` fires exactly once per user

## Acceptance criteria

- [ ] All hero/title/meta tag changes shipped
- [ ] 5 error messages, 5 empty states, 5 toasts rewritten
- [ ] Sentence case sweep complete (grep'd, all caught)
- [ ] 15 new telemetry events firing (verified in network panel)
- [ ] AI cost calculation: query `AiUsage` shows non-zero costCents
- [ ] Sentry test event includes user.id and tags.canvasId
- [ ] Backend `/api/v1/events/track` endpoint created and CORS-OK
- [ ] All tests passing

## Rollback

Trivial — revert the commit. No DB changes.

## Effort

**2 days.** Voice changes (4hr) + telemetry wiring (1 day) + AI cost calc (3hr) + tests (3hr).

## Owner

TBD

## Commit messages

Two commits recommended:

```
copy: reconcile React hero with prerender voice + sentence case sweep
feat(telemetry): add 15 events + AI cost calculation + Sentry user context
```

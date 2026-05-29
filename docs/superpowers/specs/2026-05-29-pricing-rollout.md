# Pricing Model Rollout Runbook (4-tier + metered transcription)

**Date:** 2026-05-29
**Status:** Code foundation landed (this PR). Live cutover is BLOCKED on Stripe price objects — see "Owner: YOU" steps.
**Rule of thumb:** nothing in this rollout changes what an _existing_ paying user is charged. New prices apply only to _new_ checkouts. Grandfathering is automatic (Stripe subs keep their original price).

---

## The agreed model

| Tier              | Price                                                            | Who                     | Headline entitlements                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Free**          | $0                                                               | Trial / light use       | 2 canvases, 5 transcripts, 10K words, 10 codes, 4 analyses, CSV. **No AI.** No transcription.                                                             |
| **Student**       | **$5/mo** ($48/yr), verified `.edu`                              | Solo academics          | Near-Pro: AI + auto-code, all 13 analyses, QDPX export, ethics/cases. Capped: 5 canvases, no collaborators, no ICR. **5 hrs/mo transcription** + BYO-key. |
| **Pro**           | **$15/mo** ($144/yr ≈ $12/mo) — grandfather existing at $12      | Independent researchers | Unlimited canvases/codes, all analyses, QDPX, ethics/cases, 5 shares, 3 collaborators. **10 hrs/mo transcription** + BYO-key unlimited.                   |
| **Team**          | **$39/seat/mo** ($384/yr ≈ $32/mo) — grandfather existing at $29 | Labs / orgs             | Pro + ICR (Kappa), unlimited shares + collaborators, integrations. **50 hrs/mo pooled transcription**.                                                    |
| **Institutional** | custom ~$3–8k/yr                                                 | Campuses                | Sales-led. _Later — not in this rollout._                                                                                                                 |

**Differentiator:** unlimited _text_-AI on all paid tiers (cheap models, fair-use ceiling via `aiRequestsPerDay`). **Transcription is the only metered cost** (Whisper ≈ $0.36/hr; mini ≈ $0.18/hr). Overage = $0.50/hr or BYO-key (free). Annual ≈ 2 months free. Existing `.edu` 40% coupon stays on Pro.

---

## What already shipped (this PR — safe, zero live impact)

- `apps/backend/src/config/plans.ts`:
  - `PlanTier` union now includes `'student'`.
  - New `student` entitlement block (Pro-like, capped: 5 canvases, no collaborators, no ICR, 5 hrs transcription).
  - Pro transcription 60 → **600 min** (10 hrs); Team 300 → **3000 min** (50 hrs). _(Generous-to-existing bump; `transcriptionMinutesPerMonth` has no enforcement consumer yet, so this is declarative only.)_
- `getPlanLimits('student')` resolves correctly (was falling back to `free`).
- Backend `create-checkout` already accepts an arbitrary `plan` string and stores it in `session.metadata.plan`; the webhook writes it to `user.plan`. **So `student` works end-to-end on the backend with no further code change** — it only needs a Stripe price ID + the pricing page to offer it.
- Test: `planEnforcement.test.ts` asserts the student entitlements.

**Nothing user-facing changed.** The pricing page still shows current tiers/prices. No one can land on `student` until the steps below are done.

---

## Step 1 — Stripe dashboard (Owner: YOU — I cannot create price objects)

In the **same** Stripe account that holds the existing Pro/Team prices (Test mode first, then Live):

1. **Create Products + recurring Prices** (do NOT edit or archive existing prices — that would change current subscribers):
   - Student — **$5/mo** and **$48/yr**
   - Pro — **$15/mo** and **$144/yr** _(new; existing Pro subs keep their old $12/$120 price automatically)_
   - Team — **$39/seat/mo** and **$384/yr** _(new; existing Team subs keep $29 automatically)_
2. Copy each new **price ID** (`price_...`).
3. **Academic coupon caution:** backend auto-applies `STRIPE_ACADEMIC_COUPON_ID` (40% off) to **any** `.edu` checkout (`billingRoutes.ts:43`). If a `.edu` student also gets the coupon, $5 → $3. **Decision needed:** either (a) make the Student price itself the all-in academic price and gate the coupon to `plan !== 'student'`, or (b) accept the stacked discount. The code change for (a) is a one-line guard — tell me which and I'll PR it.
4. Confirm the **webhook endpoint** (`/api/v1/billing/webhook`) and `STRIPE_WEBHOOK_SECRET` already cover `checkout.session.completed` + subscription updates (they do today — no change).

➡️ **Hand me the new price IDs.** Everything after this I can do.

---

## Step 2 — Env vars / GHA secrets (Owner: me, once I have the IDs)

Frontend reads price IDs from `VITE_*` build-time vars baked on the GHA runner (see `vite_build_env_gha`). Add/update as repo **secrets**:

| Secret                                 | Value                       |
| -------------------------------------- | --------------------------- |
| `VITE_STRIPE_STUDENT_MONTHLY_PRICE_ID` | new                         |
| `VITE_STRIPE_STUDENT_ANNUAL_PRICE_ID`  | new                         |
| `VITE_STRIPE_PRO_MONTHLY_PRICE_ID`     | **update** → new $15 price  |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID`      | **update** → new $144 price |
| `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID`    | **update** → new $39 price  |
| `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID`     | **update** → new $384 price |

> Updating the Pro/Team vars only changes what **new** checkouts buy — existing subscriptions are untouched.

---

## Step 3 — Code (Owner: me — separate, reviewed PR, deployed only after Steps 1–2)

1. `PricingPage.tsx` (`TierCardV2`): add a **Student** card; update displayed Pro $12→$15 and Team $29→$39; replace the stale hardcoded `$17.95` string; wire `VITE_STRIPE_STUDENT_*`; checkout for the student card passes `plan: 'student'`.
2. **`.edu` verification gate** for the Student card: the Student "Start" CTA is enabled only when the signed-in account's email ends in `.edu` (and is verified). Non-`.edu` users see "Requires a verified .edu email." _(Lightweight — reuses existing email-verification state. A heavier SheerID-style check is a later option.)_
3. Academic-coupon guard from Step 1.3 if option (a) is chosen.
4. `AccountPage` plan labels: render `student` as "Student".
5. Optionally gate the whole new pricing layout behind the existing `pricing_v2` feature flag so it can be flipped on atomically after verification.

---

## Step 4 — Grandfathering (automatic — verify, don't migrate)

- Existing Pro/Team subscribers: **no action.** Their Stripe subscription keeps its original `stripePriceId` and amount. They are not re-checked out.
- The `legacyPricing` flag on `User` (migration 0020) already grandfathers legacy access-code users to Pro entitlements — unchanged.
- **Do NOT** archive or modify the old price objects; that's what protects current subscribers.

---

## Step 5 — Deploy sequence

1. Stripe **Test mode** prices → set secrets to test IDs → deploy → run a full test-mode checkout for each tier (incl. `.edu` student) → confirm `user.plan` lands correctly via webhook.
2. Create **Live mode** prices → swap secrets to live IDs.
3. Deploy the pricing-page PR (or flip `pricing_v2`).
4. Smoke test on prod: new Pro checkout shows $15; existing Pro user's `/account` still shows their old price; Student CTA gated to `.edu`.

## Rollback

- Pricing page is a normal revert / flag-off — no data impact.
- Env-var revert restores old checkout prices instantly on next deploy.
- No subscriber data is mutated at any point, so there is nothing to un-migrate.

---

## Open decisions for YOU

1. **Academic coupon × Student** — option (a) gate coupon off student, or (b) allow stacked $3 effective? _(Recommend (a).)_
2. **Annual Pro grandfather** — existing annual Pro stays at old price automatically; confirm you don't want to proactively raise them.
3. **`pricing_v2` flag** — atomic flag flip, or just ship the new page directly once secrets are set?

Once you give me the price IDs + answers to (1) and (3), I'll do Steps 2–3 as a single reviewed PR and run the test-mode checkout before anything goes live.

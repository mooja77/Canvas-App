# Hosted-AI Tier — Design Spec (decision required)

**Date:** 2026-05-30
**Status:** Spec / proposal. **Not implemented** — enabling this spends real money on every paid user's AI calls, so it needs your explicit go-ahead + a spend ceiling.
**Parent:** Wave B of the world-class plan. Sibling to the eval harness (measure before scale) and the trust layer.

## Why

AI in QualCanvas is currently **BYO-key only** — confirmed: there is no server `OPENAI_API_KEY` on Railway, and `getDefaultProvider()` returns nothing, so every AI feature (auto-code, inline suggestions, chat, summarize, methods statement) requires the user to paste their own OpenAI key in settings. That's fine for technical users but a hard wall for the exact audience we just priced for — non-technical academics and students. Most will never create an API key, so they get a paid plan whose headline "AI you can trust" they can't actually use.

A **hosted-AI tier** provides the key server-side: paid users get AI with zero setup, and we cover the (small) text-AI cost, recouped by the subscription.

## What already exists (so this is mostly config + controls, not a build)

- **Server-key fallback**: `getDefaultProvider()` / `registerProvider('openai', …)` already wire a server key when `OPENAI_API_KEY` is set (`lib/llm-openai.ts`). Routes already fall back to it when the user has no BYO key.
- **Per-user rate limit**: `checkAiAccess()` enforces `aiRequestsPerDay` from `plans.ts` (Free 0, Student/Pro/Team 1000) against `AiUsage` counts.
- **Cost tracking**: every AI call writes an `AiUsage` row with `costCents` (`calculateCostCents`), grouped in the disclosure endpoint — so spend is already observable per user/canvas/model.
- **Transcription metering** (#99): the genuinely metered cost is already capped per plan + BYO-bypassed.

So the missing pieces are **(a)** a server key, **(b)** cost guardrails beyond the per-user daily count, and **(c)** the pricing decision.

## Unit economics (why this is affordable)

- Text models are cheap: `gpt-4o-mini` ≈ $0.15 / $0.60 per 1M input/output tokens. A typical auto-code run on one transcript ≈ $0.003–0.02. Inline suggestions / chat are smaller.
- The agreed pricing model already says **unlimited text-AI on paid tiers, fair-use via `aiRequestsPerDay`**, with **transcription** as the one metered cost. Hosted text-AI fits that: include it; don't meter per-call.
- Realistic worst case per heavy user/month: a few hundred auto-code runs ≈ low single-digit dollars — comfortably under a $5–39 subscription. The risk is _abuse/runaway_, not normal use → that's what the guardrails below cover.

## Proposed design

1. **Server key + model**: set `OPENAI_API_KEY` on Railway; default hosted model `gpt-4o-mini` (cheap, JSON-mode capable, good enough for coding suggestions — and the eval harness lets us verify/upgrade later). BYO key still takes precedence (and bypasses our cost).
2. **Gate**: a `hosted_ai` plan entitlement (default on for Student/Pro/Team, off for Free) so hosted AI is a paid benefit; Free stays BYO-only or no-AI. Reuse `aiEnabled`.
3. **Guardrails (the important part):**
   - Keep `aiRequestsPerDay` (already enforced). Consider lowering the initial hosted ceiling (e.g. 100/day) until real usage is observed.
   - **Global daily spend circuit-breaker**: a cheap check that sums `AiUsage.costCents` for the day across all users; if it exceeds a configured ceiling (e.g. `$X/day`), hosted calls return a soft "AI temporarily paused" and fall back to asking for a BYO key. Protects against a billing surprise.
   - **Per-user monthly soft cap** on hosted spend (BYO bypasses), mirroring transcription metering, so one user can't burn the pool.
   - Monitoring: Sentry alert + a simple daily spend log from `AiUsage`.
4. **Abuse**: the per-user daily + monthly caps + the global breaker bound exposure. Optionally require email verification before hosted AI.

## Rollout (measure, then widen)

1. Ship the guardrails (circuit-breaker + monthly soft cap) **behind a `hosted_ai` feature flag, off**. No spend.
2. Set the server key; flip the flag for a small cohort (or just yourself) with a **low** ceiling; watch `AiUsage` cost for a week.
3. Raise the daily/monthly ceilings to the real distribution; enable for all paid tiers.
4. Keep the eval harness in the loop: if we later swap/upgrade the hosted model, `npm run eval:ai --live` gates the change on measured quality.

## Decisions needed from you

1. **Go / no-go** on hosting AI at all (vs staying BYO-only).
2. **Spend ceiling** — the global daily $ cap for the circuit-breaker, and the per-user monthly soft cap.
3. **Model** — default `gpt-4o-mini`, or a stronger model (cost ↑, quality measurable via the eval harness).
4. **Tiers** — include hosted AI in Student+Pro+Team (recommended, matches the pricing model), or only Pro+Team.

## Out of scope here

Fine-tuning / a QualCanvas-tuned model; multi-provider hosted routing; usage-based AI add-on pricing. All trackable later once the eval harness gives us a quality/cost baseline.

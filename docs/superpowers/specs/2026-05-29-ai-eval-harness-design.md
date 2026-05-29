# AI Suggestion Eval Harness — Design

**Date:** 2026-05-29
**Status:** Spec. Phase 1 (scoring core) implemented; Phase 2/3 follow.
**Parent:** Wave B of `2026-05-29-qualcanvas-world-class-master-plan.md`. The plan's #2 bet: _eval harness → hosted tier → trust layer, in that order._ This is the eval harness.

## Why

We claim "AI you can trust" as the #1 differentiator. The red-team critique was blunt: a trust UI (accept/reject queue, confidence) over **40–50%-accurate** suggestions is lipstick (that's the Dovetail failure). So before we invest in the trust-layer UX, we must **measure** how good our AI coding suggestions actually are — and keep measuring as we change prompts/models. The eval harness is the instrument; it _gates_ the trust layer and any move to a hosted/fine-tuned model.

## What we measure

Target: the **auto-code-transcript** path (`aiRoutes.ts` → `buildAutoCodePrompt` → LLM), where the model chooses _what_ to code and _where_ (span) given a transcript + codebook. (The interactive `suggest-codes` path is span-fixed by the user, so it's a lighter eval later.)

Given a gold-coded transcript (expert codings) + its codebook, run the AI, then compare predicted codings to gold:

- A predicted coding **matches** a gold coding iff **same code** (normalized) AND **span overlap ≥ threshold** (IoU over character ranges; default 0.5). Exact-offset match is too strict for qual — researchers care that roughly the right passage got roughly the right code.
- Greedy 1:1 assignment (each gold/prediction matched at most once), highest-overlap first.
- **Precision** = matched / predicted; **Recall** = matched / gold; **F1** = harmonic mean. Plus per-code breakdown (where is the model strong/weak?).

## Components

1. **Scoring core** — `apps/backend/src/eval/evalMetrics.ts` (+ `.test.ts`). PURE: `scoreCodings(predicted, gold, opts)` → `{ precision, recall, f1, tp, fp, fn, perCode, matched }`. No LLM, no DB, no dataset — fully unit-testable. **(Phase 1 — this PR.)**
2. **Gold fixtures** — `apps/backend/src/eval/fixtures/*.json`: `{ transcript, codebook, goldCodings }`. Start with 1–3 short, hand-curated transcripts (e.g., derived from the seed canvas + manual review). Quality of the gold set bounds the eval's meaning, so curate deliberately and document provenance. **(Phase 2.)**
3. **Runner** — `apps/backend/src/eval/runAiEval.ts` (a script, `npm run eval:ai`): for each fixture, reuse the _real_ `buildAutoCodePrompt` + an LLM provider (key from env), parse predicted codings, call `scoreCodings`, aggregate, print a table + write a JSON report under `eval-reports/`. Needs an API key → run manually / on a schedule, **not** a PR gate (cost + secrets). Supports a `--dry-run` reading recorded model outputs so the pipeline is testable without a live key. **(Phase 2.)**
4. **Baseline + regression** — record a baseline F1 per fixture; the runner flags regressions vs baseline. Later: wire into a manual/cron job so prompt/model changes are measured. **(Phase 3.)**

## Decisions

- **IoU-based span match, threshold 0.5, code-name normalized (trim+lowercase).** Tunable via opts; report at multiple thresholds later.
- **Greedy highest-overlap 1:1 matching** (not Hungarian) — simple, deterministic, adequate at this scale.
- **Scoring core has zero deps** so it's trivially testable and reusable (also powers a future in-product "AI vs me" agreement view).
- The runner is **dev/research tooling**, not user-facing and not a CI gate.

## Out of scope (here)

Trust-layer UX (provenance/confidence/accept-reject — next, gated on this); hosted-tier model selection; fine-tuning; multilingual eval (track separately per plan).

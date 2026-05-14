# 6.15 `/trust/ai`

← [Pages index](README.md) · [Plan index](../README.md)

Page body in [04 §4.7 `/trust/ai`](../04-brand-design-system.md). Three Q&A sections plus links to each model provider's data-use policy and our internal AI handling diagram. Linked prominently from `/for-institutions` admin-feature grid and from the landing FAQ.

## Positioning

Every researcher and every IRB officer in 2026 asks the same first question about an AI feature: _"Are my participants' transcripts being used to train a model?"_ See [01 §1.5](../01-strategic-positioning.md) for the full positioning frame.

## Architecture promise

- Inference calls go direct from the user's account to the provider (OpenAI / Anthropic / Google) — QualCanvas never proxies.
- No transcript content retained beyond session.
- Model providers contractually exclude API traffic from training; we link to each provider's policy on this page.

## Risk note

This page makes specific architectural claims. Any architecture change that affects them must trigger a review of this page. See [10](../10-risks-and-rollback.md) R14.

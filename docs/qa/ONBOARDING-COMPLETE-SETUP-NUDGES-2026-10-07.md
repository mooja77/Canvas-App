# QualCanvas: progress-aware help through all five setup steps

Local candidate on base `a4adcaf8`. No production flags changed or customer messages sent. This is not full onboarding certification.

## Defect and correction

Previously all timed setup messages stopped at the first own coded excerpt. The remaining guide steps (two different codes, analysis and CSV export) received no progress-aware help. Behind the existing default-OFF `LIFECYCLE_SETUP_SEQUENCE_ENABLED` flag, day-1/day-3/day-7 messages now use durable server-observed milestones, reread progress before claiming delivery and suppress completed/unknown progress. Sample transcripts do not satisfy own-transcript setup. Welcome and each unfinished-step template offer plain-English written help, imports/workflow adjustments/feature requests, a two-business-day reply and a participant-data privacy warning; no call is required.

Legacy flag-OFF behaviour, preferences, event keys, bounded cohort windows, provider guards and delivery idempotency remain unchanged. The existing production legacy automation baseline is not turned off or on by this change. The new sequence remains a separate business activation decision.

## Evidence

- TDD baseline: 12 failed / seven passed. Intermediate failures and welcome-template regression retained in the coordination receipt.
- Affected behavioural tests: 66 passed across three files (44 new complete-setup tests, original nine scheduler and 13 template tests).
- Full backend: 1,406 passed / 19 skipped; 100 passing files / four skipped; 183.14 seconds. Skips are not passing proof.
- Root TypeScript and strict changed-source lint passed; backend production build (Prisma generation and TypeScript) passed.
- `verify-lifecycle-setup-local.mjs` refuses everything except the exact owned local PostgreSQL database/role before importing application code. It removes provider/delivery variables, disables automation/sending and forbids fetch. Actual Prisma persistence and locked server observations select the correct next template through all five steps, then completion. Sample exclusion, zero email deliveries and exact fictional-fixture cleanup passed. First invocation failed because PostgreSQL was starting; readiness was confirmed before the successful retry. This proof seeds fictional progress and is not a browser-operation or actual-delivery test.
- Existing full onboarding E2E remains unchanged. A fresh replay on this candidate is still required before its PR/release evidence can claim it.

## Score and first value

Conservative inherited lower-bound score remains 21/28 before and after; this scoped improvement is not a fresh evidence-linked fourteen-item audit. First value remains saving the first own coded excerpt. The preceding analysis candidate measured nine pointer clicks plus one selection drag, seven fields, 4.488 seconds signup-to-value / 5.259 seconds homepage-to-value. Those are automated local observations, not new measurements of this candidate or human-user timings. Fresh candidate replay, exact-head CI and independent deployment proof remain required.

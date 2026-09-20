# Onboarding and customer-success rollout — 2026-09-21

## Focused gap matrix

| Standard area    | Kept                                                                                   | Gap closed                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Beginner path    | Two-screen setup and five-item in-canvas checklist                                     | Back navigation; skip is a durable, resumable dismissal rather than completion; Help can resume setup and checklist                           |
| First value      | Real canvas, transcript and coding workflow                                            | Durable first value now requires a saved non-sample coding on a non-sample transcript; evidence stores IDs and time, never research text      |
| Help             | Current guide, product tour and 18-video library                                       | Search across video titles/outcomes/categories; written-guide fallback; async project-transfer, workflow-tailoring and feature-request routes |
| Safe examples    | Template samples and tutorials already use fictional data                              | Sample content cannot earn first value; support copy says never email participant data, raw transcripts or identifiable research material     |
| Lifecycle        | Preferences, unsubscribe, unique delivery ledger, retries and signed provider outcomes | Future cohorts only; legacy accounts have no cohort and no backlog; durable first value stops activation mail                                 |
| Customer success | Provider-backed at-most-once delivery foundation                                       | QualCanvas-only existing/former classification, objective fixture/suppression exclusions, exact-template internal canary and fixed event keys |
| Release gates    | Explicit send/automation brakes, verified recipient, sender/provider/webhook checks    | Removed artificial recipient allowlist and approval ladder while retaining operational and security gates                                     |

## First-value contract

First value is `first_real_coding`: a user saves a coding whose coding source and transcript source are not `sample`. `User.firstValueAt`, `firstValueCanvasId` and a JSON evidence record containing only canvas/coding/transcript identifiers and time are written atomically with the coding. This also sets `onboardingCompletedAt`. Opening, creating, importing or viewing a canvas alone does not qualify.

## Async data boundary

The public training centre accepts written requests at `research@qualcanvas.com` for import-route advice, workflow tailoring and feature requests. Users are told to send only formats, field names and synthetic examples by email. Research files belong in authenticated in-app QDPX, CSV or transcript import. No support-attachment capability is claimed.

## Video verification

On 2026-09-21 all 18 configured YouTube IDs were checked individually: each was public, non-live, matched its configured title/duration, and exposed manually uploaded `en-IE` captions. The existing user guide supplies the written workflow equivalent, so no replacement video was needed.

## Outreach classification and genuine manual gate

- Existing: verified real account with a current active/trialing subscription, or a free account with durable first value.
- Former: verified real account with a canceled subscription whose paid period has ended.
- Excluded: internal/fixture/test addresses for customer sends, invalid addresses, ambiguous/past-due/canceled-but-current accounts, missing required consent, unsubscribe, provider suppression, any permanent bounce/complaint/suppression failure, and any prior fixed event key.
- Canary: a verified, opted-in internal account receives the exact customer template with a separate fixed canary event key.
- Former offer: two free months are not applied by the email. The person must reply to accept, return on a paid plan, and have that return verified before the credit is manually applied.

Commands are read-only unless explicitly run with `canary` or `send`:

```bash
npm run lifecycle:outreach -w apps/backend -- audit
npm run lifecycle:outreach -w apps/backend -- canary existing
npm run lifecycle:outreach -w apps/backend -- send existing
npm run lifecycle:outreach -w apps/backend -- outcomes
```

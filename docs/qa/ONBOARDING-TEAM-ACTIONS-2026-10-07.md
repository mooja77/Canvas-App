# Team action recovery and genuine pointer onboarding evidence

Base: `7aca19c8c8fa5afea945d75c3da9917059059afd` (PR #230).
Scope: Team-page add/remove/delete acknowledgements, subsequent authoritative
reads, current-actor permissions, usable controls and email-first help. Existing
backend authorization, membership, billing-seat confirmation and email delivery
remain unchanged. No customer records, invitations, emails, credentials or
production settings were changed during local verification.

## Defects and corrections

- The role fallback selected the owner instead of the current actor. It now
  selects the authenticated actor's membership, with a conservative member
  fallback and a matching-team summary role.
- Member writes published unvalidated detail responses. All acknowledged writes
  now reload the validated list/detail view. A wrong-team detail is rejected.
- A failed post-write read could suggest repeating an already-completed write.
  Persistent recovery explains the known or uncertain outcome; Retry only GETs.
- A fulfilled request without `success: true` could announce success. Create,
  add, remove and delete now require an affirmative acknowledgement; missing or
  negative acknowledgements retain an uncertain-outcome notice.
- Shared synchronous locking and disabled controls prevent duplicate writes;
  stale/unmounted reads cannot replace newer state. StrictMode is covered.
- Deletion used to invent an empty account. Reload now retains remaining teams.
- Addition said an invitation was sent although email is best-effort. It now
  states only that the member was added, without promising email delivery.
- Removal has a named 44px target. Setup help offers email-based setup/data/workflow
  help, a two-working-day response and a guide link, with no call required.

## Local evidence

TDD: first six regressions failed against the inherited implementation; the
initial correction passed 23 tests. Stale-read and uncertain-outcome tests took
the focused suite to 27. Four negative-acknowledgement regressions then failed
before the acknowledgement guard. Final full frontend suite: **1,065 passed**
across 119 files, including all 31 Team-page tests. Expected mocked ErrorBoundary
and jsdom/navigation warnings remain; that is not silent-browser proof.

Backend: **1,362 passed / 19 skipped**. Existing opt-in database skips are not
claimed as exercised. Local typecheck, lint, formatting, shared/backend/frontend
builds and bundle budgets pass. The existing large PDF chunk warning remains.

The committed `e2e/team-action-recovery.spec.ts` covers add/remove/delete/member
role at 1280/820/390px, held writes, guarded read-only recovery, retained other
teams, named controls, keyboard operation, no overflow, scoped WCAG-tagged axe,
zero page errors and zero unexpected writes. It intercepts every API request;
it does not send a real invitation, exercise a payment or prove native screen
reader output. The existing read/create recovery suite is retained. Linux CI
also runs these fixtures in the existing critical cross-browser job; no new job.

Final production-build browser replay: **42/42 passed (1.7 minutes)** in local
Chrome and Playwright WebKit, retries zero, with the final acknowledgement
guards. Artifact directory: `test-results/team-actions-final-20261007/`. The
390px WebKit ordinary-member screenshot was inspected: readable help/member
details, no owner controls or horizontal overflow. Playwright WebKit is not
native Safari/VoiceOver certification. Previous failed/earlier-run artifacts
were preserved rather than overwritten.

## First-value measurement correction

The saved onboarding E2E and activation harness previously injected a DOM range
and synthetic mouseup. `scripts/select-excerpt-by-pointer.mjs` now uses actual
browser mouse down/move/up and checks the exact selected text. DOM evaluation
only reads character rectangles; it never injects a selection or input event.

Fresh saved homepage-to-first-coding journey:

- **9 pointer clicks + 1 selection gesture = 10 actions; 7 fields**.
- **7.363 seconds** from submitting signup; **8.535 seconds** from homepage entry.
- Full saved journey **1 passed (21.1s)**; its browser test took 18.3s.
- Real isolated local API/Postgres, no card/verification gate; sample template,
  own transcript, first coding, authoritative progress, phone/tablet return,
  help, dismiss/resume, one-click sample deletion and actual CSV contents checked.
- Account created by this passing test was deleted through its normal endpoint.
- Additional setup-step observations at the end use real authorized local API
  operations, not a full UI journey for those two later steps.

Artifacts: `test-results/onboarding-team-pointer-seeded-20261007/`.
The initial fresh DB had migrations but no onboarding templates, so the first
run timed out waiting for Thematic Analysis. That failed trace is preserved in
`test-results/onboarding-team-pointer-20261007/`. The owned launcher now seeds
the existing templates only into its guarded local DB, with demo access unset;
no matcher, assertion or timeout was weakened. The failed run's fixture account
remains only in the disposable local DB; do not call that run cleaned up.

Separate real-pointer blank-canvas activation proof:
`test-results/activation-team-pointer-20261007/report.json` records first coding
13.9s, CSV 21.0s, actual 488-byte CSV, all five persisted steps and account cleanup 200. It starts on registration, not the homepage, and does not measure click
counts. Blocked external analytics console/network events remain documented.
All timings are automated local-driver timings, not human usability figures or
real Google-provider verification. Earlier simulated-selection timings are not
comparable proof of pointer interaction.

## Dependency gate

The fresh production dependency gate found critical `proxy-addr` and high
`compression` advisories. Narrow floors now resolve to `proxy-addr` 2.0.8 and
`compression` 1.8.2. A real worktree-local `npm ci` was run; no shared node_modules
links. `npm audit --omit=dev --audit-level=high` passes, with **five moderate**
production findings still present. The whole development inventory is not
vulnerability-free. No forced breaking dependency upgrades or bypasses.

## Completion boundary

Historical programme before-score: 14/28. Conservative current score remains
**21/28**, not a fresh 24/28 or all-MUST certificate. This bounded correction
improves item 12 evidence but does not prove every route/role/reinstall case,
real Google sign-in, native assistive technology or complete media inventory.
The full 15-app objective remains open. Release requires exact-head green CI,
normal deployment and independent served-code/live proof; local passing tests
alone do not establish production completion.

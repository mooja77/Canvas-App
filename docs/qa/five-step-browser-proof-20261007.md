# Complete five-step browser proof — 7 October 2026

## Scope and evidence

Base: `origin/main` at `aeac4f864ed7d2eae4ca18a457f9315e9a76b1c8`.
Owned worktree: `qualcanvas-onboarding-sota`; local ports 4750–4759.

The saved onboarding test now completes the second code and Statistics analysis
through the real interface instead of POST shortcuts. It observes actual 201/200
responses, checks that merely creating an analysis does not complete the step,
verifies saved counts, and reloads to confirm all five server observations persist.
Original sample removal, CSV export, guide restore, phone/tablet and accessibility
checks remain. Account cleanup runs after successful signup even if assertions fail.

The stronger test exposed two genuine product defects:

- Compact charts could omit or truncate code labels. Statistics now also has a
  named, keyboard-scrollable semantic table with full labels and exact counts,
  including zero. Copy explains that counts mean coded excerpts, not people.
- A collapsed phone code navigator retained hidden keyboard targets. It now starts
  collapsed on narrow viewports and uses native `inert` plus `aria-hidden` while
  closed, preserving its mounted local filter state.

No chart calculations, backend/authentication/billing, provider settings, production
data or lifecycle flags changed. No customer messages were sent.

## Local results

- Production frontend build and changed-source strict ESLint: passed.
- Four Statistics component regressions: passed; original three failed before fix.
- Full final frontend suite: **1,112 tests passed across 125 files**, 44.26 seconds.
  Existing deliberate error-boundary/jsdom diagnostics remained in output.
- Complete saved production-browser journey: **1 passed**, 16.2-second test,
  19.3-second runner, against the actual new production frontend and real owned
  PostgreSQL/API. No external browser connections were permitted.
- First coded excerpt: **9 pointer clicks + 1 selection drag, 7 fields,
  4.374 seconds from signup submission / 5.132 seconds from website entry**.
  These are automated local-driver timings, not human measurements or a causal
  speed improvement. The earlier failed run measured 4.547 / 5.223 seconds but did
  not complete the journey and is not a valid successful baseline.
- Phone checks prove the closed filter remains mounted but is absent from textbox
  roles and cannot receive focus. The unchanged automated WCAG 2.2 scan passed.
- Actual local account-delete response: 200; owned API/web children stopped.

Artifacts: `test-results/five-step-real-ui-inert-navigator-20261007` (local, not
vendored). Earlier failed traces are preserved separately in
`five-step-real-ui-20261007`, `five-step-real-ui-corrected-20261007` and
`five-step-real-ui-readable-counts-20261007`. No weakened accessibility rules,
snapshot masks, fake browser events or increased timeouts were used.

After the green sharing PR237 merged, this candidate was cleanly rebased on
`48189e350476e401605ef20e61f5e483f420e5f3`. Full root production build, root lint
and bundle budgets passed. A second complete journey on that combined production
build passed: **1 test**, 16.6-second test / 19.5-second runner, \*\*9 pointer clicks

- 1 drag, 7 fields, 4.484 seconds signup / 5.186 seconds website entry\*\*.
  Artifacts: `test-results/five-step-real-ui-rebased-sharing-20261007`.
  The earlier 1,112-test suite was before this disjoint sharing rebase; the saved
  full-path replay is the combined-code proof, not a second full-unit-suite claim.

## Limits

Root typecheck passed. Strict ESLint covers the three changed frontend source/test
files. A broader invocation also named the E2E file and correctly failed because
that directory is outside the repository ESLint configuration; that warning is
not counted as a lint pass. The E2E is checked by formatting and actual execution.
Exact-head CI,
normal deployment and independent live verification are still required. The
historical provisional score remains **21/28**, not a fresh full-rubric certificate.
This proves the saved local flow, not Google provider login, native screen-reader
operation, a human timing, or completion of all 15 apps.

# QualCanvas repository recovery — scoped release evidence

Starts from current default625a34eef0e849d6fc8e32277ef09e4e8f5a6e3b in the
owned onboarding worktree, clean before the test additions; older branches
preserved, no open app PRs at pickup. No backend, plan, authentication, billing,
provider, production configuration or existing business-mutation handler changes.

## Confirmed defects and correction

Failed repository reads were presented as “No repositories yet”; malformed
responses could crash at repositories.length. Insight reads lacked loading or
failure state, and a late response for the previously selected repository could
replace the current selection's results. Clickable repository divs were not
keyboard-operable; destructive icon buttons lacked distinct accessible names.

Reads now distinguish pending, failed/malformed and verified empty responses.
Read-only retry has44px controls, a concrete next action and result-region focus.
Request counters ignore obsolete/unmounted requests; changing selection clears
old results. Selecting the already selected repository neither starts another
read nor strands loading. Semantic selection buttons are separate from labelled
delete buttons. Page help offers async setup/transfer assistance with the approved
two-working-day reply commitment, no meeting. Buttons/example links are44px;
input names and small-text contrast improved. Missing counts are unavailable,
not convenient zero; non-array tags cannot crash rendering.

Existing plan enforcement remains: GETs preserve saved research after a downgrade;
write access still requires the existing eligible plan. No false upgrade diagnosis
for a403 and no paid feature unlocked. No new dependency or lifecycle activation.

## Local evidence

The first attempted test invocation used the root Node-environment config and
failed all5 with document undefined: harness failure, NOT product TDD evidence.
The correct frontend-workspace invocation then recorded2passed/3failed and one
uncaught malformed-response error. After correction the focused suite passed5;
added malformed insight/selection-race regressions bring final focused proof to7.
One later root/config invocation found no test files and is not counted as a pass.

Full frontend985/985 across116files, no skips,369.64s. Full backend1361passed/
19existing skips across99passed/4skippedfiles,90.53s. Typecheck and production
build passed (19marketing routes,18training resources,6methodology chapters).
Existing large-chunk build warning remains. React counter cleanup lint initially
reported3warnings; stable counter-object captures remove them without waiving the
rule. Focused source/tests strict ESLint subsequently passed. The E2E file has
no matching ESLint configuration; its ignored-file warning is not a lint pass.
Full-suite logs contain expected error-boundary/jsdom diagnostics, not a claim
of a clean browser console.

Initial real-backend browser replay5/6passed46.9s: last tablet repository case
could not connect because local Vite crashed with unhandled read ECONNRESET.
Its trace/video/screenshot and server/browser logs are preserved in the WORKTREE
ROOT test-results/repository-recovery-failed-20261002-1435. No application assertion
was loosened, skipped or made optional. Final replay evidence is pending below.

Browser test is explicitly loopback/disposable-database-only, uses real signup
and authenticated repository/insight GETs, and deletes its fictional account in
teardown. A saved research fixture is seeded solely in that isolated local DB;
the user's Free plan stays unchanged. Browser-only503 faults require explicit
Enter retry→exactly one successful real GET, focused named region,44px controls,
no horizontal overflow, scoped axe and no captured business API mutation. This
is not a native screen-reader or real Google-provider proof.

## Score and first-value measurement

Saved before14/28→provisional21/28, unchanged pending all-route/native/provider
certification. Saved local own-material coding aha9clicks/7fields/7.292driver
seconds is not a fresh measurement from this lane or a hosted/human-speed claim.
Fresh current-source full-path replay passed1/1 in16.7s:10clicks/7fields,
4.553seconds from signup submission to actual persisted first coded excerpt,
5.312seconds from website start. This is automated local production-preview
timing, not hosted/human speed or a comparable before/after improvement.
The same test validates server firstValueAt/five observed steps, refuses forged
completion, downloads and inspects coded CSV, dismisses/restores guide, checks
phone/tablet axe and removes samples while preserving the user's own material.

## Final browser replay

The unchanged development run reproduced5/6passed44.8s with the same local Vite
ECONNRESET at tablet teardown; second failure archive is at the worktree root
test-results/repository-recovery-failed-20261002-1436. Rather than hide the crash
or relax assertions, the local-only runner served a fresh production build.
All6required recovery cases passed37.7s with retries0/skips0: desktop Chrome,
390pxphone Chrome,768pxtablet WebKit. Each summary/repository/insight retry makes
exactly one real successful GET, no generation or business-data API mutation,
and result focus/44px/nooverflow/scoped axe passes. The development-mode
StrictMode cases already passed on desktop/phone; tablet summary also passed,
but the entire development server teardown defect is not called repaired.
Successful log: test-results/repository-recovery-passed-20261002.log;
video/trace output: test-results/repository-recovery-20261002-browser.
Full-path log: test-results/repository-activation-20261002.log;
recording: test-results/repository-activation-20261002-browser.

The repository fixture guard accepts only the named owned local4759database or
the exact existing CI localhost55432/qualcanvas_e2e database with E2E_TEST=true.
It rejects any other URL before seeding. No arbitrary or production DB accepted.
The CI Chromium suite discovers this committed test; the existing cross-browser
CI allowlist is unchanged, so this lane's local matrix is separate evidence.
Owned API/web/browser processes and the local database stopped normally.

Current-head green CI, normal merge and independent live proof remain required.
SmartCash/Lustriel holds and all other owners' files were untouched.

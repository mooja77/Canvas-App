# Current beginner guide: evidence and remaining gates

Scope: `GuidePage.tsx`, guide regression tests, saved public-guide browser tests,
and one new actual pricing screenshot. Authentication, billing, research data,
provider credentials and lifecycle flags are unchanged. The separate full-five-step
PR #239 is preserved; no other owner's working copy was edited.

## Corrected user instructions

- Email signup has three fields; the Free plan needs no card. Two starting
  questions are optional. A fictional practice paragraph, a selected sentence
  and one code name provide the first saved coded excerpt.
- The five-step home guide detects progress, can be dismissed/restored, and
  clearly labels removable sample data. The 89-second captioned lesson has a
  direct link and a written alternative.
- Analysis requires **Run computation**, including after changes; excerpt
  counts are not participant counts or evidence of thematic importance.
- Share codes make independent copies. Inviting a viewer/coder opens the
  original, with roles and possible seat charges confirmed separately.
- Offline edits are not saved. No guaranteed instant synchronization, complete
  keyboard coverage, native-app equivalence or provider-price guarantee is made.
- Written setup/import/workflow/feature help promises a reply within John's
  approved two business days; it does not push a call or request research data
  by email.
- Current monthly pricing includes four self-service plans and a custom
  Institutions option. Annual savings vary by plan. The actual Word report
  exporter is documented rather than omitted.

## Evidence and defects found

Six initial unit regressions failed before the guide correction, then passed.
The screenshot-size guard subsequently failed before intrinsic dimensions were
added. The eighth current-pricing/Word regression failed before those corrections.
These failures were retained, not classified as upstream failures.

Actual production-build browser verification first failed WCAG contrast for
Contents/category labels and badges. After darker colors, a stronger navigation
assertion caught a genuine off-screen destination despite focused headings.
HTML dimensions alone did not stabilize lazy images. Explicit CSS width/aspect
ratio and immediate section navigation corrected that defect.

`test-results/current-guide-stable-layout-20261007`: **6 passed in 27.0 seconds**,
Chrome and WebKit at 1280, 820 and 390 pixels. Checks include keyboard Contents
open/Escape/focus return, selected heading in viewport, current manual-analysis
instructions, written help, real image HTTP/content types, no horizontal
overflow, zero page errors and the full selected Axe WCAG A/AA rule set.
Requests outside loopback and all non-GET/HEAD requests were blocked. No HTTP
mutations were allowed. Earlier request counters checked host before method,
so they did not count blocked external analytics POST attempts: zero attempted
HTTP mutations must not be inferred from those counters. The final saved test
records methods first, separately reports blocked marketing analytics attempts
at the exact `/api/v1/events/track` path, and requires zero product-mutation
attempts. Owned API/web processes exited after the run.

The current monthly pricing image was captured from the actual rendered pricing
grid after rejecting optional cookies and selecting Monthly: 1104 × 610,
SHA-256 `429e6bd9487bc8112219c17b25b93d5c5f8190027d893092f7aa09aa9d6506f0`.
It is a new asset; the historical screenshot was not overwritten. Other guide
screenshots have not all been recaptured and must not be described as new.

## Completion boundary

After the pricing/Word edits, the full frontend suite passed **1,131 tests in 126
files**, and root build, lint and bundle budgets passed. The expanded final
browser suite passed **6 cases in 40.2 seconds** in
`test-results/current-guide-final-section-headings-20261007`, navigating all 15
contents destinations by keyboard at every width/engine, with focused headings
in viewport and the same complete image/error/mutation/Axe checks. Two test-only
selector failures are retained: the closed mobile menu cannot be counted with
visible-role locators, and the help offer is a sixteenth section, not a contents
destination. The test now counts the actual named guide headings and opens the
menu before asserting its 15 visible buttons.

PR #239 merged after all 11 exact-head checks passed, with merge-tree equality
verified. This guide branch must now rebase on that merge and check the combined
full onboarding path before its one push. No guide PR, merge or live proof yet.

The combined rebase suite passed **1,135 tests / 127 files**; root build, lint
and bundle budgets passed. The first full saved replay then failed at signup:
the public-API build was deliberately blocked by the local-only network guard.
All four attempted external POSTs have trace status -1; the owned API received
only readiness. This is a test-build configuration failure, not a passing
journey or evidence of a customer production write. Its artifact is retained at
`test-results/current-guide-combined-full-onboarding-20261007`.
For a local full-journey replay, build with process-only
`VITE_API_URL=http://localhost:4751/api` before using the owned static server.
Never disable the external-request guard to work around it.

An initial loopback replay with `VITE_E2E=true` passed the saved full journey:
one case, 24.4-second runner, 9 pointer clicks plus one selection drag, 7 fields,
5.550 seconds from signup and 6.477 from the website. This is a test-mode build:
source inspection found the flag suppresses feature tips and expands the initial
analysis choices. It is **not** certified as the normal production onboarding UI.
A final loopback-only build without that UI-changing test flag and full replay
is required before pushing this guide.

That final normal-UI build passed: `VITE_E2E` is absent, feature tips and the
normal first-run analysis menu remain, and only the public API address is replaced
with the owned loopback URL. The full saved journey passed **1 case / 24.4-second
runner**, including all five setup steps through the UI, durable progress/reload,
readable counts, keyboard/mobile checks and owned fixture cleanup. Current
automated first value: **9 pointer clicks plus 1 selection drag, 7 fields, 5.205
seconds from signup / 6.284 seconds from the website**. Artifact:
`test-results/current-guide-normal-ui-full-onboarding-20261007`.

The corrected read-only guide suite also passed **6 cases / 56.0 seconds** on that
combined normal-UI build, all 15 destinations in Chrome/WebKit at all three widths.
Artifact: `test-results/current-guide-normal-ui-all-sections-20261007`.
The exact whole GuidePage module remains SHA-256
`3f9ef7b8f03f3362ac449e0aeb431721ea0faa3d13c95c060767750837617804`, identical
to the separately frozen public-API build; changing the fixture API address did
not change this guide module. All owned API/web processes exited after both runs.
These are local proofs, not a production provider or native screen-reader test.
Automated Axe/browser checks do not certify native screen-reader behavior or
provider login. No actual customer account was created or contacted.

Historical QualCanvas score **21/28 is provisional**, not a fresh 14-item
certification. This focused correction does not invent a new whole-app score.
The latest separately measured first-value path before this guide-only change
was 9 pointer actions plus 1 drag, 7 fields, 4.484 seconds from signup and 5.186
seconds from the website, in the owned automated local stack. It is not a human
study, Shopify install measurement or new timing of this guide branch.

## Actual CI failure and scoped correction

PR #240 at `b73963a41114e7dab7f264dada38fd73d4c79884` completed CI
run `37609220931` with ten successful checks and one failed Chromium check.
Chromium reported 780 passed, 9 skipped, 1 flaky and 1 failed. The failing
case was the Guide hero/first-section visual comparison against the old Linux
baseline. The rendered changes match this PR: the new beginner introduction,
darker Contents label and resulting section spacing. The actual screenshot was
visually reviewed. Both first-attempt and retry actual PNGs are byte-identical;
the artifact's expected PNG matches the repository's original baseline.

Only `guide-page-chromium-linux.png` is replaced with that reviewed actual PNG:
SHA-256 `a544f155e5da7cc6dc1d89b3ef47871159176d0acad9b6c02b03bdf8b2a2bc69`.
No other platform baseline, threshold, assertion, retry or accessibility rule is
changed. The original failed artifact is retained under the coordination folder
`qualcanvas-guide-ci37609220931`. This fixes a genuine observed CI failure, not
a speculative rerun. The flaky sharing read-recovery contrast case passed on
retry and remains disclosed; it is not evidence of deterministic accessibility.
The correction still requires green checks on its exact new head before merge
and independent live proof after normal deployment.

# QualCanvas sharing: truthful read recovery

Status at verification: locally verified on latest main `a4adcaf8`; not yet pushed or deployed. Release state is tracked separately in the coordination receipt. This document does not certify production or the entire programme.

## User story and boundaries

The canvas owner opens Share canvas (More canvas actions first on a phone), reads the existing collaborators and share codes, and chooses between working together and giving an independent copy. A failed read must not imply an empty access list. Retry must only GET existing state, preserve entries on the same canvas and never send invitations, create/revoke codes or charge a seat.

The server's existing ownership checks, collaborator email verification, seat quotes, explicit charge confirmations and viewer fallback are unchanged. No customer outreach, production data, settings or credentials were changed. No new paid service was added.

## Reproduced baseline and correction

- Initial behavioural run: 8/8 failed, with one uncaught `TypeError: shares.map is not a function` for a malformed object response.
- Other reproduced failures: missing persistent errors and read-only retry; invalid/wrong-canvas share data accepted; malformed collaborator role labelled as a coder; late old-canvas share shown on the newly selected canvas.
- Corrected reads validate arrays and rendered fields, reject explicit unsuccessful envelopes, require share canvas identity and valid non-negative whole clone counts/dates, and accept only editor/viewer collaborator roles. Invalid reads are not converted to empty arrays.
- Separate loading/error states, named persistent alerts and keyboard-operable GET-only retries. Last verified rows remain visible during refresh, but mutation controls stay disabled while uncertain. Responses require explicit `success: true`, and collaborator rows must match the requested canvas identity.
- Request generations invalidate stale requests on canvas changes/unmount. Canvas changes clear invitation email, role and pending removal/revocation confirmation.
- Preserved seat confirmation implementation. Existing billing tests now wait for the actual collaborator GET before clicking Invite; price, charge, cancellation and viewer assertions remain intact.
- Responsive email/role/action row, explicit copy-button name, legible muted text and an inline no-call setup-help offer. A named keyboard-focusable Sharing options scroll region and bounded dialog height keep Close reachable on short screens.
- Current `/help/sharing.html`: actual desktop/phone entry, verified colleague-account prerequisite, roles/price confirmation, independent-copy limits, read-failure recovery and privacy-aware email help within two business days. Links the existing captioned 89-second coding lesson without mislabelling it as a sharing lesson.

## Local evidence so far

- Final focused recovery plus original billing/behaviour suites: 32/32 passed (two files), including stronger successful-envelope/date/canvas identity and late-collaborator checks. Original seat-quote, upgrade-price, confirmation, cancellation and viewer assertions remain intact.
- Rebased full frontend: 1,103/1,103 passed, 122 files, 141.53 seconds. Earlier pre-rebase run: 1,081/1,081, 121 files, 154.75 seconds. Final focused run after short-screen layout change: 32/32, 25.79 seconds.
- Fresh backend: 1,362 passed / 19 skipped, 99 passing files / four skipped files, 60.75 seconds; explicit owned local DB and provider/SMTP/billing variables removed from the test process.
- Full shared/backend/frontend build passed, including six methodology chapters, 19 marketing routes and 18 training resources. Existing large PDF chunk warning retained.
- Root TypeScript, root lint and bundle budgets passed. Initial two ref-cleanup lint warnings corrected; changed-file lint then passed with zero warnings.
- Browser test source prepared for commit: `e2e/sharing-read-recovery.spec.ts`; six Chrome/WebKit desktop/tablet/phone cases discovered, no retries. Cases hold malformed share data and collaborator outage until explicit keyboard retry, then use the real local GET endpoints. They assert preserved entries, no sharing writes, scope accessibility, no overflow and no page errors. Test account cleanup uses the real local account-delete route.
- First browser run retained under `test-results/sharing-read-real-20261007`: one failed / five not run before reaching the dialog. Trace proves the build inherited `https://api.qualcanvas.com/api`, blocked by the local-only external-request guard; all local fixture creation and deletion succeeded. Corrective build explicitly uses `http://localhost:4751/api` and no VITE_E2E shortcuts. This is not recorded as passing.
- Intermediate correct-local-API browser run: six passed, 46.7 seconds; phone screenshot showed the test had not dismissed cookie consent using its actual accessible name. Selector corrected rather than bypassing consent.
- Final merged-main/strict-response/guide/short-screen browser run: six passed, 47.0 seconds, zero retries, under `test-results/sharing-startup-guard-guide-compact-20261007`. Chrome and WebKit at 1280/820/390px; named region keyboard scrolling and Close in viewport at 540px height; real backend GET recovery; no sharing writes, page errors, document overflow or scoped automated WCAG violations. Guide returned 200, all guide accessibility scans passed, and phone dialog/full-guide screenshots were visually reviewed. Fictional account deletions asserted 200; direct owned-DB sharing fixture count afterward was zero.
- A preceding final-run attempt timed out in the harness startup navigation before any test/account was created. It was retained under `test-results/sharing-combined-guide-compact-20261007`. The startup smoke page now uses the same local-only external-request guard as the tests; corrected run passed without increasing timeouts.
- Complete saved onboarding journey on the final build: one passed, 2.9-minute runner / 1.8-minute test, under `test-results/sharing-full-onboarding-20261007`. Landing/signup/sample/own transcript/pointer coding/progress/help/return/phone/tablet/sample removal/real CSV content/actual server-observed steps and cleanup. The existing later setup-step checks include API observations, not proof of every later UI pathway.

## Scope, score and first value

This repairs a concrete robustness/teaching gap, not the whole app. Conservative inherited rubric lower bound remains 21/28 before and after; this is not a fresh fourteen-item certificate and does not satisfy the all-app completion gate.

First value is the first real coded excerpt, not opening sharing. Final automated local measurement: nine pointer clicks plus one selection drag, seven typed fields, 11.368 seconds signup-to-aha and 15.505 seconds homepage-to-aha. Immediately preceding ethics evidence measured the same actions/fields at 5.336 / 6.218 seconds. These are separate automated-driver observations under different machine load, not human timings or evidence of a causal performance improvement/regression. Signup itself has three fields; the count includes later setup/research entries.

Remaining limits: real payment/seat execution, provider sign-in, native assistive-technology checks and a dedicated current sharing-video review are not certified by these unit/browser checks. Invitation mutations are covered by original mocked billing tests, not real-person sends. This lane does not establish that every page's errors or all fifteen apps are complete.

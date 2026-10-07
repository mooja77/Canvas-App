# Ethics panel: truthful read recovery and first-use teaching

## Scope and status

Five ethics tabs now explain their purpose and offer a real next action or guidance/import path. This is an incremental onboarding improvement, not whole-app certification. Current evidence-backed lower-bound QualCanvas rubric remains **21/28 before and after**, below the final target. The inherited 14-item vector is `1,2,2,2,2,1,2,1,2,1,2,1,1,1`; it is not a newly completed all-route/provider/native audit.

Settings, consent, audit and journal reads are validated rather than converted into defaults or empty records on failure. Persistent errors retain previously verified data and provide read-only Retry. Scope/version guards reject late responses from another canvas. Failed legacy journal migration retains its local copy; Retry does not upload it again. Actual backend `actorId`/`meta` fields are displayed without inferring missing actors.

Controls have accessible names, responsive layouts and keyboard-focusable scroll regions. Empty consent/journal states focus the actual form, without fabricated records. Empty anonymization links to the real transcript picker and explicitly does not promise automatic name detection or guaranteed anonymity. The ethics checklist is explicitly session-only; Save Settings does not claim to persist its ticks. Email-first setup/data/workflow help states the approved two-working-day response target and does not push calls.

## Evidence gathered before final rebase

- Initial nine regression tests failed against inherited behavior; implementation then passed all nine and two existing audit-export tests. Expanded tests reject array-shaped statuses without coercion. Final review reproduced two further legacy-copy loss defects (negative upload acknowledgement and failed confirmation read); both failed before the correction. The local copy now remains until a validated server read confirms the uploaded content. Missing-from-confirmation and successful confirmation are also tested. Final recovery suite plus existing audit-export tests: **20/20 passed**.
- Full frontend: 1,078 passed / 120 files. A Testing Library `exact` option caused typecheck failure; corrected to an anchored name matcher. Final lint zero warnings, typecheck and formatting passed before the final strict-status addition.
- First built-UI browser run: two Chrome cases passed; 390px exposed a genuine keyboard-inaccessible audit scroll region. Fixed with named, focusable audit/consent/preview regions and visible focus; failed trace retained.
- A later local build inherited the production API address from its environment file. The external-request guard blocked those requests; no production records were touched. Corrected explicit local API address, retaining production tooltip/menu behavior (`VITE_E2E` empty).
- Corrected real-local-API/Postgres browser run: **6/6 passed, 1.4 minutes**, Chrome and WebKit at 1280/820/390, retries zero. Four injected read failures per case; actual backend GET retries, teaching/focus/import actions, scoped WCAG 2.2 checks, no horizontal overflow/page errors/ethics writes, and normal disposable-account deletion verified. Phone screenshot inspected. Final strict-status/rebase build and full saved onboarding journey still require verification before push.

## Final rebased verification

Rebased on `08082158e044308f5b9ba1bb8f56cd6fc9fa9fc4`, preserving Code Weighting PR #234. Final full frontend: **1,088/1,088 passed, 121 files, 173.83 seconds**. Root lint/typecheck/shared/backend/frontend build passed; final corrected frontend build (24.64 seconds), methodology/marketing/training prerenders and bundle budgets passed. Existing PDF chunk warning remains.

Final production-UI/local-API browser run: **6/6 passed, 1.6 minutes**, Chrome/WebKit at 1280/820/390, zero retries. It also chooses Reject through the actual cookie banner and verifies keyboard focus in the audit scroll region. All four injected read failures recover via real backend GETs; no ethics mutations, page errors, document overflow or scoped automated WCAG violations. All disposable accounts deleted normally. Artifacts: `test-results/ethics-rebased-production-20261007`. The exact tested build is frozen separately under `_coordination/qualcanvas-ethics-tested-dist-20261007/dist` for later independent live code comparison.

The full saved production-build onboarding journey also passed: **16.7 seconds test duration**; actual homepage/signup/sample/own transcript/pointer coding/CSV/progress/sample removal/help/return/phone-tablet and account cleanup checks. Artifacts: `test-results/ethics-full-onboarding-20261007`. The final two observations use the real API rather than all-UI steps; this is not native/provider certification.

Retained failures: `test-results/ethics-static-production-20261007` and `test-results/ethics-static-corrected-20261007`. Successful pre-rebase run: `test-results/ethics-static-final-20261007`. No assertions, timeouts, skips or security gates were weakened.

## CI development-mode correction

Initial exact-head CI run `37585645170` failed three new Chromium cases at the
first settings-error assertion (770 passed, nine skipped); the other ten checks
succeeded. Its retained retry trace shows two settings GETs, 503 then 200, during
React StrictMode's development mount. The one-shot injected outage was consumed
by the first read, allowing the second to succeed before the assertion. The test
now holds each outage until the explicit keyboard Retry and checks the four
distinct failed read kinds. It does not change application behavior, relax an
assertion, add a skip or extend a timeout. Corrected local development and frozen
production-build results are recorded here before the corrective push.

Corrected local development run: all three Chrome widths and WebKit 1280/820
passed. Vite then crashed with an unhandled `ECONNRESET`; WebKit 390 failed at
initial navigation before signup. That failure is retained, not marked passing
(`test-results/ethics-strictmode-correction-20261007`). The corrected test then
passed **all six Chrome/WebKit cases, 1.3 minutes, zero retries**, against the
original preserved production build and real local API/Postgres
(`test-results/ethics-corrected-frozen-production-20261007`). All four outage,
read-only Retry, keyboard, scoped automated WCAG, overflow and no-mutation
assertions remain. Focused ethics/audit unit suites: **27 passed, 5.13 seconds**.
Application code and its frozen build were not changed for this correction.

## First value and limitations

The saved onboarding path reaches the first real coding, not an ethics action: **nine pointer clicks plus one drag, seven fields**. Before (PR #234): **4.911 seconds signup-to-aha / 5.711 seconds homepage-to-aha**. After: **5.336 / 6.218 seconds**. These are automated fixture timings, not human estimates or causal performance changes attributable to the ethics panel. The interaction and field counts are unchanged.

The browser uses fictional disposable local accounts; every external request is blocked. It does not certify real ethics mutations, Google sign-in, native screen-reader behavior or production research content. Existing write acknowledgement, duplicate-click and uncertain-write recovery remain outside this read-focused proof. Whole-programme scope remains all 15 apps, including review-held releases and recorded external gates.

## Reproduction

Run the focused panel and existing audit-export Vitest suites, full frontend suite, lint/typecheck/format checks, and production build with `VITE_API_URL=http://localhost:4751/api` and `VITE_E2E` empty. Use the owned local launcher with `--ethics-onboarding --weighting-static`; its explicit local database guard, external-key stripping and fictional-account cleanup must remain intact. Then run the saved full path with `--committed-onboarding --weighting-static`. No real-person messages or production settings/data edits are authorized by these tests.

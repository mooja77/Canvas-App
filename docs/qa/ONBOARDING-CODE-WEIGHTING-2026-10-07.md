# Code Weighting teaching and recovery evidence

Base: PR #233, tested head `8aba659cca7afe5fb52764c493b4794fff8d3cef`,
squash-merged as `76e0a73a84a25ba6f2ca45f98872d4d6c4832374` after all 11
checks were terminal green. This correction is a separate release.

## Corrections

The inherited empty panel said only “No codings found.” It now explains why
rating coded passages matters, offers the actual transcript import picker or
focuses an existing transcript, and links to the first-code worked example.
It closes the current dialog before invoking the existing canvas action.
An empty filter is distinguished from an empty project; Show all codings clears
only the filter and returns saved passages. Both selects have accessible names.
Star buttons have 32px targets. Small header, statistics, source and footer
text use higher-contrast colors. Existing artifact storage, rating callbacks,
export, authorization, billing and provider behavior are unchanged.

## Local evidence

Five teaching/label/action/filter tests first failed against the inherited
implementation, then passed after the correction. The final frontend suite
passed **1,070/1,070 tests in 120 files (88.34s)**. Source lint has zero warnings;
backend/frontend typecheck and all four changed TypeScript-file formatting
checks passed. The repository ESLint configuration ignores E2E/config files;
an attempted invocation including those paths failed max-warnings and is not
represented as passing E2E lint. Playwright compiles and executes those files.

Actual production build: 2,282 modules, PWA output, 26.57s; the existing large
PDF chunk warning remains. Only worktree-local dependencies are used.

The committed real-backend test exercises a new fictional account, blank canvas,
keyboard import action, actual transcript focus, saved coding, empty-filter
recovery, named filters, scoped WCAG-tagged axe audits, actual target dimensions,
zero page errors and no horizontal overflow. It runs at 1280/820/390px in Chrome
and Playwright WebKit, with retries zero and external requests blocked.
The final static production-build replay passed **6/6 (1.2 minutes)**:
`test-results/weighting-static-production-20261007/`. All six fixture accounts
were deleted through the normal local endpoint in finally. The phone Chromium
screenshot was inspected: readable modal and controls without overflow.

### Failed evidence retained

- Initial browser batch: six contrast failures, existing footer 2.53:1.
- Second batch: three passed, three failed; populated source label 2.42:1 plus
  Vite development server socket-reset crash.
- Third batch: five passed, final WebKit navigation failed after the same crash.
- First production preview: one passed, tablet header/statistics 4.37:1 failed.
- Corrected production preview: five passed, final WebKit navigation failed;
  captured server output confirms an unhandled socket `ECONNRESET` on Node 22.

No axe tags, assertions, matchers or timeouts were weakened. The correction
darkens the actual text. The final coordinator-only static server serves the
same production assets and proxies only to the owned loopback API. It handles
client disconnects and reports upstream failures as errors, not fake successes.
The application server was not changed to suppress exceptions. Failed artifacts
remain in their distinct `test-results/weighting-*` directories.

## Measurement and completion boundary

Historical before-score: 14/28. Conservative current score remains **21/28**;
this bounded change does not certify every customer route, real Google sign-in,
native screen-reader output, all media or all MUST items. WebKit is not native
Safari/VoiceOver. No customer emails, invitations, records, settings, secrets,
provider calls, GPU work or POS files were touched.

Complete pointer journey at the preceding tested head: nine pointer clicks plus
one selection gesture, seven fields; 7.363s signup-submit to first coding,
8.535s homepage to first coding. Current corrected production-build journey:
**one passed (19.5s), test 16.6s; nine clicks plus one selection gesture, seven
fields; 4.911s signup-submit and 5.711s homepage to first coding**. These are
automated local driver figures, not human timings or a causal speed improvement
from this downstream panel correction. The test covers actual coded research,
sample removal retaining own work, server-observed progress, help, returning
users, responsive behavior and a real CSV download. Its last two observations
use real local API operations rather than a complete UI journey for those steps.
Its account was deleted through the normal local endpoint. Artifacts:
`test-results/onboarding-weighting-production-20261007/`.

Deployment and independent served code/live verification are still required for
this separate correction.

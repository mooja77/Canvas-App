# QualCanvas onboarding — 29 September 2026

Status: **local, not released**. Owned branch `onboarding/sota-qualcanvas`,
rebased onto `origin/main` `10c89a6`; pre-verification tip `95838c9`.
The production checkout was not changed. No push, PR, merge, deployment,
customer contact, production database write or production setting change is
claimed here. Lifecycle delivery remains off.

## Incremental-release preflight — 30 September 2026

### Production automation assumption corrected — 1 October

Before merging lifecycle behavior changes, the running baseline deployment
`10c89a6` / Railway `fae41659-ec68-43a7-83b2-2ac7d3e75153` was checked.
A narrowly filtered startup log said the lifecycle scheduler had started.
A read-only runtime command returned only three non-secret booleans:
`automationEnabled:true`, `sendEnabled:true`, `newSequenceEnabled:false`.
The saved blanket “lifecycle OFF” statements were assumptions and are
superseded: **existing production automation is ON; the new setup lane is OFF**.
No environment values outside those switches, recipients, customer records
or provider secrets were inspected; no setting, send or production write was
performed. The initial metadata connector could not authorize log retrieval;
the existing authenticated CLI supplied the scoped evidence instead.

The new day-1 selection and day-3/day-7 progress content now require the
separate `LIFECYCLE_SETUP_SEQUENCE_ENABLED=true` flag. Missing/false preserves
baseline selection and template content without new progress queries. New
templates also carry a guard marker, so a pending day-1/3/7 template cannot
reach the provider after the new flag is off. Existing welcome, old day-3/7
and inactivity behavior are not suppressed. TDD recorded **4 failing / 18
passing** guard tests before implementation, then **22/22 passing** plus
forced backend typecheck. No flag was enabled. The previously green gates
remain historical proof; this source change requires fresh exact-head CI.

Fetched origin and rebased the owned worktree: `origin/main` remains
`10c89a6ec6b4a0fbfbe74bcc7fafc0d3224dfecf`; source head remains
`539dd52`. The tracked and untracked tree was clean before this documentation
update. Read-only checks found no open QualCanvas PRs and no dirty files in
the main checkout. No app/database stack was started in this preflight.

Fresh checks on the unchanged source passed: forced backend/frontend
typecheck; eight focused frontend files (**37/37**) covering guide progress,
sample removal, import retry, Help, CSV export and usable node controls; four
focused backend files (**27/27**) covering funnel filtering, admin usage and
lifecycle safeguards; and `git diff --check origin/main...HEAD`.

The saved full-suite evidence below is reused, not represented as freshly
rerun. In particular, the successful backend report is `backend-confirm.json`
(1,349 passed / 17 skipped, success true), not the earlier failing
`backend-final.json` (1,348 passed / 17 skipped, success false). Both remain
retained. The latest saved native fullstack result and onboarding result have
exit 0; the former reports 119 expected, zero unexpected/flaky/skipped tests.

### Local PR description / release boundary

Proposed title: **Improve self-serve first coding and onboarding recovery**.
This is a verified incremental improvement, **not** final world-class
onboarding certification: conservative **14/28 before -> 20/28 locally**.
The measured own-transcript coding journey uses **12 -> 10 actions** and
**7 -> 7 typed fields** (three signup fields). Automated signup-to-value
times were **8.622s -> 20.469s**, website-to-value **10.503s -> 35.340s**;
these uncontrolled local-driver observations do not establish a speedup.

The changes teach first coding, detect own-work progress, label/remove samples
without deleting research, recover teaching empty states, improve import
feedback and preserve phone/tablet coding controls. Billing restrictions,
customer-owned AI-key requirements and lifecycle delivery gates remain intact.

Open programme gaps remain items 1, 6, 8, 10, 11, 12, 13 and 14 in the rubric
below. In particular: every-guide-step server instrumentation, every-route
teaching/help inventory, manual assistive-technology coverage and live proof
are not complete. The short derivative video remains unreleased pending its
full listening/playback review; this preflight does not publish it or verify
production playback. No push, PR, CI run, merge or deployment was performed.

Ready for the coordinator's incremental-release decision after reviewing
these limits; publishing still requires current-head green CI and deployed
proof. The historical wording “not release-ready” below described the final
programme target, not a prohibition on a separately verified incremental PR.

## Trusted funnel and lesson follow-up

### Release gate correction — 1 October

PR #217 first ran CI at `d5c137c`. Type, lint, format, build, production
image, schema drift and unit checks passed, but Dependency Audit and
GitGuardian failed. These failures are retained as failures, not waived.
The production audit found Axios, Engine.IO and brace-expansion advisories.
Compatible updates are narrowly limited to Axios 1.20.0 (frontend minimum
raised), Engine.IO 6.6.11 and patched brace-expansion copies; the subsequent
production audit reports **zero vulnerabilities** at the unchanged threshold.
Affected frontend API/socket/download tests passed **18/18**; backend
websocket/template/Excel export tests passed **33/33**. The template fixture
correction at `d5c137c` had separately passed **10/10**.

GitGuardian identified a fixed synthetic test-password literal in historical
commit `bffe69b6`, not a production credential. The current fixture already
generated its password per run using a predictable date-based prefix. After
consolidation the scanner also flagged that expression on `858311c`; it was
replaced with cryptographically random per-run bytes, with no fixed password.
Only the exclusively owned PR branch is
consolidated, with the old history preserved in a local backup ref and an
exact remote-head lease. No scanner exclusion, shared-history rewrite or
credential rotation is claimed. Fresh exact-head CI remains mandatory before
merge; this section does not claim a deployment or programme certification.

The next exact-head run, `81ad6cf` / CI `36847080312`, passed audit,
GitGuardian and all ordinary gates but failed browser checks. Cross-browser
reported **243 passed / 2 failed**: a broad Transcript `.first()` locator
selected the offscreen new sidebar empty-state action on both mobile engines.
The corrected test requires the exact toolbar button and visible Paste Text
picker, without a skip or forced click. Focused local mobile Chrome and Safari
cases both passed, but the runner then failed teardown when Vite exited with
an unhandled ECONNRESET; this is **two test passes plus a runner failure**, not
a clean suite. Only the reserved fixture account/canvas/access/audit rows were
cleaned using the isolated database, and all owned processes/container stopped.
Earlier runner readiness timeout and missing-Origin CSRF refusal are recorded
as runner failures, not application passes.

Chromium reported **724 passed / 1 failed / 9 skipped / 2 did not run**. Its
new-account full path, including the random fixture credential, passed. The
only failure was the navigator screenshot. Actual, expected and diff images
were visually reviewed: the intended always-visible Cases (0) tab makes its
teaching empty state discoverable and wraps Sources (1); the current source's
17% orange coverage indicator remains truthful. First attempt and retry actual
PNG hashes are identical. Only that reviewed Linux navigator baseline is
updated; tolerances and all other snapshots remain unchanged. Neither failed
CI head is represented as green; corrected-head CI is still required.

At `21214f2` / CI `36849993737`, all ordinary/scanner gates and cross-browser
passed; Chromium reported **726 passed / 1 failed / 9 skipped**. Its phone
axe assertion caught memo Collapse/Delete/Edit actions scaled to 2–3 pixels
in overview. Unlike transcript/code nodes, memos did not consume the shared
overview tier. Memo actions now follow the same minimal-overview safeguard,
while content remains visible; editing controls have practical 32px layout
sizes. The accessibility assertion is unchanged, with no rule exclusion.
The focused memo regression failed first, then memo/transcript/code node tests
passed **9/9**. This does not claim all zoom levels or manual screen-reader
coverage. Full current-head CI remains the release gate.

### Trusted setup funnel follow-up — 30 September

Source commit `80bef4f840937deba717924669f917571ca64b40` adds all five
server-observed guide steps. Observations follow successful authorized
transcript creation/import, actor-attributed own coding, two distinct own
codes, a stored analysis run and generation of actual coded-data CSV bytes.
Node creation alone does not count as analysis. The browser's coded-data tab
now downloads the server-generated CSV; codebook/clipboard behaviour stays
client-side. CSV quoting, UTF-8 BOM and formula neutralisation are preserved.
“Export” evidence means server-generated bytes, not proof of a user's disk.

Trusted milestones are stored in the existing user onboarding JSON under
reserved `serverSteps`, with no migration. Both observer and preference PATCH
writers use the same short, parameterized user-row lock transaction so stale
or simultaneous device writes cannot lose milestones. Client PATCH rejects
reserved fields and forged milestone checklist ticks. Historical client ticks
are not trusted. Progress no longer depends on audit retention: a dedicated
real-Postgres test concurrently wrote all five milestones and preference
patches, deleted only that fixture's audit events, and verified all milestones
and preferences survived. A second real-DB test rejected forged reserved
fields/ticks without changing trusted progress. Its fictional account and own
remaining audit entries were cleaned up; no production data was involved.

`GET /api/admin/onboarding` exposes a labelled rolling **90-day signup cohort**,
signup/aha counts and unique real actors at every observed guide step, using
the shared test/internal-account predicate. Audit observations remain subject
to the existing published retention policy; lifetime user progress is separate.
No interview text is stored in these events. Event forwarding excludes test
accounts. Billing, trial, viewer authorization and customer-owned AI-key
protections were not relaxed. Telemetry failure cannot discard saved work.

Fresh focused checks: **58/58 backend tests in five files**, **5/5 download UI
tests**, **2/2 dedicated real-Postgres durability tests**, forced typecheck and
normal commit hooks (ESLint and Prettier) passed. The saved full unit/estate
suites below were not repeated or re-labelled as fresh proof.

The first new browser attempt failed before onboarding due solely to the
runner setting `VITE_API_URL=/api`: existing socket initialization requires an
absolute URL. Its trace/log are retained. With the runner corrected to the
absolute same-origin loopback URL, the complete path passed with all five
observations, actual CSV bytes and forged-marker rejection. That intermediate
run measured 10 actions / 7 fields / 8.248s signup-to-aha / 9.919s website-to-aha.
These remain uncontrolled automated observations, not a speedup claim. Final
exact-source-head (`80bef4f`) replay after the durability change passed **1/1**,
including all five server observations, forged-marker rejection, actual
downloaded CSV bytes, scoped desktop/phone/tablet axe and account cleanup:
**10 actions / 7 fields / 7.320s signup-to-aha / 8.542s website-to-aha**.
The isolated container and only this agent's API/web/browser processes were
stopped afterward. Data remains retained in the stopped local container.

Current conservative local rubric is **14/28 before -> 21/28**: item 11 moves
from 1 to 2 with the server observation and durability proof; all other item
scores remain as in the historical 29 September table. This is still below the
final target and has no current-head CI or deployed proof.

### Derivative lesson release review — 30 September

The coordinator processed all **88.700s** using the already-installed CPU
Whisper base model (no GPU, download or paid service), compared the transcript
against the supplied captions through the beginning and end, and visually
reviewed nine frames at approximately 5, 15, ..., 85 seconds. Narration and
caption topics correspond; an ASR mishearing of “broaden” does not alter the
source caption. The sampled frames were coherent with no obvious exposed
credentials or unsupported claim. This is machine transcription plus sampled
visual review, **not human listening certification or production playback**.
It teaches coding concepts, not a complete click-by-click signup demonstration.
Help therefore remains partial (item 8 = 1). The coordinator's general release
authority covers including the derivative; this agent has not published it.
Ignored review WAV/frame artifacts are not staged.

## Actual first value — saved 29 September comparison

The outcome is a saved coded excerpt from the researcher's **own** transcript,
not opening a project or looking at sample material. The full browser path
starts on the public website, creates an email account, chooses a template,
adds a fictional transcript and saves a real coding through the API (201).
The upgraded path additionally checks the durable first-value marker, guide
hide/restore and reload, sample removal without removing the user's work,
support links, keyboard access and phone/tablet layout.

| Source                              | Counted actions | Typed fields | Signup to outcome | Website to outcome |
| ----------------------------------- | --------------: | -----------: | ----------------: | -----------------: |
| Unchanged default `10c89a6`         |              12 |            7 |            8.622s |            10.503s |
| Upgraded branch, final complete run |              10 |            7 |           20.469s |            35.340s |

These are automated local-driver observations, **not human timings or a
statistical speed claim**. The final complete run shared CPU with the full
unit suite and release compilers; the earlier phone-corrected run measured
6.308s from signup / 7.971s from the website. These are not controlled evidence
of a speed improvement. Actions include the cookie decision and the
excerpt-selection gesture. Signup has three required fields; the other four
are the optional project topic, transcript title/content and first code name.
The default needs an additional Solo choice and Fit View action. The upgrade
removes the third personalisation question and brings the transcript into view.

The default comparison used pristine source from `git archive 10c89a6`, an
actual offline `npm ci` (1,411 packages), its own generated Prisma client and
compiled shared library. No dependency junctions were created. Both versions
used the same reserved ports and isolated local database; that database has
the current, compatible schema superset. The default test does not assert new
guide/sample features or a new server marker that the default does not have.
Both runs create only uniquely named fixtures and delete their own account.
Fixtures left by earlier failed browser runs remain in the isolated database;
they are not production users.

## Reproduced defects and corrections

- Overview buttons were physically about 2.4px at 10% zoom. Hide those editing
  controls in overview and show 32px controls at editing zoom. Two component
  regressions failed before the change and passed afterward.
- Expanding the phone guide triggered a delayed recover-fit that undid its
  transcript link. Preserve requested focus through programmatic recovery;
  user pan/zoom, explicit fitting and project changes relinquish that focus.
- Visual review found a further failure missed by the original size-only
  assertion: a pasted paragraph gave an unsized transcript an intrinsic width
  that placed its controls off-screen. The stronger full-path viewport
  assertion failed with viewport ratio 0, then passed with a 360px default for
  **unsized** transcripts. User-resized widths are preserved. Final phone and
  tablet screenshots were inspected; the phone transcript and controls fit.
- Progress changes lacked a screen-reader announcement. Add a polite, atomic
  status without moving keyboard focus; the regression failed before the fix.
- Creating an empty analysis node incorrectly completed “Run an analysis”.
  Only a populated server result completes it, including a valid named empty
  result set. The regression failed before the fix, then all 13 guide cases
  passed.
- A coding on a sample transcript incorrectly counted as the researcher's own
  work. Exclude sample transcripts as well as sample-labelled codings.
- The guide's coded-data export link opened the codebook, whose download could
  incorrectly tick the coded-data step. Open the data tab directly and require
  actual own codings before marking it. Regressions failed before both fixes;
  the full browser path now reads the real downloaded CSV and verifies the
  researcher's excerpt and code name, rather than just observing a click.
- The stronger export journey exposed a tiny question-colour button at
  overview zoom. Use a non-interactive colour cue there, with 32px editing
  controls at editing zoom. Its component regression failed before the fix.
- Institutional crawler metadata still advertised SSO/SCIM, BAA and EU
  residency even though the visible page correctly states their absence.
  Match the existing truthful page description, with a failing-then-passing
  regression and an assertion on generated production HTML.
- The mocked lifecycle-template test captured the local origin at module
  import. Pin and restore that test fixture before importing; no delivery gate
  was weakened. The 220,000-match result-count fixture now freezes only its
  clock; separate hostile-regex timeout tests still use the real clock and the
  production 100ms guard is unchanged.

## Verification ledger

Artifacts and command logs are retained under ignored
`test-results/codex-20260929/`.

- Backend full suite: **1,349 passed, 17 skipped**, exit 0. The skipped inventory
  is three opt-in database files, not evidence of a database pass.
- Those files ran separately against the dedicated PostgreSQL database with
  file parallelism disabled: **14 real tests passed, 3 inverse skip-marker
  cases skipped**, exit 0. The first parallel attempt had one aggregate-fixture
  collision; it is not labelled passing.
- Final frontend full suite: **966/966**, 115 files, exit 0, including all
  sample/export, overview-control, announcement and metadata corrections.
- Final saved full-stack estate suite: **119/119**, no skips or retries, exit 0,
  after every source correction in this checkpoint, including account
  security, offline signed Google-token validation, billing/trial/seat paths,
  customer-owned AI keys, export and egress assertions.
- Final complete full onboarding path: **1/1**, including readable actual CSV
  download bytes and all axe
  WCAG A/AA tags through 2.2, with no severity filter, on desktop, phone and
  tablet. This is not a claim of whole-application accessibility conformance
  or manual assistive-technology certification.
- Final forced backend/frontend/shared typecheck and configured whole-source
  ESLint passed, exit 0. Whole-source formatting also passed after normalizing
  the auth route's line endings; that normalization produced no Git content
  diff. Normal commit hooks remain required.
- Canonical frontend production build passed, including six methodology
  chapters plus hub, **19/19** marketing routes and 18 training resources.
  Bundle budgets passed without changing limits: CanvasPage about 567.9 KiB
  against 575 KiB. Generated institutional metadata matches the truthful page.
- Earlier builds accidentally inherited `NODE_ENV=test` from the unit-test
  environment. Their development React output exceeded the bundle limits.
  Those are harness failures, not a claimed application defect or a production
  bundle pass. Rebuilding with `NODE_ENV=production` passed the unchanged gate.
- The first actual-download run failed with Chromium cancellation. A tiny
  independent data-URL download also failed, including on the matching browser
  revision. A controlled hidden-process comparison isolated forward-slash
  Windows profile/environment paths: canceled with those paths, successful
  with native backslashes. Correcting only the runner environment made the
  unchanged app download pass. No browser policy or security setting changed.
  The Firefox diagnostic timed out; it is not recorded as a Firefox pass.

No browser traffic or backend connection could leave loopback during the local
journeys. Stripe, Google certificates, AI and email were local fixtures/stubs;
token signatures and application authorization were still checked. None of
those simulations establishes a new live provider round trip.

## Conservative rubric: 14/28 before → 20/28 local evidence

This is an evidence-backed lower bound, **not release-ready**. Partial means
some implementation exists but the entire criterion is not established. It
does not silently turn unknown or untested work into a score of 2.

| Item                           | Before | After | Evidence / remaining limitation                                                                                                                                                                               |
| ------------------------------ | -----: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Entry — MUST                 |      1 |     1 | Three-field email signup, no card/mailbox wait; visible Google and signed-token tests. No new live Google browser round trip in this pass. The previously closed Google owner decision is not reopened.       |
| 2 First value — MUST           |      2 |     2 | Same actual coding outcome measured on both sources; both below the local automated timing ceiling.                                                                                                           |
| 3 Ask less                     |      0 |     2 | Three personalisation choices before; two optional questions and skip after; topic names the project.                                                                                                         |
| 4 Home guide — MUST            |      1 |     2 | Five detected steps, progress bar, real links, dismiss/restore/reload; sample content does not tick own-work steps; analysis now requires a result.                                                           |
| 5 Samples                      |      0 |     2 | Labelled, one-click removal, own work retained; real-DB and admin tests exclude samples/test accounts.                                                                                                        |
| 6 Teaching empty states — MUST |      1 |     1 | Repository, project, code/source/case/calendar/team/sidebar recovery covered; no complete every-route inventory yet.                                                                                          |
| 7 Import                       |      1 |     2 | CSV title/content mapping and valid-row preview, named skipped rows, malformed-file errors and retry only remaining saves; QDPX/vendor routes preserved.                                                      |
| 8 Help                         |      1 |     1 | In-app email/setup offer and approved two-business-day reply promise; 88.70s captioned lesson exists locally. Full lesson review/publication and every-page help coverage remain open.                        |
| 9 Plans/trials — MUST          |      2 |     2 | Existing Free/trial retention and billing/seat restrictions preserved and saved estate tests pass.                                                                                                            |
| 10 Nudges                      |      1 |     1 | Welcome and day-1/3/7 progress-based pre-aha sequence, suppression/consent/provider safeguards; it stops at aha, not every remaining guide step. Delivery intentionally off.                                  |
| 11 Funnel — MUST               |      1 |     1 | Server signup/own transcript/coding/first-value evidence and sample/test filtering; the admin funnel does not yet record every guide step. Client CSV-completion state is not trusted server export evidence. |
| 12 Robust/accessibility — MUST |      1 |     1 | Complete owned-material journey, recovery tests, saved estate suite and scoped phone/tablet/keyboard/axe evidence; not all routes or manual screen-reader journeys.                                           |
| 13 Truthful plain language     |      1 |     1 | Corrected institutional metadata and superseded obsolete five-screen/hosted-AI specification; whole listing/help/website claim inventory not complete.                                                        |
| 14 Proven — MUST               |      0 |     1 | Full-path E2E and actual before/after figures are present; PR/current-head CI and deployed proof are not.                                                                                                     |

## Next work, in order

1. Add trustworthy, actor-attributed server observations for **each** guide
   step, including actual analysis execution and CSV generation, expose them
   through the admin funnel, and prove forged client markers cannot count.
2. Finish a route-by-route teaching/help/recovery inventory and remaining
   accessibility journeys. The passing scoped axe checks are not a substitute.
3. Complete the short-lesson release review; keep the existing public library
   distinct from this new self-hosted derivative.
4. Re-score, rebase on the latest default, push one complete PR, require green
   current-head CI, merge and verify deployed assets/endpoints. Do not spend
   Actions budget on a PR already known to miss the release gate.

John-only release decision: enabling lifecycle delivery remains separate and
is **not** needed to test this local implementation. SmartCash/Lustriel review
holds and all protected apps/POS/GPU work remain unchanged.

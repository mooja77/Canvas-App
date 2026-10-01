# QualCanvas final-standard follow-up — 1 October 2026

This lane starts from live `acd29d1` in the existing owned worktree, on
`onboarding/qualcanvas-final-20261001`. The worktree was clean, latest default
was fetched, and no open PRs existed. The prior branch and backup refs remain.
Incremental release evidence is in `ONBOARDING-REBASE-EVIDENCE-2026-09-29.md`.
The score remains a conservative **21/28**, not final certification.

## Smallest confirmed gaps addressed locally

- Google SDK failure or a stalled load left a blank signup area. A status now
  explains that email remains usable and how to retry Google; the shared SDK
  script has per-page listener/timer cleanup. No OAuth/account rules changed.
- Signup still had the document title “Sign In”. The title now follows the
  chosen tab, without adding a field or changing signup requirements.
- Empty code hierarchy lacked a real first-action link and example. It now
  explains grouping, opens the existing transcript picker and links the
  already-released coded-passage lesson. It creates no fake research.
- A failed summary read was presented as an empty list. It now has a distinct
  retryable error; a successful empty read teaches the purpose, source choice
  or import, and includes a clearly labelled illustrative sentence, not data.
- Saved-summary viewing was blocked until an AI key was connected. The same
  existing wizard guard now sits on Generate instead of opening the panel.
  Backend authorization, plan checks, provider resolution and BYOK requirements
  are unchanged. Reading/retry do not call the generation API. Labels, close
  control and a named complementary region make this bounded panel usable by
  keyboard/semantic inspection; no native screen-reader claim is made.

TDD recorded **7 failed / 14 passed** for the first recovery regressions,
then **21/21 passed**. The generation-gate regressions recorded **2 failed /
13 passed** after correcting an undefined mock-response harness error, then
the three focused files passed **31/31**. The signup-title regression separately
failed **1 / 17**, with 16 passing. Five affected files subsequently passed
49/49 before the title/positive-gate additions. Final focused gates and exact
head browser results must be recorded below before any source push.

The final five-file focused run passed **51/51**, including the title change
and the positive generation-guard callback contract. Forced frontend typecheck
and diff whitespace checks passed. The latter callback contract uses a mocked
generation response, not a real provider; production/provider calls remain
outside this proof. The React review checked unconditional hooks, shared SDK
listener cleanup, labels, named regions and the lack of new dependencies.

## Evidence limits / next closures

### Local real-backend recovery replay

Exact clean source/test head `e017a81e68aa9d70d1a99684d75d5b4bd6951fe3`
passed **3/3 in 33.8 seconds**, with no retries: desktop Chrome 1280×900
(6.6s), phone Chrome 390×844 (9.3s), tablet WebKit 768×1024 (9.4s).
Each used the real disposable local backend and database, a fictional account
deleted in teardown, externally blocked Google SDK recovery, and an injected
first summary-read 503 followed by a successful real GET. Each recorded two
summary reads and zero generation requests, checked the labelled empty example,
source focus, scoped WCAG 2.2 axe checks and keyboard close, and proved Generate
still opens the existing AI-account configuration wizard without a provider call.
This is not a real Google round-trip, provider generation or native screen-reader
test. All owned processes exited normally and `qc-onboard-pg` was stopped;
4750/4751/4759 had no listeners afterwards.

The initial `55830ba` replay failed **0/3** at an incorrect test-only exact
accessible-name locator. Its log and screenshots are retained: the import menu
was visible, with actual name `Paste Text Type or paste transcript content`.
Only that exact matcher was corrected; no application change, forced click,
skip, tolerance or weakened visible assertion was used. The passing JSON is
retained locally as `test-results/codex-20260930/recovery-browser-e017a81-passed.json`;
the failed JSON's configured nested output was discovered after the successful
rerun and therefore overwritten, while the copied failed log and failure
screenshots remain. No claim is made that the original failed JSON survived.

| MUST item | Established                                                                                                                                        | Remaining evidence or implementation                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry     | Email signup three fields, no card/verification first-use gate; Google server/token tests; explicit SDK-error recovery tests                       | Real Google-provider browser round-trip is not proved by a mocked SDK or blocked Google scripts.                                                                                     |
| Teaching  | Primary first-run canvas/source/code/case/calendar/team/repository guidance retained; hierarchy and summary gaps addressed                         | Complete every-route/list inventory is still required. Excerpt filtered/no-coding views, advanced tools and privileged admin lists need classification rather than assumed coverage. |
| Robust    | Saved full path, durable progress, retry/recovery tests, three-device real-backend recovery, scoped keyboard/axe and prior mobile engines retained | All-route error/keyboard inventory and native assistive-technology evidence remain incomplete.                                                                                       |
| Proven    | Committed full onboarding E2E, measured before/after figures, exact green CI and incremental live release                                          | This new follow-up has no PR/current-head CI or live release yet.                                                                                                                    |

There is no new migration, production setting/secret/customer write, campaign,
provider call or video asset change. Existing production automation is ON;
the independent new lifecycle setup lane remains OFF. Local stack use is
coordinated separately; no stack was started during these unit/build checks.

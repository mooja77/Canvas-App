# E2E evidence — `fix/qc-p0-p1-closure`

Durable record of the Playwright run for this branch, kept so the ten failures
are not re-attributed to it later.

**Headline: 718 passed, 10 known upstream failures, zero observed branch
regressions.**

This is _not_ "all gates pass". Ten tests fail, and they fail identically on
clean upstream in the same environment.

## Commits

|                           |                                           |
| ------------------------- | ----------------------------------------- |
| Branch                    | `fix/qc-p0-p1-closure`                    |
| Upstream compared against | `origin/main` @ `ecccee5` (Merge PR #160) |
| Branch tip at time of run | `4c84b1c`                                 |

## Environment

Windows 11, Chromium project, `workers: 1`, `retries: 0`.

Postgres 16 in Docker, container `qc-e2e-pg`, published on `localhost:55432`,
matching the CI service definition in `.github/workflows/ci.yml`.

```
DATABASE_URL=postgresql://qualcanvas:qualcanvas@localhost:55432/qualcanvas_e2e?schema=public
DEMO_ACCESS_CODE=e2e-only-qualcanvas-code-2026
E2E_ACCESS_CODE=e2e-only-qualcanvas-code-2026
JWT_SECRET=qualcanvas-e2e-secret
E2E_TEST=true
```

Schema applied with `prisma db push`, then `npm run db:seed -w apps/backend`.

**Why batched:** `npm run test:e2e` over all 60 specs was run twice as a single
background job and stopped before completing both times. The suite was therefore
executed in 13 foreground batches covering every spec file. Each batch re-runs
the `setup` project, so authentication is re-established per batch.

## Batches

Every batch was prefixed with `npx playwright test --project=setup --project=chromium`.

| #   | Specs                                                                                                                                                        | Passed  | Failed |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------ |
| 1   | `canvas-export` `scenario-h-export` `pages`                                                                                                                  | 29      | 0      |
| 2   | `pages-extended` `auth-flows` `scenario-d-ethics` `canvas-crud`                                                                                              | 79      | 0      |
| 3   | `visual-regression` `dark-mode` `mobile-responsive` `cookie-consent`                                                                                         | 22      | 9      |
| 4   | `canvas-codes-full` `canvas-coding` `canvas-transcripts-full` `canvas-lifecycle-full` `canvas-sharing`                                                       | 53      | 0      |
| 5   | `scenario-a-healthcare-thematic` `scenario-c-cross-case` `scenario-e-intercoder` `scenario-f-mixed-methods` `resilience` `network-resilience`                | 111     | 0      |
| 6   | `canvas-workspace` `canvas-navigation` `canvas-toolbar-dropdowns` `canvas-analysis` `onboarding-tour` `layout-persistence`                                   | 41      | 1      |
| 7   | `canvas-deep-contextmenu` `canvas-deep-edgecases` `canvas-deep-edges` `canvas-deep-keyboard` `canvas-deep-layout`                                            | 61      | 0      |
| 8   | `canvas-deep-performance` `canvas-deep-undoredo` `canvas-deep-visual` `canvas-deep-zoom` `canvas-errors-full`                                                | 49      | 0      |
| 9   | `canvas-advanced` `canvas-auth-gated-tools` `canvas-coding-full` `canvas-full-workflow` `canvas-modal-accessibility`                                         | 50      | 0      |
| 10  | `canvas-popover-placement` `canvas-responsive-visual` `canvas-search-presentation` `canvas-toolbar-full` `canvas-workspace-full` `canvas-auto-layout-visual` | 42      | 0      |
| 11  | `scenario-b-grounded-theory` `scenario-g-emergent-coding` `scenario-i-workspace` `scenario-l-visual-canvas`                                                  | 89      | 0      |
| 12  | `ux-phase1-placement` `ux-phase2-polish` `ux-phase3-power` `ux-phase4-advanced`                                                                              | 49      | 0      |
| 13  | `scenario-j-stress` `scenario-k-training` `stress-performance`                                                                                               | 43      | 0      |
|     | **Total**                                                                                                                                                    | **718** | **10** |

718 + 10 = 728, plus the `setup` project's `authenticate` = the 729 the runner
reports for a whole-suite invocation. All 60 spec files are covered.

## The ten failures

Nine are visual-regression comparisons against the committed **win32**
baselines. `e2e/visual-regression.spec.ts-snapshots/` holds 15 `chromium-linux`
and 15 `chromium-win32` baselines; CI regenerates on Linux, so the win32 set has
drifted.

1. `visual-regression.spec.ts:171` — Visual Regression — Public Pages › 1 - Landing page
2. `visual-regression.spec.ts:178` — Visual Regression — Public Pages › 2 - Login page
3. `visual-regression.spec.ts:185` — Visual Regression — Public Pages › 3 - Pricing page (above the fold)
4. `visual-regression.spec.ts:192` — Visual Regression — Public Pages › 4 - Guide page (hero + first section)
5. `visual-regression.spec.ts:285` — Visual Regression — Component Snapshots › 9 - Code navigator sidebar
6. `visual-regression.spec.ts:342` — Visual Regression — Theme & Responsive › 12 - Dark mode landing page
7. `visual-regression.spec.ts:361` — Visual Regression — Theme & Responsive › 13 - Mobile landing page (375x812)
8. `visual-regression.spec.ts:368` — Visual Regression — Theme & Responsive › 14 - Mobile login page (375x812)
9. `visual-regression.spec.ts:375` — Visual Regression — Theme & Responsive › 15 - Pricing page annual toggle

The tenth is a flake:

10. `canvas-workspace.spec.ts:136` — Canvas Workspace › Fit View button works

## Same-environment upstream comparison

Both were re-run from a detached checkout of `origin/main` @ `ecccee5`, same
machine, same database, same environment variables:

| Check                                                    | Branch              | `origin/main` @ `ecccee5` |
| -------------------------------------------------------- | ------------------- | ------------------------- |
| `visual-regression.spec.ts` (whole file)                 | 9 failed / 5 passed | **9 failed / 5 passed**   |
| `canvas-workspace.spec.ts -g "Fit View" --repeat-each=3` | 3 failed / 1 passed | **3 failed / 1 passed**   |

Identical on both sides. Four of the nine visual failures (Login page, Guide
page, Code navigator sidebar, Mobile login page) are on surfaces this branch
never touches, which is consistent with baseline drift rather than a content
change.

## Not attributable to this branch

No failure observed here is introduced by `fix/qc-p0-p1-closure`. Separate
follow-ups, not release blockers for this branch:

- decide whether win32 baselines remain authoritative, or regenerate them
  (`update-e2e-snapshots.yml`) / restrict visual regression to Linux;
- stabilise `Fit View button works`, which asserts a post-fit zoom scale
  differing from the pre-fit scale and is timing-sensitive.

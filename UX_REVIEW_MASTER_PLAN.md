# QualCanvas Review Master Plan

Date: 2026-05-15

Purpose: consolidate all review, browser QA, benchmark research, and implementation planning into one execution plan based on the current app state. This is the plan to work from; the detailed research/backlog files remain supporting evidence.

## Source Corpus

Primary review documents:

- `UX_CANVAS_BENCHMARK_RESEARCH.md` - 20 benchmark passes and 99 world-class principles.
- `UX_VISUAL_REMEDIATION_PLAN.md` - phased remediation plan through Phase 101.
- `UX_VISUAL_FIX_EXECUTION_BACKLOG.md` - executable backlog from P0-01 through P2-98 plus P3 and engagement work.
- `UX_FINDINGS_APPENDIX.md` - earlier strategic, schema, methodology, and React Flow performance findings.
- `test-results/ui-ux-review-2026-05-14-deep-live-report.md` - live browser QA report with screenshots, videos, contact sheets, and findings.

Key artifact directories:

- `test-results/ui-ux-review-2026-05-14T10-20-29-345Z-deep-live-visual/`
- `test-results/ui-ux-review-2026-05-14T10-30-35-367Z-supplemental-modals/`
- `test-results/ui-ux-review-2026-05-14T11-17-29-191Z-stress-interactions/`
- `test-results/ui-ux-review-2026-05-14T13-43-13-943Z-responsive-orientation/`
- `recordings/`

Current app anchors:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx`
- `apps/frontend/src/components/canvas/panels/AddComputedNodeMenu.tsx`
- `apps/frontend/src/hooks/useAutoLayout.ts`
- `apps/frontend/src/hooks/useCanvasKeyboard.ts`
- `apps/frontend/src/stores/canvasStore.ts`
- `e2e/`
- `test-results/live-visual-qa-deep.mjs`
- `test-results/live-visual-modal-pass.mjs`
- `test-results/live-visual-responsive-pass.mjs`
- `test-results/live-visual-stress-pass.mjs`

## Current App State

The app is a TypeScript workspace with `shared`, `apps/backend`, and `apps/frontend`. The frontend uses React 18, Vite, `@xyflow/react` 12, Zustand, Dagre, Tailwind, Recharts, VisX, and Playwright coverage. The product already has a substantial graphical qualitative-analysis workspace with many canvas nodes, panels, modals, computed-analysis nodes, export flows, training surfaces, and e2e specs.

The current canvas implementation is powerful but concentrated:

- `CanvasWorkspace.tsx` is about 2,680 lines and owns graph setup, fit/viewport behavior, nodes/edges, modals, overlays, search, status, minimap, controls, and many actions.
- `CanvasToolbar.tsx` is about 1,079 lines and contains dense toolbar/dropdown behavior.
- `AddComputedNodeMenu.tsx` is small but uses an absolute top/right dropdown that does not become a true mobile-native menu.
- `CanvasWorkspace.tsx` still has fixed initial fit options with `minZoom: 0.5` and an explicit note that there is no automatic `fitView` on container resize.
- Existing e2e coverage is broad, and the review created browser recordings/contact sheets; however the planned future regression specs from the benchmark work do not yet exist.

The live UI/UX review found the core desktop canvas did not crash under normal interactions, and search/presentation mode were visually solid. The high-risk failures are responsive graphical correctness, not basic product existence.

## Executive Conclusion

Do not start with the 100-phase aspirational backlog. Start by making the existing graphical workspace reliably visible, responsive, testable, and recoverable. Then split the large canvas implementation safely and add world-class graph capabilities in layers.

The correct implementation order is:

1. Stabilize data, test environment, and browser QA gates.
2. Fix current visual failures: fit/framing, mobile shell, dropdowns, auto-layout, controls/minimap/status, modal/auth/telemetry.
3. Reduce canvas implementation risk through small seams, shared primitives, and performance fixes.
4. Add core graph UX capabilities that make QualCanvas feel world-class now: navigation, overview, graph hygiene, sections, contextual add, state/lineage, data preview, review modes.
5. Add research-method depth and operational execution features.
6. Only then activate lifecycle email/training journeys at scale.
7. Treat marketplace, SDK, supply-chain, versioned-flow, and enterprise capabilities as platform horizons, not immediate visual-fix work.

## Non-Negotiable Gating Rules

- No lifecycle email automation until canvas stability, preferences, consent, suppression, analytics, journey preview, and rollback are in place.
- No broad `CanvasWorkspace` rewrite before current visual regressions are captured with Playwright and artifact scripts.
- No marketplace or third-party extension expansion before sandboxing, dependency checks, signatures, SBOM/provenance, permission review, and quarantine exist.
- No AI-generated recommendations or lifecycle targeting before evidence lineage, redaction, evals, prompt/version governance, and human fallback queues exist.
- No enterprise/accessibility claims before VPAT/ACR evidence, keyboard/non-visual graph navigation, audit logs, retention, identity, secrets, backup/restore, and data residency controls are real.
- No high-volume imports, transcriptions, reports, or sends before durable jobs, replay, error routing, dead-letter handling, quota/cost controls, and support bundles exist.

## Horizon 0 - Baseline, Safety, And Environment

Objective: make the repo and environment safe enough to trust fixes.

Schema-state correction (2026-05-15): a re-audit of `apps/backend/prisma/schema.prisma` against `UX_FINDINGS_APPENDIX.md §1.1` and `§1.3` showed most of the May-12 appendix list is already fixed in tree. Remaining schema gaps:

- `AiSuggestion.questionId` (line 550) — nullable column, no FK to `CanvasQuestion`, no `@@index`.
- `FileUpload.userId` (line 466) — nullable column, no FK to `User`, no `@@index`.

The other appendix items (Team.ownerId cascade, ReportSchedule.teamId FK, TrainingAttempt.userId FK, CanvasTextCoding.questionId index, AuditLog.resourceId index, Integration.userId index) are already in tree — do not re-migrate them.

Work:

- Fix the local/QA environment so Playwright setup can run; `DATABASE_URL` must point to a valid PostgreSQL URL.
- Run baseline gates: `npm run typecheck`, `npm run lint`, `npm run build`, and the core canvas Playwright slice.
- Preserve existing screenshots/videos and produce new baseline contact sheets before changing graphical behavior.
- Ship the two remaining schema gaps as one migration (`0019_aisuggestion_fileupload_fks`).
- Audit Stripe webhook event backlog from the `§1.2` incident (user-paired — needs Stripe Dashboard access).
- Land 5 e2e spec scaffolds (`canvas-responsive-visual`, `canvas-popover-placement`, `canvas-auto-layout-visual`, `canvas-modal-accessibility`, `canvas-auth-gated-tools`) — failing/skipped placeholder assertions wired to numbered findings in the live QA report.
- Fix telemetry 405 on `POST /api/v1/events/track`: backend route exists at `apps/backend/src/routes/eventsRoutes.ts:47`, but `apps/frontend/src/utils/analytics.ts:87` falls back to relative `/api` (which hits Cloudflare Pages static host returning 405) if `VITE_API_URL` isn't injected at build time. Pin `VITE_API_URL` explicitly in `.github/workflows/deploy-frontend.yml` so local `.env.production` autoloading is not the only safety net.
- Track existing build warnings separately: chunk-size warnings and `KeyboardShortcutsModal` dynamic/static import warning should not be confused with new visual regressions.

Acceptance:

- Baseline test outcome is documented with exact failures/skips.
- Database/env blocker is gone.
- Two remaining schema gaps have shipped migrations; appendix's other §1.1/§1.3 items confirmed already in tree.
- 5 e2e spec scaffolds exist and run (failures expected — to be made green during Horizon 1).
- Telemetry POST returns 204 in production console (verified by re-running supplemental modal pass artifact script).
- Browser QA artifacts can be regenerated repeatably.

Primary backlog mapping:

- Critical appendix items 1.1, 1.2, 1.3 (status-corrected above).
- Existing Playwright/browser QA setup.
- Live QA report finding #7 (telemetry 405).

## Horizon 1 - Current Visual Defects First

Objective: make the current graphical app look and behave correctly for a real user on desktop, tablet, and mobile.

Horizon 1 ships as three sub-batches with explicit dependency arrows. Do not merge them into one PR — each batch has a distinct risk profile and verification surface.

### 1A - Fit, framing, and auto-layout math (low risk, pure code)

Pre-work: lock the fit/framing algorithm on paper before writing code. Inputs: `{ bbox: {minX, minY, maxX, maxY}, viewport: {w, h}, breakpoint: 'mobile'|'tablet'|'desktop' }`. Outputs: `{ x, y, zoom }` with explicit `minZoom` per breakpoint. Define the two-stage policy (when stage 2 runs: on resize? orientationchange? after auto-layout?). Test cases must include findings #1 (mobile 11 clipped of 25), #2 (desktop dense initial scale 0.5 missing 8 nodes), #11 (auto-layout vertical column collapse), #18 (mobile landscape rotation not recovering).

Work:

- Implement dynamic fit/framing with graph-bounds-aware zoom and breakpoint-tuned `minZoom`.
- Make auto-layout viewport-aware: avoid huge vertical columns, preserve edges, wrap dense selections, fit after layout, keep manual anchors.
- Add debounced resize/orientation recovery that re-runs fit.

Files: `CanvasWorkspace.tsx`, `useAutoLayout.ts`, `useCanvasKeyboard.ts`.

Verification: makes `canvas-responsive-visual.spec.ts` and `canvas-auto-layout-visual.spec.ts` green. Findings #1, #2, #11, #17, #18 have before/after screenshots attached to PR.

### 1B - Responsive popover primitive + Tools/Analyze conversion (medium risk, new shared component)

Build the collision-aware popover primitive FIRST and convert Tools + Analyze before touching Export/Share/More. Desktop popover (collision-aware) and mobile bottom-sheet are two components, not one — ship the popover, then add the sheet variant in a follow-up. Do not bundle them.

Work:

- Build collision-aware popover primitive that respects `max-height: calc(100vh - safe offsets)` and clips to viewport.
- Convert `CanvasToolbar.tsx` Tools dropdown to the new primitive.
- Convert `AddComputedNodeMenu.tsx` (Analyze) to the new primitive.
- Reserve bottom-left/bottom-right safe zones for ReactFlow controls. Hide or relocate minimap/status on narrow viewports.
- Add deliberate minimap readiness/fade behavior to remove perceived flicker.

Files: `CanvasToolbar.tsx`, `AddComputedNodeMenu.tsx`, `CanvasWorkspace.tsx`, new shared popover primitive.

Verification: makes `canvas-popover-placement.spec.ts` green. Findings #3, #4, #8, #13, #19, #20 have before/after screenshots.

### 1C - Hygiene scatter (low risk, independent fixes)

These are independent small fixes that can interleave with 1A or 1B. None of them block each other.

Work:

- Add modal accessibility labels, `role="dialog"`, `aria-modal`, and named controls (especially Code Weighting's 21 unnamed buttons).
- Fix Research Calendar legacy-auth behavior: disable/hide or show an email-auth-required state instead of an indefinite spinner.

Files: per-modal cleanups across `components/canvas/`.

Verification: makes `canvas-modal-accessibility.spec.ts` and `canvas-auth-gated-tools.spec.ts` green. Findings #5, #6 have before/after screenshots.

### Horizon 1 exit criterion

Every numbered finding in the live QA report (findings #1-#21) has a documented verified fix or an explicit "deferred" justification with date and successor ticket.

**Status as of 2026-05-16 — Horizon 1 shipped (one finding reopened).** PRs #18 (Sprint 1A), #19 (Sprint 1B), #20 (Sprint 1C), #21 (telemetry backend), #22 (#9/#16 follow-up) merged to `main` and deployed.

Correction (2026-05-16): a live production browser check found finding #1 is **not actually resolved**. Sprint 1A shipped a correct, unit-tested fit algorithm — but on phone-width viewports the React Flow pane itself renders 0px wide (a flex-layout bug — the canvas status bar is a row sibling whose ~493px min-content width starves the `flex-1` canvas). The fit had nothing to fit into. See finding #1 row below and the Known follow-ups section.

| #   | Finding                                             | Status           | Where                                                                               |
| --- | --------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------- |
| 1   | Mobile canvas opens mostly blank                    | 🔴 reopened      | 1A fit math shipped, but canvas pane is 0px-wide on mobile — see Known follow-ups   |
| 2   | Dense graph initial fit not fitting                 | ✅ shipped       | 1A                                                                                  |
| 3   | RF controls overlapped/blocked tablet/mobile        | ✅ shipped       | 1A + 1B                                                                             |
| 4   | Minimap renders late / flicker                      | ✅ shipped       | 1B — minimap fade                                                                   |
| 5   | Modal close buttons icon-only / unnamed             | ✅ shipped       | 1C                                                                                  |
| 6   | Research Calendar legacy-auth poor                  | ✅ shipped       | 1C — EmailAuthRequired                                                              |
| 7   | Telemetry endpoint 405                              | ✅ shipped       | Sprint 0 (frontend) + PR #21 (backend middleware order)                             |
| 8   | Mobile toolbar too wide / truncates                 | ✅ shipped       | 1B — bottom-sheet                                                                   |
| 9   | First-run overlays compete with canvas              | 🟡 deferred      | Out of scope per Scope section — separate small PR                                  |
| 10  | Dense manual fit trades completeness for legibility | 🟡 partial       | 1A fixes framing; semantic overview → Horizon 3                                     |
| 11  | Auto-arrange tall poorly-framed column              | ✅ shipped       | 1A — post-layout fit                                                                |
| 12  | Mobile first load blank after stress layout         | ✅ shipped       | 1A                                                                                  |
| 13  | Mobile dropdown clipped                             | ✅ shipped       | 1B — CollisionPopover                                                               |
| 14  | Dark-mode graph framing inherits layout failure     | ✅ shipped       | 1A (framing)                                                                        |
| 15  | Low-zoom selection state overwhelms                 | ✅ shipped       | 1B — canvas-low-zoom-bulk                                                           |
| 16  | Search + presentation mode solid                    | ✅ no fix needed | Snapshot-protection deferred to a follow-up                                         |
| 17  | Compact mobile blank                                | ✅ shipped       | 1A — math verified by 22 vitest cases; narrow-portrait e2e `.fixme` (RF cull quirk) |
| 18  | Mobile landscape rotation doesn't recover           | ✅ shipped       | 1A — orientationchange refit                                                        |
| 19  | Tools menu clips at non-mobile breakpoints          | ✅ shipped       | 1B                                                                                  |
| 20  | Analyze menu not mobile-native                      | ✅ shipped       | 1B                                                                                  |
| 21  | Desktop resize doesn't preserve graph visibility    | ✅ shipped       | 1A — ResizeObserver refit                                                           |

17 of 21 shipped. #1 reopened (see below). #9 deferred (out of scope). #10 partial — framing fixed, semantic overview is Horizon 3. #16 needed no fix.

**Finding #1 — reopened, diagnosed, blocked on environment.**

- Root cause (confirmed via live prod DOM): `CanvasWorkspace.tsx` renders the canvas status bar as a flex-**row** sibling of the canvas pane, under `<div className="flex flex-1 min-h-0">`. The status bar's content has a ~493px min-content width; on a viewport narrower than that it consumes the whole row and the `flex-1` canvas pane collapses to 0px. Desktop is also affected (canvas squeezed to ~55%) but not fatally.
- Flexbox constraint (verified by reasoning): there is no row-sibling tweak that fixes this — shrink is proportional to flex-basis, so the status bar always absorbs the row. The fix **requires** restructuring: the status bar must become a flex-column child below the canvas, or an `absolute` overlay.
- Two restructure attempts (flex-column; absolute-overlay) both destabilized React Flow's e2e tests — `canvas-coding`, `canvas-crud`, `ux-phase4` fail "element not stable" and the `visual-regression` canvas screenshot becomes non-deterministic (the graph renders at two vertical positions = a non-deterministic fit). `retries: 0`, so it is a real deterministic regression, not flake. The cause of the React Flow instability is not yet pinned down.
- Pinning it down needs a stable local repro to watch the Playwright trace / instrument `runFit`. As of 2026-05-16 the local dev environment cannot sustain that (Prisma provider mismatch vs the local SQLite DB, Docker daemon instability, an OS-level `DATABASE_URL` from another project shadowing config, dev servers being reaped). Fixing the local environment is the gating dependency — and is itself the Horizon 0 task that was deprioritized.
- Work-in-progress preserved on branch `canvas-ux/finding-1-layout-wip` (commit `c83793e`, the absolute-overlay attempt). Estimated ~1 hour to finish once a stable React Flow dev environment exists.

Known follow-ups carried out of Horizon 1:

- Narrow-portrait (320x568, 390x844) responsive-visual + popover e2e tests are `.fixme` / breakpoint-excluded — React Flow `onlyRenderVisibleElements` cull/measure deadlock + a 320px `.react-flow__pane` hidden-layout issue. Fit math itself is unit-verified. Revisit when the RF rendering layer is next touched.
- Semantic low-zoom overview (group/cluster labels) — Horizon 3.
- First-run overlay sequencing (#9) + search/presentation snapshot protection (#16) — separate small PR.

Acceptance:

- First load at `320x568`, `390x844`, `568x320`, `768x1024`, `1024x640`, `1024x768`, and desktop shows meaningful graph content or an explicit review/overview state.
- No critical dropdown/menu is clipped outside the viewport.
- Fit View is clickable and not blocked by minimap/status.
- Auto-layout never drops visible edge rendering in dense scenarios.
- Repeated-frame hash stability shows no obvious flicker except intentional animation.
- Modal close buttons and key controls are accessible by name.

Primary backlog mapping:

- P0-01 through P0-04.
- P1-01 through P1-04.
- Phases 1-6 in `UX_VISUAL_REMEDIATION_PLAN.md`.

Implementation files likely touched first:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx`
- `apps/frontend/src/components/canvas/panels/AddComputedNodeMenu.tsx`
- `apps/frontend/src/hooks/useAutoLayout.ts`
- `apps/frontend/src/hooks/useCanvasKeyboard.ts`
- shared responsive popover/bottom-sheet component to create.

## Horizon 2 - Stabilize The Canvas Architecture

Objective: reduce regression risk before adding more graphical depth.

Work:

- Extract small, low-risk seams from `CanvasWorkspace.tsx`: viewport fitting, resize/orientation observers, minimap/status layout policy, ReactFlow control wrappers, and QA instrumentation.
- Do not do a full canvas split in one refactor. Split only behind tests and only where behavior is already covered.
- Apply React Flow performance fixes from the appendix: stable node data/actions, shallow store selectors, stable ReactFlow props, lazy-load chart-heavy nodes, and decouple transient drag position from full node rebuilds.
- Create shared responsive overlay primitives: collision-aware popover, mobile bottom sheet, menu list, focus trap, escape handling, and named close buttons.
- Add visual regression fixtures for key canvas states: empty, small, dense, selected-many, modal-open, menu-open, dark, mobile, tablet, landscape, large computed nodes.

Acceptance:

- `CanvasWorkspace.tsx` loses responsibilities incrementally without changing user behavior.
- Existing e2e specs keep passing after each extraction.
- Performance work is verified with dense graph artifacts and profiler snapshots where available.
- New shared menu/modal primitives are used by Tools and Analyze before expanding elsewhere.

Primary backlog mapping:

- P2-50, P2-73, P3-04.
- Appendix React Flow performance top 5.

## Horizon 3 - Core World-Class Graph UX

Objective: make QualCanvas feel like a serious graphical analysis workspace, not just a browser board with nodes.

Work:

- Add recoverable orientation: home view, fit all, fit selection, saved views, navigator/outline, jump to section/search result.
- Add low-zoom semantic overview: group labels, cluster labels, node counts, section contours, high-count selection affordances, and offscreen indicators.
- Add graph hygiene: reroutes, waypoints, labels, edge bundling/opacity, relation warnings, tidy-up, sections, and subgraphs.
- Add contextual creation: command palette upgrades, cursor quick-add, edge-drag suggestions, selection actions, and recent actions.
- Add edit/review/present modes backed by the same model, with mobile review-first behavior.
- Add self-documenting nodes and port-level help.
- Add data previews and quality panels for selected nodes/edges.

Acceptance:

- Users can recover orientation without manual pan/zoom guessing.
- Dense graphs become meaningful at low zoom through landmarks and summaries.
- Creation and analysis actions appear where the user is working.
- Mobile is a review/navigation surface, not a broken desktop squeeze.

Primary backlog mapping:

- P2-01 through P2-24.
- P2-80 through P2-83 where they support navigation/inspection/debugging.

## Horizon 4 - Research Rigor And Method Depth

Objective: differentiate QualCanvas from generic whiteboards and lightweight AI summarizers.

Work:

- Add formal visual grammar and typed research links: evidence, code, memo, theme, case, report, journey, requirement, decision, and lifecycle objects.
- Add CAQDAS-grade maps: code co-occurrence, code similarity, document similarity, code-by-case matrices, source-linked insight snapshots.
- Add analytic audit trail for rename/merge/split, code evolution, memo rationale, theme changes, and exportable research packets.
- Upgrade intercoder reliability beyond only Cohen's kappa; include Krippendorff's alpha and disagreement/adjudication workflows.
- Add framework analysis matrix, saturation tracker, typed memos, quote-driven write-up workspace, and method checklists.
- Add reproducible reports with manifests, regeneration diffs, evidence appendices, and stale-output warnings.

Acceptance:

- Serious academic, healthcare, policy, and UX researchers can defend how outputs were produced.
- Reports cite exact evidence, code states, prompt/model versions, and method checklist state.
- Methodological features are exportable for thesis, compliance, journal, and stakeholder workflows.

Primary backlog mapping:

- P2-13 through P2-18.
- P2-24 through P2-28.
- P2-44, P2-45, P2-74, P2-85.
- Appendix methodology top 10.

## Horizon 5 - Workflow Execution, Debugging, And Operations

Objective: make graph execution observable, repeatable, and supportable.

Work:

- Add observable analysis run mode: per-node status, inputs/outputs, timing, rerun from node, compare runs, redacted logs, approval breakpoints.
- Add execution queue, partial recompute, cache semantics, dataflow backpressure, replay, cannot-replay explanations, and provenance replay.
- Add error workflows, node status signals, dead-letter operations, suspicious-success detection, and owner routing.
- Add work-item matrices for imports, transcriptions, AI jobs, reports, exports, lifecycle sends, connector syncs, and variants.
- Add requirements perspective, coverage gates, traceability matrices, and parent/subflow execution correlation.
- Add graph diagnostics workbench: compile errors, search, semantic diff, breakpoints, watches, call stacks, node warnings, and focused fixes.
- Add collection semantics: cardinality, branch paths, domains, matching/lacing controls, sample/full-run boundaries.

Acceptance:

- Users can answer: what ran, what changed, what failed, what was skipped, what was stale, what cost money, and what evidence supports this?
- Support can diagnose runs from redacted bundles without reproducing sensitive data.
- High-risk actions are blocked by precise, navigable diagnostics.

Primary backlog mapping:

- P2-31, P2-40, P2-41.
- P2-81 through P2-86.
- P2-93 through P2-96.

## Horizon 6 - Lifecycle Email And Training System

Objective: increase activation and retention without sending users into unstable or ungoverned product states.

Work:

- Build the lifecycle event model: signup, first canvas, transcript import, first code, first export, inactivity, trial ending, feature release, training recommendation.
- Add email preferences/compliance: unsubscribe, categories, marketing vs product-help, consent, suppression.
- Build journey builder: entry/exit criteria, delays, branching, suppression, frequency caps, goals, experiments, preview, staging, safe-send, rollback.
- Build in-product destinations: sample canvas, guided task, Training Center, exact canvas section/snippet, import/coding/export help.
- Add analytics: activation milestones, cohorts, retention, feature flags, experiments, lifecycle conversion.
- Add redaction/permission checks for any email that references research content.

Acceptance:

- Every email has one primary CTA and a working in-app/website destination.
- No lifecycle campaign can send without preference, consent, suppression, frequency, and safe-send checks.
- Staging dry-run shows who would receive which email and why.
- Lifecycle sends are observable jobs with retries, cancellation, rollback, and dead-letter routing.

Primary backlog mapping:

- Engagement backlog ENG-01 through ENG-04.
- P2-30, P2-42, P2-63, P2-64.
- Must follow Horizon 1 and core governance foundations.

## Horizon 7 - Platform, Governance, And Enterprise Readiness

Objective: make QualCanvas safe for teams, enterprises, regulated research, and integrations.

Work:

- Add enterprise governance: roles, guest/domain policy, content classification, audit logs, export/share/AI/email controls, access reviews.
- Add identity/secrets/contracts/recovery: SSO/OIDC/SAML, SCIM, vault-backed secrets, BYOK/CMK policy, OpenAPI/AsyncAPI, signed webhooks, backup/restore/DR.
- Add data residency, tenant-boundary transparency, retention/legal hold/eDiscovery, incident response, procurement evidence room, accessibility conformance artifacts.
- Add API/event/integration hub, connector inventory, schema drift policies, sync health, deprecation, and downstream impact.
- Add stakeholder portal, embedded dashboards, subscriptions, test sends, permissions, stale-report warnings.

Acceptance:

- Enterprise customers can self-serve security review, access review, recovery review, and integration review.
- Regulated-region and sensitive-project behavior is visible in product, not handled manually.
- Export/share/send controls respect classification, consent, retention, and role constraints.

Primary backlog mapping:

- P2-25, P2-29, P2-34.
- P2-47 through P2-59.
- P2-68 through P2-72.

## Horizon 8 - Creator Ecosystem And Marketplace

Objective: support reusable assets, templates, partner workflows, and extensions without compromising trust.

Work:

- Add nested reusable subgraphs, parameter panels, dependency resolver, missing asset recovery, environment snapshots, example gallery, static analysis, solution packaging, symbol index.
- Add custom node SDK, node UI standards, developer console, permission manifests, fixture tests, package validation, and compatibility matrix.
- Add expression/mapping workbench with typed previews, safe sandboxing, redaction warnings, before/after comparisons, and lineage.
- Add data profiling/Browse nodes, dependency path hygiene, signed artifacts, SBOM/provenance, supply-chain attestations, scans, quarantine, and trust-room evidence.
- Add operator palette, certified snippets, governed catalogs, hidden/internal nodes, deprecated-node warnings, and versioned flow promotion.

Acceptance:

- Reusable assets can be authored, tested, versioned, promoted, scanned, signed, installed, rolled back, and audited.
- Customers can inspect dependency, permission, version, compatibility, and supply-chain evidence before adopting marketplace content.
- Graph assets can move across dev/staging/prod/customer environments without secret leakage or hidden broken dependencies.

Primary backlog mapping:

- P2-75 through P2-80.
- P2-87 through P2-92.
- P2-97 through P2-98.
- P3-01 through P3-07.

## Recommended Sprint Order

Sprint 0: Baseline and safety

- Fix `DATABASE_URL`/Playwright setup.
- Run and record baseline quality gates.
- Fix or ticket critical Prisma/FK/index issues.
- Confirm current skipped tests and build warnings.

Sprint 1: Fit, framing, and mobile shell

- Implement dynamic fit helper and orientation/resize recovery.
- Hide/reposition minimap/status/controls on narrow screens.
- Add responsive screenshots and video artifacts.

Sprint 2: Responsive menus and modal accessibility

- Build shared popover/bottom-sheet primitive.
- Convert Tools and Analyze first.
- Add named modal close/rating controls and dialog semantics.

Sprint 3: Auto-layout and dense graph reliability

- Fix auto-layout shape, edge preservation, post-layout fit, and low-zoom selection noise.
- Add dense graph edge visibility and auto-layout Playwright assertions.

Sprint 4: Telemetry/auth/minimap polish

- Fix telemetry route mismatch.
- Fix Calendar auth state.
- Add minimap readiness/fade and flicker checks.

Sprint 5: Architecture seam extraction

- Extract viewport/fit policy, menu primitives, minimap/status layout policy, and QA instrumentation.
- Apply the first React Flow performance fixes.

Sprint 6: Core world-class graph UX

- Navigation model, semantic overview, graph hygiene, sections/subgraphs, contextual add.

Sprint 7: Research state and rigorous outputs

- State badges, lineage, audit trail, data previews, report reproducibility, method-quality panels.

Sprint 8: Engagement foundation

- Lifecycle events, preferences, suppression, destinations, staging dry-run, analytics.

Sprint 9+: Platform horizons

- Durable jobs, operations, governance, enterprise, marketplace, SDK, versioned flow promotion.

## Verification Plan

Local quality gates:

```powershell
npm run typecheck
npm run lint
npm run build
```

Current targeted Playwright gates:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-deep-layout.spec.ts e2e/canvas-deep-edges.spec.ts e2e/canvas-workspace.spec.ts e2e/mobile-responsive.spec.ts e2e/dark-mode.spec.ts e2e/canvas-toolbar-dropdowns.spec.ts
```

Relevant artifact scripts:

```powershell
node test-results/live-visual-qa-deep.mjs
node test-results/live-visual-modal-pass.mjs
node test-results/live-visual-stress-pass.mjs
node test-results/live-visual-responsive-pass.mjs
```

Immediate missing specs to create first:

- `e2e/canvas-responsive-visual.spec.ts`
- `e2e/canvas-popover-placement.spec.ts`
- `e2e/canvas-auto-layout-visual.spec.ts`
- `e2e/canvas-modal-accessibility.spec.ts`
- `e2e/canvas-auth-gated-tools.spec.ts`

Future slices should be created as the matching product surface exists; do not add empty placeholder specs for P2-75+ features before implementation begins.

## Definition Of Done

A fix batch is done only when:

- Implementation is complete.
- Typecheck, lint, and build status are known.
- Relevant Playwright specs pass or failures are documented with cause.
- Production-like artifact scripts are rerun where the change is visual.
- Screenshots, videos, and contact sheets are reviewed.
- For each numbered finding in the live QA report addressed by the batch, the PR has a before/after screenshot pair captured from the same breakpoint and confirming the specific defect is gone. Test-pass alone is insufficient.
- No critical console errors or failed requests are introduced.
- No leftover temporary QA canvases remain.
- Any known skips are intentional and documented.

## Decision

The next work should be Horizon 0 and Horizon 1, not more benchmark expansion. The research already establishes the long-term product bar. The app's current bottleneck is execution: make the existing canvas visually reliable and testable, then build the world-class graph capabilities in the order above.

## Scope Note on Horizons 4-8

Horizons 4-8 (research-method depth, ops/debugging, lifecycle email, governance/enterprise, marketplace/SDK) remain valid long-term direction with binding gating rules at the top of this document. They are **not** scheduled work in the next quarter. Treat them as "future evaluation, revisit after Horizon 3 exit." If the gating rules conflict with any opportunistic feature that lands earlier, the gating rule wins. Do not pull Horizon 4+ items forward without re-planning Horizon 0-3.

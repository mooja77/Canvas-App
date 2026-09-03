# QualCanvas — Plan Reconciliation (2026-05-31)

**Purpose:** Reconcile the 2026-05-13 planning engagement (`EXECUTIVE_SUMMARY.md`, `IMPLEMENTATION_SPECS.md`,
`UX_ENHANCEMENT_PLAN_V3.md`, `docs/implementation/*`) against the **current** code on `main`.
Every claim below is verified by reading the live source, not the plan.

**Headline:** The May-13 plan is ~90% already shipped. The doc's "#1 critical, fix-this-week" item
(3 Prisma cascade bugs) is **already fixed**. What remains is three PARTIAL items.

> Note on doc age: the 8 untracked planning docs (`EXECUTIVE_SUMMARY`, `MASTER_INDEX`,
> `IMPLEMENTATION_PLAN`, `IMPLEMENTATION_SPECS`, `UX_ENHANCEMENT_PLAN[_V2/_V3]`, `FEATURE_CATALOGUE`)
> carry filesystem mtimes and content headers of **2026-05-12/13** — they are a ~2.5-week-old layer,
> not produced today. Today's HEAD commit is `#111` (2026-05-31). The recent live-audit screenshots
> (`cv-*`, `deep-*`, `ns-*`, `erg-*`, `long-*`) and `.yml` accessibility snapshots are the fresh artifacts.

---

## Status table

| #   | Plan item                                                       | Status     | Evidence (current code)                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | **3 Prisma cascade bugs** (the "CRITICAL — fix this week" item) | ✅ DONE    | `Team.owner … onDelete: Cascade` (schema.prisma:778); `ReportSchedule.team … onDelete: Cascade` (704–705) + back-relations `User.reportSchedules`/`Team.reportSchedules` (65/780); `TrainingAttempt.user … onDelete: Cascade` (463) + `User.trainingAttempts` (69) + `@@index([userId])` (466)         |
| 1   | Pricing restructure                                             | ✅ DONE    | `config/plans.ts:1` — 4 tiers `free \| student \| pro \| team`; `PricingPage.tsx:50,58` — Student $5 / Pro $15 / Team $39/seat, annual default toggle, 5th "Institutions" card. (Plan proposed Pro $17/Researcher $39/Team $49 — **superseded**; actual launch chose Student $5 / Pro $15 / Team $39.) |
| 2   | Krippendorff α / Fleiss κ                                       | ⚠️ PARTIAL | `utils/intercoder.ts` implements `computeKappa` + `computeKrippendorffAlpha` (l.131) + `computeFleissKappa` (l.224), all tested. **But** `IntercoderReliabilityModal.tsx` uses its own inline Cohen's κ only — no method picker, α/Fleiss not surfaced.                                                |
| 3   | Telemetry events                                                | ✅ DONE    | `utils/analytics.ts:19-82` — ~50 named events (was 4): activation funnel, conversion, inline-AI, cmdk, onboarding. GA4 + Plausible + backend ingest.                                                                                                                                                   |
| 4   | Cmd+K coverage                                                  | ✅ DONE    | `CommandPalette.tsx` registers excerpts (252), weighting (297), codebook (357), hierarchy (363), cases (369), ethics (387), AI modals. `cmdk_search_no_results` telemetry at l.579.                                                                                                                    |
| 5   | VS Code activity bar / IA                                       | ⚠️ PARTIAL | `ActivityBar.tsx` fully built (8 panels). **But** `featureFlagsStore.ts:57` ships `activity_bar_v2: false`; `CanvasToolbar` dropdowns remain the live UI for all users.                                                                                                                                |
| 6   | 85-second onboarding                                            | ✅ DONE    | `onboarding/OnboardingFlow.tsx` — 2-screen flow (not 22-step tour), lands on pre-seeded canvas; `OnboardingChecklist.tsx` 5 reactive tasks; `onboarding_completed_seconds` tracked.                                                                                                                    |
| 7   | AI prompt upgrades (5 gaps)                                     | ✅ DONE    | `utils/aiPrompts.ts` — all 5 fixed: few-shot examples, text-anchor (not char-offset) matching, AAVE/bias-awareness clause, `cache_control: ephemeral`, 4-band confidence rubric.                                                                                                                       |
| 8   | Inline AI tag suggestions                                       | ✅ DONE    | `transcript/InlineCodeSuggester.tsx` + `panels/AiSuggestPanel.tsx` + `QuickCodePopover` AI mode; `inline_ai_*` telemetry.                                                                                                                                                                              |
| 9   | Mobile canvas <768px                                            | ✅ DONE    | `hooks/useMobile.ts`; `CanvasWorkspace.tsx:152-167` mobile hint + minimap suppression; checklist hidden on mobile.                                                                                                                                                                                     |
| 10  | DB backups + migrate-diff CI                                    | ⚠️ PARTIAL | `.github/workflows/backup-prod.yml` — weekly `pg_dump`→R2 DONE. **But** `ci.yml` schema-drift job is `continue-on-error: true` (soft-fail) — drift visible, never blocks a PR (SQLite-era migrations 0001–0011 can't replay on Postgres).                                                              |

---

## The three genuinely-open items (ranked by value/effort)

1. **Intercoder modal method picker** — backend computes α + Fleiss but the modal only shows Cohen's κ.
   "Intercoder κ + α live" is literally on the Team pricing card → an advertised, paid-tier feature gap.
   Frontend-only wiring over already-tested backend math. **Best "ship now" candidate: high value, low risk, TDD-able.**
2. **Flip `activity_bar_v2` on** — the IA redesign is invisible until flagged on; needs live verification + is a
   default-UI product decision (higher risk, needs prod screenshot verification).
3. **Harden the schema-drift CI guard** — remove `continue-on-error` once SQLite-era migrations are reconciled;
   prevents silent prod schema drift (valuable but a bigger migration-history task).

---

## Bottom line

"Reconcile + fix Prisma" resolves to: **reconcile = this file; fix Prisma = nothing to do (already fixed).**
The remaining work is shipping item 1 (then optionally 2 and 3).

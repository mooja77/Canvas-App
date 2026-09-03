# `docs/implementation/` — README

Technical specs for the 12-week implementation plan in [`../../IMPLEMENTATION_PLAN.md`](../../IMPLEMENTATION_PLAN.md).

## Layout

```
docs/implementation/
├── 00_readme.md                    ← you are here
├── 01_roadmap.md                   ← week-by-week schedule + dependencies
├── 02_sprint_a_prisma_cascades.md  ← 20-min data-integrity fixes (DO FIRST)
├── 03_sprint_b_voice_telemetry.md  ← copy reconciliation + 15 events
├── 04_sprint_c_pricing.md          ← restructure tiers + Stripe + experiments
├── 05_sprint_d_krippendorff.md     ← α + Fleiss κ implementation
├── 06_sprint_e_legal_compliance.md ← DPA + Trust page + audit-read events
├── 07_sprint_f_onboarding.md       ← 85-second flow replacing 22-step tour
├── 08_sprint_g_activity_bar_ia.md  ← VS Code-style IA + Cmd+K coverage
├── 09_sprint_h_inline_ai.md        ← Inline tag suggestions on highlight
├── 10_reliability_investments.md   ← 10 reliability fixes (cross-cutting)
├── 11_ai_prompt_upgrades.md        ← Few-shot, caching, bias-awareness
├── 12_react_flow_perf.md           ← Top 5 perf fixes
├── 13_brand_identity.md            ← Tier 2 visual rollout
├── 14_marketing_gtm.md             ← SEO + content + conferences + KPIs
└── 15_feature_flags.md             ← Rollout strategy + Zustand-backed flag store
```

## Reading order

**If you're a new engineer:**

1. Read `../../EXECUTIVE_SUMMARY.md` (10 min) for context
2. Read `01_roadmap.md` here for the schedule
3. Pick up `02_sprint_a_prisma_cascades.md` first — it's the next thing to ship

**If you're a PM/founder reviewing:**

1. Read `../../IMPLEMENTATION_PLAN.md` (10 min)
2. Skim `01_roadmap.md` for sequencing
3. Read individual sprint specs as needed

**If you're a designer joining:**

- Start with `13_brand_identity.md`
- Then `07_sprint_f_onboarding.md` (touches design heavily)
- Then `08_sprint_g_activity_bar_ia.md` (IA layout decisions)

## Spec format

Every sprint spec follows this structure:

```
# Sprint X — <name>

## Goal (1 sentence)
## Scope (bullets — what's in)
## Out of scope (bullets — what's not)
## File-level changes
  - Per-file diff or new-file content
## Database changes (if any)
  - Schema diffs + migration command
## Tests
  - Unit + E2E test descriptions
## Acceptance criteria
  - Checklist
## Rollback
  - How to undo
## Telemetry
  - Events to fire
## Effort
  - Hours/days estimate
## Owner
  - TBD (until claimed)
```

## Standards

- All file paths use absolute Windows paths: `C:\JM Programs\QualCanvas\...`
- All code snippets are copy-pasteable
- All schema changes include the `npx prisma migrate dev --name <name>` command
- All UI changes specify the exact file:line where it lives
- All telemetry events are listed by exact event name + payload schema
- All sprints carry an explicit rollback plan

## What this folder is NOT

- Research / "why" justifications → see `../../UX_FINDINGS_APPENDIX.md`
- High-level strategic sequencing → see `../../UX_ENHANCEMENT_PLAN_V3.md`
- Visual feature catalogue → see `../../FEATURE_CATALOGUE.md`

This folder is for **engineers writing code**, not for stakeholders reviewing strategy.

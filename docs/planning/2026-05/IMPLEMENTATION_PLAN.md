# QualCanvas — Implementation Plan

**Date:** 2026-05-13
**Status:** Active. This is the canonical entry point for the next 12 weeks of engineering work.

This document is the single source of truth for **what we are shipping, in what order, with what acceptance criteria**. Detailed technical specs for each workstream live in `docs/implementation/`.

---

## TL;DR — the 12-week ship list

| #   | Sprint              | Workstream                              | Duration            | Risk                | File                                                                                   |
| --- | ------------------- | --------------------------------------- | ------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| A   | Data integrity      | 3 Prisma cascade fixes                  | 20 min              | 🟢 Trivial          | [02_sprint_a_prisma_cascades.md](docs/implementation/02_sprint_a_prisma_cascades.md)   |
| B   | Foundation          | Voice reconciliation + telemetry events | 2 days              | 🟢 Low              | [03_sprint_b_voice_telemetry.md](docs/implementation/03_sprint_b_voice_telemetry.md)   |
| C   | Revenue             | Pricing restructure ($17 / $39 / $49)   | 1 day code + Stripe | 🟡 Medium (revenue) | [04_sprint_c_pricing.md](docs/implementation/04_sprint_c_pricing.md)                   |
| D   | Methodological moat | Krippendorff α + Fleiss κ               | 1-2 weeks           | 🟢 Low              | [05_sprint_d_krippendorff.md](docs/implementation/05_sprint_d_krippendorff.md)         |
| E   | Compliance          | DPA + Trust page + audit-read events    | 2-3 weeks (+legal)  | 🟡 Medium           | [06_sprint_e_legal_compliance.md](docs/implementation/06_sprint_e_legal_compliance.md) |
| F   | Activation          | 85-second onboarding                    | 3-4 days            | 🟡 Medium           | [07_sprint_f_onboarding.md](docs/implementation/07_sprint_f_onboarding.md)             |
| G   | Discoverability     | VS Code activity bar + Cmd+K coverage   | 5 days              | 🟡 Medium           | [08_sprint_g_activity_bar_ia.md](docs/implementation/08_sprint_g_activity_bar_ia.md)   |
| H   | AI moat             | Inline AI tag suggestions on highlight  | 4 days              | 🟡 Medium           | [09_sprint_h_inline_ai.md](docs/implementation/09_sprint_h_inline_ai.md)               |

**Cross-cutting workstreams (run parallel where possible):**

| Workstream                         | Effort               | File                                                                               |
| ---------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| Reliability investments (10 items) | ~23 hours total      | [10_reliability_investments.md](docs/implementation/10_reliability_investments.md) |
| AI prompt upgrades                 | ~1 day               | [11_ai_prompt_upgrades.md](docs/implementation/11_ai_prompt_upgrades.md)           |
| React Flow perf refactor           | ~1 week              | [12_react_flow_perf.md](docs/implementation/12_react_flow_perf.md)                 |
| Brand identity Tier 2              | 4-6 weeks (designer) | [13_brand_identity.md](docs/implementation/13_brand_identity.md)                   |
| GTM + marketing                    | 12 weeks             | [14_marketing_gtm.md](docs/implementation/14_marketing_gtm.md)                     |
| Feature flags                      | 1 day                | [15_feature_flags.md](docs/implementation/15_feature_flags.md)                     |

---

## Schedule

```
WEEK   1   2   3   4   5   6   7   8   9   10  11  12
       │   │   │   │   │   │   │   │   │   │   │   │
A ████ │   │   │   │   │   │   │   │   │   │   │   │      Prisma cascades (Day 1)
B   ██ │   │   │   │   │   │   │   │   │   │   │   │      Voice + telemetry (Day 2-3)
C      ██  │   │   │   │   │   │   │   │   │   │   │      Pricing (Day 4-5)
D        ████████  │   │   │   │   │   │   │   │   │      Krippendorff (Weeks 1-2 in parallel)
E              ████████████   │   │   │   │   │   │       Compliance (Weeks 3-5)
F                       ███   │   │   │   │   │   │       Onboarding (Week 5-6)
G                           ██████ │   │   │   │   │      Activity bar (Week 6-7)
H                                  ████   │   │   │       Inline AI (Week 7-8)
Reliability ██████████████████████████████████████        Continuous, fit between sprints
Perf refactor              ████████████   │   │   │       Weeks 5-7
Brand                              ██████████████████     Weeks 7-12 (parallel, designer-led)
GTM    ████████████████████████████████████████████       Continuous (content + comparison pages)
```

---

## Acceptance criteria (every sprint must satisfy)

1. ✅ Lighthouse Performance ≥ 90 on `/canvas` mobile
2. ✅ 60fps interaction during pan/zoom at 50 nodes
3. ✅ Zero new console errors
4. ✅ Dark mode parity verified on new components
5. ✅ Keyboard accessible (Tab/Enter/Esc) for all new controls
6. ✅ Mobile tested at 390×844 (iPhone) and 768×1024 (iPad)
7. ✅ E2E test added for new flow
8. ✅ Visual regression baseline updated
9. ✅ Test coverage maintained or improved
10. ✅ ARIA labels on every new interactive element

---

## Order of operations

**Day 1 (today):** Sprint A — Prisma cascade fixes. Pure win, zero risk, 20 minutes.

**Days 2-3:** Sprint B — Voice reconciliation + 15 telemetry events. Cheap quality signal + measurement infrastructure for everything that follows.

**Days 4-5:** Sprint C — Pricing restructure. Stripe Price IDs + plans.ts + PricingPage CTAs + default annual.

**Weeks 1-2 (parallel):** Sprint D — Krippendorff α. Unlocks institutional sales segment (~$130-200K pipeline).

**Weeks 3-5:** Sprint E — Compliance (DPA + Trust page + audit-read). Unblocks ~70% of EU + enterprise deals.

**Week 5-6:** Sprint F — Onboarding redesign. Targets 40% → 70% activation rate.

**Weeks 6-7:** Sprint G — Activity bar IA + Cmd+K coverage. Solves the 16-features-hidden problem.

**Weeks 7-8:** Sprint H — Inline AI tag suggestions. The Dovetail-killer feature.

**Weeks 5-7 (parallel):** React Flow perf refactor — extract `CanvasWorkspace.tsx` (2,787 lines).

**Weeks 7-12 (parallel):** Brand identity Tier 2 rollout (designer-led).

**Continuous:** Reliability investments, AI prompt upgrades, marketing content + comparison pages.

---

## Cross-cutting decisions made

These are settled. Don't relitigate.

1. **Tagline:** _"The canvas where qualitative research thinks with you."_
2. **Wedge customer:** dissertation student (PhD year 3, 12-30 interviews, $9-12/mo budget, viral cohort, /r/PhD discovery channel)
3. **Pricing tiers:** Free / Pro $17/mo / Researcher Pro $39/mo / Team $49/seat/mo (annual = 18-20% off, default toggle to annual)
4. **Voice direction:** Plain-spoken. Methodologically literate. Quietly competitive.
5. **Brand direction:** Ink (#0F1419) + Ochre (#C8853B). Fraunces display + Inter body + JetBrains Mono accent. 22 custom canvas node icons.
6. **AI position:** Two-phase always. AI proposes; researcher approves. Citation-linked. Bias-aware.
7. **Feature flag library:** simple Zustand-backed (no Growthbook/LaunchDarkly yet)
8. **Vector store:** pgvector on existing Postgres (not Pinecone)
9. **No FedRAMP** until $5M+ ARR
10. **No native mobile** until web PWA reaches plateau

---

## Risks and mitigations

| Risk                                                | Likelihood | Mitigation                                                                                                         |
| --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Feature creep (Q2 ambition)                         | High       | Ship Sprint A-C in 1 week before starting D. Force-rank weekly.                                                    |
| AI cost spike from Magic Cluster + Cmd+J chat       | Medium     | Aggressive embed caching, daily caps, Anthropic prompt caching, fallback to Haiku for cost-sensitive flows.        |
| Pricing change pushback from existing $12 Pro users | Medium     | Grandfather all existing subscriptions; never raise on existing customers.                                         |
| 2,787-line CanvasWorkspace refactor breaks things   | Medium     | Extract incrementally (one sub-component per PR); 683 E2E tests + visual regression catch regressions.             |
| Visual brand refresh without designer = mediocre    | Medium     | Copy named references (ComfyUI, Linear, Notion) by name; don't invent. Hire freelance for Tier 2 if budget allows. |
| Krippendorff α math wrong → methodologists notice   | Low        | Test against Krippendorff (2018) ch. 12 published datasets to 4 decimal places.                                    |

---

## Strategic docs (read these for context)

| Doc                                                    | Read time | When to read                                    |
| ------------------------------------------------------ | --------- | ----------------------------------------------- |
| [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)           | 10 min    | Start here for "the whole game in one page"     |
| [UX_ENHANCEMENT_PLAN_V3.md](UX_ENHANCEMENT_PLAN_V3.md) | 45 min    | Sprint sequencing rationale                     |
| [UX_FINDINGS_APPENDIX.md](UX_FINDINGS_APPENDIX.md)     | 2 hr      | Evidence base — every claim has a citation here |
| [FEATURE_CATALOGUE.md](FEATURE_CATALOGUE.md)           | 30 min    | What's already built (don't rebuild it)         |
| [MASTER_INDEX.md](MASTER_INDEX.md)                     | 5 min     | Navigates everything                            |

---

## Closing note

Detailed technical specifications for every sprint live in `docs/implementation/`. Each spec is structured as:

- **Goal** — 1 sentence
- **Scope** — what's in
- **Out of scope** — what's not
- **File-level diffs** — actual code changes
- **Tests** — what to verify
- **Acceptance criteria** — definition of done
- **Rollback** — how to undo
- **Effort** — hours/days
- **Telemetry** — what to track

Read [docs/implementation/00_readme.md](docs/implementation/00_readme.md) for the directory layout. Start with Sprint A.

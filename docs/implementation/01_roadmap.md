# 12-Week Implementation Roadmap

## Gantt overview

```
WEEK   1   2   3   4   5   6   7   8   9   10  11  12
A      ▓   .   .   .   .   .   .   .   .   .   .   .    Sprint A — Prisma cascades (20m)
B      ▓▓  .   .   .   .   .   .   .   .   .   .   .    Sprint B — Voice + telemetry (2d)
C      .▓  .   .   .   .   .   .   .   .   .   .   .    Sprint C — Pricing (1d code)
D      ░░ ▓▓▓▓▓▓ .   .   .   .   .   .   .   .   .      Sprint D — Krippendorff (1-2w)
E      .   .   ▓▓▓▓▓▓▓▓▓ .   .   .   .   .   .   .      Sprint E — Compliance (2-3w)
F      .   .   .   .   .▓▓▓ ▓ .   .   .   .   .   .      Sprint F — Onboarding (3-4d)
G      .   .   .   .   .   .▓▓▓▓▓ .   .   .   .   .      Sprint G — Activity bar (5d)
H      .   .   .   .   .   .   .▓▓▓▓ .   .   .   .      Sprint H — Inline AI (4d)
Rel    ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒    Reliability (continuous)
Perf   .   .   .   .   ░░░ ░░░ ░ .   .   .   .   .      React Flow refactor (3w)
Brand  .   .   .   .   .   .   ░░░░░░░░░░░░░░░░░░ ░     Brand Tier 2 (designer, 6w)
GTM    ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒    GTM + marketing content
```

Legend: `▓` = active dev | `░` = passive/parallel | `⌒` = continuous | `.` = idle

## Week-by-week milestones

### Week 1 — Foundation

- ✅ Sprint A: 3 Prisma cascade fixes merged (Day 1)
- ✅ Sprint B: Voice reconciliation complete (Day 2-3)
- ✅ Sprint B: 15 telemetry events wired (Day 2-3)
- ✅ Sprint C: Pricing code + Stripe Price IDs (Day 4-5)
- ⏳ Sprint D started (Krippendorff α implementation begins)
- ⏳ Reliability fix #1: `prisma migrate diff` in CI
- ⏳ Reliability fix #2: Prisma connection pool config

### Week 2 — Methodological moat

- ✅ Sprint D: Krippendorff α + Fleiss κ shipped
- ✅ Sprint D: Methods white-paper drafted (1-page, customer-citable)
- ⏳ Reliability fix #3: Retry wrapper for LLM SDK calls
- ⏳ Reliability fix #4: Postgres backup automation
- ⏳ Pricing experiments 1-3 launched (A/B)

### Week 3-4 — Compliance

- ✅ Sprint E: Trust page (`/trust`) live
- ✅ Sprint E: DPA template + legal review
- ✅ Sprint E: Sub-processor list published
- ✅ Sprint E: Audit-read events middleware
- ✅ Sprint E: Privacy Policy GDPR rewrite
- ⏳ AI prompt upgrades begin (few-shot examples)

### Week 5-6 — Activation

- ✅ Sprint F: 85-second onboarding shipped
- ✅ Sprint F: 5 templates seeded
- ✅ Sprint F: 22-step tour moved to /help (not auto-fired)
- ⏳ React Flow perf refactor begins
- ⏳ Brand identity designer engaged (kickoff)

### Week 6-7 — Discoverability

- ✅ Sprint G: VS Code activity bar live
- ✅ Sprint G: Cmd+K coverage complete (16 missing actions registered)
- ✅ Sprint G: Inspector contextual panel
- ✅ Sprint G: Mobile responsive (390/768 breakpoints)

### Week 7-8 — AI moat

- ✅ Sprint H: Inline AI tag suggestions on highlight
- ✅ Sprint H: Two-phase suggestions tray
- ✅ Sprint H: Backend streaming `/suggest-codes-inline`
- ⏳ Brand: 22 custom canvas node icons delivered

### Week 9-10 — Polish + perf

- ✅ React Flow refactor complete (CanvasGridController, CanvasPanelManager, CanvasEventHandlers extracted)
- ✅ useCanvasKeyboard split into 5 smaller hooks
- ✅ Brand: color system migrated (Ink + Ochre)
- ✅ Brand: Fraunces + JetBrains Mono fonts wired
- ⏳ 5 marketing GIFs recorded + embedded

### Week 11-12 — Marketing momentum

- ✅ Brand: full visual identity rollout complete
- ✅ Marketing: 4 comparison pages live (`/vs-nvivo`, `/vs-atlas-ti`, `/vs-dovetail`, `/vs-delve`)
- ✅ Marketing: 2 migration pages live (`/import-from-nvivo`, `/import-from-dovetail`)
- ✅ Marketing: 4 blog posts published
- ⏳ AERA 2026 submission deadline (Sprint plan + booth alternative)

## Dependency graph

```
A ──┐
    ├──── B ──── C ──── D ──── E ──── F ──── G ──── H
    │                                                 │
    │                                                 │
Rel─┴─Continuous──────────────────────────────────────┘
Perf──────────────────────────────parallel from W5────┘
Brand─────────────────────────────parallel from W7────┘
GTM───Continuous──────────────────────────────────────┘
```

- A → B: Schema must be stable before adding telemetry events
- B → C: Telemetry must be wired before pricing experiment (need to measure)
- C → D: Pricing must ship before α (Researcher Pro tier needs α as exclusive feature)
- D → E: α gives institutional credibility; compliance unlocks the sales
- E → F: Trust page improves signup conversion before onboarding rework
- F → G: Onboarding teaches users about features; activity bar surfaces them
- G → H: Inline AI lives in the new activity bar's AI panel

## Sprint review cadence

- **Daily standup** (15 min) — what shipped, what's blocked, what's next
- **Friday demo** (30 min) — show what shipped this week
- **End-of-sprint retro** (45 min) — what went well, what hurt, what to fix

## Definition of done (per sprint)

See [`../../IMPLEMENTATION_PLAN.md` § Acceptance criteria](../../IMPLEMENTATION_PLAN.md). 10 boxes:

1. Lighthouse ≥ 90 mobile
2. 60fps at 50 nodes
3. Zero new console errors
4. Dark mode parity
5. Keyboard accessible
6. Mobile tested (390 + 768)
7. E2E test added
8. Visual regression baseline updated
9. Test coverage maintained
10. ARIA on all interactives

## What's NOT in the 12-week plan

These are explicitly deferred to Q2/Q3 2026:

- Video-transcript-canvas tri-sync (Reduct steal)
- Channels (auto-tag incoming transcripts)
- Repository graph view
- Native mobile / PWA full polish
- SOC 2 Type II audit (starts Week 8, finishes Q3)
- HIPAA tier
- EU region
- FedRAMP

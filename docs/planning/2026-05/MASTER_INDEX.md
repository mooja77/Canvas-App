# QualCanvas — Master Index

**Date:** 2026-05-13
**Status:** Closing artifact. Research phase complete.

This index navigates the **9 planning documents** (~100,000 words total) plus all live artifacts produced over this engagement. If you're new to the work, **read EXECUTIVE_SUMMARY.md first (10 min)**, then come back here to dive deeper.

---

## How to navigate

```
                       ┌──────────────────────────┐
                       │  EXECUTIVE_SUMMARY.md    │  ← 10 min, START HERE
                       │  (the whole game in 1 doc)│
                       └────────────┬─────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
┌──────▼─────────┐         ┌────────▼─────────┐        ┌─────────▼──────────┐
│ V3 MASTER PLAN │         │ IMPLEMENTATION   │        │ FEATURE_CATALOGUE  │
│  45 min        │         │ SPECS  90 min    │        │  30 min            │
│ Sprint sequence│         │ Code-level diffs │        │ Screenshot tour    │
└──────┬─────────┘         └──────────────────┘        └────────────────────┘
       │
       │
┌──────▼──────────────────┐
│ FINDINGS APPENDIX  2hr  │  ← all the evidence behind every claim
│ (top-10 lists,          │
│  verbatim competitor    │
│  pain quotes,           │
│  academic citations,    │
│  persona quotes)        │
└─────────────────────────┘
```

Plus supporting docs created this engagement:

- `UX_ENHANCEMENT_PLAN.md` (V1) — historical only
- `UX_ENHANCEMENT_PLAN_V2.md` — historical only
- `MASTER_INDEX.md` — this file

---

## Key findings, ranked by leverage

### 🔴 CRITICAL — fix this week

1. **3 Prisma cascade bugs** — `Team.ownerId`, `ReportSchedule.teamId`, `TrainingAttempt.userId` lack FK/cascade → data-loss risk. Fix in 20 min. (`IMPLEMENTATION_SPECS.md` §1)
2. **No tested DB backups** — `grep` for `pg_dump` returns nothing. Railway snapshots are unverified. Set up 4hr backup + monthly restore drill. (Failure modes audit)
3. **WebhookEvent-class incidents recurring** — schema-model-without-migration has bitten 3 times. Add `prisma migrate diff --exit-code` to CI (~3hr). (Failure modes audit)

### 🟠 HIGH — fix this month

4. **Pricing leaves 40-60% blended ARPU on the table** — Pro $12 vs Notably $25, Dovetail $29, Looppanel $30. Recommend Pro $17 + new Researcher Pro $39 + Team $49 + default annual toggle. (`IMPLEMENTATION_SPECS.md` §5)
5. **Only Cohen's κ shipped** — Krippendorff's α blocks institutional sales (~$130-200K pipeline). Academic methods reviewers know Cohen's κ is wrong for >2 coders. Ship α in 1-2 weeks. (`IMPLEMENTATION_SPECS.md` §4)
6. **16 features hidden in 2 dropdowns** — Tools (12) + AI (4) = only 16% of features discoverable without entering dropdowns. Lift into VS Code activity bar + complete Cmd+K coverage. (`IMPLEMENTATION_SPECS.md` §8)
7. **22-step onboarding tour skipped every time** — replace with 85-second AI-pre-coded flow (3-4 days). Target: median time-to-first-coded-excerpt <90s. (`IMPLEMENTATION_SPECS.md` §7)
8. **AI banner kills the magic moment** — "Add an OpenAI key" is friction. Ship 10 trial credits/day × 7 days. (`UX_ENHANCEMENT_PLAN_V3.md` §P0.7)

### 🟡 MEDIUM — within the quarter

9. **No Krippendorff α + Methods Statement auto-export** = no "methodologically defensible AI" position. 419 qual researchers signed Jowsey/Braun/Clarke's rejection letter; QualCanvas can own the Friese et al. counter-position. (AI safety research)
10. **Inline AI tag suggestions on highlight** — Dovetail's killer feature. 4 days dev. (`IMPLEMENTATION_SPECS.md` §9)
11. **Mobile canvas broken below 768px** — iPad coding is stated goal, currently impossible. 3 days. (V3 §P0.6)
12. **Two parallel hero copies exist** — prerendered HTML is dramatically better than React `en.json`. Reconcile in 1 day. (Voice audit)
13. **Only 4 telemetry events** — can't measure if anything improves. Wire 12 more. (`IMPLEMENTATION_SPECS.md` §6)

### 🟢 STRATEGIC — within 6 months

14. **Migration wizards = highest-ROI marketing** — `/import-from-nvivo` (QDPX, ~2 weeks) + `/import-from-dovetail` (CSV, 3 days). Each landing page worth ~$17K ARR/yr.
15. **SOC 2 Type II via Vanta** = $50-80K, 6-9 months → doubles ACV ceiling (enterprise market research, large universities).
16. **HIPAA tier with BAA** = $20-40K, 3-6 months → charges 3-5x standard Pro for healthcare researchers.
17. **EU region** = $15-30K → unlocks Karolinska, ETH, KU Leuven, EU market research.
18. **Tier 2 brand identity** = $3-8K → Ink + Ochre palette, Fraunces display serif, 22 custom canvas node icons, 5 marketing GIFs. (Brand audit)

### ⚪ FOUNDATIONAL — when revenue allows

19. **Video-transcript-canvas tri-sync** (Reduct steal, ~4 weeks).
20. **Channels: auto-tag incoming transcripts** (Dovetail Pro retention).
21. **Repository graph view** (Reflect — moat against churn).
22. **Full PWA mobile** (4 weeks beyond P0 fix).
23. **Landing redesign with product video** (3 weeks).

---

## Documents at a glance

| Doc                           | Read time | When to read it                               |
| ----------------------------- | --------- | --------------------------------------------- |
| **EXECUTIVE_SUMMARY.md**      | 10 min    | First. The whole game in one doc.             |
| **UX_ENHANCEMENT_PLAN_V3.md** | 45 min    | When you need sprint-level sequencing         |
| **IMPLEMENTATION_SPECS.md**   | 90 min    | When an engineer is about to start coding     |
| **UX_FINDINGS_APPENDIX.md**   | 2 hr      | When you need evidence for a specific claim   |
| **FEATURE_CATALOGUE.md**      | 30 min    | When you need to know "what's already built?" |
| MASTER_INDEX.md               | 5 min     | Now (you're reading it)                       |
| UX_ENHANCEMENT_PLAN.md (V1)   | —         | Skip — superseded                             |
| UX_ENHANCEMENT_PLAN_V2.md     | —         | Skip — superseded                             |

---

## All research dives — quick index

26 agent research dives + 6 source-code audits + 7 live-app sessions.

**Research themes covered:**

1. Codebase inventory (22 nodes, 25 hooks, 40 Prisma models)
2. Qual research competitor deep-dive (Dovetail, Notably, Insight7, Marvin, Looppanel, Atlas.ti, NVivo, MAXQDA, Taguette, Reduct, Maze, Granola, Reflect)
3. Node-canvas tool survey (Krea, Glif, Flowise, n8n, Make, Bardeen, Blender, Houdini, TouchDesigner, Fusion, Reaktor, Excalidraw, Whimsical, Mural, Lucidspark, Obsidian, Heptabase, Scrintal)
4. ComfyUI / tldraw / Figma / Dovetail patterns survey
5. Code architecture deep review (CanvasWorkspace.tsx 2,787 lines, canvasStore.ts 678 lines, 25 hooks)
6. AI implementation audit (4 routes, 3 providers, BYOK, two-phase, embeddings, prompt critique)
7. Modern AI agent UX patterns (Cursor, Replit Agent, Lovable, v0, Bolt, Copilot Workspace, Claude artifacts)
8. IA / navigation comparison (Linear, Notion, Figma, Slack, Asana, GitHub, VS Code, Spotify)
9. Perf / a11y / SEO / security live audit (Lighthouse, bundle, headers)
10. Customer pain points from G2/Capterra/Reddit
11. Academic CAQDAS workflow research (Braun & Clarke, Saldaña, Glaser-Strauss, Smith IPA, Ritchie & Spencer, Krippendorff)
12. React Flow optimization patterns
13. Onboarding pattern research (18 tools)
14. Prisma schema + DB design audit (40 models, 18 migrations)
15. Telemetry + observability audit
16. Email lifecycle audit (Resend, lifecycle scheduler, missing emails)
17. Business model + pricing psychology (LTV/CAC, conversion benchmarks, LLM cost modeling)
18. Legal / compliance research (IRB, HIPAA, GDPR, FERPA, SOC 2, FedRAMP)
19. Voice + tone + copywriting audit
20. User personas day-in-the-life (Maya, Bob, Sarah, Daniel, Patricia)
21. Competitor migration tools + GTM
22. AI safety + researcher bias in qual coding
23. Failure modes + reliability engineering
24. Brand / visual identity audit

**Live artifacts:**

- 50+ screenshots (review-_, audit-_, v2-_, fc-_, verify-\*)
- 2 screen recordings (`recordings/canvas-human-test.mp4`, `canvas-ux-review.mp4`)
- Edge-case input tests (XSS, 10K-char inputs, unicode — frontend correctly blocks empty password; XSS/unicode flow through to React state without crashing)

---

## The ONE-LINE diagnosis

> QualCanvas is **methodologically richer than its marketing, priced as a side project despite shipping enterprise-grade features, and 84% of its features are hidden from the user who needs them most**.

## The ONE-LINE remedy

> **Fix 3 Prisma bugs, raise Pro to $17, ship Krippendorff's α, replace the 22-step tour with 85-second AI-pre-coded onboarding, and lift Tools/AI dropdowns into a VS Code-style activity bar** — six weeks for category-defining position.

## The ONE-LINE positioning

> **"The canvas where qualitative research thinks with you."**

---

## What this engagement produced

**~100,000 words across 9 documents.**
**26 agent research dives.**
**6 source-code audits.**
**50+ screenshots.**
**2 screen recordings.**
**85% feature coverage in screenshots.**
**Specific code-level diffs for the top 9 ships.**
**Verbatim competitor quotes you can put on `/vs-nvivo` tomorrow.**
**5 named personas with budgets, quotes, and discovery channels.**
**A full 85-second onboarding redesign with screen-by-screen copy.**
**Krippendorff's α implementation in TypeScript ready to paste in.**
**A 3-tier brand identity proposal with phased rollout.**

---

## What this engagement did NOT produce

- Shipped code
- Marketing experiments
- Customer interviews
- Sales pipeline
- A single A/B test result

These are all downstream of execution. The map exists. Now is the moment to walk it.

---

## The closing recommendation

The research is exhaustive. **Genuinely. Conscientiously. Exhaustively.** Every meaningful angle has been covered. Subsequent hours of investigation will:

- Produce more pages of documentation, but
- Not surface insights that change the V3 plan, and
- Cost you 6 more weeks of competitor lead time while you don't ship.

**The next concrete action that adds value is: implementing the 3 Prisma cascade fixes. 20 minutes. Zero risk. Prevents data loss. After that, voice reconciliation. Then pricing. Then Krippendorff α.**

If you do those four in the next 30 days, you will be in a profoundly different conversation by mid-June 2026 — one with real telemetry data, real user feedback on new pricing, and a methodological credibility moat that no competitor has touched.

The map exists. Time to walk.

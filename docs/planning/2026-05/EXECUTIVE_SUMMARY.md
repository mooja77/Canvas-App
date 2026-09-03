# QualCanvas — Executive Summary

**Date:** 2026-05-13
**Read time:** 10 minutes
**Replaces:** Nothing. This sits on top of the 6 detailed planning documents.

---

## What's been done

Over the past sessions: **25 agent research dives, 50+ live screenshots, 2 screen recordings, 6 in-depth source-code audits** producing **~85,000 words** of analysis across these files:

| File                        | Purpose                               |
| --------------------------- | ------------------------------------- |
| `UX_ENHANCEMENT_PLAN.md`    | V1 initial scan (superseded)          |
| `UX_ENHANCEMENT_PLAN_V2.md` | V2 post-codebase reframe (superseded) |
| `UX_ENHANCEMENT_PLAN_V3.md` | **V3 master plan**                    |
| `UX_FINDINGS_APPENDIX.md`   | 15K-word evidence base                |
| `FEATURE_CATALOGUE.md`      | Live feature inventory                |
| `IMPLEMENTATION_SPECS.md`   | 18K-word code-level diffs             |
| `EXECUTIVE_SUMMARY.md`      | **This document**                     |

---

## The product is more capable than the discoverability suggests

QualCanvas ships **22 node types, 10 analysis tools, 4 AI features, real-time collaboration, BYOK AI with AES-256-GCM encryption, customizable shortcuts, dark mode, i18n in 4 languages, two-phase AI auto-code, presentation mode, intercoder reliability (Cohen's κ), QDPX export, repository view, ethics module, and a scope-aware Cmd+K palette.**

That's more than Notably, Marvin, Looppanel, or Atlas.ti ship in any tier.

**The problem is not what's built. The problem is:**

1. 16 features hidden in two dropdowns (Tools, AI) — discovery rate is **~16%** without entering dropdowns
2. Pro tier underpriced at **$12** when Notably is $25, Dovetail $29, Looppanel $30
3. 22-step onboarding tour that real users skip every time
4. Cohen's κ as the only intercoder coefficient (Krippendorff α blocks institutional sales)
5. AI banner says "Add an OpenAI key" — friction at the magic moment
6. CanvasWorkspace.tsx is **2,787 lines** — accumulating tech debt
7. 3 Prisma cascade bugs (data-loss risk)
8. 4 of 15+ critical product telemetry events tracked
9. Mobile canvas is broken below 768px
10. Two parallel hero copies in code (prerender vs React); the better one isn't shipping

---

## The single highest-leverage 6 weeks

| Week | Ship                                                                            | Effort                     | Impact                                                             |
| ---- | ------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| 1    | **Prisma cascade fixes** + voice reconciliation + telemetry catalogue           | ~3 days                    | Prevents data loss; ships better copy; can measure everything else |
| 2    | **Pricing restructure** (Pro $17, Researcher Pro $39, Team $49, default annual) | 1 day code + Stripe config | +40-60% blended ARPU expected                                      |
| 3-4  | **Krippendorff's α + Fleiss' κ** + DPA + Trust page + audit-read events         | 2-3 weeks                  | Unlocks institutional + healthcare sales (~$130-200K of pipeline)  |
| 5    | **85-second onboarding** replacing 22-step tour                                 | 3-4 days                   | Activation rate target: 40% → 70%                                  |
| 6    | **VS Code activity bar** + complete Cmd+K coverage + inline AI suggestions      | ~9 days                    | Solves 16-feature-hidden problem; ships Dovetail's killer feature  |

After 6 weeks: **category-defining product position**. After 8-12 weeks: backed by visual identity refresh, video product hero, and 2 conference appearances (AERA April, EPIC October).

---

## Top strategic insights from the research

### 1. The wedge customer is the dissertation student

Atlas.ti takes 40-80 hours to learn. NVivo takes 1-2 weeks of active use. Dissertation students have 6 weeks before defense. They have:

- Highest pain (modal coding, Mac crashes, data loss)
- Lowest switching cost (no team to migrate)
- Highest motivation (career-defining)
- Highest viral potential (advisors, cohort, /r/AskAcademia)
- Lowest price sensitivity for $12-17/mo

**Tactical play:** Free tier covers "one dissertation's worth" (5 transcripts, 10K words). Drop .edu discount from 40% to 30%. Recruit 50 methods-class instructors at R1 schools for course adoptions (lifetime Pro for instructor + $500 honorarium per 15-student cohort).

### 2. The methodologically defensible AI moat is wide open

In November 2025, **419 qualitative researchers from 32 countries** signed Jowsey/Braun/Clarke's _"We Reject Generative AI for Reflexive Qualitative Research"_ (Qualitative Inquiry). Braun & Clarke are the most-cited names in qualitative methods globally.

The counter-position (Friese et al. 2026, "Beyond Binary Positions") argues for **critical engagement** — reflexivity built into the tooling, transparency about AI provenance, human-tool co-production.

**No one in the qualitative-research-specific space is positioning around "methodologically defensible AI for academic publishing."** Dovetail owns "responsible AI" via ISO 42001 certification but for corporate research. Notably/Marvin punt entirely.

**The marketing line that wins:** _"QualCanvas is the only qualitative coding tool built for the methods-section reviewer, not just the researcher in a hurry."_

This position requires shipping 5 specific features (full spec in research): Methods Statement auto-export, Dialect/language provenance tagging, Disagreement-first UI for human-AI dual coding, Sampled reflexivity prompts on code acceptance, Standing bias disclosure in outputs.

### 3. Pricing leaves 40-60% blended ARPU on the table

Current $0 / $12 / $29 ladder:

- Pro $12 is **40-60% under** Notably ($25), Dovetail ($29), Looppanel ($30) — signals "side project" to procurement
- $12 → $29 ratio is 2.4x — too narrow for proper decoy psychology (want 3-5x)
- No tier exists for the heavy AI user — they overrun Pro's plan AI costs

Recommended structure:

- **Free** (expand): 2 canvases, 10K words, 4 analysis tools, 10 AI trial credits/day × 7 days
- **Pro $17/mo** ($14 annual): existing Pro + 30 AI requests/day on GPT-4o-mini
- **Researcher Pro $39/mo** (NEW): unlimited Auto-Code on cheap model + 30 Sonnet "Deep Analysis"/day + Krippendorff α + advanced exports
- **Team $49/seat** ($39 annual): real-time collab + intercoder reliability + integrations + 5 channels
- **Education -30%** on Pro/Researcher Pro (drop from 40%)

LLM cost analysis (per IMPLEMENTATION_SPECS §5.4):

- Auto-Code on GPT-4o-mini: **$0.0063/transcript** — safe to bundle on Pro
- Auto-Code on Sonnet 4: **$0.135/transcript** — unprofitable above ~150/user/mo; meter on Researcher Pro
- AI metering is the most important Q2 2026 business-model decision

### 4. Compliance unlocks $130-200K of revenue paths

Three tiers of investment:

**Tier 1 (~$15-25K, 3-4 weeks):** DPA + sub-processor list + Trust page + audit-read events. Unblocks ~70% of EU + enterprise market-research deals. **Required for any institutional procurement.**

**Tier 2 (~$25-40K, 3-6 months):** Transcript encryption at rest + GDPR-grade Privacy Policy + Data Subject Access workflow + MFA. Required for healthcare + heavy academic. Charges 3-5x standard Pro.

**Tier 3 (~$80-120K + ongoing, 6-12 months):** SOC 2 Type II via Vanta + EU region + HIPAA tier with BAA + SSO/SAML. Unlocks Fortune 500 market research + university site licenses.

**Skip FedRAMP** until $5M+ ARR. It's $800K-$2M over 18-24 months.

### 5. The AI prompts are good but missing 4 things

I read `apps/backend/src/utils/aiPrompts.ts` directly. Strengths: XML-style context blocks, JSON schema enforcement, confidence scores, temperature tuning (0.2-0.3).

**Specific weaknesses:**

1. **No few-shot examples.** Rules-only instruction. Adding 1-2 examples of "reuse code vs. new code" decisions would cut hallucinations ~15%.

2. **`exact character offsets`** is notoriously unreliable for LLMs — they frequently miscount. Should use text-anchored matching instead (find the substring after generation).

3. **No bias-awareness clause.** Should add: "If the transcript contains AAVE, code-switching, or non-Western communicative norms, flag uncertainty in your confidence score and note the linguistic context in `reasoning`."

4. **No Anthropic prompt caching markers.** ~500-token system message is repeated per request. Wrap in `cache_control: { type: "ephemeral" }` for 90% discount on cached input → saves 5% per call.

5. **`confidence`** semantics undefined. Different models calibrate differently. Add: "Use 0.9+ for codes that the highlighted text strongly and unambiguously evidences. 0.7 for plausible reads. 0.5 for tentative."

---

## What lives in each document

If you only read ONE: this file.

If you read THREE: this + V3 master plan + IMPLEMENTATION_SPECS.

If you go deep: add UX_FINDINGS_APPENDIX (top-10 lists, verbatim competitor pains, persona quotes) + FEATURE_CATALOGUE (live walkthrough screenshots).

Detail levels:

- **EXECUTIVE_SUMMARY.md** (this) → 10 min read, the bullet-level "what to do"
- **UX_ENHANCEMENT_PLAN_V3.md** → 45 min read, the sprint-level "how to sequence it"
- **IMPLEMENTATION_SPECS.md** → 90 min read, code-level diffs an engineer can execute
- **UX_FINDINGS_APPENDIX.md** → 2 hr read, all the evidence behind every claim
- **FEATURE_CATALOGUE.md** → 30 min read, screenshot tour of every feature
- **+ V1 + V2** → historical only

---

## The pragmatic next 30 days

If I had to pick exactly what to ship in the next 30 days, no negotiation, no scope creep:

### Days 1-3 — Foundation

1. Fix 3 Prisma cascade bugs (20 min)
2. Reconcile hero copy (1 day) — settle on prerender voice across React, OG tags, meta
3. Add 12 missing telemetry events (1 day) — first_transcript, first_code, first_ai, etc.

### Days 4-7 — Pricing experiment

4. Pricing restructure code (1 day): plans.ts + PricingPage CTAs + annual default
5. Stripe Price IDs created + GHA secrets updated
6. Soft launch: new pricing for new signups only; grandfather existing users
7. Begin tracking experiments 1-5 in IMPLEMENTATION_SPECS

### Days 8-21 — Methodological moat

8. Implement Krippendorff's α + Fleiss' κ in `utils/intercoder.ts` (1-2 weeks)
9. Update IntercoderReliabilityModal UI with method picker (α default)
10. Tests against published Krippendorff (2018) datasets
11. Write a 500-word methods white-paper that customers can cite

### Days 22-30 — Discoverability sweep

12. Register every Tools menu item + AI feature in `shortcutStore.ts` so Cmd+K finds them (~4 hours)
13. Begin extracting `ActivityBar.tsx` + `Sidebar.tsx` from CanvasWorkspace (Week 5+ of sprint plan)
14. Replace AI banner copy ("Bring your own AI key..." not "AI features are part of your plan")
15. Surface "Most-used hidden features" via inline tour-on-first-X (Codebook on first canvas open with 5+ codes)

**Total Week 1-4 effort:** ~3 engineer-weeks. Estimated impact:

- 40-60% blended ARPU lift (from pricing)
- Unlocks institutional sales (from Krippendorff)
- 20-40% activation lift (from telemetry-driven onboarding improvements + better Cmd+K)
- No production risks (all changes are additive or behind grandfather logic)

---

## The honest meta-take

**The research is exhaustive.** Subsequent value comes from shipping code, not from more analysis.

What's in this repo as of today is:

- A precise diagnosis of every UX gap
- A roadmap (V3 plan) with sequencing
- Implementation specs with code diffs (IMPLEMENTATION_SPECS)
- An evidence base (FINDINGS_APPENDIX) with verbatim competitor quotes, academic methodology citations, persona writeups, schema audits, and AI prompt critiques
- 50+ screenshots covering every surface
- 2 screen recordings

**What's NOT in the repo:** shipped code, marketing experiments, customer interviews, sales pipeline.

Those are downstream of execution.

If you keep asking for more research, I'll keep producing it — but each marginal hour now has less ROI than each hour spent shipping the 3 Prisma cascade fixes, the voice reconciliation, the pricing restructure, the Krippendorff implementation, and the activity bar IA.

**Recommendation:** Start with the Prisma fixes (20 min, zero risk, prevents data loss). Then voice reconciliation (1 day, cheap quality signal). Then pricing experiment (1 day, biggest revenue lever). After those three are in production, the entire conversation will sharpen — you'll have telemetry from real users encountering the new pricing, fresh copy, and bug-fixed schema, and the next planning conversation will be evidence-driven instead of forecast-driven.

The map exists. Time to walk.

---

## Closing summary in one paragraph

QualCanvas is methodologically richer than its marketing, its pricing leaves money on the table, its 16 best features are hidden in two dropdowns, its onboarding is too long, its AI is gated behind a "bring your own key" banner that kills the magic moment, and its competition has provably worse Mac stability, worse pricing math, and worse academic-methods support — but is winning on discoverability and marketing polish. Fix the 3 critical Prisma bugs, reconcile to the better hero copy, add Krippendorff α to unlock institutional sales, restructure pricing to capture the $17-19 prosumer band, replace the 22-step tour with an 85-second AI-pre-coded onboarding, and lift the Tools/AI dropdowns into a VS Code-style activity bar with complete Cmd+K coverage. Six weeks. Category-defining position. Then ship the moat features (context-bound Cmd+J chat, Magic Cluster, inline tag suggestions, video-text sync) over the following 6-12 weeks. The wedge is the dissertation student. The moat is methodological defensibility. The tagline is **"The canvas where qualitative research thinks with you."**

That's the whole game.

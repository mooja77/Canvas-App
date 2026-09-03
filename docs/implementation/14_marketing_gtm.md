# Marketing + GTM Plan

## Goal

Drive paying-customer acquisition over the next 12 weeks via SEO comparison content, migration landing pages, methods-credibility content, 2 conference appearances, and a referral program. Targets: +25% MoM new paid signups by month 3; first university course adoption by month 6.

## Scope

- 12 blog posts (methodology + comparison + product)
- 4 comparison pages (`/vs-nvivo`, `/vs-atlas-ti`, `/vs-dovetail`, `/vs-delve`)
- 2 migration pages (`/import-from-nvivo`, `/import-from-dovetail`)
- 2 conferences (AERA April 2026 + EPIC October 2026)
- Referral program structure
- 5 monthly KPIs
- 5 SEO landing pages for methodology terms

## Out of scope

- Paid advertising (defer until organic foundation is solid)
- Influencer partnerships
- Affiliate commission scheme (Sprint 15 considers Rewardful tooling)
- PR / press outreach

## SEO content calendar (Months 1-3)

### Month 1 — Foundation

**Blog posts** (target keywords in parens):

1. **"Coding interviews: from raw transcript to publishable themes in 7 days"** _(thematic analysis, qualitative coding)_ — workflow tutorial, ranks for top-of-funnel
2. **"Reflexivity in qualitative analysis: a working researcher's checklist"** _(reflexivity qualitative research, reflexive thematic analysis)_ — methodology, citable
3. **"The cost of NVivo: 2026 total-cost-of-ownership for a 5-person research team"** _(NVivo pricing, NVivo cost academic)_ — comparison, data-driven, ranks for high-intent NVivo searches

**Comparison pages** (live with proper SEO meta + JSON-LD):

- **`/vs-nvivo`** — 2,000-2,500 words: feature-by-feature table, honest "when to use NVivo" section, pricing math, migration link
- **`/vs-atlas-ti`** — same structure

Both should rank within 4 weeks for "qualcanvas vs nvivo" + adjacent variants.

**File:** `apps/frontend/src/pages/comparisons/VsNvivo.tsx` (new route)
**File:** `apps/frontend/src/pages/comparisons/VsAtlasTi.tsx`

### Month 2 — Migration

4. **"What QDPX actually preserves (and what it loses) when you switch CAQDAS tools"** _(QDPX, qualitative data exchange)_ — technical, shared by methodologists, builds authority
5. **"Auto-coding vs human coding: where AI helps and where it hurts inter-coder reliability"** _(AI qualitative coding, intercoder reliability AI)_ — defensive moat content
6. **"Three ways to lose your PhD data — and how to back up qualitative projects properly"** _(qualitative data backup, NVivo crash recovery)_ — emotional, viral potential

**Migration pages:**

- **`/import-from-nvivo`** — QDPX import wizard landing, honest about what's lost (per Sprint 14 dependency on actual importer impl)
- **`/import-from-dovetail`** — CSV import landing

**File:** `apps/frontend/src/pages/migrate/FromNvivo.tsx`
**File:** `apps/frontend/src/pages/migrate/FromDovetail.tsx`

### Month 3 — Authority

7. **"Intercoder reliability without tears: a Kappa primer using real data"** _(Cohen's Kappa, Krippendorff alpha, intercoder reliability)_ — methodology depth, Sprint D companion
8. **"Visual coding canvases vs hierarchical node trees: a structural comparison"** _(visual qualitative coding)_ — positions the canvas differentiator
9. **"Ethical considerations for AI-assisted qualitative coding: an IRB-ready briefing"** _(IRB AI qualitative, AI ethics research)_ — paired with Ethics module

**Comparison pages:**

- **`/vs-maxqda`**
- **`/vs-delve`** — Delve is the closest direct competitor; this page will convert well

## 2026 conferences

### AERA 2026 — April 9-12, Los Angeles

**Strategy:** Don't book an exhibitor booth ($4-8K). Instead:

- Submit a structured-poster or methodology-roundtable proposal (free or $50) — deadline typically July preceding
- Run a $400/night Airbnb for one-on-one demos
- Post on AcademicTwitter/Bluesky during the conference with #AERA2026
- Co-author a poster with an existing academic user (creates third-party validation)

**Budget:** $2,500-3,500 (travel + accommodation + minor materials)
**Expected ROI:** 40 quality conversations, 10 paid conversions over 6 months = ~$1,400 MRR = ~$8K spent → 6-month payback

### EPIC 2026 — October, Chicago (Illinois Tech)

**Strategy:**

- "Friend of EPIC" sponsorship tier (~$1.5K) — logo + paragraph in attendee materials
- Submit a methodology talk
- Smaller audience (~400) but higher-quality (industry UX/research mix with budgets)

**Budget:** $3,000-4,000
**Expected ROI:** 5-10 Team-tier conversations, 2-3 conversions = $1,740-2,610 MRR → 3-month payback

### Conferences to SKIP

- CHI 2026 (overlaps AERA; HCI-systems-focused, not qual-research)
- AAA / BSA (defer until EU presence exists)
- Lumivero / NVivo sponsored events (obvious conflict)

## Referral program

### Researcher referral (peer-to-peer)

- Both parties get **2 months Pro free** when referred user converts
- Cap: 12 months free total per referrer (prevents abuse)
- Simple, no cash payouts (reduces tax + reporting friction for academics)
- Implementation: referral code → Stripe coupon

### Course adoption referral

- Instructor receives **lifetime Pro free + $500 honorarium** per 15+ student cohort that activates accounts
- Volume play — one course = ~25 students × ~$300 LTV = $7,500 expected value
- Implementation: manual contract; track via Notion CRM for first 10 cohorts

### Affiliate (for methodology bloggers, YouTube creators)

- **25% recurring commission** on Pro conversions for 12 months
- Paid via Stripe Connect
- Use **Rewardful** ($150/mo) or **PartnerStack** for tracking — don't build in-house

## 5 monthly KPIs

| KPI                                                   | Target Month 3 | Target Month 6 |
| ----------------------------------------------------- | -------------- | -------------- |
| Pro MRR                                               | $1,200         | $3,500         |
| Team MRR                                              | $300           | $1,200         |
| Activation rate (signup → 25+ codings in 14 days)     | 40%            | 55%            |
| Demo-call requests from `.edu` / `.ac.uk` / `.edu.au` | 5/month        | 15/month       |
| Net retention (90-day cohort)                         | 85%            | 92%            |

Track in spreadsheet weekly. First 4 KPIs feed off telemetry events (Sprint B); net retention requires 90 days of data.

## Channels to invest in

1. **SEO content + comparison/migration pages** (above) — primary investment
2. **YouTube tutorials** — pay for guest spots on Grad Coach ($500-1,000/spot); sponsor methodology channels
3. **Methodspace + course adoptions** — pitch SAGE Methods Minute newsletter; direct outreach to 50 R1/R2 methods-class instructors with free unlimited Pro offer

## Channels to deprioritize

1. **Twitter/X** — academic discourse fragmented; low engagement
2. **Cold email outbound** — academics treat as spam; deliverability hit
3. **General conference booths** — high cost, low ROI (do the AERA/EPIC strategies above instead)

## Sales motion

- **Self-serve for Free + Pro** — no sales touch
- **Light-touch inside-sales for Team** — once inbound demo requests cross 20/month, hire one part-time SDR
- **Median B2B SaaS sales cycle: 84 days** — academic cycles run 90-180 days
- **Don't hire a closer until Team-tier ARR > $100K**

## File-level deliverables (12-week)

| File                                                 | Sprint week                      | Owner                             |
| ---------------------------------------------------- | -------------------------------- | --------------------------------- |
| `apps/frontend/src/pages/comparisons/VsNvivo.tsx`    | Week 1                           | Marketing engineer                |
| `apps/frontend/src/pages/comparisons/VsAtlasTi.tsx`  | Week 1                           | Marketing engineer                |
| `apps/frontend/src/blog/coding-interviews-7-days.md` | Week 1                           | Writer                            |
| `apps/frontend/src/blog/reflexivity-checklist.md`    | Week 2                           | Writer                            |
| `apps/frontend/src/blog/nvivo-tco-2026.md`           | Week 2                           | Writer                            |
| `apps/frontend/src/pages/migrate/FromNvivo.tsx`      | Week 5 (after Sprint H importer) | Marketing engineer                |
| `apps/frontend/src/pages/migrate/FromDovetail.tsx`   | Week 5                           | Marketing engineer                |
| `apps/frontend/src/pages/comparisons/VsMaxqda.tsx`   | Week 9                           | Marketing engineer                |
| `apps/frontend/src/pages/comparisons/VsDelve.tsx`    | Week 10                          | Marketing engineer                |
| AERA poster submission                               | Week 4 (submit Jan for April)    | Founder + co-author academic user |
| EPIC sponsorship + talk submission                   | Week 8                           | Founder                           |
| Referral program live (Rewardful)                    | Week 6                           | Marketing engineer                |

## Tests

- SEO: each comparison page has unique title, meta description, JSON-LD SoftwareApplication schema
- SEO: each migration page has FAQPage schema + breadcrumb
- A/B: referral CTA placement on `/account` (top of page vs sidebar)
- Conversion: comparison pages have ≥5% click-through to /pricing

## Acceptance criteria

- [ ] All 9 blog posts published (Months 1-3)
- [ ] All 4 comparison pages live with full SEO metadata
- [ ] 2 migration pages live (post-Sprint H importer)
- [ ] AERA proposal submitted + accepted
- [ ] EPIC sponsorship paid + talk submitted
- [ ] Referral program live with Rewardful
- [ ] 5 KPI tracking dashboard built (Looker / Metabase)

## Effort

**Continuous over 12 weeks** with ~50% of one marketing engineer + 1 writer + founder time. Estimated total cost: $25-35K (writer + conferences + Rewardful tooling).

## Owner

Marketing engineer + writer + founder

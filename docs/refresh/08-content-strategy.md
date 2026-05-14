# 8. Content strategy

← [Plan index](README.md)

## 8.1 Case studies

Target at launch: **3 real, 1 representative** (clearly labeled as a worked example with synthetic data).

## 8.2 Methodology chapters

Target at launch: **six chapters**. Outlines in §8.5.

## 8.3 Changelog cadence

One entry per shipped feature or every two weeks, whichever's more frequent. Backfill 6–8 entries before launch from git history.

## 8.4 SEO + structured data

Target keywords:

| Keyword                                   | Volume       | Action                                |
| ----------------------------------------- | ------------ | ------------------------------------- |
| qualitative coding software               | medium       | Land on `/`; optimize meta + schema   |
| qualitative data analysis software        | medium       | `/` and `/pricing`                    |
| nvivo alternative                         | low-medium   | `/vs/nvivo`                           |
| atlas.ti alternative                      | low-medium   | `/vs/atlas-ti`                        |
| dedoose alternative                       | low          | `/vs/dedoose`                         |
| thematic analysis software                | medium       | `/methodology/thematic-analysis`      |
| grounded theory software                  | low          | `/methodology/grounded-theory`        |
| intercoder reliability                    | low          | `/methodology/intercoder-reliability` |
| how to cite [QDA tool]                    | low          | `/cite`                               |
| qda software for IRB                      | low          | `/for-institutions`                   |
| does QDA software train AI on transcripts | low (rising) | `/trust/ai`                           |

Extend the existing JSON-LD in `index.html` per-page:

- `/customers/[slug]` → `Article` + `Organization`
- `/methodology/[slug]` → `Article` + `LearningResource`
- `/pricing` → `Offer` per tier with explicit price
- `/changelog` → `Article` per entry
- `/cite` → `WebPage` + `CreativeWork`
- `/vs/[competitor]` → `Article` + `ComparisonReview`

## 8.5 Methodology chapter outlines

Concrete outlines so Phase 3 content writing isn't blocked on planning.

### 1. Foundations (~1,800 words)

- _§1.1 What qualitative coding actually is._ Traces Saldaña 2021. Definition by way of three paragraphs of difference: coding is not data labeling, not category-membership classification, not summarization.
- _§1.2 Inductive vs. deductive coding._ Worked side-by-side example on the same 3-paragraph excerpt.
- _§1.3 Why coding is interpretive work._ The philosophical hinge: codes are claims about meaning, not labels for content. (This is the section that earns the rest.)
- _§1.4 What QualCanvas does and doesn't do in this picture._ Honest framing.
- _§1.5 Further reading._ Saldaña, Charmaz, Braun & Clarke, Smith.

### 2. Thematic analysis (~2,400 words)

- _§2.1 Braun & Clarke's six phases._
- _§2.2 Familiarization_ and what to do with the notes.
- _§2.3 Initial coding_ — open, in-vivo, descriptive.
- _§2.4 Searching for themes_ — the conceptual leap, not clustering.
- _§2.5 Reviewing themes_ — Phase 4 honest work.
- _§2.6 Defining and naming themes._
- _§2.7 Producing the report._
- _§2.8 Reflexive TA specifically_ — the 2019 update.
- _§2.9 Worked example._ 3 paragraphs of sample transcript, fully coded, themed.
- _§2.10 When to use TA vs. grounded theory vs. IPA._

### 3. Grounded theory (~2,000 words)

- _§3.1 Three traditions_ — Glaser, Strauss, Charmaz.
- _§3.2 Constructivist GT in 2026._
- _§3.3 Open → focused → theoretical coding._
- _§3.4 Memo-writing as theoretical development._
- _§3.5 Theoretical sampling._
- _§3.6 Saturation_ and how to know you're not at it.
- _§3.7 Worked example._
- _§3.8 Pitfalls._ Forcing categories. Premature closure.

### 4. Interpretative Phenomenological Analysis (~1,800 words)

- _§4.1 Smith, Flowers, Larkin_ — what's idiographic.
- _§4.2 The double hermeneutic._
- _§4.3 Reading and re-reading._
- _§4.4 Initial noting_ — descriptive, linguistic, conceptual.
- _§4.5 Developing emergent themes._
- _§4.6 Looking for connections across themes._
- _§4.7 Moving to the next case._
- _§4.8 Worked example._
- _§4.9 When IPA is and isn't the right method._

### 5. Intercoder reliability (~1,400 words)

- _§5.1 What κ measures_ — and what it doesn't.
- _§5.2 Cohen's κ formula_ and an intuition for bias correction.
- _§5.3 Krippendorff's α_ — when it's the right one.
- _§5.4 The recurring debate._ Is IRR appropriate for interpretive coding?
- _§5.5 A pragmatic position._ Report it when reviewers ask; don't let it dictate your codebook.
- _§5.6 Worked example_ with three coders on five segments.
- _§5.7 Krippendorff's α in QualCanvas_ (flag-gated today: `krippendorff_alpha` per `featureFlagsStore.ts:67`).

### 6. Ethics in practice (~1,800 words)

- _§6.1 Consent as ongoing_, not a form.
- _§6.2 Anonymization vs. pseudonymization vs. de-identification._
- _§6.3 The five tactics that actually work_ — and the two that don't.
- _§6.4 Retention windows._ How to decide. How to enforce.
- _§6.5 The participant's right to be forgotten._
- _§6.6 What an audit trail needs to contain._
- _§6.7 When AI assistance becomes an ethics question._ (Links to `/trust/ai`.)

## 8.6 Case study schema + outreach email

### Sourcing email template (working draft — refine before send)

> **Subject:** Would you talk to us about how you use QualCanvas? ($200 honorarium)
>
> Hi [name],
>
> You've been a QualCanvas user for [X months] and your team has built [Y] canvases — you're one of our most active researchers. I'd love to feature your work in a short case study.
>
> The commitment:
>
> - One 45-minute call with me.
> - Two emails of back-and-forth on the draft.
> - Final review rights before publish.
>
> In exchange:
>
> - $200 honorarium, or a charitable donation in your name.
> - Final copy approval — we don't publish anything you haven't signed off on.
> - A backlink to your work.
> - The story stays on our `/customers` page indefinitely.
>
> The story is short — three sections (challenge, approach, outcome), three numbers, one quote. About 800 words. You can be anonymized at any granularity: named institution + named you, named institution + anonymous you, fully anonymous worked example.
>
> Happy to send a draft outline before you decide.
>
> — [name]

### Case study schema

| Field              | Type      | Required                           | Example                                                                |
| ------------------ | --------- | ---------------------------------- | ---------------------------------------------------------------------- |
| `slug`             | string    | yes                                | `stanford-som-thematic-2026`                                           |
| `institution_name` | string    | yes (or `"Anonymous Institution"`) | `Stanford School of Medicine`                                          |
| `institution_logo` | image     | optional                           | `logo.svg`                                                             |
| `field`            | string    | yes                                | `Public Health`                                                        |
| `discipline`       | string    | yes                                | `Qualitative methods`                                                  |
| `team_size`        | int       | yes                                | `4`                                                                    |
| `plan_used`        | enum      | yes                                | `team`                                                                 |
| `primary_method`   | enum      | yes                                | `thematic_analysis`                                                    |
| `n_transcripts`    | int       | yes                                | `22`                                                                   |
| `duration_weeks`   | int       | yes                                | `6`                                                                    |
| `three_stats`      | object[3] | yes                                | `[{number, label}]`                                                    |
| `hero_image`       | image     | yes                                | photo or screenshot 1920×1080                                          |
| `body_md`          | markdown  | yes                                | 600–1000 words                                                         |
| `pull_quote`       | object    | optional                           | `{text, attribution_name, attribution_title, attribution_institution}` |
| `published_at`     | date      | yes                                | `2026-06-15`                                                           |
| `features_used`    | string[]  | yes                                | `["auto_code", "intercoder", "cases"]`                                 |
| `consent_level`    | enum      | yes                                | `named` \| `anonymous_individual` \| `anonymous_all`                   |

## 8.7 Internal link graph

Every page links to at least one other page in a deliberate way. Not a sitemap — an editorial graph.

- `/` → `/methodology` (primary), `/pricing` (CTA), `/customers/[featured]` (case card), `/trust/ai` (FAQ #4)
- `/methodology/[chapter]` → next chapter, `/cite`, _one_ relevant `/customers/[slug]` deep link, `/pricing` (mid-page CTA in chapter 5 and 6)
- `/customers/[slug]` → previous/next story, `/methodology/[method-used]`, `/pricing`
- `/pricing` → `/vs/*` (comparison row), `/for-teams` (Team card), `/for-institutions` (Institutions card)
- `/for-teams` → `/customers/[lab-case]`, `/methodology/intercoder-reliability`
- `/for-institutions` → `/trust`, `/trust/ai`, `/accessibility-statement`
- `/trust` → `/trust/ai`, `/trust/subprocessors`, `/trust/dpa`
- `/trust/ai` → `/trust`, model-provider policy links
- `/vs/[competitor]` → `/pricing`, `/customers/[slug]`, one related `/vs/*`
- `/cite` → `/methodology`, the user's account
- `/changelog` → RSS feed, `/methodology` (when a feature relates to a method)

## 8.8 Sample customer story (worked example — sets the bar)

This is a complete worked example using the §8.6 schema. Synthetic / representative — clearly labeled as such at the top of the live page. It exists to establish the prose register, layout, and stat density that all future customer stories should match. Real stories replace it during Phase 3 outreach.

---

**[WORKED EXAMPLE — synthetic, not a real customer]**

`Customers > A research university`

**RESEARCH STORY**

_How a public-health lab coded 22 caregiving interviews in six weeks._

[Lab logo placeholder] A multi-coder thematic study of adult-child caregivers returning to higher education. IRB protocol withheld for the worked example.

_Public health · A research university · Qualitative methods · Team of 4 · Pro plan_

[Hero image — wide screenshot of the canvas with codes visible, 16:9]

| **22** | **6 weeks** | **κ = 0.84** |
| TRANSCRIPTS CODED | NOT SIX MONTHS | INTERCODER RELIABILITY |

**## Challenge**

The lab had three months between IRB approval and a methods-paper deadline. Twenty-two semi-structured interviews with adult-child caregivers had been transcribed; the codebook had to be developed inductively, then applied consistently across four coders, with intercoder reliability strong enough to justify the analytic claim.

The lab's prior tooling was NVivo on a single licensed laptop, passed between coders. Coding sessions had to be scheduled around physical access to the machine. Codebook drift between coders was discovered late — at one point the team's inter-rater agreement was 0.51, which would have killed the methods section.

> _"The κ was the part we couldn't fudge. The committee was going to look at it before they looked at anything else."_
> _— PI, on what made NVivo untenable for this study_

**## Approach**

The team imported the 22 transcripts into a single QualCanvas project. The PI built an initial codebook of 14 codes derived from the literature; the four coders coded the first three transcripts independently. After the third transcript the team ran QualCanvas's intercoder κ calculator and surfaced the three codes with the lowest agreement.

Three things made the next two weeks possible:

1. The shared codebook lived in one place — when a coder split a code, every other coder saw it the next time they opened the project.
2. Intercoder reliability ran continuously, not in batch. Coders could see κ rise or fall per code, per pair of coders, per transcript.
3. Memos attached to specific codes, which let the team capture _why_ a code had been split or merged — the interpretive history NVivo had hidden behind menus.

By transcript twelve the team's average κ on the contested codes had moved from 0.51 to 0.79. By transcript twenty-two it was 0.84.

**## Outcome**

The methods paper was submitted on the day of the deadline. It reported a final κ of 0.84 (95% CI 0.79–0.88) across the full corpus and a six-week coding window. Reviewer 2 commented favorably on the _transparency_ of the inter-rater reporting, citing the per-code breakdown.

> _"We finally had a shared codebook our PIs trusted. That's not a small thing."_
> _— Postdoc, on what mattered most about the workflow_

The lab now defaults to QualCanvas for qualitative work; two of the four coders have introduced it to their own dissertations.

---

Features used: Auto-code · Intercoder κ · Cases · Memos · QDPX export

Published June 2026 · 6 min read

← Previous (LSE Methods Lab) (Manchester Health Research) Next →

[ Start your own study on QualCanvas — Start free ]

## 8.9 Sample methodology chapter excerpt (sets the prose voice)

Three paragraphs (~280 words) from a hypothetical §2.3 of `/methodology/thematic-analysis` — _Initial coding_. The voice register every chapter should land on: confident, plain, methodologically literate.

---

> _Initial coding is where most people make qualitative coding seem harder than it is. Saldaña catalogues at least seventeen methods in his coding manual; teachers introduce them in roughly the order they were proposed; students absorb them as a taxonomy to be memorised. The result is a generation of coders who pick a method before reading their first transcript — and then code as though their job were to demonstrate the method, rather than to make defensible interpretive claims._
>
> _The honest description is shorter. Initial coding is the first pass of attaching a short label to a segment of data. The label can be a phrase the participant used (in-vivo coding), a phrase the researcher invents to summarise the segment (descriptive coding), a phrase that captures the action implied by the segment (process coding), or one of a dozen other choices that, with practice, you learn to combine. None of these methods are mutually exclusive within a single transcript. The choice is interpretive, and it can change as your reading of the corpus deepens — which is fine, and which is the part that some software treats as a failure of the coder rather than a feature of the work._
>
> _A working heuristic, suggested in Saldaña's manual and reinforced by Braun & Clarke's later writing: code generously on the first pass, expect to merge codes by the third transcript, and treat the codebook as a sketch that gets refined rather than a contract that gets enforced. Coding software that punishes you for splitting and merging is software that misunderstands what initial coding is._

---

The register to imitate: declarative sentences, real citations (Saldaña, Braun & Clarke), one pointed criticism of the tooling tradition delivered without naming the tools, no adjectives doing emotional work, no "we believe."

## 8.10 `/vs/nvivo` content outline (concrete — unblocks the page)

The other two `/vs/` pages follow the same six-section shape with different specifics.

### 1. Quick verdict (~250 words)

> _If your committee has read 30 qualitative papers using NVivo and your university owns a site licence, NVivo is a reasonable choice. It has been the dominant tool in the field for thirty years; that durability is real social capital and we won't pretend it isn't._
>
> _If you are starting fresh, working with a small team, or your IT department isn't already paying for NVivo: QualCanvas is the cleaner option. The pricing is public ($12/month for Pro, $29/seat for Team, 40% off with a `.edu` email). The data is in the cloud so collaboration doesn't depend on passing a laptop around. The codebook lives in one place that every coder sees in real time._
>
> _Both tools export to QDPX (the qualitative-data exchange format), so switching either direction at any point is reversible. No lock-in either way._

### 2. Pricing (sourced, dated)

Side-by-side `<CompetitorRow>`:

|                        | QualCanvas                            | NVivo (Lumivero)                                   |
| ---------------------- | ------------------------------------- | -------------------------------------------------- |
| Individual academic    | $12/mo or $120/yr                     | ~$1,200/yr (third-party-reported)                  |
| Team / multi-user      | $29/seat/mo                           | ~$499/yr for up to 5 users + $99/seat above        |
| Free tier              | Yes — 1 canvas, 5 codes               | None                                               |
| Academic discount      | 40% off `.edu`, applied automatically | Implied (separate SKU); % not published            |
| Where the numbers live | `qualcanvas.com/pricing`              | shop.lumivero.com (separate domain) or sales quote |

Footnote: _Lumivero pricing taken from third-party research at usercall.co/post/nvivo-software-pricing-how-much-does-it-really-cost-in-2025, accessed 2026-05-14, as Lumivero does not publish prices on the NVivo product page._

### 3. Where NVivo is better (~200 words)

- **Citation weight.** NVivo is Scopus-most-cited in qualitative methodology (2010–2025). If your committee reads NVivo papers, the lineage is real.
- **Desktop-first.** If your work is on encrypted laptops with no cloud allowed by IRB, NVivo's desktop app is a genuine advantage. QualCanvas is cloud-first; EU residency is available, but some IRBs still won't permit any cloud handling of participant data.
- **Mature literature on advanced features.** NCapture, classification sheets, and certain query patterns have a decade of "how to do this in NVivo" tutorials. QualCanvas's equivalents are documented and younger.

### 4. Where QualCanvas is better (~350 words)

- **Pricing is on the page.** You are reading this in less time than it takes to find NVivo's price.
- **Collaboration is real-time.** Multiple coders on the same project, codebook updates everyone sees, intercoder κ calculated live as you code. NVivo Collaboration Cloud exists; it's a separate SKU.
- **The codebook lives where you can see it.** QualCanvas puts transcripts, codes, memos, and analyses on a visual canvas. NVivo puts them in a tree of folders.
- **Public changelog and roadmap.** Every shipped feature is dated and credited on `/changelog`. NVivo's update history requires a Lumivero account.
- **A `/trust` page that resolves.** QualCanvas publishes its sub-processors, encryption posture, DPA availability, and AI use policy. As of 2026-05-14, `lumivero.com/trust` returns a 404.
- **Native dark mode designed, not inverted.** Coding at 11pm is a thing.
- **AI use policy in plain English.** See `/trust/ai`. Your transcripts are never used to train a model. NVivo's policy on this is harder to find.

### 5. Migration path (~200 words)

If you're already in NVivo:

1. Export your project as QDPX from NVivo (File → Export → QDPX).
2. Import the QDPX into QualCanvas via Canvas → Import.
3. Verify code and memo counts against your NVivo summary report (we surface these on the import-success screen).
4. Re-anchor team members — invite them to the QualCanvas project with their roles (PI, coder, analyst).

If you ever want to leave QualCanvas, the same QDPX export works in reverse. We have kept that promise since 2024 and we will keep it.

### 6. FAQ (5 questions)

- _Can I cite QualCanvas in a methodology section?_ Yes; `/cite` has BibTeX, APA, Chicago, RIS.
- _Does QualCanvas support classification sheets / attribute data?_ Yes, through the Cases system including framework-matrix views.
- _Is there an institutional licence?_ Yes — `/for-institutions`. SSO + SCIM, custom retention, DPA, BAA.
- _Do you use my transcripts to train AI?_ No. See `/trust/ai` for the full architecture.
- _What happens if Lumivero discontinues NVivo?_ Your QDPX exports remain valid in QualCanvas. The format is an industry standard, not vendor-specific.

# 1. Strategic positioning

← [Plan index](README.md)

## 1.1 Positioning statement (working)

> **QualCanvas is a visual workspace for qualitative coding — a serious tool for researchers who want to think on a canvas instead of a spreadsheet, and who care that their method is defensible.**

The four words doing the load-bearing work: **visual** (vs. NVivo's nested tree), **serious** (vs. Dedoose's exclamation-point friendliness), **think** (vs. ATLAS.ti's "90% time saving" automation pitch), **defensible** (the IRB / peer-review trump card no one else plays explicitly).

## 1.2 The wedge against each competitor

| Competitor       | Their hero claim                                               | The wedge                                                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NVivo / Lumivero | "#1 most cited QDA software, 30 years"                         | Authority by lineage. We counter with **methodology fluency** + **transparent pricing** + working **Trust page** (theirs 404s).                                                                                                                                         |
| ATLAS.ti         | "Reduce analysis time 90% with OpenAI"                         | Aggressive AI-replacement pitch. We counter with **"AI assists, you decide"** — defensible interpretive register over speed claims researchers will distrust.                                                                                                           |
| MAXQDA           | "#1 QDA with the best AI integration"                          | Two `#1`s in the category undermines both. We claim a **specific** superlative: "the only QDA tool that lets you read a real coded transcript on the homepage in 10 seconds."                                                                                           |
| Dedoose          | "Great research made easy!" + transparent active-month pricing | Friendly but visibly 2017. We are _also_ transparently priced, _also_ monthly, but with editorial register and the only 2026-grade design.                                                                                                                              |
| Delve            | "Feels natural, not clunky" + methodology blog                 | The closest stylistic competitor and the only one with real methodology depth — but theirs is text-only. We out-flank with **interactive methodology** and explicit pricing (their `/pricing` returned 401 to bots today; researchers on campus VPNs may see the same). |
| Taguette         | Free, open source                                              | Different lane entirely; not our fight. We are **"Taguette for teams that have to ship a paper this semester."** Managed reliability, real-time collab, audit trail, DPA — none of which Taguette's self-host model can give an IRB.                                    |

## 1.3 Category-level moats nobody fills

Each is worth one page or one component on the site. From the competitive scan — these are gaps every QDA tool leaves open:

1. **No one shows a real coded transcript above the fold.** Every hero is a screenshot, video, or logo wall.
2. **No one ships an interactive demo on the marketing site.** All trials gate behind email + account creation.
3. **No public changelog.** Researchers on multi-year studies care about update cadence.
4. **No public roadmap.**
5. **No academic citation page** (Lumivero brags about being most-cited but doesn't show you how to cite _them_).
6. **No real SOC 2 / ISO / DPA surface.** Lumivero `/trust` and ATLAS.ti `/security` both 404.
7. **No one markets dark mode.** Researchers code at 2am. We already ship it.
8. **No one publishes intercoder-reliability (Kappa) explainers** — we have it on Team tier.
9. **No public status / uptime page** linked from marketing.
10. **No interactive methodology guides.** Delve has prose; we can have a working tool.
11. **No competitor publishes `/vs/[competitor]` comparison pages.** SEO gold and credibility-positive — "not afraid to compare."
12. **No competitor publishes an AI use policy in researcher-friendly language.** Every IRB officer in 2026 has the same question, nobody answers it cleanly.

## 1.4 The dual-purpose framing (QualCanvas ↔ JMS Dev Lab)

JMS Dev Lab (jmsdevlab.com — verified 2026-05-14) already lists QualCanvas as project #9 on its homepage in the "Our Own Products" grid, with the description _"Qualitative coding made visual."_ The cross-link is bidirectional and already half-built. What we need:

- **From QualCanvas → JMS Dev Lab:** A single discreet `Built by JMS Dev Lab →` line in the QualCanvas footer, with a hairline ochre underline on hover. Optionally a `/colophon` page explaining the stack, fonts, and crediting the studio in a single sentence. **Never** a banner, "Want one like this?" overlay, or persistent nav item.
- **Brand register intentionally diverges.** JMS Dev Lab is pragmatic / SMB-friendly ("Custom Software That Actually Fits Your Business," `</>` glyph, problem-led copy quoting customers verbatim). QualCanvas is editorial / academic (Fraunces, generous whitespace, methodology-led copy). The contrast is the point: a prospective JMS client sees that the studio can build _both_ a pragmatic site like jmsdevlab.com _and_ a craft-tier site like the refreshed qualcanvas.com. That demonstrates range.

## 1.5 AI use as a positioning act

Every researcher and every IRB officer in 2026 asks the same first question about an AI feature: _"Are my participants' transcripts being used to train a model?"_ The fact that none of the six competitors answers this cleanly is a positioning gift.

**Our position, stated for the homepage and elaborated on `/trust/ai`:**

> QualCanvas uses LLMs for code suggestions, theme summarization, and framework synthesis. Always optional. Always reviewable. Your transcripts are never used to train any model — by us, or by the model provider. AI assists; you decide.

**Why this works.**

- It's the specific anxiety the audience has.
- The "bring your own key" architecture means the answer is structurally true, not just promised. Inference calls go direct from the user's account to the provider; QualCanvas never proxies or retains the transcript content beyond what's needed for the session.
- It distinguishes us from ATLAS.ti's "90% time saving" register, which puts the AI in the driver's seat and reads as method-erasure to a methodologist.

## 1.6 Reading-time budget for the entire site

A researcher will skim, not read deeply. The total reading time of the marketing site top-to-bottom should fit in a 90-minute window. Concrete budget:

| Surface                       | Target read time       |
| ----------------------------- | ---------------------- |
| `/` landing                   | 3 min skim, 8 min full |
| `/pricing`                    | 2 min                  |
| `/methodology` index          | 1 min                  |
| `/methodology/[slug]` average | 9 min                  |
| `/customers` index            | 2 min                  |
| `/customers/[slug]` average   | 6 min                  |
| `/for-teams`                  | 4 min                  |
| `/for-institutions`           | 5 min                  |
| `/guide`                      | 12 min                 |
| `/changelog` (per page)       | 4 min                  |
| `/trust`                      | 6 min                  |
| `/trust/ai`                   | 4 min                  |
| `/vs/[competitor]` average    | 5 min                  |
| `/cite`                       | <1 min                 |
| `/colophon`                   | <1 min                 |

**Total at depth:** ~85 minutes. Headroom intact. Skim path through funnel (`/` → `/pricing` → signup): ~6 minutes total.

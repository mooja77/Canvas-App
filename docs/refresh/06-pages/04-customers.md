# 6.4 `/customers` — case studies

← [Pages index](README.md) · [Plan index](../README.md)

**Intent.** Social proof, calibrated.

## Index page

Asymmetric bento at top with 4–6 featured stories. Below: 12-cell grid of all stories with discipline tags + read-time.

## Individual story page (`/customers/[slug]`)

- Breadcrumb: `Customers > [Institution]`.
- Eyebrow `RESEARCH STORY` + Fraunces H1 (metric-forward — e.g. `"How [team] coded 800 interviews in six weeks"`).
- Customer logo + 1-sentence subline.
- Metadata strip: `Field · University · Discipline · Team size · Plan`.
- Hero image (16:9 full-bleed).
- Three big stat cards (no decoration — just big Fraunces numbers).
- Body in single column 680px: `Challenge / Approach / Outcome` triad.
- Pull quote mid-body.
- Right rail: features used (chips), published date, read time.
- Bottom: prev/next case study nav.
- CTA stripe: `Run your own study on QualCanvas`.

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│ Customers > Stanford School of Medicine                              │
│                                                                      │
│ ─── HAIRLINE                                                         │
│ RESEARCH STORY                                ← eyebrow              │
│                                                                      │
│ How a public-health lab coded                                        │
│ 800 caregiving interviews                     ← Fraunces 56px        │
│ in six weeks                                                         │
│                                                                      │
│ [Stanford logo]   A multi-coder thematic study, IRB protocol 22-741. │
│                                                                      │
│ Public health · Stanford SOM · Qualitative methods · Team of 4 · Pro │
└──────────────────────────────────────────────────────────────────────┘
       ╔══════════════════════════════════════════════════════════╗
       ║   [hero image, 16:9, screenshot-or-photo, full bleed]    ║
       ╚══════════════════════════════════════════════════════════╝

       ┌────────────────┬────────────────┬────────────────┐
       │ 800            │ 6 weeks        │ κ = 0.84       │
       │ TRANSCRIPTS    │ NOT 6 MONTHS   │ INTERCODER     │   ← stat blocks
       │ CODED          │                │ RELIABILITY    │     Fraunces 88px
       └────────────────┴────────────────┴────────────────┘

┌────────────────────────────────────────────────┬─────────────────┐
│                                                │ Features used   │
│ ## Challenge                                   │ [auto-code]     │
│                                                │ [intercoder]    │
│ The lab had three months and a methods paper.. │ [cases]         │
│                                                │ [ethics]        │
│ ## Approach                                    │                 │
│                                                │ Published       │
│ They split the corpus into four batches…       │ April 2026      │
│                                                │                 │
│ ─── ochre rule (pull quote)                    │ 6 min read      │
│ "We finally had a shared codebook our PIs      │                 │
│  trusted." — Dr. K. Wang                       │                 │
│                                                │                 │
│ ## Outcome                                     │                 │
│                                                │                 │
│ Methods paper accepted. Lab now defaults to..  │                 │
└────────────────────────────────────────────────┴─────────────────┘

      ← Previous (LSE Methods)            (Manchester) Next →

       ╔═══════════════ Start your own study ═════════════════╗
       ║              [ Start free ]                          ║
       ╚══════════════════════════════════════════════════════╝
```

## Sample story

A complete worked example is in [08 §8.8](../08-content-strategy.md). Use as the bar.

## Schema

See [08 §8.6](../08-content-strategy.md) for the 17-field schema and outreach email template.

# 6.1 `/` — Landing

← [Pages index](README.md) · [Plan index](../README.md)

**Intent.** In 10 seconds: visitor understands what QualCanvas is, sees it work, knows it's free to start.

## Section order

1. **Hero** — type-as-hero. Fraunces display-xl headline. Inter body subhead. Two CTAs. (Copy: [04 §4.7 Landing > Hero](../04-brand-design-system.md).)

2. **Interactive coding micro-demo.** [16 spec](../16-interactive-demo-spec.md). Single biggest craft move on the page.

3. **Numbered workflow strip.** Five steps ([04 §4.7 Landing > Numbered workflow](../04-brand-design-system.md)). Native CSS scroll-driven reveal. Each step has a real screenshot (re-shot after Tier 2 ships in-app) and one-line outcome description.

4. **Bento feature grid (asymmetric 6-up).** Six tiles per [04 §4.7 Landing > Bento](../04-brand-design-system.md). Sizes: 2:1:1 / 1:1:2 alternating rows.

5. **Stats strip.** Three Fraunces display-xl numerals ([04 §4.7 Landing > Stats](../04-brand-design-system.md)).

6. **Named-institution case study card** — one Overleaf-style mini case. Links to `/customers/[slug]`.

7. **Avatar-attributed testimonials** — 3 quotes (Raycast pattern). Each names a _specific_ feature.

8. **Pricing teaser** — three tier cards Tier-2-styled, `.edu` discount surfaced inline, single primary CTA to `/pricing`.

9. **FAQ** — 5 questions ([04 §4.7 Landing > FAQ](../04-brand-design-system.md)).

10. **CTA stripe** — `Start free` on ink background.

## Layout sketch (hero + demo region)

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   ─── HAIRLINE (ochre, 48px wide)                         │
│   A QUALITATIVE WORKSPACE              ← eyebrow           │
│                                                            │
│   Code interviews                                          │
│   like you think.                      ← Fraunces 88px     │
│   Visually.                                                │
│                                                            │
│   QualCanvas is a visual workspace for coding             │
│   transcripts, finding themes, and writing memos           │
│   you can defend in front of a committee.                  │
│                                                            │
│   [ Start free ]  See the method →                         │
│   No credit card. Free forever for basic use.              │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ┌─ INTERACTIVE DEMO ──────────────────────┬───────────┐   │
│  │  "Coming back to school felt like      │ CODEBOOK  │   │
│  │   reaching for a self I'd put         │ ─────────  │   │
│  │   somewhere I couldn't quite find."   │ ▸ identity│   │
│  │  — Maya, 27 [highlighted span shown]  │   (1 span)│   │
│  │                                       │ ▸ caregiver│  │
│  │  [ + Apply code: identity-as-resistance ](2 spans) │   │
│  │                                       │ ▸ return  │   │
│  └────────────────────────────────────────┴───────────┘   │
└────────────────────────────────────────────────────────────┘
```

## Motion

Word-stagger on headline. Hairline draw-in above eyebrow. Code chip appears with scale+fade (140ms). Codebook update slides (180ms).

## Accessibility

Demo fully keyboard-navigable (Tab to span → Enter to select → Tab to chip → Enter to apply). Live region announces "code applied: identity-as-resistance." Skip-to-content link before nav. All ARIA roles documented in [16](../16-interactive-demo-spec.md).

## Success criteria

LCP < 1.2s. Demo accessible without page reload. Lighthouse Performance ≥ 95.

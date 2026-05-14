# 6.2 `/pricing`

← [Pages index](README.md) · [Plan index](../README.md)

**Intent.** Convert. Transparent. No friction.

## Changes from current (605-line page)

Keep the underlying structure (monthly / annual toggle, three cards, comparison table, FAQ, money-back, downgrade modal). Replace visual chrome with Tier 2. Reject the "Most Popular" badge. Surface .edu discount inline. Add the **Institutions** column. Add **NVivo / ATLAS.ti / Dedoose comparison row**.

## Section order

1. Eyebrow + Fraunces H1 + subhead ([04 §4.7 Pricing](../04-brand-design-system.md)).
2. Billing toggle (Monthly / Annual — default Annual, save 25%).
3. Four tier cards: **Free · Pro · Team · Institutions**. Each equally weighted. No badge. Each card: name, price, 1-sentence audience, 5–7 features, CTA.
4. `.edu discount strip` ([04 §4.7 Pricing](../04-brand-design-system.md)).
5. **Comparison table** — categorical, not binary. Groups: Workspace · Coding · Analysis · Collaboration · Ethics · Export · Security · Support. Numerical values where applicable.
6. **`<CompetitorRow>` strip** — one row showing QualCanvas published pricing next to NVivo "contact sales," ATLAS.ti "contact sales," MAXQDA "contact sales." Sourced + dated. Links to full `/vs/*` pages.
7. **Money-back + annual savings callout** (keep from current).
8. **FAQ** — 10–12 questions.
9. **CTA stripe** — primary Start free, secondary Talk to research desk.

## Layout sketch (tier cards)

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ FREE             │ PRO              │ TEAM             │ INSTITUTIONS     │
│                  │                  │                  │                  │
│ $0 / mo          │ $12 / mo         │ $29 / seat / mo  │ Custom           │
│                  │ ($120/yr)        │ ($288/yr/seat)   │                  │
│ For trying       │ For working      │ For research     │ For departments  │
│ it out           │ researchers      │ groups           │ and faculties    │
│                  │                  │                  │                  │
│ • 1 canvas       │ • Unlimited      │ • Everything in  │ • Everything in  │
│ • 5 codes        │   canvases       │   Pro            │   Team           │
│ • CSV export     │ • 50K words      │ • Intercoder κ   │ • SSO + SCIM     │
│ • Stats +        │ • All 12 tools   │ • Unlimited      │ • DPA + BAA      │
│   wordcloud      │ • Auto-code      │   shares         │ • Custom         │
│                  │ • Ethics +       │ • Team admin     │   retention      │
│                  │   cases          │                  │ • Research desk  │
│                  │ • 5 shares       │                  │                  │
│                  │                  │                  │                  │
│ [ Start free ]   │ [ Start Pro ]    │ [ Start Team ]   │ [ Book a call ]  │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘

           40% off Pro and Team with a .edu email
           ──────────────────────────────────────
```

## Hard constraints

Stripe price ID env vars (`VITE_STRIPE_PRO_*`, `VITE_STRIPE_TEAM_*`) untouched. Downgrade modal logic intact. Mobile re-flows to single-column stack.

# 18. Post-signup flow + welcome email register

← [Plan index](README.md)

A researcher who clicks `Start free` from the new `/` should land in a consistent voice. Today the flow is `Start free` → `/login` → email/password signup → `/canvas`. The welcome email exists but has not been audited against the new brand voice. Both surfaces need a Phase 5 pass.

## 18.1 Signup success page

Currently jumps straight to `/canvas`. Replace with a one-screen intermediate page that bridges the marketing register to the app:

```
─── HAIRLINE
A FEW PRACTICAL THINGS                          ← eyebrow

You're in.                                       ← Fraunces 64px

Two paths, depending on what brought you here.

┌────────────────────────────────────┬────────────────────────────────────┐
│ Start a blank canvas               │ Read the methodology guide first   │
│                                    │                                    │
│ Import a transcript, pick a span,  │ Six chapters, ~45 minutes total.   │
│ name a code. The whole motion      │ Worth it if your method has a name │
│ takes about three minutes.         │ with a hyphen in it.               │
│                                    │                                    │
│ [ Open canvas → ]                  │ [ Open methodology → ]             │
└────────────────────────────────────┴────────────────────────────────────┘

Citation info, your account, and the methodology field guide
are always in the footer.
```

Skippable in one click. State persists; if the user picks "Open canvas" we never show this page again. If they pick "Open methodology" we show a smaller variant on next visit.

## 18.2 Welcome email (rewrite for new voice)

Current welcome email register has not been audited. Working draft for Phase 5:

> **Subject:** Welcome to QualCanvas — three things to know
>
> Hi [name],
>
> You've made an account. You can log in at qualcanvas.com/login any time. Three things that will save you ten minutes later:
>
> **1. Your first canvas takes about three minutes to set up.** Import a transcript (PDF, DOCX, or paste plain text), select a span, name a code. The whole motion is written up in the field guide at qualcanvas.com/methodology if you want the long version first.
>
> **2. Cite us in your paper.** qualcanvas.com/cite has BibTeX, APA, Chicago, and RIS. Send to your advisor before they ask.
>
> **3. Your data is yours.** No transcript content ever goes to a model trainer — by us or by the model provider. Our AI use policy is at qualcanvas.com/trust/ai if your IRB asks.
>
> If you get stuck, reply to this email. It goes to a human.
>
> — The QualCanvas team

## 18.3 Onboarding email sequence

Three emails total over the first 10 days. Each ≤ 200 words. No drip-marketing register; one specific tip per email; no upsells.

- **Day 0** — welcome (above).
- **Day 3** — _"Intercoder reliability without the κ migraine."_ Links to `/methodology/intercoder-reliability`.
- **Day 10** — _"Three things teams ask in the first month."_ Practical workflow tips. Closes with a single line: "If a methodology chapter would help, the field guide is one chapter a month — subscribe at [link]."

## 18.4 Re-engagement (deferred to v2 of this plan)

Lifecycle marketing for trial-not-converted, plan-downgraded, churn-risk users is out of scope for this refresh. Document explicitly so the absence is intentional, not forgotten.

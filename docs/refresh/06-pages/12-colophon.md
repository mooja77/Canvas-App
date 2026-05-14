# 6.11 `/colophon`

← [Pages index](README.md) · [Plan index](../README.md)

**Intent.** A single page documenting the craft — stack, fonts, palette, accessibility statement, JMS Dev Lab credit.

## Why this exists

It's the dignified place to credit the studio. A research audience appreciates this — academic publications have colophons. A prospective JMS client who clicks the footer credit lands here and sees a confident, restrained statement of "made by people who care," not a sales pitch.

## Full body

See [04 §4.7 `/colophon`](../04-brand-design-system.md) for the verbatim draft.

```
COLOPHON

This site is set in Fraunces (Undercase Type) and Inter (Rasmus Andersson). The two
colors are Ink — the deepest blue we could find without making it black — and Ochre,
a single warm gold that appears only at decisions: a heading rule, a focus ring, a
primary action.

Built with React, Vite, and Tailwind. Deployed on Cloudflare Pages. Designed and
built by JMS Dev Lab in Ireland — a studio that builds custom software for
businesses too unique for off-the-shelf tools.

Accessibility: we target WCAG 2.2 AA across all marketing pages. The interactive
coding demo is fully keyboard-navigable. Motion respects prefers-reduced-motion.
A formal accessibility statement is available at /accessibility-statement.

Performance budget for marketing pages: < 80 KB JS, < 30 KB CSS, LCP under 1.2s on 4G.
We test on a four-year-old Pixel and an iPhone SE.

Last reviewed: [date].
```

## Style

- Single page, no chrome.
- Eyebrow `COLOPHON`. H1 Fraunces. Body 17px Inter.
- The JMS Dev Lab link uses the ochre-underline-on-hover treatment.
- Read time: <1 min.

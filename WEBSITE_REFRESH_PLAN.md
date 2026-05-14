# QualCanvas Website Refresh — Plan v3

**This file is the consolidated source.** For navigation during execution, see [`docs/refresh/`](docs/refresh/README.md) where the plan is split into one file per section.

**Status:** Draft for review
**Author:** Planning synthesis (Claude / 2026-05-14)
**Scope:** Every public-facing surface on qualcanvas.com — landing, pricing, guide, legal, plus new pages (methodology, customers, for-teams, for-institutions, changelog, colophon, /vs/, /cite, /trust/ai, /accessibility-statement, /press).
**Dual purpose:** (1) Convert qualitative researchers into Free → Pro / Team / Institutions signups. (2) Implicitly demonstrate JMS Dev Lab's craft ceiling — the site itself is the portfolio piece.

---

## How this plan is organized

The plan has 19 sections plus an appendix. Each is in its own file under `docs/refresh/`:

### Strategy

- [00 — Executive summary](docs/refresh/00-executive-summary.md)
- [01 — Strategic positioning](docs/refresh/01-strategic-positioning.md)
- [02 — Audiences & personas](docs/refresh/02-personas.md)
- [03 — Information architecture](docs/refresh/03-information-architecture.md)

### Design system

- [04 — Brand & design system](docs/refresh/04-brand-design-system.md) — colors, type, spacing, motion, voice, copy bank, component states
- [05 — Component inventory](docs/refresh/05-component-inventory.md)

### Page specifications

- [06 — Pages](docs/refresh/06-pages/) — one file per page or page-group

### Craft + content

- [07 — Craft moments](docs/refresh/07-craft-moments.md)
- [08 — Content strategy](docs/refresh/08-content-strategy.md) — case studies, methodology outlines, /vs/nvivo outline, SEO

### Execution

- [09 — Implementation phases](docs/refresh/09-implementation-phases.md)
- [10 — Risks & rollback plan](docs/refresh/10-risks-and-rollback.md)
- [11 — Success metrics](docs/refresh/11-success-metrics.md)
- [12 — Open decisions](docs/refresh/12-open-decisions.md)

### Budgets, QA, instrumentation

- [13 — Performance + accessibility budgets](docs/refresh/13-performance-a11y-budgets.md)
- [14 — Pre-launch QA checklist](docs/refresh/14-pre-launch-qa-checklist.md)
- [15 — Analytics events schema](docs/refresh/15-analytics-events-schema.md)

### Component specs

- [16 — InteractiveDemo data spec](docs/refresh/16-interactive-demo-spec.md)
- [17 — Dynamic OG image spec](docs/refresh/17-og-image-spec.md)

### Post-signup

- [18 — Post-signup flow + welcome email register](docs/refresh/18-post-signup-flow.md)

### Reference

- [19 — Appendix (competitor and inspiration links)](docs/refresh/19-appendix.md)

---

## The single insight that organizes everything

**Every QDA competitor markets the tool. We market the method.** Linear didn't win developer-tool marketing by listing features — they wrote `linear.app/method`, six numbered chapters of opinionated engineering doctrine. We do the equivalent for qualitative research: a real, written, illustrated methodology guide that researchers will cite in advisor emails. Delve has tried this and stayed shallow; nobody else has tried at all. This is the moat.

See [01 — Strategic positioning](docs/refresh/01-strategic-positioning.md) for the wedge against each competitor.

## The seven highest-leverage moves

1. **Build `/methodology` as six numbered chapters** in Linear Method's structure.
2. **Embed an interactive coding micro-demo above the fold.**
3. **Show real pricing on the page.**
4. **Publish `/vs/nvivo`, `/vs/atlas-ti`, `/vs/dedoose`** — sober, sourced comparison pages.
5. **Activate Tier 2 brand** (Ink + Ochre, Fraunces + Inter).
6. **Stripe-style `/trust` page** plus a dedicated `/trust/ai`.
7. **Discreet "Built by JMS Dev Lab →" footer.**

## How to use this plan

- **For a directional read:** [00](docs/refresh/00-executive-summary.md) → [01](docs/refresh/01-strategic-positioning.md) → [12](docs/refresh/12-open-decisions.md).
- **For execution starting tomorrow:** [09](docs/refresh/09-implementation-phases.md) (phases) → [04](docs/refresh/04-brand-design-system.md) (design system) → [06-pages/](docs/refresh/06-pages/) (the page you're building) → [14](docs/refresh/14-pre-launch-qa-checklist.md) (QA before merging).
- **For content authoring:** [08](docs/refresh/08-content-strategy.md) (strategy, methodology outlines, customer schema, /vs/ template) → [04 §4.7](docs/refresh/04-brand-design-system.md) (copy bank).

## Version history

- **v1** — Initial plan: strategic frame, IA, page specs, phases.
- **v2** — Adds copy drafts, AI policy positioning, /vs/ pages, methodology outlines, performance/a11y budgets, analytics schema, demo spec, QA checklist, ordered phase tasks.
- **v3** — Adds component states matrix, mobile spec, /press, sample customer story, sample methodology excerpt, /vs/nvivo content outline, MDX content pipeline, rollback plan, post-signup flow, six new open decisions. Split into `docs/refresh/` for execution browsing.

---

## Closing note

If we hold §1's line — market the method, not the tool — the site lands. If we lose it — if `/methodology` ends up as four blog posts and `/customers` ends up as a logo wall — we ship a competent QDA marketing site like the other six in the category. That's not the bar.

— end plan v3 —

# 9. Implementation phases

← [Plan index](README.md)

Five phases. Each ships independently. Each ends in a deployable state.

## Phase 1 — Foundation (1 week)

**Goal.** Tier 2 brand alive on every existing marketing page.

**Ordered tasks**

1. Self-host Fraunces — replace Google Fonts `@import` in `brand-v2.css:15` with local `woff2`; add `size-adjust` / `ascent-override` / `descent-override` for zero-CLS.
2. Wire flag-gated CSS — stop unconditional load of `brand-v2.css`; gate on `ink_ochre_palette` flag in `main.tsx`.
3. Build `<PageShell>` wrapper applying `.brand-v2` class.
4. Implement role-bound color tokens ([04 §4.1](04-brand-design-system.md)) as CSS custom properties in `brand-v2.css`; replace hardcoded `dark:` Tailwind usages on marketing pages.
5. Flip `ink_ochre_palette` and `fraunces_display` flags default-ON for marketing routes only (keep app routes on indigo).
6. Rebuild `<SiteHeader>` for Tier 2; add `<ThemeToggle>` to `<SiteFooter>`.
7. Rebuild `<SiteFooter>` — add bottom rail with `<StudioCredit>`, `Colophon →`, status indicator.
8. Remove duplicate JMS Dev Lab link from Company column.
9. Create OG image PNG (static) at `/public/og-image.png` (fix the broken reference at `index.html:13`).
10. Regenerate prerender CSS at `index.html:87–108` for Tier 2 — or remove if SSG decision lands first ([05 §5.4](05-component-inventory.md) decision).
11. Contrast audit — every marketing page, light + dark, all sizes. Fix failures.
12. Lighthouse pass on `/` — target ≥ 90 Performance.
13. Smoke test all existing pages.

**Definition of done.** `/`, `/pricing`, `/guide`, `/trust`, `/privacy`, `/terms`, `/cookies` all visibly Tier 2. No regressions. Lighthouse Performance ≥ 90 on `/`. No console errors.

## Phase 2 — Conversion path (2 weeks)

**Goal.** Rebuild `/` and `/pricing` to plan. Add `/cite`.

**Ordered tasks**

1. Build primitives: `<Eyebrow>`, `<DisplayHeading>`, `<HairlineRule>`, `<PullQuote>`, `<StatBlock>`, `<Bento>`, `<BentoCell>`, `<CTAStripe>`, `<FAQ>`, `<LogoWall>`, `<TierCard v2>`, `<ComparisonTable>`, `<CompetitorRow>`.
2. Migrate landing i18n strings — add new `landing.eyebrow`, `landing.heroLine1/2/3`, etc., per [04 §4.7](04-brand-design-system.md). Audit for dead keys (current `landing.commonQuestions`, etc., to confirm-or-replace).
3. Build new `/` per [06-pages/01-landing.md](06-pages/01-landing.md) — sections 1, 3, 4, 5, 6, 7, 8, 9, 10. Defer interactive demo (section 2) to Phase 4; render placeholder transcript + screenshot.
4. Rebuild `/pricing` per [06-pages/02-pricing.md](06-pages/02-pricing.md) — four tier cards, `.edu` strip, `<ComparisonTable>`, `<CompetitorRow>` strip, expanded FAQ.
5. Acceptance test: complete a real Stripe checkout end-to-end in staging for Pro monthly, Pro annual, Team monthly, Team annual.
6. Build `/cite` ([06-pages/13-cite.md](06-pages/13-cite.md)) — citation tabs with copy-to-clipboard; export proper BibTeX with `doi` + `version` fields.
7. `usePageMeta` for all new routes; verify OG image renders.
8. Instrument all new CTAs through `trackEvent()` per [15](15-analytics-events-schema.md) schema.
9. Cross-browser test on Chrome, Safari, Firefox, Edge.

**Definition of done.** `/`, `/pricing`, `/cite` shipped. Conversion path looks finished. Demo placeholder honest, not broken.

## Phase 3 — Content depth (2 weeks)

**Goal.** Build the content surfaces. The moat.

**Ordered tasks**

1. Build remaining primitives: `<TOC>`, `<ChapterNav>`, `<CalloutAside>`, `<CaseStudyCard>`, `<ChangelogEntry>`, `<TrustTile>`, `<CitationBlock>`.
2. Build `/methodology` index page.
3. Build `/methodology/[slug]` template. Ship with at least 4 of 6 chapters drafted ([08 §8.5](08-content-strategy.md)).
4. Build `/customers` index + `/customers/[slug]` template. Ship with 4 stories (3 real + 1 representative).
5. Start case-study outreach (email per [08 §8.6](08-content-strategy.md)) at _Phase 1 start_ — by now 4+ weeks elapsed and yeses should be in hand.
6. Build `/for-teams` and `/for-institutions` ([06-pages/05](06-pages/05-for-teams.md) – [06-pages/06](06-pages/06-for-institutions.md)).
7. Build `/vs/nvivo`, `/vs/atlas-ti`, `/vs/dedoose` ([06-pages/15-vs-competitor.md](06-pages/15-vs-competitor.md)).
8. Build `/changelog` ([06-pages/08-changelog.md](06-pages/08-changelog.md)). Backfill 6–8 entries from git history.
9. Refresh `/trust`, `/privacy`, `/terms`, `/cookies`. Externalize sub-processors. Extend Terms. Wire i18n decision.
10. Build `/trust/ai` ([06-pages/10-trust-ai.md](06-pages/10-trust-ai.md)).
11. Build `/accessibility-statement` ([06-pages/16-accessibility-statement.md](06-pages/16-accessibility-statement.md)).
12. Build `/colophon` ([06-pages/12-colophon.md](06-pages/12-colophon.md)).
13. Polish `/guide` — Tier 2 styling.
14. Re-shoot all 15 guide screenshots (depends on app Tier 2 status — see [12](12-open-decisions.md) decision 1).

**Definition of done.** Every page in [03 §3.1](03-information-architecture.md) exists. Methodology chapters: at least 4 of 6 written. Customer stories: 3 real live. /vs/ pages: 3 live.

## Phase 4 — Craft layer (1–2 weeks)

**Goal.** The eight craft moments ([07](07-craft-moments.md)).

**Ordered tasks**

1. Build `<InteractiveDemo>` and `<CodedTranscript>` per [16](16-interactive-demo-spec.md). Ship on `/`. IndexedDB persistence.
2. Wire View Transitions API for `/methodology/*` prev/next and `/customers/*` prev/next.
3. Convert manual entrance animations to native CSS `animation-timeline: scroll()`.
4. Build dynamic OG images per [17](17-og-image-spec.md) (Cloudflare Pages Function with Satori).
5. Lighthouse audit pass — every marketing route — target 100/100/100/100.
6. Full a11y audit (axe-core + manual keyboard + NVDA + VoiceOver). Fix failures.
7. Inject `Last deploy: [time]` into footer at build time.
8. Optional: SSG migration if [05 §5.4](05-component-inventory.md) decision is yes (3-day budget; may slip to a Phase 4.5).

**Definition of done.** Site demonstrably reads as crafted. Lighthouse 100 on `/`, `/pricing`, `/methodology`. Keyboard-only navigation of demo works. View Transitions visible in Chromium and Safari.

## Phase 5 — Launch (1 week)

**Goal.** De-risk the cutover.

**Ordered tasks**

1. Soft launch via `?flags=ink_ochre_palette=true,fraunces_display=true` URL — share with 5–10 trusted users.
2. Address feedback.
3. Pre-launch QA pass per [14](14-pre-launch-qa-checklist.md).
4. Set flags default ON in code (`featureFlagsStore.ts` defaults).
5. Update social-card scrapers — Twitter Card Validator, Facebook Sharing Debugger, Schema.org Validator.
6. Submit updated sitemap to Google Search Console + Bing Webmaster.
7. Announce in changelog + email to existing users (no aggressive marketing — restrained note in their account dashboard).
8. Monitor analytics dashboards for 7 days; rollback gate at 24h (see [10 §10.1](10-risks-and-rollback.md)).

**Definition of done.** Default-on for everyone. No regressions in analytics conversion. JMS Dev Lab cross-link verified to land on the right anchor.

**Total elapsed:** 6–7 weeks for one person; 4–5 with parallel content authorship.

## 9.6 Content authoring pipeline

**Decision: MDX-in-repo, build-time compiled.**

Methodology chapters, customer stories, `/vs/` pages, and changelog entries are all authored as MDX files in `apps/frontend/src/content/` with YAML frontmatter. They're compiled at build time and rendered through the same React components (`<TOC>`, `<CalloutAside>`, `<PullQuote>`, `<StatBlock>`, `<CodedTranscript>`).

**Why not a headless CMS (Sanity / Contentful / Notion):**

- Adds a third-party dependency and a recurring monthly cost.
- Editing lives outside the usual review process. Git review is more rigorous than CMS workflow approval.
- Content stays version-controlled with the components that render it — including the screenshots they reference.
- No additional analytics surface to instrument.

**Why MDX specifically:**

- Markdown is universally writable; non-technical contributors can author with light onboarding.
- MDX lets us embed React components (`<CalloutAside>`, `<PullQuote>`, `<CodedTranscript>`) without inventing a custom syntax.
- One Vite plugin handles methodology, customers, `/vs/*`, changelog — same toolchain everywhere.
- The frontmatter doubles as machine-readable metadata (Zod-validated at build time; build fails on invalid data).

**Directory structure.**

```
apps/frontend/src/content/
├── methodology/
│   ├── _index.mdx                   # /methodology TOC
│   ├── foundations.mdx
│   ├── thematic-analysis.mdx
│   ├── grounded-theory.mdx
│   ├── ipa.mdx
│   ├── intercoder-reliability.mdx
│   └── ethics-in-practice.mdx
├── customers/
│   └── [slug].mdx                   # per case study
├── vs/
│   ├── nvivo.mdx
│   ├── atlas-ti.mdx
│   └── dedoose.mdx
└── changelog/
    └── [YYYY-MM-DD-slug].mdx
```

**Frontmatter schema example (customer story).**

```yaml
---
title: How a public-health lab coded 22 caregiving interviews in six weeks
slug: public-health-lab-2026
type: customer-story
institution_name: A research university
field: Public health
discipline: Qualitative methods
team_size: 4
plan_used: pro
primary_method: thematic_analysis
n_transcripts: 22
duration_weeks: 6
three_stats:
  - { number: '22', label: 'TRANSCRIPTS CODED' }
  - { number: '6 weeks', label: 'NOT SIX MONTHS' }
  - { number: 'κ = 0.84', label: 'INTERCODER RELIABILITY' }
hero_image: /images/customers/public-health-lab/hero.avif
features_used: [auto_code, intercoder, cases, memos, qdpx_export]
consent_level: anonymous_individual
published_at: 2026-06-15
read_time_min: 6
---
```

**Build integration.** `@mdx-js/rollup` + Zod schemas in `apps/frontend/src/content/schema.ts`. Vite plugin generates route stubs at build time so each MDX file becomes a real route at `/customers/[slug]`, `/methodology/[slug]`, `/vs/[slug]`, `/changelog/[date-slug]`.

**RSS auto-generation.** Build step generates `/changelog/feed.xml` and `/methodology/feed.xml` from the MDX files. No hand-curation.

**Sitemap auto-generation.** Build step also writes `/sitemap.xml` and pings Google Search Console on production deploys (via Cloudflare Pages deploy hook).

**Image pipeline.** Author-provided source images at 1× sit alongside the MDX in `apps/frontend/src/content/<type>/[slug]/images/`. Build step transcodes to AVIF + WebP at three breakpoints (320 / 720 / 1440) and writes to `/public/cdn/`. Cloudflare Pages serves with `cache-control: public, max-age=31536000, immutable`.

**Editorial workflow.**

- Drafts on a feature branch.
- PR with `[content]` label triggers a preview Pages deploy.
- Two human reviewers required for `/methodology/*` and `/customers/*` PRs (one for voice, one for accuracy / consent).
- Merge to main triggers production deploy.

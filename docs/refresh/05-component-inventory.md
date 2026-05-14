# 5. Component inventory

← [Plan index](README.md)

## 5.1 New primitives (build once, use everywhere)

| Component                 | Purpose                                                                        | Where used                                    |
| ------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| `<PageShell>`             | Marketing page wrapper, applies `.brand-v2` class, max-width container, footer | Every marketing page                          |
| `<Eyebrow>`               | Tracked-caps label above H1                                                    | Every section start                           |
| `<DisplayHeading>`        | Fraunces display, opsz-axis-aware                                              | Hero, section heads                           |
| `<HairlineRule>`          | 1px ochre rule with draw-in motion                                             | Above H1, above pull quotes                   |
| `<PullQuote>`             | Quote + attribution + ochre vertical rule                                      | `/methodology`, `/customers/[slug]`           |
| `<StatBlock>`             | Display-xl number + Inter caption, count-up motion                             | `/customers/[slug]`, `/methodology` overview  |
| `<Bento>` + `<BentoCell>` | Asymmetric grid for landing features                                           | `/`, `/for-teams`, `/for-institutions`        |
| `<TierCard v2>`           | Replaces current `TierCard`. No "popular" badge. Equal weight.                 | `/pricing`                                    |
| `<ComparisonTable>`       | Categorical-not-binary, like Vercel pricing                                    | `/pricing`, `/vs/*`                           |
| `<CompetitorRow>`         | Side-by-side row used on `/pricing` strip and on `/vs/*` quick-verdict tables  | `/pricing`, `/vs/*`                           |
| `<CaseStudyCard>`         | Hero image + customer name + 1-line outcome                                    | `/customers` index                            |
| `<TOC>`                   | Numbered table of contents                                                     | `/methodology` index, in-page sidebar         |
| `<ChapterNav>`            | Prev / next with chapter numbers                                               | Bottom of `/methodology/*` and `/customers/*` |
| `<CalloutAside>`          | Editorial inset, Fraunces italic, ochre hairlines                              | `/methodology/*`                              |
| `<CodedTranscript>`       | Renders a transcript with code highlights — used in demo + screenshots         | `/`, `/methodology`                           |
| `<InteractiveDemo>`       | The micro-demo above the fold (see [16](16-interactive-demo-spec.md))          | `/`                                           |
| `<ChangelogEntry>`        | Date + title + body + highlights/fixes                                         | `/changelog`                                  |
| `<TrustTile>`             | Compliance badge + label + "Request" CTA                                       | `/trust`                                      |
| `<CTAStripe>`             | Ink-bg full-bleed CTA section                                                  | All conversion pages                          |
| `<FAQ>`                   | Accordion with editorial typography                                            | `/`, `/pricing`, segment pages, `/vs/*`       |
| `<LogoWall>`              | Grid of small university/journal logos                                         | `/customers`, `/for-institutions`             |
| `<CitationBlock>`         | BibTeX/APA/Chicago tabs with copy buttons                                      | `/cite`                                       |
| `<StudioCredit>`          | Footer "Built by JMS Dev Lab" line                                             | `<SiteFooter>`                                |
| `<ThemeToggle>`           | Three-state (system/light/dark)                                                | `<SiteFooter>`                                |
| `<RSSLink>`               | Single ochre link to changelog RSS                                             | `/changelog`, `/methodology` index            |

## 5.2 Existing infrastructure to keep

- `usePageMeta` hook — drives `<title>`, OG, canonical. All new pages reuse.
- `useFeatureFlag` — already supports `ink_ochre_palette` and `fraunces_display`.
- `trackEvent()` — already wired to GA4 + backend events. Instrument new CTAs.
- `<SiteHeader>` / `<SiteFooter>` — keep the components; rewrite their internals for Tier 2.
- `useMobile`, `useUIStore` (dark mode) — keep.

## 5.3 Animation library decision

**Recommendation: native CSS only.** All seven motion moments above are achievable in plain CSS + a tiny IntersectionObserver hook for "enter viewport" triggers. Adding `framer-motion` (~50KB gz) for marketing pages alone is overkill, and the constraint of native CSS is part of what makes the site read as crafted.

## 5.4 SSR / pre-render decision

The current site is a pure SPA. The only no-JS surface is the small inline `#marketing-root` block at `index.html:87–108` which renders a static facsimile of the hero. For an editorial / academic site this is borderline embarrassing — researchers using strict campus browsers and content scrapers (Google, social cards) get a degraded experience.

**Recommendation: Vite SSG (Static Site Generation) for marketing routes.**

Cloudflare Pages serves the static HTML; React hydrates on the client. We get:

- A proper no-JS reading experience (matters for editorial / academic).
- Perfect LCP without prerender-CSS gymnastics.
- Social-card scrapers see real OG content.
- Lighthouse 100 Performance becomes trivial.
- Bots (Google, Bing) index the real text, not a `<noscript>` fallback.

**Routes to SSG:** every `/` page in [03 §3.1](03-information-architecture.md) _except_ `/login` (which stays SPA).

**Cost:** moderate. Need to introduce `vite-plugin-react-pages` or `vite-plugin-ssr` (or roll a small SSG via `vite build --ssr`). One-time setup; routine builds thereafter.

**Risk:** existing `usePageMeta` hook does DOM mutations after mount. We need to render meta tags server-side for the initial document. This is a 2–3 day refactor.

**Decision required.** If we say no: live with the SPA, keep the prerender CSS hack, accept that we cap at Lighthouse 95 and have a small no-JS hole. If we say yes: 3-day upfront cost, no further architectural disruption.

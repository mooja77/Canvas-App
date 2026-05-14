# 17. Dynamic OG image specification

← [Plan index](README.md)

A Cloudflare Pages Function generates a 1200×630 PNG for every marketing page on first request, cached for 24 hours. Built with [Satori](https://github.com/vercel/satori) or equivalent (renders JSX to SVG to PNG).

## Composition

All cards share a common chrome:

- Background: `bg.page` (light) or `bg.card` (dark).
- A 4px ochre rule at top-left, 96px wide.
- QualCanvas wordmark in Fraunces, bottom-left.
- A small `qualcanvas.com` URL bottom-right in Inter mono.

## Per-page variation

| Page                               | Card body                                                      |
| ---------------------------------- | -------------------------------------------------------------- |
| `/`                                | Hero headline rendered in Fraunces 88px; subhead in Inter 22px |
| `/pricing`                         | "Pricing." in Fraunces; three tier prices stacked              |
| `/methodology`                     | "A short field guide" eyebrow; chapter list excerpt            |
| `/methodology/[slug]`              | Chapter number + chapter title in Fraunces                     |
| `/customers/[slug]`                | Institution logo + "How [team] [outcome]" in Fraunces          |
| `/for-teams` / `/for-institutions` | Segment H1 in Fraunces; one-line sub                           |
| `/vs/[competitor]`                 | "QualCanvas vs. [Competitor]" in Fraunces                      |
| `/changelog`                       | "Changelog" + most recent entry title                          |
| Other                              | Page title in Fraunces, page subtitle in Inter                 |

## Cache key

URL pathname + a build-hash query param so deploys invalidate.

## Fallback

Static `og-image.png` (Phase 1) renders if the Function fails or is cold-started past 2s.

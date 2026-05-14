# 6.17 Mobile design specification

← [Pages index](README.md) · [Plan index](../README.md)

Mobile (< 640px) is not an afterthought. A meaningful share of researchers will land via X, email, or a campus VPN-on-phone setup. Rules per surface.

## Navigation

- `<SiteHeader>` collapses to logo + hamburger (current implementation works; restyle for Tier 2).
- Sticky on scroll with a subtle backdrop blur for legibility over body content.
- Skip-to-content link appears as first focusable element.
- Theme toggle stays in footer, not header.

## Typography

- All display sizes drop per [04 §4.2](../04-brand-design-system.md) mobile column.
- Body never goes below 16px (avoids iOS auto-zoom).
- Line-height generous; tracking compression unnecessary at small sizes.

## Hero (`/`)

- Headline reflows to 3–4 lines; subhead stays at 18px.
- CTAs stack vertically, full-width, 8px gap.
- Microcopy line (`No credit card. Free forever.`) below CTAs, center-aligned.

## Interactive demo on mobile

- Desktop drag-selection is replaced by native touch selection (`window.getSelection()` after `touchend`).
- Three suggested code chips appear in a **bottom sheet** (not a floating widget) — fits Apple/Material conventions, doesn't fight the keyboard.
- Bottom sheet animates up with 240ms ease-out; Escape or backdrop tap dismisses.
- Codebook on right collapses to a tab below the transcript that expands on tap.

## Pricing

- Four tier cards stack vertically (current pattern; restyle).
- Comparison table per-tier cards with feature pairs (current PricingPage mobile pattern works; restyle for Tier 2).
- `<CompetitorRow>` shows one competitor at a time with a swipe affordance (small arrow + dot indicator).

## Methodology chapters

- Sidebar TOC becomes an inline accordion at the top of the chapter, collapsed by default.
- Pull quotes shrink from 28px → 22px but keep the ochre rule.
- Editorial asides keep full visual treatment.
- Chapter prev/next nav stays full-width with arrow icons.

## Customer stories

- Hero image stays 16:9 but max-height capped at 360px.
- Stat blocks stack 1-column. Numbers shrink to 48px (from 88px desktop).
- Right rail (features, date, read time) moves below body.

## Trust / for-institutions

- Three-concerns cards stack 1-column.
- Logo wall reflows to 3 cols max.
- AI policy tiles stack.

## Touch targets

- Minimum 44×44 px (WCAG 2.5.5).
- 8px minimum spacing between adjacent targets.
- No hover-only affordances — every state reachable by tap or focus.

## Performance budget on mobile

- LCP target same (< 1.2s) but measured on 4G with 4× CPU throttle.
- Hero image AVIF first, WebP fallback. No JPEG, no PNG (except the static OG fallback).

## Test devices

- Real Pixel 6a (older mid-range Android).
- Real iPhone SE 2 (small viewport, older Safari).
- Chrome DevTools "Slow 3G" simulation as a sanity check.

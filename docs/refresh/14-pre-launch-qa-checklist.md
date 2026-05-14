# 14. Pre-launch QA checklist

← [Plan index](README.md)

A 30-item walk-through before flipping flags default-on at Phase 5. Each item: a single yes/no.

## Build & deploy

1. Production build succeeds with `npm run build`.
2. `npm test` passes (234 backend + 131 frontend + 44 E2E).
3. `npm run typecheck` passes.
4. `npm run lint` passes.
5. Cloudflare Pages preview deploy succeeds for the launch branch.
6. Cloudflare Pages production deploy verified on `qualcanvas.com`.

## Brand & visual

7. Tier 2 (Ink + Ochre + Fraunces) renders on `/` in both light and dark.
8. Fraunces is locally hosted; no Google Fonts request in network panel.
9. `<ThemeToggle>` cycles system / light / dark and persists across reload.
10. No flash-of-unstyled-text (FOUT) on any marketing route.
11. Dark mode contrast passes on every marketing page (axe-core).
12. Ochre only appears at hairlines, focus rings, pull-quote rules, primary CTAs.

## Functional

13. All four Stripe checkouts complete in staging (Pro monthly, Pro annual, Team monthly, Team annual) and produce a real subscription.
14. `.edu` discount applies at checkout when the email ends in `.edu`.
15. The interactive demo loads, accepts a highlight, applies a code, and persists across reload.
16. `useReducedMotion()` correctly disables all 7 motion moments when the OS toggle is set.
17. Keyboard-only walk from URL to "code applied" succeeds without trapping focus.
18. Every CTA fires the correct `trackEvent` per [15](15-analytics-events-schema.md).

## SEO & social

19. Each marketing route has a unique `<title>` and `<meta name="description">`.
20. OG image renders correctly for `/`, `/pricing`, `/methodology/*`, `/customers/*`, `/vs/*` (test in Twitter Card Validator + Facebook Sharing Debugger).
21. Schema.org JSON-LD validates (test in Google Rich Results Test).
22. `sitemap.xml` updated and submitted to Google Search Console.
23. `robots.txt` allows crawling of every marketing route; excludes `/login`, `/canvas`.

## Legal & content

24. `/trust` content has legal sign-off — confirmed in writing.
25. `/trust/ai` claims verified against actual architecture; provider policy links resolve.
26. `/terms` extended to research-conduct + data-deletion clauses; signed off.
27. Sub-processor list (now externalized) is current.
28. `/vs/*` pages have current pricing claims, dated, source-linked. Legal signed off.

## Studio link

29. `Built by JMS Dev Lab →` opens `https://www.jmsdevlab.com/apps.html#qualcanvas` in a new tab.
30. `/colophon` matches [04 §4.7](04-brand-design-system.md) wording (or its agreed final form).

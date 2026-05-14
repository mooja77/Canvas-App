# 12. Open decisions

← [Plan index](README.md)

Decisions to settle before / during Phase 1 — each materially shapes downstream work.

1. **Tier 2 scope (marketing-only vs. app + marketing).** Recommendation: marketing-only first; app refresh as a separate plan.

2. **Real vs. representative case studies at launch.** Recommendation: start outreach immediately (Phase 1 day 1); ship hybrid (real where we have them, clearly-labeled worked examples otherwise — never fabricated names).

3. **Methodology authorship.** Recommendation: founder/internal draft + paid external reviewer per chapter for v1; commission named contributors over time.

4. **Legal i18n.** Recommendation: English-canonical with banner. Cheaper, lower risk; revisit with institutional sales.

5. **`/colophon` JMS Dev Lab credit wording.** Recommendation: both footer line and colophon page.

6. **Studio sister-site updates (`jmsdevlab.com/apps.html#qualcanvas`).** Recommendation: yes, but as a separate small change after QualCanvas Phase 5 — out of scope.

7. **Interactive demo scope.** Recommendation: fully interactive — ship a polished animated preview as fallback in Phase 2 to de-risk Phase 4.

8. **Public roadmap.** Recommendation: defer. Changelog covers retention at launch; roadmap requires product input we don't have yet.

9. **SSG migration.** Recommendation: yes, but as Phase 4 stretch goal. SPA stays viable if we slip.

10. **AI use policy specificity.** Should `/trust/ai` name specific models (OpenAI gpt-X, Anthropic claude-Y) with their training-exclusion guarantees, or speak in principles? Recommendation: name model families and link to each provider's policy; refresh quarterly. Specific model versions get stale fast.

11. **`/vs/[competitor]` legal review.** Recommendation: paragraph-level review by legal before publish. Sourced claims only. Defamation risk is real if anything reads as malicious.

12. **Honorarium for case studies.** Recommendation: $200 in cash or charitable donation. Within market norm for academic interview compensation; signals seriousness.

13. **Privacy-respecting analytics.** Current setup is GA4 + a backend events stream (`POST /api/v1/events/track`). GA4 is heavy, sets third-party cookies, and tracks across sites — an academic / privacy-sensitive audience does notice.

    Options:
    - Keep GA4 + cookie-consent gating (current).
    - Replace GA4 with [Plausible](https://plausible.io) (~1 KB script, no cookies, GDPR-clean, ~$9/mo for our volume).
    - Self-host [Umami](https://umami.is) on Cloudflare.

    **Recommendation: Plausible** on marketing routes; keep GA4 only on the app. The backend events stream stays unchanged. Aligns with the `/trust/ai` posture and removes a credibility-poll from the cookie banner.

14. **Newsletter strategy.** Linear has none on `/`. Stripe runs Atlas (a real publication). Are.na has a small footer subscribe.

    **Recommendation: no newsletter modal anywhere.** Add a single footer line — `Get the methodology field guide by email — one chapter a month` — linking to a discreet subscribe page. Low friction, opt-in only, monthly cadence tied to methodology chapters being published. Buttondown or ConvertKit as the back end; cheap, clean, no popups.

15. **PWA / service worker on marketing routes.** The existing `vite-plugin-pwa` with `registerType: 'prompt'` caches the app shell. Should marketing routes be in scope?

    **Recommendation: no.** Keep the SW limited to the app shell. Marketing routes should not be cached aggressively — copy and prices change. Exclude `/`, `/pricing`, `/methodology/*`, `/customers/*`, `/vs/*`, `/changelog`, `/trust*` from the SW's navigation-cache strategy. Static assets (fonts, CSS, JS chunks) cache normally.

16. **Founder / team visibility.** Maya wants to know who built this. Tom wants to see the studio.

    **Recommendation:** A single sentence in `/colophon`. A byline on each `/methodology/*` chapter (author name + 1-line bio with link). No founder photo on the home page. Voice across all surfaces is "the team," not "I." Maintains the editorial register; satisfies the persona without bending the brand.

17. **Carbon / sustainability statement.** Editorial sites increasingly publish a one-line carbon footprint via [Website Carbon](https://websitecarbon.com).

    **Recommendation:** _measure but don't publish at launch._ Revisit at 6 months. If we're meaningfully below the 0.6 g CO₂ / pageview industry median, then publish on `/colophon` as a single sentence. Otherwise stay quiet.

18. **Status page hosting.** The footer status indicator promises something — build vs. buy?

    **Recommendation: buy.** [Better Uptime](https://betterstack.com/better-uptime) or [Instatus](https://instatus.com) for ~$0–29/mo. Branded status subdomain (`status.qualcanvas.com`). Hand-rolling is not worth the engineering cost; outages need a status page that's _not_ on the same hosting as the thing that's down.

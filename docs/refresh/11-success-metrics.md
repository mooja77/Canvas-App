# 11. Success metrics

← [Plan index](README.md)

Set baseline in Phase 1; measure delta at Phase 5+30 days.

| Metric                                                 | Baseline (today, estimate) | Phase 5+30d target             | How measured                                     |
| ------------------------------------------------------ | -------------------------- | ------------------------------ | ------------------------------------------------ |
| `/` → signup conversion                                | unknown (instrument)       | ≥ +30% relative                | `trackEvent('signup_started')` from `/` referrer |
| `/pricing` → signup conversion                         | unknown                    | ≥ +20% relative                | Same                                             |
| `/vs/[competitor]` → signup conversion                 | n/a (new)                  | ≥ 8% per visitor               | Funnel from `/vs/*` to `signup_started`          |
| Lighthouse Performance (`/`)                           | ~80 (est.)                 | ≥ 95                           | `npx lighthouse` in CI                           |
| Lighthouse Accessibility                               | ~88 (est.)                 | 100                            | Same                                             |
| CLS                                                    | unknown                    | < 0.05                         | Web Vitals report                                |
| TBT                                                    | unknown                    | < 200ms                        | Lighthouse                                       |
| Marketing JS bundle                                    | unknown                    | < 80 KB uncompressed per route | Vite build analyzer                              |
| Time on `/methodology/*`                               | n/a                        | ≥ 90s median                   | GA4                                              |
| `/methodology` → signup                                | n/a                        | ≥ 5%                           | GA4 funnel                                       |
| Organic impressions on `"qualitative coding software"` | unknown                    | +100% absolute                 | Search Console                                   |
| Organic impressions on `"nvivo alternative"`           | unknown                    | rank top-10 within 90 days     | Search Console                                   |
| Inbound JMS Dev Lab traffic via `/colophon`            | n/a                        | ≥ 50 outbound clicks / mo      | `trackEvent('studio_credit_clicked')`            |
| Number of named case studies live                      | 0                          | ≥ 4                            | Manual count                                     |
| Methodology chapters published                         | 0                          | ≥ 4 of 6                       | Manual count                                     |
| Days since last changelog entry                        | n/a                        | ≤ 14 days                      | RSS feed                                         |

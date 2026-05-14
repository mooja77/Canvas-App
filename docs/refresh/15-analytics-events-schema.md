# 15. Analytics events schema

← [Plan index](README.md)

Instrument every new CTA. Use the existing `trackEvent()` utility (`analytics.ts` per the audit). Add these events to the typed `AnalyticsEvent` enum.

| Event                            | Trigger                                     | Properties                                       |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| `marketing_page_viewed`          | every marketing page mount                  | `page`, `referrer`, `persona_hint` (utm-derived) |
| `cta_clicked`                    | any tracked CTA                             | `cta_label`, `location`, `target_route`          |
| `signup_started`                 | clicked Start free / Start Pro / Start Team | `source_page`, `plan`                            |
| `interactive_demo_started`       | user highlights any span                    | (none)                                           |
| `interactive_demo_code_applied`  | user clicks a suggested code                | `code_name`, `code_count_in_session`             |
| `interactive_demo_completed`     | user applies 3+ codes                       | (none)                                           |
| `methodology_chapter_started`    | chapter page enters viewport                | `chapter`                                        |
| `methodology_chapter_completed`  | scroll reaches 90%                          | `chapter`, `scroll_time_ms`                      |
| `customer_story_viewed`          | `/customers/[slug]` enters viewport         | `slug`, `institution_name`                       |
| `pricing_toggle_changed`         | monthly / annual toggle                     | `new_value`                                      |
| `comparison_row_expanded`        | competitor comparison row clicked           | `competitor`                                     |
| `vs_page_viewed`                 | `/vs/[competitor]` page viewed              | `competitor`                                     |
| `dpa_requested`                  | clicked Request DPA                         | (auth state)                                     |
| `soc2_requested`                 | clicked Request SOC 2                       | (auth state)                                     |
| `ai_policy_viewed`               | `/trust/ai` page viewed                     | (none)                                           |
| `studio_credit_clicked`          | clicked JMS Dev Lab link                    | `location` (`footer` / `colophon`)               |
| `changelog_subscribed`           | clicked RSS link                            | (none)                                           |
| `citation_copied`                | clicked copy on `/cite`                     | `format` (`bibtex`/`apa`/`chicago`/`ris`)        |
| `accessibility_statement_viewed` | `/accessibility-statement` page viewed      | (none)                                           |

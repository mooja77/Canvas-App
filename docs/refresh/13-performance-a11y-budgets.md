# 13. Performance + accessibility budgets

← [Plan index](README.md)

Concrete numbers. Failing any of these on a marketing route blocks a release.

## Performance budgets

| Metric                                 | Budget            | Notes                                 |
| -------------------------------------- | ----------------- | ------------------------------------- |
| LCP (Largest Contentful Paint)         | < 1.2s on 4G      | Hero text or hero image               |
| FID / INP                              | < 100ms / < 200ms | First / next interaction              |
| CLS                                    | < 0.05            | Variable-font `size-adjust` mandatory |
| TBT (Total Blocking Time)              | < 200ms           | Lighthouse                            |
| Marketing route JS (uncompressed)      | < 80KB            | Per route, gzip ~25KB                 |
| Marketing route CSS (uncompressed)     | < 30KB            | Per route                             |
| Total fonts (Fraunces + Inter, subset) | < 90KB            | Variable; subset Latin only           |
| Initial HTML                           | < 25KB            | Helps cold-start LCP                  |
| Hero image (compressed AVIF)           | < 80KB            | Fallback WebP < 120KB                 |
| Largest screenshot (compressed)        | < 200KB           | AVIF/WebP, no PNGs                    |
| Per-page network requests              | < 25              | Including fonts, scripts, images      |
| `prefers-reduced-data` honored         | yes               | Skip non-essential images             |

## Accessibility budgets

| Item                              | Budget                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| WCAG conformance                  | 2.2 AA across marketing pages; AAA where it's free          |
| Body text contrast (light)        | ≥ 7:1                                                       |
| Body text contrast (dark)         | ≥ 7:1                                                       |
| Small text contrast               | ≥ 4.5:1                                                     |
| Non-text contrast (UI components) | ≥ 3:1                                                       |
| Color-only differentiators        | none — every state has a non-color cue                      |
| Keyboard reach                    | 100% of interactive elements                                |
| Focus indicators                  | visible, 2px ochre ring, not-`outline: none` ever           |
| Screen reader test                | passes NVDA (Windows) + VoiceOver (macOS + iOS) smoke tests |
| `prefers-reduced-motion`          | every motion has a non-motion fallback                      |
| Headings hierarchical             | one H1 per page, no skipped levels                          |
| Images have meaningful alt        | yes, or `alt=""` deliberately for decoration                |
| Form fields labeled               | yes (relevant on `/login`, `/cite` copy buttons, demo)      |
| Skip-to-content link              | first focusable element of every page                       |

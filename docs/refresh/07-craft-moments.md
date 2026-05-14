# 7. Craft moments specification

← [Plan index](README.md)

The eight things that make the site read as "built by an excellent dev studio" — the items that earn the JMS Dev Lab cross-link.

| #   | Move                                                | Implementation                                                                                                                                            | Visible to user as                                                |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Interactive coding micro-demo                       | `<CodedTranscript>` + IndexedDB cache via `idb-keyval`                                                                                                    | Hero feels alive, not a screenshot                                |
| 2   | View Transitions API between marketing pages        | `document.startViewTransition` wrapper in `react-router-dom@7`                                                                                            | Logo + title morph smoothly on nav                                |
| 3   | Native scroll-driven animations                     | CSS `animation-timeline: scroll()` on `<HairlineRule>` and bento reveals                                                                                  | Subtle entrance motion, no JS scroll library                      |
| 4   | Lighthouse 100/100/100/100 on every marketing route | Self-host Fraunces; remove `brand-v2.css` from unconditional load; lazy-load demo bundle; SSG marketing routes (see [05](05-component-inventory.md) §5.4) | Site loads instantly                                              |
| 5   | `prefers-reduced-motion` honored end-to-end         | Single `useReducedMotion()` hook returning a token map                                                                                                    | Site is humane to users with vestibular sensitivity               |
| 6   | Designed dark mode                                  | [04](04-brand-design-system.md) §4.1 token map + image saturation filter + Fraunces weight-shift                                                          | Dark mode looks composed, not inverted                            |
| 7   | Dynamic per-page OG images                          | Cloudflare Pages Function generating PNG via Satori                                                                                                       | Every shared link looks designed (spec [17](17-og-image-spec.md)) |
| 8   | Real-time texture                                   | `Last deploy: 2h ago` in footer (build-time injected); IndexedDB persistence on demo; visible version number                                              | Subliminal "this is maintained" signal                            |

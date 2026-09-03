# Brand Identity Tier 2 Rollout

## Goal

Migrate QualCanvas from "generic indigo Tailwind starter" to a distinctive Ink + Ochre brand that reads as "academic, considered, methodologically literate." Designer-led, ~4-6 weeks parallel to other sprints.

## Scope

- New color palette (Ink + Ochre, indigo demoted to functional accent)
- Type system: Inter body + Fraunces display + JetBrains Mono accent
- Custom logo + wordmark replacing the sparkles glyph
- 22 custom canvas node icons (illustrator engagement)
- 5 marketing GIFs / screen recordings
- Updated OG image + favicon set
- Brand guidelines doc (2-4 pages)

## Out of scope

- Marketing site full redesign (Sprint 14 — GTM)
- Visual identity refresh of all 200+ in-app micro-interactions (continuous)
- Photography / illustration system (defer to Tier 3)

## Phase 1 — Foundation (Week 1)

### Color migration

**`C:\JM Programs\QualCanvas\apps\frontend\tailwind.config.js`:**

```diff
  theme: {
    extend: {
      colors: {
-       brand: {
-         50:  '#EEF2FF',
-         100: '#E0E7FF',
-         500: '#6366F1',
-         600: '#4F46E5',
-         700: '#4338CA',
-         // ... full scale
-       },
+       ink: {
+         50:  '#F7F8F9',
+         100: '#E8EAED',
+         200: '#D1D5DB',
+         300: '#9CA3AF',
+         400: '#6B7280',
+         500: '#374151',
+         600: '#1F2937',
+         700: '#111827',
+         800: '#0F1419',
+         900: '#030712',
+       },
+       ochre: {
+         50:  '#FBF7EF',
+         100: '#F4E9D2',
+         200: '#E8D2A5',
+         300: '#DCBC78',
+         400: '#D0A54B',
+         500: '#C8853B',
+         600: '#A66B2E',
+         700: '#7D5023',
+         800: '#553617',
+         900: '#2C1D0C',
+       },
+       // indigo demoted to functional accent (focus rings, link hover only)
+       accent: {
+         500: '#6366F1',
+         600: '#4F46E5',
+       },
      },
    },
  },
```

### Font system

**`C:\JM Programs\QualCanvas\apps\frontend\index.html`:**

```diff
- <link rel="preconnect" href="https://fonts.googleapis.com">
- <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
- <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
+ <link rel="preload" as="font" type="font/woff2" crossorigin
+       href="/fonts/inter-variable.woff2">
+ <link rel="preload" as="font" type="font/woff2" crossorigin
+       href="/fonts/fraunces-variable.woff2">
+ <style>
+   @font-face {
+     font-family: 'Inter';
+     src: url('/fonts/inter-variable.woff2') format('woff2-variations');
+     font-weight: 400 700;
+     font-display: swap;
+   }
+   @font-face {
+     font-family: 'Fraunces';
+     src: url('/fonts/fraunces-variable.woff2') format('woff2-variations');
+     font-weight: 500 700;
+     font-display: swap;
+   }
+ </style>
```

Download Inter Variable + Fraunces Variable woff2 to `apps/frontend/public/fonts/`. Both Google-fonts-licensed, OFL.

**`C:\JM Programs\QualCanvas\apps\frontend\tailwind.config.js`:**

```diff
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
+       serif: ['Fraunces', 'Georgia', 'serif'],
+       mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
```

Apply `font-serif` to h1, hero, marketing eyebrow text only. Apply `font-mono` to stats counters, timestamps, node IDs, code blocks.

### Cross-app sweep

```bash
cd "C:\JM Programs\QualCanvas\apps\frontend"
# Find all bg-brand- / text-brand- / border-brand- usages
grep -rn "brand-" src/
# Categorize:
# - "primary action" → migrate to ink-700 (text on ochre-500 bg) or ochre-500 (CTA)
# - "focus ring" → migrate to accent-600 (kept)
# - "selected state" → migrate to ochre-100 (light) / ochre-500 (border)
```

## Phase 2 — Logo + favicon (Week 2)

### Logo replacement

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\SiteHeader.tsx:29-37`:**

Replace the Heroicons sparkles glyph with a custom 3-circle constructive mark:

```diff
- <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg ...">
-   <svg viewBox="0 0 24 24" className="w-5 h-5 text-white">
-     <path d="M9.813 15.904L9 18.75..." />  {/* sparkles */}
-   </svg>
- </div>
+ <div className="w-8 h-8 flex items-center justify-center">
+   {/* 3 connected nodes: small / medium / large */}
+   <svg viewBox="0 0 32 32" className="w-7 h-7 text-ink-800 dark:text-ink-50">
+     <circle cx="6" cy="22" r="3" fill="currentColor"/>
+     <circle cx="16" cy="14" r="4" fill="currentColor"/>
+     <circle cx="26" cy="8" r="2.5" fill="currentColor"/>
+     <line x1="8.5" y1="20" x2="13.5" y2="16" stroke="currentColor" stroke-width="1.5"/>
+     <line x1="19" y1="12" x2="24" y2="9.5" stroke="currentColor" stroke-width="1.5"/>
+   </svg>
+ </div>
+ <span className="ml-2 font-serif text-xl tracking-tight">QualCanvas</span>
```

### Favicon set

**`C:\JM Programs\QualCanvas\apps\frontend\public\favicon.svg`:** the same 3-circle mark, ink-800 on transparent.

**`C:\JM Programs\QualCanvas\apps\frontend\public\favicon-32.png`:** 32×32 PNG.
**`apps/frontend/public/apple-touch-icon.png`:** 180×180 PNG.
**`apps/frontend/public/manifest.json`:** point at the new favicon set.

**`apps/frontend/index.html`:**

```diff
- <link rel="icon" href="data:image/svg+xml,<svg ...><text>Q</text></svg>">
+ <link rel="icon" type="image/svg+xml" href="/favicon.svg">
+ <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
+ <link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### OG image refresh

**`C:\JM Programs\QualCanvas\apps\frontend\public\og-image.png`** (1200×630):

New design: 3-circle mark + "QualCanvas — Visual coding for interview research" set in Fraunces 600 on cream background.

## Phase 3 — Canvas node icons (Weeks 2-3, parallel)

### Brief for illustrator

**`C:\JM Programs\QualCanvas\design\node-icon-brief.md`** (new):

- 22 icons, all 1.5px stroke weight, mono-line style
- Designed to be distinguishable at 16×16
- Single color (currentColor in SVG; nodes apply their own tint)
- Mood: precise, slightly sketched (think Stripe documentation diagrams crossed with a sociology textbook)
- Required types: transcript, question (code), memo, sticky-note, group, reroute, case, document, document-portrait, stats, word-cloud, sentiment, co-occurrence, cluster, coding-query, matrix, comparison, treemap, search-result, timeline, geo-map, ai-suggestion

Delivery format: 22 SVGs at `apps/frontend/src/components/canvas/node-icons/<name>.svg`.

### Integration

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\canvas\nodes\TranscriptNode.tsx` (and all 21 siblings):**

```diff
- import { DocumentTextIcon } from '@heroicons/react/24/outline';
+ import { ReactComponent as TranscriptIcon } from '../node-icons/transcript.svg';

- <DocumentTextIcon className="w-4 h-4" />
+ <TranscriptIcon className="w-4 h-4 text-ink-600 dark:text-ink-300" />
```

## Phase 4 — Marketing artifacts (Weeks 3-4)

### 5 marketing GIFs

Record via ScreenStudio or CleanShot, all 800px wide, looping, captioned.

1. **Coding a transcript** — highlight text → AI suggests 3 codes → click apply → node appears on canvas. ~15s loop.
2. **Cross-session pattern** — 2 transcripts side by side, codes flowing into a shared theme node. ~20s loop.
3. **Intercoder reliability** — 2 cursors coding the same passage live, Kappa/α updating. ~15s loop.
4. **Auto-Code review** — pending suggestions tray, bulk-accept >80% confidence. ~15s loop.
5. **Methods statement export** — click "Export methods statement" → text appears with citations. ~10s loop.

**File paths:**

- `apps/frontend/public/marketing/gif-coding-transcript.gif`
- `apps/frontend/public/marketing/gif-cross-session.gif`
- `apps/frontend/public/marketing/gif-intercoder.gif`
- `apps/frontend/public/marketing/gif-autocode-review.gif`
- `apps/frontend/public/marketing/gif-methods-statement.gif`

Embed on:

- LandingPage hero (rotating; replaces `hero-canvas.png`)
- /features.html
- /vs-nvivo, /vs-dovetail comparison pages (Sprint 14)
- ProductHunt launch (when relevant)

### Brand guidelines doc

**`C:\JM Programs\QualCanvas\design\BRAND_GUIDELINES.md`** (new):

```markdown
# QualCanvas Brand Guidelines

## 1. Voice (3 words)

Plain-spoken. Methodologically literate. Quietly competitive.

## 2. Colors

- Primary: ink-800 #0F1419 (type, surfaces, primary buttons)
- Accent: ochre-500 #C8853B (active states, highlights, Pro markers)
- Functional indigo: accent-600 #4F46E5 (focus rings, selection glow only)

## 3. Type

- Body: Inter 400/500/600/700
- Display: Fraunces 500/700 (h1, hero, marketing eyebrow only)
- Mono: JetBrains Mono 400 (stats, timestamps, IDs, code)

## 4. Logo

Three connected nodes (small/medium/large), 1.5px stroke, ink-800 on light or ink-50 on dark.
Wordmark: "QualCanvas" in Fraunces 700, no gradient, no container.

## 5. Icons

Heroicons everywhere except canvas nodes (22 custom icons).
Canvas node icons: 1.5px stroke, mono-line, currentColor for tinting.

## 6. Motion

Spring easing cubic-bezier(0.34, 1.56, 0.64, 1) at 150-300ms.
Respect prefers-reduced-motion (already wired).

## 7. Voice in visuals

Restraint over decoration. Diagrams over illustrations. Margins over color washes.
The page should look like a well-set academic journal, not a startup deck.

## 8. Don't

- Don't use the sparkle / star emoji as a visual element (it's the generic AI cliché)
- Don't use stock photos of diverse people pointing at laptops
- Don't gradient-overlay screenshots
- Don't use Title Case on body buttons (sentence case only)
```

## Phase 5 — Dark mode parity (Week 4)

Audit every new component for dark variants. Ochre on dark backgrounds:

- `bg-ochre-500` → light mode: fine
- `bg-ochre-500` on dark: keep, but adjust hover to `bg-ochre-400`
- `text-ochre-500` on dark: shift to `text-ochre-300` for readability

## Phase 6 — Rollout (Week 5-6)

Single "QualCanvas 2.0" release bundle:

1. New colors live (behind feature flag if needed)
2. New fonts loaded
3. New logo deployed
4. 22 canvas node icons swapped
5. 5 marketing GIFs embedded
6. Brand guidelines doc published

Coordinate with marketing post + product changelog entry.

## Tests

- Visual regression: full snapshot suite re-baseline-d
- Lighthouse: still ≥90 on mobile (fonts self-hosted shouldn't regress LCP)
- A11y: contrast checks (ink-800 on ink-50 = 16.7:1 AAA; ochre-500 on ink-50 = 4.8:1 AA large)

## Acceptance criteria

- [ ] All `brand-*` Tailwind classes migrated to `ink-*` or `ochre-*`
- [ ] `font-serif` applied to h1/hero only
- [ ] `font-mono` applied to stats/timestamps
- [ ] 22 custom canvas node icons delivered + wired
- [ ] 5 marketing GIFs recorded + embedded
- [ ] New logo + favicon set live
- [ ] Brand guidelines doc published
- [ ] Visual regression baseline updated
- [ ] Dark mode parity verified

## Rollback

Hard rollback would be a multi-file revert. Easier path: keep old palette as `brand-legacy-*` in Tailwind config for 30 days; can switch back via single `<html class="brand-legacy">` toggle.

## Cost estimate

| Item                                                     | Cost             |
| -------------------------------------------------------- | ---------------- |
| Freelance illustrator (22 node icons)                    | $1,500-3,000     |
| Logo design refinement                                   | $500-1,000       |
| Brand designer consult (~10 hours)                       | $1,000-2,000     |
| Stock fonts (Fraunces + Inter free; JetBrains Mono free) | $0               |
| **Total**                                                | **$3,000-6,000** |

If budget is tight: skip designer consult, use the 3-circle mark spec above as-is, illustrate node icons in-house. Drops cost to ~$1,500.

## Effort

**4-6 weeks** (designer-led, parallel to other sprints). Engineering integration: ~1 week distributed across phases.

## Owner

Designer (freelance) + 1 frontend engineer

## Commit messages

Multiple commits across phases:

```
feat(brand): migrate to Ink + Ochre palette
feat(brand): self-host Inter + Fraunces variable fonts
feat(brand): replace sparkles logo with 3-circle mark
feat(brand): 22 custom canvas node icons
feat(marketing): 5 product GIFs on landing + features
docs(brand): publish brand guidelines
```

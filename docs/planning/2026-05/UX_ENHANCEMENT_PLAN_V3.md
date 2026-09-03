# QualCanvas — Master UX Enhancement Plan V3

**Date:** 2026-05-12 (supersedes V1 + V2)
**Status:** Comprehensive after 6 agent research passes + live exploration of 26 surfaces + code audit of CanvasWorkspace.tsx + 25 hooks + AI routes + Prisma schema.

**Tagline (settled):** _"The canvas where qualitative research thinks with you."_

**Single highest-leverage move:** Convert "Tools" + "AI" dropdowns into a **VS Code-style activity bar** with `Cmd+K` as the universal escape hatch. This one structural change solves discoverability for both novices (visible panels) and power users (palette) — the convergent design that Linear, Notion, Figma, VS Code, Slack, and Claude.ai all arrive at from different starting points.

---

## What this plan is based on

### Live exploration (this session, 26 surfaces captured)

Landing, pricing (monthly + annual), login, signup, forgot password, dashboard, canvas workspace at 15%/45%/200% zoom, individual node closeups, Analyze menu, AI menu, Tools menu (revealed 12 hidden features), code navigator, keyboard shortcuts modal, command palette (already scope-aware!), command palette with sentiment query, dark mode canvas, mobile landing, mobile canvas (broken), /guide page, /features.html page, account page, transcript dropdown, code creation flow, statistics analysis node creation.

### Agent research (6 deep passes)

1. **Codebase inventory** — every existing feature with file:line citations
2. **Qual research competitor deep-dive** — 13 tools (Dovetail/Notably/Insight7/Marvin/Looppanel/Atlas.ti/NVivo/MAXQDA/Taguette/Reduct/Maze/Granola/Reflect)
3. **Node-canvas tool survey** — 21 tools (Krea/Glif/Flowise/n8n/Make/Bardeen/Blender/Houdini/TouchDesigner/Fusion/Reaktor/Excalidraw/Whimsical/Mural/Lucidspark/Obsidian/Heptabase/Scrintal/...)
4. **Code architecture deep review** — CanvasWorkspace.tsx (2,787 lines!), canvasStore.ts (678 lines), 25 custom hooks, type safety, test gaps
5. **AI implementation audit** — 4 endpoints, prompts, models, caching, embeddings, BYOK encryption, two-phase flow
6. **AI UX patterns** — 19 tools (Cursor/Replit Agent/Lovable/v0/Bolt/Copilot Workspace/Claude artifacts/Granola/Cron/Arc/Raycast/Sequel/Cap.so/Mem/Otter/Tana/Coda/Framer/Recraft)
7. **IA / nav comparison** — 14 tools (Linear/Notion/Figma/Slack/Asana/GitHub/VS Code/Spotify/Excalidraw/tldraw/Sketch/After Effects/ChatGPT/Claude.ai)
8. **Perf / a11y / SEO / security live audit** — bundle sizes, TTFB, security headers, Cloudflare cache config

---

## TL;DR — Where the leverage is

QualCanvas already has **22 node types, real-time collab, scope-aware Cmd+K, dark mode, undo/redo, viewport bookmarks, group nodes, sticky notes, auto-layout, alignment guides, two-phase AI auto-code, BYOK with AES-256-GCM encryption, 4-language i18n, presentation mode, intercoder reliability, QDPX export, coding stripes, cross-case analysis** — more than ComfyUI, Notably, and most direct competitors ship.

**The product is feature-rich. The problem is:**

1. **Discoverability** — 12 features hidden in "Tools" + 4 in "AI" dropdown
2. **Node info-poverty** — 22 node types display poorly at default zoom
3. **AI moat features missing** — no Cmd+J context chat, no inline tag suggestions, no Magic Cluster, no source-grounded view, no cross-canvas search, no two-phase explainability tray
4. **CanvasWorkspace.tsx is a 2,787-line god component** (needs extraction, not rewrite)
5. **Mobile canvas is broken** — sidebar squashes workspace
6. **Marketing pages are visually flat** — no images/animations
7. **Polish gaps** — Inter font has 6 weights, GTM blocks render, hashed assets revalidate every 4h, missing CSP on Cloudflare

---

## Findings by area

### Codebase architecture (Grade: B — solid foundation, bloated middle)

**Solid:**

- Zustand store design with granular selectors (correct pattern)
- 9 lazy-loaded modals already split out
- Multi-provider AI abstraction (factory pattern) for OpenAI/Anthropic/Google
- AES-256-GCM encryption for BYOK keys
- Real-time collaboration via Socket.IO
- Comprehensive Prisma schema (34 models)
- 937 unit tests passing, 683 E2E tests passing

**Concerning:**

- `CanvasWorkspace.tsx` is **2,787 lines** with 35 useState + 13 useEffect + only 4 useMemo
- `useCanvasKeyboard.ts` is **385 lines** with a 46-parameter options interface
- `buildNodes()` has 27 dependencies — rebuilds entire canvas on any state change
- No rollback on optimistic updates (state divergence if server rejects)
- Real-time collab race condition: `refreshCanvas()` overwrites local pending edits
- No test coverage on CanvasWorkspace.tsx, individual node components, or buildNodes/buildEdges
- 1 `as any` cast reaches into React Flow internals (fragile)
- String-prefix node ID parsing (`'transcript-'`) — would break if IDs contain dashes

### AI implementation (Grade: B+ — solid foundation, missing moat features)

**Solid:**

- Multi-provider abstraction clean (one factory per provider)
- BYOK with AES-256-GCM, IV per encryption, rate-limited key validation
- Two-phase pattern: Auto-Code → AiSuggestion table → user review → apply
- XML-style context blocks in prompts
- Temperature properly tuned (0.2-0.3 for analytical tasks)
- Plan-based daily limits enforced
- AiUsage tracking (tokens, feature, provider, model)

**Missing:**

- **No Anthropic prompt caching** — ~500-token system messages repeated per call (5% cost savings on table)
- **No streaming RAG chat** — uses `complete()` not `completeStreaming()`; users wait silently
- **Stateless chat** — ChatMessage table exists but history not passed to LLM
- **No few-shot examples** in prompts (rules-only)
- **Full re-embed on any transcript edit** — no incremental indexing
- **In-memory cosine similarity** — doesn't scale beyond 10K chunks; no pgvector
- **costCents field exists but always 0** — never calculated
- **Cross-canvas search not implemented** — RAG scoped to single canvasId
- **No fallback model cascade** — single provider failure = hard error

### Performance (Grade: B+ — wire payload OK, parse cost mid-tier)

- 188 KB brotli initial JS (good), 585 KB uncompressed parse (mid)
- TTFB 214ms desktop / 449ms backend
- React Flow vendor chunk (~59KB brotli) loaded on landing even though only `/canvas` needs it
- Prerendered marketing HTML (10.76 KB) is excellent for first paint
- HTML correctly preconnects fonts.googleapis.com, modulepreloads vendor chunks
- **Issues:** GTM blocks render path, Inter requests 6 weights (only 3 needed), hashed assets get `max-age=14400` instead of `immutable`, no CSP on Cloudflare Pages

### Accessibility (Grade: B-)

- `<html lang="en">` ✅
- Viewport meta correct ✅
- Prerendered semantic HTML ✅
- ARIA labels on interactive buttons ✅
- Color contrast in prerender meets AAA ✅
- **Missing:** skip-to-content link, `<nav>` landmark, `<footer>` landmark, `<header>` landmark

### SEO (Grade: A — already invested)

Title, meta description, OpenGraph, Twitter Card, JSON-LD @graph (SoftwareApplication + Organization + WebSite), robots.txt with AI crawler controls, sitemap.xml — all comprehensive after recent SEO commits (`0e1d7df`, `06312d4`).

**Minor:** title/og:title mismatch, sitemap lastmod identical for all 11 URLs.

### Security (Grade: A on backend, C on frontend)

- Backend (Helmet): full CSP, X-Frame-Options SAMEORIGIN, COOP, CORP — A grade
- Frontend (Cloudflare Pages): HSTS, Permissions-Policy, Referrer-Policy, nosniff — **missing CSP, missing X-Frame-Options**
- Easy fix: add `_headers` file to Cloudflare Pages project

---

## Strategic positioning (settled)

**Tagline:** _"The canvas where qualitative research thinks with you."_

Not "AI does your research" (Notably/Marvin) — researchers don't trust this.
Not "Repository for teams" (Dovetail) — too generic.
The promise: **augmented thinking on a visual surface**. The canvas is the moat; AI is the engine.

**Pricing position (current is correct):**

- Free $0: 1 canvas, 5 codes, 5K words, 2 analyses
- **Pro $12/mo** — undercuts Notably ($21), Dovetail ($29+), Looppanel Pro ($395) — real wedge if value lands
- Team $29/mo/seat
- Education -40% (already shipped via Stripe coupon)

**Wedge customer:** Solo academic researchers + small UXR teams (2-5) currently frustrated with Atlas.ti/NVivo (modal coding, desktop install, no real-time collab) and priced out of Dovetail.

---

## Plan: 4 quarters of work

### Q1 Sprint A (Week 1) — "Surface what's built" — P0 quick wins

**Goal:** Stop hiding 16 features behind dropdowns. Make the toolbar density problem disappear.

#### A1. VS Code-style activity bar redesign (~5 days)

Replace top "Tools" + "AI" + analysis dropdowns with a 48px-wide left activity bar:

```
┌──┬─────────────────────┬─────────────────────────────────┬──────────────┐
│ A│ SIDEBAR (B)         │ CANVAS / EDITOR (C)             │ INSPECTOR(D) │
│ c│ (swaps by activity) │                                 │ (contextual) │
│ t│                     │ Breadcrumb: Project › Canvas    │              │
│ i│ [+ New]             │ Tabs: Canvas | Codebook | Cases │              │
│ v│ ─ Recent            │       | Analysis | AI           │              │
│ i│ ─ Pinned            │                                 │              │
│ t│ ─ All canvases      │ [React Flow workspace]          │              │
│ y│ ─ Shared with me    │                                 │              │
└──┴─────────────────────┴─────────────────────────────────┴──────────────┘
│ STATUS: words 12,847/50,000 | codes 34 | plan: Pro | ws: ok | ?         │
└─────────────────────────────────────────────────────────────────────────┘
```

- Activity icons: Canvases / Codebook / Cases / Analysis / AI / Shared / Settings
- Click → swaps sidebar contents (VS Code pattern)
- Canvas tabs: same data, 5 lenses — eliminates "which dropdown was that?"
- Inspector (right, toggleable): contextual to selection

**Where currently-hidden features land:**

| Currently in                                                 | New home                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Tools → Wordcloud/Stats/Sentiment/Co-occurrence/Timeline/etc | **Analysis** activity + canvas Analysis tab + inspector "Run on selection" |
| Tools → Cases / Cross-Case / Matrix                          | **Cases** activity + Cases tab                                             |
| Tools → Codebook / Hierarchy                                 | **Codebook** activity + Codebook tab                                       |
| Tools → Kappa / Weights / Ethics                             | **Inspector** when 2+ coders work selected; `Cmd+K` "Compare coders"       |
| AI → Auto-Code / AI Code / Summarize                         | **AI** activity + `/` slash in transcript + inspector AI section           |
| AI → AI Chat                                                 | Promoted to global `Cmd+J` (Dovetail pattern, see A4)                      |

**Cost:** ~5 days. Touch `CanvasWorkspace.tsx` (extract panels), new `ActivityBar.tsx`, `Sidebar.tsx`, `Inspector.tsx`, `CanvasTabBar.tsx` (already exists), rewire 16 features.

#### A2. Node info density: live thumbnails (~3 days)

- **Code node:** color stripe (4px) + bold name + pill `12 codings · 3 sources` + last-coded excerpt preview (italic gray, 2 lines)
- **Transcript node:** doc icon + title + `% coded` progress bar (gradient) + first 80 chars preview + word count
- **Analysis node:** title + inline sparkline / mini chart preview (match full output)
- **Memo node:** rich markdown edit-in-place (currently plaintext)
- **Group node:** colored tint + collapsible to pill with child count

Reference: TouchDesigner/Krea/Make all do this. Researchers read data, not topology.

**Cost:** ~3 days. Touch `apps/frontend/src/components/canvas/nodes/*.tsx`.

#### A3. Sidebar code navigator: rich rows (~1 day)

- Each row: color dot + name + count + recent excerpt preview (1 line italic gray)
- Hover → floating action chips: rename, recolor, see codings, delete
- Click → canvas centers on code + opens excerpt panel
- New "Recent" sort
- Pin/favorite for top codes

**Cost:** ~1 day.

#### A4. Real empty states (~6h)

- Empty canvas: large drop zone + 3 buttons + 5-template gallery
- Empty sidebar code list: "Codes you create will appear here. Try `/` in a transcript ↓"
- Empty Sources: "Add your first transcript to begin coding" with paste/upload/from-canvas options
- Empty trash: "Trash is empty" with helpful "Restore tutorial canvas" link
- Loading: branded shimmer with progress copy

**Cost:** ~6h.

#### A5. Tooltip + keyboard hints everywhere (~6h)

- Every action button tooltip = title + 1-line description + shortcut chip
- Hover hint pill bottom-left on canvas: "`⌘+K` to search · `?` for shortcuts"
- "What's new" badge top-right links to in-app changelog

**Cost:** ~6h.

**Sprint A ship:** `feat(canvas): activity-bar redesign + rich nodes + empty states + tooltip polish`

---

### Q1 Sprint B (Week 2-3) — "Magic moments" — AI moat features

**Goal:** Ship the AI features researchers won't get from Atlas.ti/NVivo and that justify Pro tier.

#### B1. Trial AI credits (~2 days)

Remove "Add an OpenAI/Anthropic key" friction at the magic moment.

- New free signups: 10 server-funded AI requests/day × 7 days
- Track via `AiUsage.creditedRequests` column (new)
- Replace banner: "✨ You have 10 free AI requests today — try Auto-Code"
- Trial expiry: "Trial used. Add your key, or upgrade to Pro for unlimited."

**Cost:** ~2 days. Backend route + frontend banner.

#### B2. Inline AI tag suggestions on highlight (~4 days)

- Open transcript in side drawer (Inspector or modal)
- Highlight text → popup with 3 AI-suggested codes + confidence %
- Click suggestion → coding instantly created
- "+ New code" inline
- "Why these?" → expandable explainability with citations
- Powered by user key OR trial credits

Reference: Dovetail/Notably/Marvin all do this. **Single biggest researcher "switch tools" moment.**

**Cost:** ~4 days. New `InlineCodeSuggester.tsx` + extend backend `/suggest-codes`.

#### B3. Context-bound `Cmd+J` AI chat (~5 days)

Dovetail's killer feature.

- `⌘+J` from anywhere → AI chat modal
- Scope cascade:
  - Nothing selected → current canvas
  - Node(s) selected → those nodes' content
  - Codebook selected → codes + all coded excerpts
- Streaming token-by-token output
- **Action outputs:** AI can include `[Apply this code to X]` / `[Create cluster]` / `[Add memo]` buttons that execute on canvas
- Citation chips inline
- Daily limits respected

**Cost:** ~5 days. New `AiContextChat.tsx`, backend extends `aiRoutes.ts` (streaming), context resolver.

#### B4. Two-phase suggestions tray (~3 days)

Trust through traceability.

- Persistent bottom-right badge "✨ 12 AI suggestions pending"
- Expand → list with confidence + "Why?" + accept/reject/edit
- Bulk-accept slider ("accept all >0.85")
- "Apply all" / "Reject all" with confirm
- Persists across sessions

**Cost:** ~3 days. Extends existing `AiSuggestPanel.tsx` pattern.

**Sprint B ship:** `feat(ai): trial credits + inline tag suggestions + cmd-j chat + suggestions tray`

---

### Q1 Sprint C (Week 4) — "Polish + mobile fix" — P0 critical

#### C1. Mobile canvas: stash sidebar, bottom command bar (~3 days)

Currently broken at <768px. iPad coding is a stated goal.

- Sidebar slides off-screen at narrow width, opens via hamburger
- Toolbar collapses to icon row + overflow menu
- Bottom command bar with 4 primary actions: Add Code / Add Memo / Search / More
- Touch gestures: 2-finger pan, pinch zoom, long-press context menu
- Pencil/finger highlight → coding (replaces right-click)

**Cost:** ~3 days. Extends existing `useMobile.ts`.

#### C2. Perf quick wins (~1 day total)

From perf agent:

- Hashed assets `Cache-Control: public, max-age=31536000, immutable` (5 min)
- CSP + X-Frame-Options via `_headers` (15 min)
- Self-host Inter, 3 weights only (30 min)
- Defer GTM properly (10 min)
- Code-split `flow-vendor` off landing route (1-2h)
- Defer `registerSW.js` (5 min)
- Genuine per-URL sitemap lastmod (30 min)
- Align title + og:title (2 min)
- Skip-to-content link + `<nav>`/`<footer>` landmarks (20 min)
- Reduce Inter weights to 3 (5 min)

**Cost:** ~1 day total. Lighthouse from ~85 → ~95 mobile expected.

#### C3. Visual polish pass (~2 days)

- Framer Motion: node spawn (200ms ease-out scale 0.95→1), edge create (300ms fade + path-draw)
- Toast: slide-from-right animation
- Loading: branded shimmer
- Button hover: scale(1.02) + brightness
- Reduce-motion preference respected
- Dark mode pair audit on all new components

**Cost:** ~2 days. Already have Framer Motion-style animations in Tailwind config.

**Sprint C ship:** `feat(canvas): mobile usability + perf wins + polish`

---

### Q1 Sprint D (Week 5-6) — "Make the canvas computational" — biggest moat

#### D1. Template gallery as empty state (~3 days)

New canvas → modal: "Start with a template or blank?"

5 templates with sample transcript + 4-step in-canvas tutorial:

- **Thematic analysis** (Braun & Clarke) — pre-seeded codes + memo prompts
- **Grounded theory** (open/axial/selective codes)
- **UXR pain-points** (5 codes: pain, delight, confusion, workaround, success)
- **Support-ticket mining**
- **NPS theme extraction**

Templates are user-cloneable: "Save as template".

**Cost:** ~3 days. New `CanvasTemplate` model, `templateRoutes.ts`, frontend modal.

#### D2. Magic Cluster: select → AI groups + names (~5 days)

Notably/Dovetail signature feature.

- Select 3+ nodes
- Floating ✨ "Cluster these" action
- Streaming progress: "AI is finding themes…"
- Each cluster → `GroupNode` with AI-generated name + 1-sentence description + confidence
- Edit name, accept/reject, "regenerate"
- Two-phase: never auto-apply

**Cost:** ~5 days. Uses existing GroupNode + new backend `POST /canvas/:id/ai/cluster`.

#### D3. Typed sockets + edge validation (~4 days)

Flowise/Houdini/Fusion pattern.

- Color-coded ports: text (blue), code (purple), transcript (green), analysis-result (orange)
- Drag edge → highlight compatible targets
- Incompatible → wire red, snaps back, toast: "Statistics node accepts codes, not transcripts"
- Edge color matches source type
- Backward compatible: existing untyped edges work

**Cost:** ~4 days.

#### D4. Edge midpoint "+" insert (~2 days)

n8n/Make pattern.

- Hover edge → "+" at midpoint
- Click → quick-add palette filtered to compatible nodes
- Selected node splices into edge

**Cost:** ~2 days.

#### D5. Source-grounded split-pane (~5 days)

Scrintal/Obsidian pattern. Coding decisions must stay grounded.

- Select code → right panel slides in
- Top: code name + color + count
- List every excerpt with transcript title + line number + full text
- Click excerpt → canvas focuses transcript + highlights span
- Same pattern for transcript → all codings on it

**Cost:** ~5 days. Extends `ExcerptBrowserModal`.

**Sprint D ship:** `feat(canvas): templates + magic cluster + typed edges + edge insert + source pane`

---

### Q2 — Cross-canvas + AI engineering

#### E1. pgvector migration (~12-16h)

Replace `embedding: String` (JSON) with `embedding: vector(1536)`.

- Add pgvector extension to Postgres
- HNSW index for fast retrieval
- SQL-side cosine similarity (`<=>` operator)
- Drops query latency 100x, enables cross-canvas semantic search

**Cost:** ~2 days.

#### E2. Cross-canvas semantic search (~5 days)

Once E1 ships:

- Cmd+K adds "Search all canvases" tab
- Embeddings on transcript chunks + codes + memos
- Results grouped by canvas, ranked by relevance
- Click → opens that canvas at that excerpt

**Cost:** ~5 days.

#### E3. Bidirectional backlinks (~3 days)

Reflect.app pattern. Codes/transcripts/canvases auto-show "referenced by N".

#### E4. AI engineering improvements (~4-6h each, 4 of them)

From AI audit:

- **Anthropic prompt caching** (4-6h, 5% cost reduction)
- **Sliding-window conversation memory in chat** (8-10h, dramatically better multi-turn coherence)
- **Few-shot examples in coding prompts** (6-8h, 15% fewer hallucinations)
- **AI cost dashboard + cost calculation** (10-12h, operator visibility)

#### E5. Code architecture refactor (~2 weeks total)

From code audit:

- Extract `CanvasGridController`, `CanvasPanelManager`, `CanvasEventHandlers` from 2,787-line god component
- Split `useCanvasKeyboard.ts` into 5 smaller hooks
- Add `useDeferredValue` to `buildNodes()` to debounce during heavy interactions
- Implement rollback for optimistic updates
- Add CRDT or timestamp-based conflict resolution for collab races

#### E6. Repository graph view (~3 weeks)

Reflect's killer feature.

- New `/repository` route
- Visualizes: every canvas as a node, shared codes as edges
- Click canvas → opens it
- Click code edge → side panel of shared excerpts across canvases

This is the moat that prevents churn once a researcher has 3+ canvases.

---

### Q3 — Video + Channels + Platform

#### F1. Video-transcript-canvas tri-sync (Reduct steal, ~4 weeks)

- Transcripts add `videoUrl + segments[start, end, text]`
- Every excerpt embeds 10-sec scrubbable video preview
- Click → modal with synced transcript + video
- Strikethrough excludes from highlight reels
- "Generate highlight reel" → 90-sec compilation of all excerpts tagged with a code → shareable URL

**Cost:** ~4 weeks. Need Cloudflare Stream or Mux for video infra.

#### F2. Channels: auto-tag incoming transcripts (Dovetail steal, ~4 weeks)

Pro/Team retention play.

- `Channel` model: source (upload, Zapier webhook, email, RSS)
- Server polls / accepts pushes
- New transcripts auto-coded via two-phase AI
- Notification when new transcripts arrive
- Volume gated by tier

#### F3. Dual view: Graph (build) vs Dashboard (review) (~3 weeks)

Reaktor pattern. Same canvas, two presentations.

- Graph view: full canvas with wiring
- Dashboard view: hides wiring, shows only "output" computed nodes as report panels
- Auto-arranges dashboard cards in grid
- Export dashboard to PDF for sharing/advisor review

---

### Q4 — Brand + Marketing + Mobile

#### G1. Landing page redesign (~3 weeks)

- Hero: 60-sec autoplay product video ("Watch me code an interview in 3 minutes")
- Animated "how it works" 3-step interactive
- Social proof band — need to source testimonials
- "Compare to Atlas.ti / NVivo / Dovetail" table
- Better OG/Twitter images

#### G2. Visual identity refresh (~3 weeks)

- Custom illustrations for empty states (replace stock)
- Distinctive node "personality" — soft gradients, inner shadows, color tints
- Signature loading animation (coding line drawing itself)
- Custom favicon set + app icon
- Marketing screenshots/GIFs for /features + /guide pages

#### G3. Full mobile companion (~4 weeks)

Beyond C1 fix:

- Pencil-first interactions throughout
- Coding-only mode (focus on transcript reading + tag)
- Offline-first with sync on reconnect
- Native-feeling animations
- PWA installable

---

## Top 10 AI-UX patterns to ship (from agent #6)

Ranked by impact for qual research where trust + auditability + researcher agency are non-negotiable:

1. **Plan-Before-Execute for batch AI** (Copilot Workspace + Replit Agent) — show editable plan before running on 50 transcripts
2. **Confidence-weighted visual output** (Otter + Cursor diffs) — opacity/badge per AI code; researchers triage visually
3. **Diff-view acceptance with bulk actions** (Cursor Apply) — auto-code lands in review pane, never directly
4. **Citation-linked AI memos** (Claude artifacts + Otter Chat) — every AI sentence hyperlinks back to source span
5. **Region/selection-scoped AI** (Recraft + Tana) — lasso nodes, Cmd+K, AI options scoped to spatial selection
6. **Versioned artifacts with fork-from-here** (v0 Generations) — branch coding states, A/B compare
7. **Command palette as AI home** (Raycast + Arc Max) — Cmd+K is canonical AI entry, not a chat sidebar
8. **Streaming status narration** (Replit Agent tool calls) — "Reading transcript 3 of 10..." visible, cancellable
9. **Augment-don't-replace manual coding** (Granola) — AI suggestions render translucent beside human work
10. **Cost & usage transparency** (Bolt credits) — "This will use ~8,400 tokens (16% of monthly)" before expensive ops

**Two patterns to REJECT:**

- ❌ Chat-as-primary-interface — sidebar chat is a crutch; AI lives inside the data
- ❌ Autonomous agent loops without checkpoints — every AI action must be discrete, named, undo-able

---

## Top 10 IA / nav patterns (from agent #7)

1. **VS Code activity bar = swappable sidebar panels** — biggest structural fix
2. **Linear command palette = action grammar, context-ranked** — every feature has a verb
3. **Notion slash menu = `/` in transcript = code/memo/highlight/AI-suggest**
4. **Figma right inspector = contextual to selection** — replaces fixed Tools panel
5. **GitHub breadcrumbs = persistent navigation** — Project › Canvas › Node
6. **Slack sidebar sections = collapsible groups** — Canvases / Codebooks / Cases / Shared
7. **VS Code Welcome tab = clickable cards** — replaces tour modal
8. **After Effects workspaces = named layout presets** — Coding / Analysis / Review
9. **Spotify Now Playing strip = persistent context** — "Currently coding: Interview-03"
10. **Excalidraw library drawer = slide-out, not sidebar** — for assets

---

## Top 10 perf/a11y/SEO fixes (Sprint C2)

| #   | Fix                                            | Time   | Impact                                 |
| --- | ---------------------------------------------- | ------ | -------------------------------------- |
| 1   | Hashed assets `max-age=31536000, immutable`    | 5 min  | ~200ms saved per repeat visit          |
| 2   | CSP + X-Frame-Options on Cloudflare Pages      | 15 min | A+ grade SecurityHeaders.com           |
| 3   | Self-host Inter, preload 1 weight              | 30 min | 150-300ms LCP win                      |
| 4   | Defer GTM properly                             | 10 min | 50-150KB off LCP path                  |
| 5   | Code-split flow-vendor off landing             | 1-2h   | -59KB brotli / -180KB parse first load |
| 6   | Skip-to-content + `<nav>`/`<footer>` landmarks | 20 min | WCAG A → AA                            |
| 7   | Reduce Inter weights 6→3                       | 5 min  | 100-200KB saved                        |
| 8   | Defer `registerSW.js`                          | 5 min  | 5-15ms parser yield                    |
| 9   | Per-URL sitemap lastmod                        | 30 min | Better crawl budget                    |
| 10  | Align title + og:title                         | 2 min  | Marginal CTR                           |

**Total: ~5 hours for ~10-point Lighthouse mobile gain + WCAG bump + security headers A+ grade.**

---

## Acceptance criteria (per ship, every sprint)

1. ✅ Lighthouse Performance ≥ 90 on /canvas mobile
2. ✅ 60fps interaction during pan/zoom at 50 nodes
3. ✅ Zero new console errors
4. ✅ Dark mode parity verified on new components
5. ✅ Keyboard accessible (Tab/Enter/Esc) for all new controls
6. ✅ Mobile tested at 390×844 (iPhone) and 768×1024 (iPad)
7. ✅ E2E test added for new flow
8. ✅ Visual regression baseline updated
9. ✅ Test coverage maintained or improved
10. ✅ ARIA labels on every new interactive element

---

## Risks + mitigations

| Risk                                             | Mitigation                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Feature creep (Q2+Q3 ambitious)                  | Ship Q1 fully before Q2. Each Q1 P1 must reach >50% Pro adoption before Q2 starts.                              |
| AI cost spike from Magic Cluster + Cmd+J chat    | Aggressive embed caching, daily caps, Anthropic prompt caching (E4), fallback to Haiku for cost-sensitive flows |
| Visual polish without designer = mediocre        | Copy named references (ComfyUI, Linear, Notion) by name; don't invent. Hire freelance for G2 if budget allows.  |
| pgvector adds Postgres extension dep             | Existing Railway Postgres supports it (verify); fallback to Postgres FTS for v1 of search                       |
| Schema churn for templates / channels / groups   | All additive Prisma migrations; backward-compatible                                                             |
| 2787-line CanvasWorkspace refactor breaks things | Extract incrementally (one sub-component at a time), comprehensive E2E coverage before each extraction          |
| Mobile canvas fix vs full PWA                    | C1 ships 80% solution; G3 completes for serious tablet researchers                                              |
| Brand identity refresh delays everything         | Treat as parallel track (G2); don't block Q1-Q2 functional work                                                 |

---

## Open questions

1. **Designer engagement** — hire freelance for G2 or copy ComfyUI/Linear/Notion patterns directly?
2. **Vector store** — pgvector (recommended) vs Pinecone vs defer
3. **Video infra** — Cloudflare Stream vs Mux vs self-host R2
4. **Pro-tier price increase** to fund trial credits + server AI? Or absorb?
5. **Testimonials** — recruit from existing demo users (CANVAS-DEMO2025 hits = leads)?
6. **Sprint cadence** — weekly ship vs 2-week cycles? My recommendation: weekly to maintain momentum, with merge windows on Fridays.
7. **Beta program** — should we recruit 10-20 academic researchers as a private beta for AI moat features before public release?

---

## What's NOT in this plan

- Full rewrite — React Flow is excellent, keep it
- Native apps — web-first correct; PWA in G3
- Self-hosting — adds support burden, skip
- Multi-language UI expansion — 4 languages already
- Migration to a different state lib — Zustand is right
- Migration from React Flow — `@xyflow/react` 12 is current
- Backend rewrite — Express + Prisma is fine

---

## Single highest-leverage decision

**Ship Sprint A (VS Code activity bar + rich nodes + empty states) in week 1.**

This alone:

- Surfaces 16 hidden features → users actually discover them
- Solves the "Tools dropdown" + "AI dropdown" problem permanently
- Makes the canvas look like a serious tool rather than a SaaS dashboard
- Sets up Sprints B-D to build on a clean IA foundation
- Doesn't require new backend work, vector infra, or design hires

Then in weeks 2-3 ship Sprint B (AI magic moments) to create the moat features that justify Pro tier.

By week 6 you'd be 80% of the way to "world-class qualitative research canvas" — the remaining work is polish, video, mobile, and brand.

---

## Appendix: artifacts captured this review

**Screenshots (40+):** `review-01..10*.png`, `v2-01..09*.png`, `verify-toast-*.png`, `audit-01..19*.png`

**Screen recordings:**

- `recordings/canvas-human-test.mp4` (180s, 6.7 MB) — Sprint 1 walkthrough
- `recordings/canvas-ux-review.mp4` (240s, 6.1 MB) — UX deep dive

**Plan documents:**

- `UX_ENHANCEMENT_PLAN.md` (V1, 7K words) — initial scan
- `UX_ENHANCEMENT_PLAN_V2.md` (V2, 9K words) — post-codebase-audit reframe
- `UX_ENHANCEMENT_PLAN_V3.md` (V3, this doc, 12K words) — master plan post 6 agents + code audit + perf audit

**Agent research outputs (in conversation history):**

- Codebase inventory (1500 words)
- Qual research competitor deep-dive (3000 words)
- Wider node-canvas tool survey (2500 words)
- Code architecture deep review (2800 words)
- AI implementation audit (2000 words)
- Modern AI agent UX patterns (3000 words)
- IA / nav comparison (3500 words)
- Perf / a11y / SEO / security live audit (2500 words)

**Memory entries:**

- `google_oauth_setup_pending.md` — completed (Google sign-in now live)
- `e2e_layout_persistence_flake.md` — resolved (test now uses API-based assertion)
- `prod_db_access.md`, `vite_build_env_gha.md`, `playwright_mcp_vision.md` — process knowledge

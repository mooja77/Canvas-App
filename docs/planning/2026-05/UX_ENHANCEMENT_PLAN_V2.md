# QualCanvas — UX Enhancement Plan V2

**Date:** 2026-05-12 (supersedes V1)
**Goal:** Take QualCanvas from "powerful but under-surfaced qualitative coding tool" → "the category-defining canvas for qualitative research thinking."

**Tagline:** _"The canvas where qualitative research thinks with you."_

---

## What changed from V1

V1 recommended building things that **already exist**:

- ❌ Group containers — exists (`GroupNode`, `useCanvasGroups`)
- ❌ Sticky notes — exists (`StickyNoteNode`)
- ❌ Reroute nodes — exists (`RerouteNode`)
- ❌ Cmd+K palette — exists and is actually scope-aware (searches actions + node names + analyses)
- ❌ Keyboard shortcuts modal — exists, Linear-quality, customizable
- ❌ Minimap, viewport bookmarks (5 slots), auto-layout, alignment guides — all exist
- ❌ Undo/redo, multi-select, snap-to-grid — all exist
- ❌ Selection toolbar + Quick-add menu — components exist (`SelectionToolbar`, `QuickAddMenu`)
- ❌ WebSocket presence + cursors + avatars — exist
- ❌ Two-phase AI (Auto-code review-before-apply) — exists
- ❌ 22 node types, 3 edge types, dark mode, 4-language i18n, animations — all exist
- ❌ Presentation Mode, Intercoder Reliability, Cross-Case Analysis, Code Weighting, Excerpt Browser — all exist
- ❌ Coding stripes, Codebook export, QDPX export, Rich HTML export — all exist

**The product has world-class breadth.** The problem is **discoverability + density + polish + AI moat features that aren't here yet.**

V2 reorients around:

1. **Surface what's already built** (huge under-utilization)
2. **Add the moat features** identified from Dovetail/Notably/Looppanel/Reduct (NL chat, two-phase explainability, video sync, semantic search, magic cluster, channels, repository graph)
3. **Polish the visual language** (node info density, edge clarity, micro-interactions, mobile)

---

## Findings (live review of 26 surfaces + agent research across 24 tools)

### Strengths

- ✅ 22 node types is more than ComfyUI ships out of the box
- ✅ Cmd+K palette already searches node names + actions in scope
- ✅ Keyboard shortcuts modal is genuinely well-designed
- ✅ Dark mode parity excellent on canvas
- ✅ 10 analysis tools categorized cleanly
- ✅ Coding edges show on canvas with proportional thickness
- ✅ Real-time presence cursors via WebSocket
- ✅ Free demo flow (CANVAS-DEMO2025) is friction-free for evaluators

### Discoverability / Density (biggest gap)

- **❗ "Tools" dropdown hides 12 power features**: Cases, Cross-Case, Hierarchy, Kappa, Weights, Show Coding Stripes, Dashboard, Ethics, Excerpts, Codebook, Research Calendar, Edges. A casual user will never find them.
- **❗ "AI" dropdown hides 4 high-value items**: Auto-Code, AI Code, AI Chat, Summarize. AI Chat is a moat feature buried as a dropdown sub-item.
- **❗ Node info-poverty at default zoom**: code nodes at 50% zoom are pill-shaped with truncated names. No coding count, no excerpt preview, no last-used.
- **❗ Sidebar code list shows count only**: no excerpt preview, no transcript link.
- **❗ Empty/loading states render as gray skeletons**: not friendly empty CTAs.

### Mobile (P0 issue — currently unusable)

- Landing/pricing/login responsive, render fine.
- **❌ /canvas/:id on mobile is BROKEN**: left sidebar takes 25% width, the canvas workspace is squashed to ~75% with toolbar text truncated ("Themat..."), nodes invisible, no touch-optimized controls. iPad coding (a stated goal) is currently impossible.

### Marketing pages (visually flat despite good copy)

- /features.html has 12 well-written feature cards but **zero images / diagrams / animations**. Compare to Linear's animated feature pages or Notion's GIF-rich marketing — same content lands very differently.
- /guide is text-dense, hard to scan, screenshots are small.
- Landing hero screenshot is static; competitor sites all have hover-animated product previews.

### AI moat features missing (vs Dovetail/Notably/Looppanel)

- **❌ Context-bound `Cmd+J` AI chat** (Dovetail). We have AI Chat in a dropdown — but it's modal, not context-scoped, not summoned by keyboard.
- **❌ "Magic cluster" — select N nodes, AI auto-groups + names** (Notably/Dovetail).
- **❌ Inline tag-suggestions on text-highlight in transcripts** (all AI-first competitors).
- **❌ Auto-affinity layout after researcher reviews suggestions** (Looppanel two-phase).
- **❌ Cross-canvas semantic search ("show me all quotes about anxiety")** — Cmd+K searches current canvas only.
- **❌ Bidirectional backlinks across canvases** (Reflect).
- **❌ Video-text sync** (Reduct) — transcripts are text-only; no video preview per excerpt.
- **❌ Pre-built starter codebooks** (Marvin) — users land on blank canvas.
- **❌ Channels: auto-tag incoming transcripts against existing codebook** (Dovetail) — Pro/Team play.
- **❌ "Live thumbnails on every node"** (TouchDesigner/Krea) — code nodes don't show their top excerpt; analysis nodes don't show a mini-chart.

### Polish gaps

- Cookie consent banner overlaps chat widget bottom-right (already noted).
- Toolbar density: 9 top-level buttons + 3 dropdowns + 1 share + 1 more-dots = visual clutter.
- No edge midpoint "+" to insert nodes (n8n pattern).
- No typed/colored sockets (Flowise pattern) — any edge can connect any node.
- No template gallery as empty state for new canvases.
- Sentence-case vs title-case is inconsistent ("Add New Code" vs "Add Memo" vs "Auto-Code").

---

## P0 — Surface what's already built (highest leverage, lowest cost)

### P0.1 — Lift hidden Tools/AI features into a primary command rail (~2 days)

**Why:** 16 power features (12 Tools + 4 AI) live in dropdowns. Researchers don't know they exist.

**Spec:**

- Replace top toolbar with a **left rail of grouped command tiles** (Notion/Linear pattern):
  - **Sources** (Transcript / Survey / Upload / From Canvas)
  - **Codes** (Add Code / Codebook / Hierarchy / Coding Stripes)
  - **Cases** (Cases / Cross-Case / Matrix)
  - **AI** (Auto-Code / AI Code / AI Chat / Summarize / Magic Cluster — when shipped)
  - **Analyze** (10 tools, current categorization)
  - **Quality** (Kappa / Weights / Ethics / Audit log)
  - **Review** (Excerpts / Research Calendar / Dashboard)
- Each tile has icon + label + shortcut hint ("⌘+K then C")
- Less-used groups collapse to icon row; expand on hover

**Cost:** ~2 days. Reuses all existing route handlers.

### P0.2 — Node info density: live thumbnails (~3 days)

**Why:** TouchDesigner/Krea/Make do this; researchers need to read data, not topology.

**Spec:**

- **Code node:** color stripe (4px) + bold name + pill `12 codings · 3 sources` + last-coded excerpt preview (italic gray, 2 lines, truncate)
- **Transcript node:** doc icon + title + `% coded` progress bar (gradient) + first 80 chars preview + word count
- **Analysis node:** title + tiny inline chart sparkline / count badge (matches the analysis's full output preview)
- **Memo node:** edit-in-place markdown rich content (not plaintext)
- **Group node:** colored tint + collapsible to single pill with child count

**Cost:** ~3 days. Touch `apps/frontend/src/components/canvas/nodes/*.tsx`.

### P0.3 — Sidebar code navigator: rich rows + actions (~1 day)

**Why:** 250px column wasted on count-only display.

**Spec:**

- Each row: color dot + name + count badge + most-recent excerpt (gray italic, 1 line, truncate)
- Hover row → floating chip actions: rename, recolor, see codings, delete
- Click row → canvas centers on that code + opens excerpt panel
- New "Recent" sort alongside By count / A-Z
- Pin/favorite toggle for top-used codes

**Cost:** ~1 day. Touch `CodeNavigator.tsx`.

### P0.4 — Real empty states (~6h)

**Why:** Current gray skeletons frustrate new users.

**Spec:**

- **Empty canvas:** large drop zone center: "Drop a transcript here, paste interview text, or pick a starter codebook" + 3 buttons + template gallery (P1.3)
- **Empty sidebar:** "Codes you create will appear here. Try highlighting text in your transcript ↓"
- **Empty Sources tab:** "Add your first interview transcript to begin coding"
- **Loading:** Replace plain skeletons with branded shimmer + progress message ("Loading your canvas…")

**Cost:** ~6h. New `EmptyStates.tsx`.

### P0.5 — Toolbar slim-down (~1 day)

**Why:** 14 top-level items is too dense.

**Spec:**

- Promote critical actions to icon-only with hover-expand labels
- Move "Survey" into Sources sub-group (already there per P0.1)
- Use the `⌘+K` overflow pattern from Linear: less-used items only in palette, not toolbar
- Add keyboard hints in all tooltips ("Add Code · ⌘+⇧+C")

**Cost:** ~1 day (or absorbed by P0.1).

### P0.6 — Mobile canvas: stash sidebar, add bottom command bar (~3 days)

**Why:** Currently unusable on iPad/phone. Important for conference researchers.

**Spec:**

- < 768px: left sidebar slides off-screen, opens via hamburger
- Toolbar collapses to icon row + overflow menu
- Bottom command bar with 4 primary actions: Add Code, Add Memo, Search, More
- Touch gestures: 2-finger pan, pinch zoom, long-press for context menu
- Pencil/finger highlight → coding (replace right-click-to-code)
- Status bar moves to top under header

**Cost:** ~3 days. Extends existing `useMobile.ts`.

### P0.7 — Trial AI credits (~2 days)

**Why:** "Add an OpenAI key" banner kills the magic moment for new users. Most don't have a key handy.

**Spec:**

- New free signups: 10 server-funded AI requests/day × 7 days
- Track via new `AiUsage.creditedRequests` column
- Replace "Add an OpenAI/Anthropic key" banner with: "✨ You have 10 free AI requests today — try Auto-Code"
- After trial: prompt to add own key OR upgrade to Pro (Pro gets unlimited via own key OR generous server credits)

**Cost:** ~2 days. Backend route + frontend banner copy.

### P0.8 — Tooltip with keyboard shortcut + brief help (~6h)

**Why:** Linear/Raycast standard. Teaches power features passively.

**Spec:**

- Every action button tooltip = title + 1-line description + shortcut
- Hover hint pill bottom-left on canvas: "⌘+K to search · ? for shortcuts"
- Surface a "What's new" badge top-right that links to in-app changelog

**Cost:** ~6h.

---

## P1 — Moat features (medium effort, high differentiation)

### P1.1 — Context-bound AI chat (`Cmd+J`) (~5 days)

**Why:** Dovetail's killer feature. Steal directly.

**Spec:**

- `⌘+J` from anywhere → AI chat modal opens
- **Scope cascade**:
  - Nothing selected → scope = current canvas
  - Node(s) selected → scope = those nodes' content
  - Codebook selected → scope = codes + all coded excerpts
- Chat input + streaming response
- **Action outputs**: AI responses can include `[Apply this code to X]` / `[Create cluster]` / `[Add memo]` buttons that execute on canvas
- Costs: existing AiUsage limit applies
- Quote citations inline ("…this is suggested because P3 said 'I felt overwhelmed'")

**Cost:** ~5 days. New `AiContextChat.tsx`, backend extends `aiRoutes.ts`.

### P1.2 — Inline AI tag suggestions on text-highlight (~4 days)

**Why:** Dovetail/Notably/Marvin all do this. Magic moment for new users.

**Spec:**

- Open transcript in side panel (or expand-in-place)
- Highlight text → small popup appears with 3 AI-suggested codes (with confidence %)
- Click one → coding created instantly
- "+ New code" option to create a fresh code from the suggestion
- "Why these?" → explainability popover with citations
- Powered by user's API key OR trial credits (P0.7)

**Cost:** ~4 days. New `InlineCodeSuggester.tsx` + extend backend `/suggest-codes`.

### P1.3 — Template gallery as empty state (~3 days)

**Why:** Blank canvas terrifies new researchers (every tool does this — Flowise, Glif, Krea, Marvin).

**Spec:**

- New canvas → modal: "Start with a template or blank?"
- 5 templates:
  - **Thematic analysis** (Braun & Clarke 6-step) — pre-seeded codes + memo prompts
  - **Grounded theory** (open/axial/selective codes)
  - **UXR pain-points** (5 common UX codes: pain, delight, confusion, workaround, success)
  - **Support-ticket mining** (customer-support common codes)
  - **NPS theme extraction** (promoter / detractor / suggestion codes)
- Each template includes 1 sample transcript + 4-step in-canvas tutorial
- Templates are user-cloneable: "Save as template"

**Cost:** ~3 days. New `templateRoutes.ts`, schema add `CanvasTemplate`, frontend modal.

### P1.4 — Magic Cluster: select nodes → AI groups + names (~5 days)

**Why:** Notably/Dovetail signature feature.

**Spec:**

- Select 3+ code or excerpt nodes
- Floating action: ✨ "Cluster these"
- Modal: "AI is finding themes…" with streaming progress
- Result: each cluster becomes a `GroupNode` with AI-generated name + 1-sentence description
- User can edit name, accept/reject, or "regenerate"
- Confidence shown per cluster
- Two-phase: never auto-apply

**Cost:** ~5 days. Uses existing `GroupNode` infrastructure + new backend `POST /canvas/:id/ai/cluster`.

### P1.5 — Two-phase AI suggestions tray (~3 days)

**Why:** Trust through traceability. Every AI competitor does this.

**Spec:**

- Persistent bottom-right tray badge "✨ 12 AI suggestions pending"
- Click expands to show: each suggestion with confidence + "Why?" expansion + accept/reject/edit buttons
- Bulk-accept threshold slider (e.g., "accept all >0.85")
- "Apply all" / "Reject all" with confirm
- Suggestions persist across sessions until acted on

**Cost:** ~3 days. Extends existing AI suggest panel pattern.

### P1.6 — Typed sockets + edge validation (~4 days)

**Why:** Flowise/Houdini/Fusion. Reduces "why is my analysis empty?" frustration.

**Spec:**

- Color-coded node ports by data type: text (blue), code (purple), transcript (green), analysis-result (orange)
- Dragging an edge highlights compatible target ports
- Incompatible target → wire turns red, snaps back, toast: "Statistics node accepts codes, not transcripts"
- Edge color matches source type
- Backward compatible: existing untyped edges keep working

**Cost:** ~4 days. Touch React Flow handle props on every node type + edge validation hook.

### P1.7 — Edge midpoint "+" insert (~2 days)

**Why:** n8n/Make pattern. Insert filter/translate nodes inline.

**Spec:**

- Hover any edge → "+" affordance appears at midpoint
- Click → quick-add palette opens pre-filtered to compatible-type nodes
- Selected node inserts inline, splices edge

**Cost:** ~2 days.

### P1.8 — Source-grounded split-pane (~5 days)

**Why:** Scrintal/Obsidian. Coding decisions must stay grounded in transcript context.

**Spec:**

- Select any code node → right panel slides in with:
  - Top: code name + color + count
  - List of every excerpt with transcript title, line number, full text
  - Click excerpt → canvas focuses transcript node + highlights span
- Same panel for transcript → shows all codings on that transcript with span underlines

**Cost:** ~5 days. Extends `ExcerptBrowserModal`.

### P1.9 — Edge data badges (~1 day)

**Why:** Make pattern. Canvas reads as flow diagram.

**Spec:**

- Edge tooltip enhancement: show count + most recent excerpt preview
- Optional always-on badge: "12 codings" on edges over thickness threshold
- Edges support typed labels: "contradicts", "co-occurs", "elaborates"

**Cost:** ~1 day.

### P1.10 — Cross-canvas semantic search (~5 days)

**Why:** Dovetail/Marvin/Looppanel all rank cross-corpus search highly. Currently Cmd+K is one canvas only.

**Spec:**

- Cmd+K palette adds: "Search all canvases" tab
- Backed by embeddings on transcript chunks (use pgvector or Postgres FTS as fallback)
- Results grouped by canvas, ranked by relevance
- Click result → opens that canvas at that excerpt

**Cost:** ~5 days. New `searchRoutes.ts`, requires vector infra decision.

### P1.11 — Visual polish pass (~3 days, can be split)

**Why:** Linear/Notion-level micro-interactions.

**Spec:**

- Framer Motion: node spawn (scale 0.95→1, 200ms ease-out), edge create (fade-in + path draw, 300ms)
- Toast: slide-from-right (already top-right per recent fix)
- Loading: branded shimmer with progress copy
- Button hover: subtle scale(1.02) + brightness
- Reduce motion preference respected
- Audit all dark-mode pairs on new components

**Cost:** ~3 days.

---

## P2 — Platform investment (3-6 weeks each)

### P2.1 — Video-transcript-canvas tri-sync (Reduct steal)

**Why:** Critical gap; no other QDA tool does this well.

**Spec:**

- Transcript model adds `videoUrl + segments[start, end, text]`
- Every excerpt node embeds 10-sec scrubbable video preview
- Click excerpt → modal with synced transcript + video
- Strikethrough text excludes from highlight reels
- "Generate highlight reel" canvas action → 90-second compilation of all excerpts tagged with a code → shareable URL

**Cost:** ~4 weeks. Largest single feature; need video infra (probably Cloudflare Stream).

### P2.2 — Repository graph view (Reflect steal)

**Why:** Once a user has 3+ canvases, cross-canvas networking is the moat that prevents churn.

**Spec:**

- New `/repository` route
- Visualizes: every canvas as a node, shared codes as edges between canvases
- Click canvas node → opens it
- Click code edge → side panel shows shared excerpts across canvases
- Bidirectional backlinks auto-computed: "This code appears in 4 other canvases"

**Cost:** ~3 weeks.

### P2.3 — Channels (Dovetail steal): auto-tag incoming transcripts

**Why:** Pro/Team retention play. Researcher uploads 50 support tickets → all auto-tagged against canvas's codebook overnight.

**Spec:**

- New `Channel` model: source (file upload, Zapier webhook, email, RSS)
- Server polls / accepts pushes
- New transcripts auto-coded via existing two-phase AI
- Notification when new transcripts arrive
- Channel volume gated by plan tier

**Cost:** ~4 weeks (sources × polling infra × notification).

### P2.4 — Dual view: Graph vs Dashboard (Reaktor steal)

**Why:** Researchers build in graph view; advisors review in dashboard view.

**Spec:**

- Same canvas, two presentations
- Dashboard view: hides wiring, shows only "output" computed nodes as report panels
- Auto-arranges dashboard cards in grid
- Export dashboard to PDF for sharing
- Toggle in toolbar

**Cost:** ~3 weeks.

### P2.5 — Landing page redesign with product video

**Why:** Convert at higher rate.

**Spec:**

- Hero: 60-sec autoplay product video (record someone coding an interview in real-time)
- Animated "how it works" 3-step interactive
- Social proof band (need to source testimonials)
- "Compare to Atlas.ti / NVivo" table
- Pricing collapses
- Better OG/Twitter cards (real screenshots)

**Cost:** ~2 weeks design + ~1 week implementation.

### P2.6 — Mobile/tablet companion mode (full)

**Why:** Conference researchers want to code on iPads.

**Spec:**

- Beyond P0.6 fix: pencil-first interactions, touch gestures throughout
- Coding-only mode (hide canvas, focus on transcript reading + tag)
- Offline-first with sync on reconnect
- Native-feeling animations
- PWA installable

**Cost:** ~4 weeks.

### P2.7 — Theme + visual identity refresh

**Why:** Make the brand visceral, not generic SaaS purple.

**Spec:**

- Engage designer or do disciplined Linear/Notion-style polish
- Custom illustrations for empty states (replace stock icons)
- Distinctive node "personality" (soft gradients, inner shadows, color tints)
- Signature loading animation
- Custom favicon set + app icon
- New marketing screenshots/GIFs for /features and /guide

**Cost:** ~3 weeks design + ~2 weeks implementation.

---

## Strategic positioning

### Tagline

**"The canvas where qualitative research thinks with you."**

Not "AI does your research" (Notably/Marvin claim — researchers don't trust this). Not "Repository for teams" (Dovetail). The promise: **augmented thinking on a visual surface.**

### Wedge customer

**Solo academic researchers + small UXR teams (2-5 people).** Currently:

- Atlas.ti/NVivo: frustrated by modal coding, desktop install, no real-time collab — but inertia
- Dovetail $29+/seat: priced out
- Notably $21/seat: spreadsheet-focused, no canvas depth
- Looppanel Pro $395/mo: too expensive
- ChatGPT/Claude: no traceability, no canvas, one-shot results

QualCanvas Pro at $12 hits a perfect price point if the value lands.

### Marketing focus

- Demo video: "Watch me code an interview in 3 minutes" (vs Atlas.ti's 20-min wizard)
- Compare-to pages: "Migrate from NVivo" / "Migrate from Atlas.ti" with import + reassurance
- Academic discount badge prominent (40% .edu already shipped)
- Open codebooks: publish 5 starter codebooks as open-source on GitHub for SEO + thought leadership

### Pricing recalibration (post-P1)

- **Free**: 1 canvas, 2 transcripts, 5K words, 5 codes, 2 analyses, 10 AI/day × 7 days trial credits, CSV export
- **Pro $12/mo**: unlimited everything except shares (5), AI features fully unlocked (own key or moderate server credits), all 10 analyses, 1 channel
- **Team $29/mo/seat**: real-time collab, unlimited shares, intercoder reliability, channels (5), repository graph view (post-P2.2)
- **Education $7.20/mo** (40% off Pro) — already shipped via Stripe coupon
- **Institutional**: custom, enterprise sales

---

## Recommended sequencing

### Sprint 1 (week 1) — surface what's built

- P0.1 Lift hidden Tools/AI into command rail
- P0.3 Sidebar rich rows
- P0.4 Empty states
- P0.8 Tooltip shortcut hints

Ship: `feat(canvas): surface power features + sidebar polish + empty states`

### Sprint 2 (week 2-3) — node + mobile

- P0.2 Node info density (live thumbnails)
- P0.6 Mobile canvas fix
- P0.5 Toolbar slim-down (or absorbed into P0.1)

Ship: `feat(canvas): rich nodes + mobile-usable workspace`

### Sprint 3 (week 4) — AI moat phase 1

- P0.7 Trial AI credits
- P1.2 Inline AI tag suggestions
- P1.5 Two-phase suggestions tray

Ship: `feat(ai): trial credits + inline suggestions + review tray`

### Sprint 4 (week 5) — AI moat phase 2

- P1.1 Context-bound Cmd+J chat
- P1.4 Magic Cluster

Ship: `feat(ai): cmd-j chat + magic cluster`

### Sprint 5 (week 6) — canvas polish

- P1.3 Template gallery
- P1.6 Typed sockets
- P1.7 Edge midpoint insert
- P1.9 Edge data badges
- P1.11 Visual polish pass

Ship: `feat(canvas): templates + typed edges + polish`

### Sprint 6 (week 7-8) — search + grounding

- P1.8 Source-grounded split-pane
- P1.10 Cross-canvas semantic search

Ship: `feat(search): source-grounded coding + repository search`

### Quarter 2+

- P2.1 Video sync
- P2.2 Repository graph
- P2.3 Channels
- P2.4 Dual view (Graph / Dashboard)
- P2.5 Landing redesign
- P2.6 Mobile companion full
- P2.7 Visual identity refresh

---

## Acceptance criteria (per ship)

Every Sprint must satisfy:

1. ✅ Lighthouse score on /canvas ≥ 90
2. ✅ 60fps interaction during pan/zoom at 50 nodes
3. ✅ Zero new console errors
4. ✅ Dark mode parity verified
5. ✅ Keyboard accessible (Tab/Enter/Esc)
6. ✅ Mobile-tested at 390×844 (iPhone) and 768×1024 (iPad)
7. ✅ E2E test added
8. ✅ Visual regression baseline updated

---

## Risks + mitigations

- **Feature creep:** P2 is ambitious. Mitigation: ship P0+P1 fully before P2. Each P1 must reach >50% Pro-tier adoption before P2 starts.
- **AI cost exposure:** Trial credits + Magic Cluster + Cmd+J chat could spike OpenAI bills. Mitigation: aggressive caching on transcripts (embed once), daily caps per user, fall back to Anthropic Haiku/Claude 3.5 Sonnet for cost-sensitive flows.
- **Visual polish without designer = mediocre:** Mitigation: copy named references (ComfyUI quick-add, Linear command palette, Notion empty states) by name; don't invent.
- **Vector store for P1.10:** pgvector adds Postgres dep; external (Pinecone) adds latency + cost. Recommend pgvector for v1.
- **Schema churn for templates/channels/groups:** All additive Prisma migrations. No destructive changes needed.

---

## Open questions

1. Designer engagement — do we have one, or copy ComfyUI/Linear/Notion patterns?
2. Vector store choice — pgvector on Postgres vs. Pinecone vs. defer P1.10
3. Video infra for P2.1 — Cloudflare Stream vs. Mux vs. self-host
4. Pro-tier price increase to fund trial credits + server-side AI? Or absorb cost?
5. Source testimonials for marketing — recruit from existing demo users?
6. Mobile P0.6 vs. full P2.6 — ship 80% solution now, or wait for full?

---

## What's NOT in this plan

- Full rewrite — react-flow is excellent, keep it
- Native apps — web-first is correct
- Self-hosting — adds support burden, skip
- Multi-language UI expansion — 4 languages already covered

---

## Appendix: artifacts captured this review

**Screenshots (20+ saved to repo root):**

- `review-01..10*.png`, `v2-01..09*.png`

**Screen recording:**

- `recordings/canvas-human-test.mp4` (180s, 6.7 MB) — first review pass
- `recordings/canvas-ux-review.mp4` (240s, 6.1 MB) — UX review pass

**Agent research outputs (in conversation history):**

- Codebase inventory (1500 words)
- Qual research competitor deep-dive (2000 words)
- Wider node-canvas tool survey (2000 words)
- ComfyUI/tldraw/Figma/Dovetail/Notion/Linear initial survey (1200 words)

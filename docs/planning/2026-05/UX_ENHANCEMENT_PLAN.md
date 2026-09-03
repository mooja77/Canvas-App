# QualCanvas — UX Enhancement Plan

**Goal:** Take QualCanvas from "functional qualitative coding canvas" → "the tool researchers tell their colleagues about." Inspired by ComfyUI's node fluency, tldraw's gesture model, FigJam's collaboration, Dovetail's AI magic, and Linear's polish.

**Date:** 2026-05-12
**Reviewed surfaces:** landing, pricing, login, /canvas dashboard, /canvas/:id workspace, Analyze menu, AI menu, Tools menu, code navigator, transcript node inline
**Artifacts:** `review-01..10*.png`, `recordings/canvas-ux-review.mp4`

---

## Current state — findings

### What's working

- Real product, real flows, 937 unit + 683 E2E tests green
- 10 analysis tools categorized in Analyze menu
- Working AI (Auto-Code, AI Code, AI Chat, Summarize)
- Stripe billing wired, Google sign-in working, demo account
- Clean visual language (brand purple, white cards, soft shadows)
- Real research data in demo canvas (Sarah Chen interview, 256 words, 7 codes)

### Friction points (observed live)

1. **Node design is anemic.** At normal zoom, code nodes are tiny horizontal pills with the code text truncated. No coding count badge on the node, no color affordance beyond a thin colored stripe.
2. **Edge clarity is poor.** A single red bezier curve loops through 6 codes. Hard to tell which transcript-excerpt → which code at a glance.
3. **Toolbar has 9 top-level buttons + 3 dropdown menus** (Transcript / Survey / Code / Memo / AI / Tools / upload / share / Analyze). "Tools" alone hides 12 items: Cases, Cross-Case, Hierarchy, Kappa, Weights, Show Coding Stripes, Dashboard, Ethics, Excerpts, Codebook, Research Calendar, Edges. **Discoverability is buried.**
4. **Empty/loading states are skeletons** (gray bars). No friendly "Start by uploading a transcript" prompt with the actual button to do that.
5. **Sidebar code list shows only count, no context** (e.g., "Demo Topics — 1 coding" — but no excerpt preview, no transcript link, no last-used).
6. **No keyboard shortcuts visible on hover.** ComfyUI/Linear/Raycast all teach shortcuts by surfacing them in tooltips.
7. **Default zoom puts canvas at 15-50%, nodes unreadable.** First impression of an open canvas is "tiny boxes I can't read."
8. **No social proof on landing** — no logos, no testimonials, no stats ("Used by 5,000 researchers at 200 institutions").
9. **First-visit tour is 22 steps long.** Too long; most users will skip.
10. **AI is gated behind "Add an OpenAI or Anthropic key" banner.** Friction at the moment a user wants to feel magic. (Should ship trial credits.)
11. **The Analyze menu shows everything Pro+** even for free users — no clear "locked" indicator, just a 403 surprise on click.
12. **Cookie banner overlaps the chat widget bottom-right.** Already noted.

---

## P0 — Quick wins (1-3 days each, ship this week)

### P0.1 — Node redesign with information density

**Why:** Current code nodes are unreadable at default zoom. A code node should communicate: name, color, coding count, last-used date, excerpt preview-on-hover.

**Spec:**

- Code node:
  - Top stripe (4px) in the code's color
  - Bold code name (truncate at 28ch with tooltip)
  - Inline pill `12 codings • 3 transcripts`
  - 3-line preview of the most recent coded excerpt (italic, gray)
  - On hover: floating "open in sidebar / merge / recolor / delete" action chips
- Transcript node:
  - File icon + title
  - Progress bar showing % coded (gradient)
  - Coding count + word count
  - First 80 chars of transcript as preview
  - On hover: "Open full transcript" button

**Files:** `apps/frontend/src/components/canvas/nodes/` — touch `CodeNode.tsx`, `TranscriptNode.tsx`.

**Cost:** ~6h.

### P0.2 — Space / double-click context-aware quick-add palette

**Why:** ComfyUI's #1 flow multiplier. Space anywhere → palette filtered by what you're hovering. FigJam clones it.

**Spec:**

- `Space` key on empty canvas → palette opens at cursor with: "Add transcript", "Add code", "Add memo", "Add analysis", "Add case"
- `Space` on a transcript node → filters to "Add code (linked to this)", "Run analysis on this", "Add memo about this"
- `Space` on a code node → "Add child code", "Merge with...", "Group as theme", "Run co-occurrence"
- Type to fuzzy-search ("wc" → Word Cloud)
- Enter to spawn, Esc to cancel
- Spawned node connects automatically to the originating selection if a connection is implied

**Files:** new `apps/frontend/src/components/canvas/panels/QuickAddPalette.tsx`, hook into `CanvasWorkspace.tsx` keydown handler.

**Cost:** ~1 day. Foundation for many P1 features.

### P0.3 — Floating contextual toolbar on multi-select

**Why:** tldraw + Figma. Keeps eyes on canvas. Replaces hunting through dropdowns.

**Spec:**

- Select 2+ nodes → small toolbar floats above selection with context-aware actions
- All codes selected → "Merge codes", "Group as theme", "Recolor all", "Delete"
- Mixed selection → "Group as case", "Align", "Distribute", "Delete"
- Single computed node → "Run", "Edit config", "Duplicate", "Open in panel"

**Files:** new `apps/frontend/src/components/canvas/panels/SelectionToolbar.tsx`, mounted into React Flow's selection layer.

**Cost:** ~1 day.

### P0.4 — Sidebar code navigator: rich rows

**Why:** Current rows show name + count only. Underuses the 250px column.

**Spec:**

- Each row: color dot + name + count badge + last excerpt preview (gray italic, single line)
- Hover row → floating actions: ✏️ rename, 🎨 recolor, 🔗 see codings, 🗑️ delete
- Click row → centers canvas on that code node + opens excerpts panel
- "Favorites" toggle: pin frequently-used codes to top
- "Sort by recency" alongside "By count" / "A-Z"

**Files:** `apps/frontend/src/components/canvas/panels/CodeNavigator.tsx`.

**Cost:** ~6h.

### P0.5 — Real empty states (not skeletons)

**Why:** New users see gray bars. Should see a clear "Drop a transcript file here, paste interview text, or import from another canvas" with the buttons inline.

**Spec:**

- Empty canvas: large drop zone center-aligned with 3 CTAs (Paste, Upload, From Canvas)
- Empty sidebar (Codes): "Highlight text in your transcript to start coding" with arrow indicator
- Empty canvas dashboard: "Welcome, Demo Researcher. Want a 90-second tour or start a blank canvas?"

**Files:** `apps/frontend/src/components/canvas/EmptyStates.tsx` (new).

**Cost:** ~6h.

### P0.6 — Keyboard shortcut hints in tooltips

**Why:** Linear/Raycast UX standard. Teaches power use passively.

**Spec:**

- Every toolbar button tooltip ends with the shortcut: "Add Code (⌘+K then C)"
- Hover hint on canvas: small pill bottom-left "Space to add ▸ ⌘+/ to search"
- Update `shortcutStore.ts` to include hint registrations

**Cost:** ~3h.

---

## P1 — Medium-effort (3-7 days each, this month)

### P1.1 — Inline AI tag suggestions on text selection (Dovetail magic)

**Why:** The single feature researchers will switch tools for.

**Spec:**

- Open transcript inline (drawer or inline expand)
- Highlight text → small popup with 3 AI-suggested codes (with confidence %)
- Click one → coding created, code node spawned/connected if new
- "Don't see the right code? Type new code..." inline input
- Powered by user's OpenAI/Anthropic key OR by trial credits (see P1.5)

**Files:** new `apps/frontend/src/components/transcript/InlineAiSuggester.tsx`, backend: extend existing `/api/v1/canvas/:id/transcripts/:tid/suggest-codes` (already exists per shared/types).

**Cost:** ~3 days.

### P1.2 — Group / Theme container (Cmd+G on multi-select)

**Why:** ComfyUI groups + FigJam sections. Researchers think in themes.

**Spec:**

- Multi-select codes → `Cmd+G` → group container with title "New theme"
- Group has: editable title, color tint (lighter than child codes), collapse-to-pill
- Move group → children move with it
- Theme propagates: child codes inherit a "theme" tag for analyses
- `Cmd+Shift+G` ungroups
- Groups serializable to DB (`CanvasGroup` model — new Prisma model needed)

**Files:** `prisma/schema.prisma` (+CanvasGroup), `apps/backend/src/routes/groupRoutes.ts` (new), `apps/frontend/src/components/canvas/nodes/GroupNode.tsx` (new).

**Cost:** ~5 days.

### P1.3 — Edge clarity: typed, color-coded, hover-tooltip

**Why:** Current bezier curves are visually noisy and information-poor.

**Spec:**

- Edges color-coded by source-target type pair: transcript→code (blue), code→theme (purple), etc.
- Edge thickness proportional to coding count (already partially done)
- Hover edge → tooltip with excerpt preview + count
- Click edge → opens "this coding" panel showing the specific text segment
- Edge style preference: bezier / orthogonal / straight (user setting, already exists)

**Files:** `apps/frontend/src/components/canvas/edges/CodingEdge.tsx`.

**Cost:** ~3 days.

### P1.4 — Mini-map with viewport + colored dots

**Why:** Once a canvas has 30+ nodes, the current zoom-to-fit is the only way to navigate. Mini-map is industry standard for a reason.

**Spec:**

- Bottom-right, collapsible, ~200×120
- Each node = colored dot by type
- Viewport rectangle moves with pan/zoom
- Click in minimap = pan to that location
- Already partially in React Flow — needs styling + filtering

**Cost:** ~1 day.

### P1.5 — Trial AI credits (3 days × $X — no key required to try AI)

**Why:** "Add an OpenAI key" is friction at the exact moment a user wants the magic. Most won't have a key handy.

**Spec:**

- Free tier: 10 AI requests/day for 7 days post-signup, using server-side key
- After trial: prompt to add own key OR upgrade to Pro
- Track via existing `AiUsage` model with new `creditedRequests` column
- Frontend: replace "Add an OpenAI key" banner with "You have 10 free AI requests today ✨"

**Cost:** ~2 days.

### P1.6 — Better first-run experience

**Why:** Current 22-step tour is too long. Most users skip.

**Spec:**

- Replace with a **2-minute interactive demo** on signup
- Step 1: "Paste any interview transcript" (we have a sample button)
- Step 2: "Highlight 'I felt overwhelmed' and we'll suggest codes"
- Step 3: "Add the code 'Cognitive Load' — see how it appears on the canvas"
- Step 4: "Run the Statistics analysis — see your first chart"
- Total: 4 steps, < 90 seconds. Skip allowed at any time.
- Confetti animation on completion + show "/canvas" with seeded content

**Files:** `apps/frontend/src/components/onboarding/` — significant rework.

**Cost:** ~4 days.

### P1.7 — Cmd+K command palette: search content, not just actions

**Why:** Linear's Cmd+K is the gold standard. Yours already exists but only does actions.

**Spec:**

- Already has command palette (shortcutStore)
- Extend to search: canvas names, transcript text, code names, memo content
- Result grouping: "Canvases", "Codes", "Transcripts", "Memos", "Actions"
- Recent searches at top
- ⌘+K from anywhere — including not-logged-in pages (search "pricing", "billing")

**Cost:** ~3 days.

### P1.8 — Visual polish pass

**Why:** Modern apps signal quality via micro-interactions. Linear, Raycast, Notion all do this.

**Spec:**

- Add Framer Motion to node spawn (200ms ease-out scale 0.95→1.0)
- Edge creation: 300ms fade-in + path draw animation
- Toast position has been fixed (top-right). Add slide-from-right animation.
- Loading states: skeleton → real content with 150ms cross-fade
- Button hover: subtle scale(1.02) + brightness shift
- Dark mode pass: verify all newly-added components

**Cost:** ~3 days, can be spread.

---

## P2 — Platform investment (1-3 weeks each)

### P2.1 — Collaboration: presence cursors + per-user selection halos

**Why:** Team tier value. Intercoder reliability _needs_ this. Currently the Team tier sells unlimited shares but no actual real-time presence.

**Spec:**

- WebSocket (already exists for canvas sync) → broadcast cursor positions + selected node IDs
- Each user gets a stable color (hash of userId)
- Show name label near cursor, fade after idle 2s
- Selection halo (2px outline in their color) around what they have selected
- Conflict resolution: last-write-wins on node edits, with toast "Pat just edited this code"
- Use case: Pro/Team researchers code the SAME transcript in real-time, edges appear as they're created

**Cost:** ~2 weeks.

### P2.2 — Edge-anchored comments + threaded discussion

**Why:** FigJam pattern. Critical for intercoder reliability disagreements ("I coded this as Anxiety, why did you code it as Stress?").

**Spec:**

- Right-click any node or edge → "Add comment"
- Comments are threaded, support @ mentions of teammates
- Resolved comments hidden but searchable
- Email notification on @ mention (Resend already wired)
- New Prisma model: `CanvasComment` (canvasId, anchorType, anchorId, threadId, body, authorId, resolvedAt)

**Cost:** ~1.5 weeks.

### P2.3 — Nested canvas / drill-down (Obsidian Canvas pattern)

**Why:** A Case is conceptually its own mini-canvas. Currently flat structure forces all content into one canvas.

**Spec:**

- Right-click a Case node → "Open as canvas"
- Case becomes its own infinite canvas with breadcrumb back
- Parent canvas shows preview of nested canvas thumbnail
- Schema: `CodingCanvas.parentCanvasId` (already supported via `CanvasCase`?)

**Cost:** ~2 weeks (with backend, breadcrumb routing, thumbnail generation).

### P2.4 — "Ask your data" — natural language query node (Dovetail)

**Why:** Pro-tier moat. Researchers can ask "what did Sarah say about emotional regulation?" and get matching excerpts as a query result node.

**Spec:**

- New computed node type: `QueryNode`
- Input: NL question
- Backend: embed question, vector-search across transcript chunks (need pgvector or external like Pinecone)
- Output: ranked excerpts with confidence + transcript locations
- Node visually shows: question + top 5 results + "Connect" button to spawn coding edges
- Cost-sensitive: cache embeddings on transcript creation, not query time

**Cost:** ~3 weeks (vector infra is the long pole).

### P2.5 — Landing page redesign with product video + social proof

**Why:** Current landing is functional but doesn't convey "world-class". Convert at higher rate.

**Spec:**

- Hero: 60-second autoplay product video (recorded in canvas with someone narrating "Watch me code this interview in 3 minutes")
- Add social proof band: "Used by researchers at [Stanford / MIT / Berkeley logos]"
- "How it works" interactive 3-step animation (replaces feature grid)
- Testimonials: 3 quotes from real researchers (need to source)
- Pricing collapses to single comparison table
- New section: "Compare to Atlas.ti / NVivo" — show migration path
- Better OG/Twitter cards (currently using @graph schema is fine but visual assets weak)

**Cost:** ~1 week design + 1 week implementation.

### P2.6 — Mobile/tablet companion mode

**Why:** Researchers want to code on iPads at conferences. Current canvas is desktop-only-feasible.

**Spec:**

- iPad layout: bottom toolbar (touch-friendly), sidebar slides in from left
- Pencil support: highlight text on transcript with Pencil = create coding
- Pinch zoom canvas, two-finger pan
- Detect device, switch layout — not a separate codebase
- Already have `useMobile.ts` per memory; extend it

**Cost:** ~3 weeks.

### P2.7 — Theme & visual identity refresh

**Why:** Make the app instantly recognizable. Current brand is "generic SaaS purple".

**Spec:**

- Engage a designer or do a Linear/Notion-style polish:
  - Custom illustrations for empty states (not stock icons)
  - Distinctive node "personality" — slight gradient, soft inner shadow, color tints
  - A signature loading animation (e.g., a coding line drawing itself)
  - Custom favicon set + app icon
- Light/dark theme parity audit

**Cost:** ~2-3 weeks (depends on designer engagement).

---

## Sequencing

**Sprint 1 (this week — P0 quick wins):**

- P0.1 Node redesign
- P0.4 Sidebar code navigator
- P0.5 Empty states
- P0.6 Keyboard hints

Ship as `feat(canvas): node + sidebar polish + empty states + shortcut hints`.

**Sprint 2 (next week — P0 advanced):**

- P0.2 Quick-add palette (Space key)
- P0.3 Floating contextual toolbar

Ship as `feat(canvas): space-quick-add + contextual toolbar`.

**Sprint 3-4 (this month — P1 high-impact):**

- P1.1 Inline AI suggestions (highest user-magic ratio)
- P1.5 Trial AI credits (unblocks P1.1)
- P1.3 Edge clarity
- P1.2 Group/Theme container

**Sprint 5+ (next month — platform):**

- P1.6 First-run rework (after P0 is in place)
- P1.7 Cmd+K content search
- P2.1 Collaboration cursors

**Quarter 2+:**

- P2.2 Comments
- P2.3 Nested canvases
- P2.4 NL query
- P2.5 Landing redesign

---

## Acceptance criteria (per ship)

Every Sprint must satisfy:

1. ✅ Lighthouse score on /canvas ≥ 90 (currently unknown)
2. ✅ 60fps interaction during pan/zoom at 50 nodes
3. ✅ Zero new console errors on demo flow
4. ✅ Dark mode parity for every new component
5. ✅ Keyboard accessible (Tab/Enter/Esc) for every new control
6. ✅ Mobile-degradation: never broken on iPad even if not optimized
7. ✅ E2E test added for the new flow
8. ✅ Visual regression baseline updated and committed

---

## Risk + mitigation

- **Risk:** Big rewrites disrupt active users. **Mitigation:** Ship behind feature flags (use existing GrowthBook integration if present, or a simple `useFeatureFlag` hook).
- **Risk:** AI features create cost exposure. **Mitigation:** Per-user daily limits in `planLimits.ts` (already enforced); cache aggressively.
- **Risk:** Group/case schema churn. **Mitigation:** Use additive Prisma migrations; keep old "flat" view available via toggle for 90 days.
- **Risk:** Visual polish without designer = mediocre. **Mitigation:** Reference the named tools (ComfyUI, Linear, Notion) and _copy with attribution_, don't invent.

---

## What's NOT in this plan

- A full rewrite — react-flow is fine
- A native app — web is fine for v1
- Multi-language UI — i18n already exists in 4 languages, low priority
- Self-hosting — adds support burden, drop unless customers demand
- Mobile-native — start with PWA + responsive

---

## Open questions to resolve before kickoff

1. Designer engagement: do we have one, or do we copy ComfyUI/Linear patterns directly?
2. Vector store choice for P2.4: pgvector on existing Postgres vs. Pinecone vs. defer
3. Feature-flag library: any preference, or roll a simple Zustand-backed one?
4. Pro-tier price increase to fund trial credits (P1.5)? Or absorb cost?
5. Real testimonials for P2.5: do we have users we can quote, or do we need to recruit?

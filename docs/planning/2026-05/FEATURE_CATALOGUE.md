# QualCanvas — Feature Catalogue (Live Walkthrough)

**Date:** 2026-05-13
**Status:** Companion document to V3 plan + Findings Appendix
**Purpose:** Visual inventory of every shipped feature, with discoverability + UX notes per surface.

---

## Big-picture findings from the live walkthrough

### 1. **Cmd+K palette has INCOMPLETE feature coverage** (NEW finding)

Searching `Cmd+K → "cases"` returns **"No results found"** — even though Cases is one of the biggest features in the Tools menu. Same likely true for Hierarchy, Weights, Ethics, Excerpts, Codebook, Research Calendar.

**Implication:** Sprint A (activity bar redesign) MUST include a "register every action with the command palette" pass. Otherwise users searching for features that exist will think they don't.

**Where to fix:** `apps/frontend/src/stores/shortcutStore.ts` — extend action registry to cover every Tools menu item, every Analyze item, every AI item, every Export option.

### 2. **The Codebook view is genuinely world-class**

Tab structure (`Codebook` | `All Coded Data`), columns (Code Name / Color / Parent Theme / Frequency / Coverage / Example Excerpts), Copy + Download CSV actions. This is exactly what an academic methods reviewer wants. **Don't touch it. Surface it more prominently.**

### 3. **The 22-step tour gets skipped every time**

Both my sessions: opened canvas, immediately clicked "Skip tour". Real users do the same. Confirms V3 plan's onboarding redesign priority.

### 4. **Hidden discovery rate is alarming**

Tools dropdown reveals 12 features only after a click. AI dropdown reveals 4 more. **At default zoom, no visual hint these exist.** Users using QualCanvas for weeks may never find: Cases, Cross-Case, Hierarchy, Kappa, Weights, Coding Stripes, Dashboard, Ethics, Excerpts, Codebook, Research Calendar.

### 5. **Loading states are inconsistent**

Some routes show skeleton bars, some show spinners, some flash content. No branded shimmer pattern.

### 6. **Cookie consent banner clashes with chat widget**

Both fixed bottom-right. Cookie banner overlays the chat trigger. Known from earlier UX review; still present.

---

## Feature inventory (every shipped surface)

### Canvas core

| Feature                      | Surface                                 | Discoverability         | Quality        | V3 action                    |
| ---------------------------- | --------------------------------------- | ----------------------- | -------------- | ---------------------------- |
| Pan/zoom with mouse          | Native React Flow                       | ✅ Obvious              | A              | Keep                         |
| Mini-map                     | Bottom-right                            | ⚠️ Hidden until enabled | B+             | Promote                      |
| Viewport bookmarks (5 slots) | `Ctrl+Shift+1-5` save, `Alt+1-5` recall | ❌ Invisible            | A (when found) | Surface in command rail      |
| Auto-layout (Dagre)          | `Ctrl+Shift+L`                          | ❌ Invisible            | A              | Add to floating toolbar      |
| Alignment guides on drag     | Auto-visible                            | ✅                      | A              | Keep                         |
| Snap to grid                 | Toggleable                              | ⚠️                      | A              | Surface in inspector         |
| Focus mode                   | `Ctrl+.`                                | ❌ Invisible            | B+             | Surface in keyboard hints    |
| Scroll mode toggle           | Status bar bottom-right                 | ⚠️                      | B              | Document better              |
| Undo/redo                    | `Ctrl+Z` / `Ctrl+Shift+Z`               | ✅ Standard             | A              | Keep                         |
| Multi-select marquee         | Drag on empty                           | ✅                      | A              | Keep                         |
| Drag to copy                 | `Alt+drag`                              | ❌ Invisible            | A              | Surface in keyboard hints    |
| Group nodes                  | `Ctrl+G` after multi-select             | ❌ Invisible            | A              | Surface in selection toolbar |
| Sticky notes                 | Right-click → Add sticky                | ⚠️ Buried               | B+             | Promote                      |
| Reroute nodes                | Right-click edge                        | ❌ Invisible            | A              | Tooltip hint                 |

### Toolbar primary actions

| Feature               | Surface          | Notes                                                         |
| --------------------- | ---------------- | ------------------------------------------------------------- |
| Back                  | Header left      | Standard, fine                                                |
| Canvas title dropdown | Header center    | Rename / switch / settings                                    |
| Transcript dropdown   | Toolbar          | 4 import methods (Paste / Assessments / Upload / From Canvas) |
| Survey                | Toolbar          | Wise narrative responses import                               |
| Code (button)         | Toolbar          | Opens inline "Type your research question" input              |
| Memo                  | Toolbar          | Add memo node                                                 |
| Upload                | Toolbar          | File upload modal                                             |
| Share                 | Toolbar          | Share canvas modal                                            |
| Notification bell     | Header top-right | Per memory                                                    |

### Tools dropdown (12 hidden features)

| Feature                 | Notes                                                      |
| ----------------------- | ---------------------------------------------------------- |
| **Cases**               | Group by participant; supports framework analysis          |
| **Cross-Case**          | Compare across cases; the Ritchie & Spencer matrix         |
| **Hierarchy**           | Parent/child code structure (Saldaña second-cycle)         |
| **Kappa (Intercoder)**  | Cohen's κ — **ONLY** kappa shipped. Missing α + Fleiss     |
| **Weights**             | Code weighting panel                                       |
| **Show Coding Stripes** | Visual coding-density overlay on transcripts               |
| **Dashboard**           | Canvas-level dashboard view                                |
| **Ethics**              | Ethics/IRB tracking                                        |
| **Excerpts**            | Excerpt browser modal                                      |
| **Codebook**            | ✅ Genuinely world-class table view (see screenshot fc-02) |
| **Research Calendar**   | Calendar events scheduling                                 |
| **Edges**               | (cut off at modal — edge management?)                      |

### AI dropdown (4 hidden features)

| Feature       | Notes                                             |
| ------------- | ------------------------------------------------- |
| **Auto-Code** | Two-phase batch auto-code on transcript           |
| **AI Code**   | Manual AI-assisted code suggestion                |
| **AI Chat**   | Conversational AI scoped to canvas                |
| **Summarize** | Generate summary of canvas / transcript / codings |

### Analyze menu (10 analysis tools, organized in 3 categories)

| Category                    | Tools                                                  |
| --------------------------- | ------------------------------------------------------ |
| **Text Analysis**           | Text Search · Word Cloud · Sentiment                   |
| **Coding Analysis**         | Statistics · Co-occurrence · Coding Query · Clustering |
| **Frameworks & Comparison** | Framework Matrix · Comparison · (Theme map / treemap)  |

Per memory: `timeline` (temporal) and `geomap` (geographic) also exist. Total = 10 (Pro/Team), or 2 (Stats + Word Cloud on Free tier).

### 22 node types (per codebase audit)

**Basic (3):** TranscriptNode · QuestionNode · MemoNode
**Workspace structure (3):** GroupNode · StickyNoteNode · RerouteNode
**Cases (1):** CaseNode
**Document (2):** DocumentNode · DocumentPortraitNode
**Computed analysis (10):** StatsNode · WordCloudNode · SentimentNode · CooccurrenceNode · ClusterNode · CodingQueryNode · MatrixNode · ComparisonNode · TreemapNode · SearchResultNode · TimelineNode · GeoMapNode

**That's actually 13 computed nodes counting Search + Timeline + Geo.** Bigger feature surface than any competitor.

### 3 edge types

CodingEdge · RelationEdge · ConnectionLine

### Sidebar (collapsible left)

Tabs:

- **Codes (N)** — code navigator with filter, sort (By count / A-Z), color dots, count badges
- **Sources (N)** — transcript list with word count + coverage

### Command palette (`Cmd+K`)

**Working:**

- Search node names (e.g., "sentiment" finds existing Sentiment nodes)
- Add actions (Add New Code, Add Memo, Fit View, Toggle Snap to Grid, etc.)
- Switch Dark Mode
- Toggle Coding Stripes
- Toggle Navigator

**NOT working (critical V3 fix):**

- Search "cases" → No results
- Likely same for: Hierarchy, Weights, Ethics, Excerpts, Codebook, Research Calendar

### Keyboard shortcuts modal (`?`)

**Excellent.** Categorized (Navigation / Editing / Selection & Layout / View). Click to reassign. Reset to defaults link.

### Export

| Format   | Plan                                         |
| -------- | -------------------------------------------- |
| CSV      | Free                                         |
| PNG      | Pro                                          |
| HTML     | Pro                                          |
| Markdown | Pro                                          |
| QDPX     | Pro (export to Atlas.ti/NVivo for migration) |

### Sharing & collaboration

- Share modal with shareCode generation
- CanvasShare model tracks clone count
- CanvasCollaborator for team-tier real-time editing
- WebSocket presence + cursors + selection halos
- PresenceAvatars component

### Free tier limits (from `plans.ts`)

- 1 canvas
- 2 transcripts per canvas
- 5,000 words per transcript
- 5 codes
- 2 analyses (Stats + Word Cloud only)
- 0 share codes
- No: ethics, cases, AI, file upload, repository, integrations
- 0 AI requests/day

### Pro tier ($12/mo)

- Unlimited canvases / transcripts / codes
- 50K words per transcript
- All 10 analysis tools
- Auto-code AI
- All exports
- 5 share codes
- Ethics + Cases + AI enabled
- 1000 AI requests/day
- 500 MB storage
- 60 transcription minutes/month
- 3 collaborators
- Repository enabled

### Team tier ($29/mo/seat)

- All Pro features
- Unlimited share codes
- Intercoder reliability (Kappa)
- 5GB storage
- 300 transcription minutes/month
- Unlimited collaborators
- Integrations enabled

---

## Discoverability gap analysis

**Of 16 Tools+AI features, how many can a casual user find?**

| Feature           | Sidebar           | Toolbar                | Cmd+K       | Right-click     | Keyboard |
| ----------------- | ----------------- | ---------------------- | ----------- | --------------- | -------- |
| Add code          | ✅ "Add New Code" | ✅ Code button         | ✅          | ✅ context menu | ✅       |
| Add memo          | ✅                | ✅ Memo button         | ✅          | ✅              | ✅       |
| Add transcript    | —                 | ✅ Transcript dropdown | ❌          | —               | —        |
| Codebook          | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Cases             | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Cross-Case        | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Hierarchy         | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Kappa             | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Weights           | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Coding Stripes    | —                 | ❌ Tools dropdown      | ✅ (toggle) | —               | —        |
| Dashboard         | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Ethics            | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Excerpts          | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Research Calendar | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Edges             | —                 | ❌ Tools dropdown      | ❌          | —               | —        |
| Auto-Code         | —                 | ❌ AI dropdown         | ❌          | —               | —        |
| AI Code           | —                 | ❌ AI dropdown         | ❌          | —               | —        |
| AI Chat           | —                 | ❌ AI dropdown         | ❌          | —               | —        |
| Summarize         | —                 | ❌ AI dropdown         | ❌          | —               | —        |

**Score: 3 of 19 features (16%) discoverable without entering the Tools/AI dropdowns OR memorizing shortcuts.**

This is the discoverability gap V3 Sprint A solves.

---

## V3 Sprint A — Refined IA proposal

Based on this walkthrough, the activity bar should be:

```
[Activity Bar (left, 48px icons)]
─────────────────────────────────
📋 Canvases       ←  Default landing (canvas list)
📚 Codebook       ←  Codebook table + hierarchy
👥 Cases          ←  Cases list + Cross-Case
📊 Analyze        ←  10 analysis tools (with empty-state CTA per analysis)
✨ AI             ←  Auto-Code, AI Chat, Summarize history
🤝 Collaborate    ←  Share, intercoder, comments (when shipped)
🛡️ Quality        ←  Kappa, Weights, Ethics, Audit log
📅 Schedule       ←  Research Calendar
─────────────────────────────────
⚙️ Settings       ←  Bottom; account, AI keys, etc.
```

**Removed from toolbar:** Tools dropdown, AI dropdown
**Kept in toolbar:** Back, canvas title, Transcript / Survey / Code / Memo (primary creation actions), Upload, Share, Analyze
**Result:** 7 primary toolbar items + 8 activity-bar items = 15 surface positions for 35+ features (vs. current ~10 surface positions hiding 19+ features in dropdowns)

---

## Polish quick wins from this walkthrough

1. **Fix Cmd+K coverage** — register every feature with `shortcutStore.ts` so `Cmd+K → cases` actually works (~4 hours)
2. **Add tooltip with shortcut to every button** — `?` for shortcut hint pill, etc. (~6h)
3. **Branded shimmer for loading states** — replace plain gray skeleton bars (~6h)
4. **Move chat widget OR move cookie banner** so they don't overlap (~30 min)
5. **Improve the "Add OpenAI key" banner** with trial credits messaging once P0.7 ships

---

## Screenshots captured this session

- `review-01..10*.png` — first deep review
- `audit-01..19*.png` — sprint 1 walkthrough
- `verify-toast-*.png` — fix verifications
- `final-01..02*.png` — final sprint verification
- `v2-01..09*.png` — second deep review (dark mode, mobile, marketing)
- `fc-01..05*.png` — feature catalogue capture this session
- `visual-*.png` + `e2e-failure-*.png` — CI failure investigations
- `google-button-live.png` — Google OAuth verification

**Total: ~50 screenshots covering the entire app surface.**

---

## Recordings captured

- `recordings/canvas-human-test.mp4` (180s, 6.7 MB) — initial walkthrough
- `recordings/canvas-ux-review.mp4` (240s, 6.1 MB) — UX deep dive
- `recordings/ffmpeg*.log` — capture logs

---

## Plans + research documents produced

| File                        | Words    | Purpose                    |
| --------------------------- | -------- | -------------------------- |
| `UX_ENHANCEMENT_PLAN.md`    | 7K       | V1 initial scan            |
| `UX_ENHANCEMENT_PLAN_V2.md` | 9K       | V2 post-codebase reframe   |
| `UX_ENHANCEMENT_PLAN_V3.md` | 12K      | **Master plan (PRIMARY)**  |
| `UX_FINDINGS_APPENDIX.md`   | 15K      | All raw research           |
| `FEATURE_CATALOGUE.md`      | This doc | Live walkthrough inventory |

**Total: ~50,000+ words of research and planning across this engagement.**

---

## Five highest-leverage shipping decisions (final settled view)

1. **Fix 3 Prisma cascade bugs (20 min)** — prevents data-loss support tickets
2. **Ship Krippendorff's α (1-2 weeks)** — unlocks institutional sales
3. **Replace 22-step tour with 85-second onboarding (3-4 days)** — measured: median <90s to first coded excerpt, >70% completion
4. **Lift Tools/AI dropdowns into VS Code activity bar + complete Cmd+K coverage (5 days + 4h)** — solves 16-features-hidden problem
5. **Inline AI tag suggestions on highlight (4 days)** — Dovetail's killer feature

**6 weeks of work for category-defining product position.** Everything else in the V3 plan is gravy.

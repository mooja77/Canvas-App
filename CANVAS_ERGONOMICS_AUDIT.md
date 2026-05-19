# Canvas Ergonomics Audit — Comprehensive

_Last updated: 2026-05-19. Subject: the qualitative-coding canvas
(`CanvasWorkspace.tsx`) on production (`qualcanvas.com`, build `1401e4d`)._

## 1. Scope & method

The lens throughout is **ease of use for qualitative researchers** — not power
users. ComfyUI-style node tools are used by tinkerers who enjoy fiddling;
researchers will not tinker their way past friction. The canvas must feel
obvious, forgiving, and quiet.

Evidence base — three passes:

- **Deep live walkthrough (2026-05-19):** built a probe canvas (1 transcript,
  4 codes, 5 codings) on production and exercised entry, adding nodes, the
  coding loop, node controls, menus, command palette, dark mode and mobile —
  with on-page measurement.
- **Production audit (2026-05-18):** six UI/UX defects, all since fixed (§2).
- **Code review:** node builders, `canvasFit.ts`, context menus,
  `QuickCodePopover`, `CodingEdge`.

Tags: **[verified]** directly observed/measured · **[code-confirmed]** confirmed
in source · **[recommendation]** convention gap.

---

## 2. Already shipped this cycle

Six canvas/UX defects from the 2026-05-18 audit — fixed, merged, deployed:

| Issue                                                           | PR  |
| --------------------------------------------------------------- | --- |
| Mobile toolbar overflowed viewport — Transcript/Analyze clipped | #31 |
| Minimap rendered as an empty white box                          | #32 |
| Initial framing computed against zero-size phantom nodes        | #32 |
| Right-click context menus spilled off-viewport                  | #31 |
| PWA manifest icon 404 → console error every page                | #31 |
| Landing stat band flashed "0" pre-animation                     | #31 |

This audit is everything found **after** those fixes.

---

## 3. Findings

Severities: 🔴 P1 (high-frequency friction) · 🟠 P2 · 🟡 P3 · 🟢 P4 (polish).

### F1 — New nodes spawn on top of existing content 🔴 P1

**[verified + code-confirmed]** Creating a code from a text selection placed the
new code node _directly over the transcript_. On the 4-code probe canvas, the
"Identity & self" node overlapped the transcript (1 overlapping node pair
measured on load). This is the **highest-frequency friction on the canvas** — it
recurs on every node creation, dozens of times a session.
Root cause — `CanvasWorkspace.tsx` node builders (L495–699): a node with no
persisted position falls back to a fixed type-column —
`transcript {x:50, y:50+i·500}`, `question/code {x:550, y:50+i·280}`,
computed `{x:1250+col·400, …}`. The fallback is blind to where existing nodes
sit or how the researcher arranged them.
→ Place new nodes in nearest _clear_ space, collision-checked against existing
node rects; anchor codes near their source transcript, never overlapping.
**Effort ~0.5–1 d.**

### F2 — `window.prompt` for "Add Sub-Code" 🟠 P1

**[verified]** The node context menu's **Add Sub-Code** uses a native
`window.prompt()` — an unstyled grey OS dialog, no validation, off-brand. The
one interaction that visibly breaks the app's polish.
→ Inline input, reuse the `QuickCodePopover` pattern. **Effort ~0.5 d.**

### F3 — Node-header controls are 8–11 px and shrink further with zoom 🟠 P2

**[verified — measured]** On the probe canvas at 59 % zoom the node-header
buttons measured: Change-color **8×8 px**, Collapse / View-codings / Delete
**11×11 px**. Because React Flow scales node content with zoom, these controls
get _smaller_ the more a researcher zooms out — and zoomed-out is the normal
overview state. They are far below the ~24 px minimum for a reliable target.
→ Give node controls a minimum rendered hit area independent of zoom (or a
floor), and ≥32 px padding. **Effort ~0.5 d.**

### F4 — Auto-layout collapses codes into a vertical column 🟠 P2

**[verified]** Four codes auto-arranged as a single vertical stack cascading
down the right side, with long curved edges crossing each other. It reads as a
list, not a map — and gets visually noisy as code count grows. (This is the
2026-05-14 QA finding #11, still live.)
→ Lay codes out in a balanced 2-D arrangement around their source(s), not one
column. **Effort ~1 d.**

### F5 — Small graphs frame off-centre 🟡 P2

**[verified]** A canvas with one transcript framed it low and right-of-centre
with ~75 % empty canvas. `fitView` frames the bbox but does not account for how
a 1–3-node graph reads in a wide viewport.
→ Centre small graphs and cap zoom. **Effort ~0.5 d (extends `canvasFit.ts`).**

### F6 — ~~Blank-canvas problem: no starter templates~~ — WITHDRAWN ✅

**Correction (longitudinal test, 2026-05-19): this finding was wrong.** The
"New Canvas" modal already offers a full methodology-template chooser — Blank,
Thematic Analysis, Grounded Theory, IPA, Framework Analysis, Content Analysis —
each (except Blank) seeding 4–5 starter codes. The original audit created its
probe canvases via the API, which bypasses the "New Canvas" modal, so the
template chooser was never seen. No work required — the blank-canvas concern is
already addressed by the product. See `LONGITUDINAL_TEST_2026-05-19.md`.

### F7 — Persistent AI banner eats prime vertical space 🟡 P3

**[verified — measured]** The "AI features are part of your plan…" banner is
**37 px** on desktop and wraps to **~75 px (3 lines)** on mobile, sitting above
the canvas until manually dismissed.
→ Make it a one-line dismissible strip, or move it into the AI menu as a hint.
**Effort ~0.25 d.**

### F8 — Mobile: chrome stack consumes ~37 % of the screen 🟡 P3

**[verified]** On a 390×844 phone the stack above the canvas — header, AI
banner (3 lines), tab bar, back/name row, and the toolbar wrapped to **3 rows**
— measured ~310 px, leaving the canvas ~470 px. The toolbar wrap (PR #31) keeps
every control reachable, but the cumulative chrome is heavy.
→ Collapse secondary toolbar rows behind a single "⋯ More" on mobile; thin the
chrome. **Effort ~0.5 d.**

### F9 — Mobile: transcript text ~6 px — coding by selection impractical 🟡 P3

**[verified]** At the fit zoom the transcript node's body text is ~6 px. The
core interaction (select text → code) requires zooming deep into the node and a
precise touch selection. Mobile is realistically a _read/review_ surface, not a
coding surface — that's a reasonable product stance, but it should be explicit
(e.g. a gentle "best on a larger screen for coding" hint), not silent.
**Effort ~0.25 d (messaging) — or larger if true mobile coding is in scope.**

### F10 — Minimap overlaps canvas content on mobile 🟡 P3

**[verified]** On the 390 px phone the minimap (~150×100) sits over the
bottom-right canvas, covering nodes.
→ Hide the minimap below a width breakpoint, or shrink + make it toggleable.
**Effort ~0.25 d.**

### F11 — Tools menu is an overloaded "junk drawer" 🟡 P3

**[verified]** The Tools dropdown holds **14+ items** with minimal grouping:
analysis tools (Cases, Cross-Case, Hierarchy, Kappa, Weights), view toggles
(Show Coding Stripes, Focus Mode, Presentation Mode), panels (Dashboard, Ethics,
Excerpts, Codebook, Research Calendar) and an edge-style picker — all in one
list. Finding a tool means scanning the whole menu.
→ Split: a "Analysis" group, a "View" group; move edge-style to a settings
affordance. **Effort ~0.5 d.**

### F12 — No find / jump-to-existing-node 🟡 P3

**[verified]** Ctrl+K opens a _"Search nodes"_ palette — but it searches node
**types to add** (CORE: Transcript / Research Question / Memo / Sticky Note;
ANALYSIS: Text Search / Co-occurrence / Framework Matrix / Statistics / …), not
existing nodes. In a large project there is no way to type "Caregiving" and have
the canvas centre on that code.
→ Add an existing-node search/jump mode to the palette. **Effort ~0.5 d.**

### F13 — ~~Add-node is fragmented; no double-click add~~ — WITHDRAWN ✅

**Correction (2026-05-19): this finding was wrong.** `CanvasWorkspace.tsx`
`handlePaneClick` (≈L1514) already detects a double-click on the empty pane
and opens a quick-add menu **at the cursor**. The original audit's
double-click probe used a detection selector that the quick-add menu does not
match — a false negative. Double-click-to-add already works; no change needed.

### F14 — Modal-heaviness 🟢 P4

**[verified]** Tools and Analyze actions open modal dialogs, each pulling the
researcher out of the spatial canvas context. Fine for heavy tasks; lightweight
ones could be in-canvas panels. **Larger refactor.**

### F15 — 18 node types, uneven chrome 🟢 P4

**[code-confirmed]** 8 base + 10 computed node types with varying header sizes
and density. A node canvas's calm comes from uniform chrome.
→ Normalise header height / control size / padding across all 18 types.
**Effort ~1 d.**

---

## 4. Strengths to protect (do not regress)

1. **Text-selection → QuickCodePopover** — the best interaction in the app:
   shows the selected quote, search-to-create field, In Vivo / Paragraph / AI
   shortcuts, helpful empty-state; one step creates the code _and_ first coding.
2. **Empty-state guidance** — clear next action in the codes panel.
3. **Node context menu** — organised, keyboard-hinted (Duplicate Ctrl+D,
   Collapse C, Delete Del).
4. **Domain graphics** — coding stripes / inline highlight of coded text,
   colour-keyed edges, group boxes, sticky notes. No generic node tool matches.
5. **Ctrl+K add palette** — categorised, searchable, fast (just add-only — F12).
6. **Minimap** — renders node rects correctly (PR #32).
7. **Dark mode** — clean and complete across canvas, nodes, edges, panels.
8. **Edge styling** — bezier / straight / step / smoothstep, colour-keyed,
   waypoint reroute.

---

## 5. Root-cause note — node placement

F1, F4 and F5 all stem from one area: **node positioning is naïve**. Builders
assign any node without a persisted position to a fixed type-column grid
(L495–699), auto-layout stacks codes in a column, and `fitView` frames whatever
results. The single highest-leverage structural fix is a shared
**"place near anchor, in nearest free space"** helper used by every node-create
path — it resolves F1, removes the overlap that hides coding edges, and feeds a
better-shaped graph into fit. (It also removes the `onlyRenderVisibleElements`
culling fragility seen during the minimap work.)

---

## 6. Prioritized worklist

| #       | Item                                                           | Priority | Effort  | Type     |
| ------- | -------------------------------------------------------------- | -------- | ------- | -------- |
| F1      | New nodes placed in nearest clear space (collision-aware)      | 🔴 P1    | 0.5–1 d | defect   |
| F2      | Replace `window.prompt` Add Sub-Code with inline input         | 🟠 P1    | 0.5 d   | defect   |
| F3      | Node-header controls — minimum hit size, zoom-independent      | 🟠 P2    | 0.5 d   | defect   |
| F5      | Centre small graphs on initial fit                             | 🟠 P2    | 0.5 d   | defect   |
| F4      | Auto-layout: balanced 2-D instead of vertical column           | 🟠 P2    | 1 d     | defect   |
| ~~F6~~  | ~~Starter templates~~ — WITHDRAWN, already exists              | —        | —       | —        |
| F7      | Slim the AI banner                                             | 🟡 P3    | 0.25 d  | polish   |
| ~~F13~~ | ~~Double-click-empty-canvas → add~~ — WITHDRAWN, already works | —        | —       | —        |
| F10     | Hide/shrink minimap on mobile                                  | 🟡 P3    | 0.25 d  | polish   |
| F11     | Split the Tools "junk drawer" menu                             | 🟡 P3    | 0.5 d   | polish   |
| F12     | Find / jump-to-existing-node in the palette                    | 🟡 P3    | 0.5 d   | feature  |
| F8      | Slim mobile chrome stack                                       | 🟡 P3    | 0.5 d   | polish   |
| F9      | Mobile coding-on-phone messaging                               | 🟡 P3    | 0.25 d  | polish   |
| F15     | Uniform node chrome across 18 types                            | 🟢 P4    | 1 d     | polish   |
| F14     | Reduce modal-heaviness                                         | 🟢 P4    | —       | refactor |

**Progress:** PR #33 shipped F3, F7, F10. PR #34 corrected F6. The ergonomics
PR-2 ships F2 (inline sub-code input) + F11 (Tools-menu grouping); F13 was found
already implemented. **Remaining:** F1 (node placement — its own PR, since it
is e2e-sensitive), F4 (auto-layout), F5, F8, F9, F12, F15, F14.

---

## 7. Bottom line

The canvas is **capable** — it has the full node-canvas interaction layer
(searchable add, minimap, context menus, edge styling, command palette, dark
mode) _and_ domain graphics generic node tools cannot match (coding stripes,
colour-keyed edges). It does **not** have a parity problem.

It has a **last-mile friction problem**, and two findings carry most of the
weight:

- **F1** — new nodes pile on top of existing content (every session, dozens of
  times). The single most important fix. The longitudinal test
  (`LONGITUDINAL_TEST_2026-05-19.md`) shows this compounds across a project's
  life and that the only repair, Auto-Arrange, is destructive to manual layout.
- **F2** — one OS dialog breaks the polish.

Fix those and the canvas goes from "capable but fiddly" to "quiet and obvious"
— which, for a research audience, is the whole game.

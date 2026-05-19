# Longitudinal Usage Test — 2026-05-19

A simulated qualitative-research project run end-to-end on production
(`qualcanvas.com`, build `bb0ea89`), using the app as a researcher would across
the lifecycle of a study — not a feature click-through.

## The simulated study

**"Returning to Study — Caregiver Hiatus"** — a thematic analysis of mature
students who took a leave of absence to care for a family member and then
returned to graduate school. Four interview participants (Maya, James, Priya,
Tom), realistic transcript content, thematic overlap across cases (disrupted
identity, institutional friction, the meaning of the work, time/mortality).

The test walked the project's lifecycle as distinct working sessions:

1. **Session 1** — create the project, add the first interview, begin coding.
2. **Weeks of work** — grow to 4 transcripts, 7 codes, 16 codings.
3. **Returning session** — reload the grown project after time away.
4. **Analysis** — run an analysis on the coded data.

---

## Phase-by-phase findings

### Session 1 — project setup & first interview

- ✅ **Methodology template chooser.** "New Canvas" opens a template picker —
  **Blank, Thematic Analysis, Grounded Theory, IPA, Framework Analysis,
  Content Analysis** — each (except Blank) seeding 4–5 starter codes. Picking
  _Thematic Analysis_ created the canvas pre-populated with 5 Braun & Clarke
  phase codes. **This directly contradicts ergonomics-audit finding F6** ("no
  starter templates") — F6 is wrong and must be corrected (see §Corrections).
- ✅ **Add-transcript flow.** Clean inline form (Title + Content), four import
  sources (Paste, Assessments, Upload file, From another canvas). No friction.
- ❌ **L1 — first transcript collided immediately.** The moment the first
  transcript was added it spawned _overlapping the "Initial impressions"
  starter code_ — its text was half-hidden behind the code node before the
  researcher had done anything. The very first action produces a collision.
  (Confirms ergonomics-audit **F1**.)

### Growth to scale — 4 transcripts, 7 codes, 16 codings

- ✅ **Persistence is solid.** After building the project up and reloading,
  every transcript, code and coding was intact; counts correct in the navigator
  ("Codes (7)", "Sources (4)") and status bar ("66% coded, 16 codings").

### Returning session — reopening the grown project

- ❌ **L2 — the canvas had degraded into an overlapping tangle.** Reopening the
  4-transcript / 7-code project showed **two vertical columns of nodes that
  overlapped each other** — every transcript sat under a code node, 16 coding
  edges bundled into a crossing knot. This is a _small_ project; a real study
  (20–40 transcripts, 50+ codes) would be unusable on open without manual
  cleanup. F1 + the vertical-column auto-layout (audit **F4**) **compound**:
  each addition lands badly, and they accumulate.
- ✅ **Auto-Arrange recovers it.** `Ctrl+Shift+L` re-laid the canvas into a
  clean, non-overlapping arrangement — transcripts in a readable left column,
  codes spread on the right. The canvas _can_ look good.
- ❌ **L3 — but Auto-Arrange is all-or-nothing.** It repositions **every**
  node. A researcher who has hand-arranged a thematic map and then adds one
  transcript faces a lose-lose: live with the new overlap, or run Auto-Arrange
  and **lose their entire manual layout**. Across a multi-week project this is
  a recurring tax — the canvas does not maintain itself.

### Analysis phase

- ✅ **Analyze menu is well-built.** Categorised — Text Analysis (Search, Word
  Cloud, Sentiment), Coding Analysis (Statistics, Co-occurrence, Coding Query,
  Clustering), Frameworks & Comparison (Framework Matrix, Comparison, Theme
  Map) — each with icon + description. A clear contrast with the Tools menu's
  14-item "junk drawer" (audit **F11**).
- ✅ **Statistics analysis worked.** Adding a Statistics node and running it
  produced a correct chart of the 16 codings across the 7 codes ("16 total",
  bar/pie toggle).
- ❌ **L4 — analysis nodes also spawn overlapping** existing nodes (F1 is not
  limited to transcripts/codes — computed nodes hit it too).
- 🟡 **L5 — computed nodes need a manual "Run".** A freshly-added Statistics
  node shows "Click Run to compute statistics". Reasonable for expensive
  analyses, but there's no indication a node's result is _stale_ after the
  underlying codings change — a researcher could read an out-of-date chart.

---

## The headline longitudinal finding

**In its parts, the app handles the research lifecycle well** — templating,
the add-transcript flow, the coding popover, persistence, the analysis menu and
charts all work. **What does not hold up is the spatial canvas itself.**

The canvas does not _maintain_ itself. Every node added — transcript, code, or
analysis — lands on a blind fixed coordinate, so the layout degrades a little
with every edit. The only repair, Auto-Arrange, is destructive: it discards any
arrangement the researcher built by hand. Over the weeks-to-months span of a
real study this is the dominant friction — the researcher is forced to choose,
repeatedly, between a messy canvas and re-doing their spatial thinking.

This **reframes ergonomics-audit F1**: it is not merely "annoying on node
creation" — it is a lifecycle-long tax on the one thing the product is
named for, the canvas.

---

## Corrections to the ergonomics audit

`CANVAS_ERGONOMICS_AUDIT.md` finding **F6 — "Blank-canvas problem: no starter
templates"** is **incorrect**. A full methodology-template chooser with starter
codes exists at canvas creation. The audit's live walkthrough created canvases
via the API, which bypasses the "New Canvas" modal — the modal was never seen.
F6 should be struck; the blank-canvas concern is already addressed by the
product.

---

## Revised priorities (longitudinal lens)

| #          | Finding                                           | Why it matters longitudinally                                     |
| ---------- | ------------------------------------------------- | ----------------------------------------------------------------- |
| F1 / L1–L4 | Nodes spawn on blind fixed coordinates → overlap  | Compounds every session; the canvas degrades continuously         |
| L3         | Auto-Arrange is destructive (all-or-nothing)      | The only repair erases manual layout — researchers stop arranging |
| F4         | Vertical-column auto-layout                       | Feeds the tangle as the project grows                             |
| L5         | No staleness indicator on computed analysis nodes | Risk of reading an out-of-date chart                              |
| F11        | Tools "junk drawer"                               | Scanning cost grows as the researcher learns the tool             |

**Strongest single recommendation:** the F1 fix should not just "place new nodes
in clear space" — it should place them _without disturbing existing nodes_, and
Auto-Arrange should gain an **incremental mode** that places only un-positioned
nodes and leaves hand-placed ones alone. Together those make the canvas
self-maintaining across a project's life — the difference between a tool a
researcher fights and one they trust.

## What worked (protect these)

Methodology templates · add-transcript flow · text-selection coding popover ·
coding stripes · **persistence** · Auto-Arrange's _output_ quality · the
categorised Analyze menu · Statistics analysis on real data · dark mode.

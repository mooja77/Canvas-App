# ComfyUI-grade node ergonomics — design

**Date:** 2026-05-25
**Status:** Draft for review
**Goal:** Make the canvas's node interactions — sizing, connecting, resizing — at least as good as ComfyUI's node graph. Reported by the user: "nodes can't be resized, connections are hard to do, starting nodes are the wrong size for the text in them, lots of other little bugs."

## Problem (from a live discovery pass on prod)

Measured on the prod canvas (`Thematic Analysis` demo), benchmarked against ComfyUI:

1. **Nodes clip their own text.** A Code node measured `clientHeight 79` while its content needed `scrollHeight 120` — ~40px of text hidden. Resizing the node taller revealed it (`scrollHeight 153 ≈ clientHeight 150`), proving the _box_ is wrong, not the content. New/seeded nodes get a stored height that doesn't track their text. ComfyUI nodes auto-grow to fit content.
2. **Connections are hard.** Connection handles are **6–8 screen pixels** — you must precisely grab a 6px dot to start a wire. There is a nice hover-grow (`scale(1.4)`) + connecting pulse, but you must hit the 6px target first to trigger it; there is no enlarged hit zone and the default strict connect radius. The connection _logic_ is strong and worth preserving (transcript→code creates a coding when text is pre-selected; code→code offers merge/relation; dropping a wire on empty canvas opens a QuickAdd "smart link" menu) — it is simply gated behind ungrabbable handles.
3. **Resize is undiscoverable, not broken.** `NodeResizer` is active when a node is selected (8 controls render) and dragging a handle _does_ resize. But the grab handles are **8px** and appear only when selected, so users can't find/grab them. Also: **resize is not undoable** (Ctrl+Z does not revert it).
4. **Other little bugs found:** resize not in undo history; computed nodes expose only a _target_ handle (you can't wire _out_ of them); handles are shown on select rather than on hover.

## Goal / quality bar

ComfyUI-grade: nodes always fit their content; handles are large and forgiving to grab and drop; resize is obvious and undoable; wiring feels effortless. No regressions to the existing (good) connection semantics or the fit/auto-layout behavior.

## Non-goals (out of scope here)

- Edge restyling / identity-colored edges / micro-motion (separate enhancement track).
- The computed-node visual unification (already in flight as PR #70).
- Any backend/schema change. This is a frontend ergonomics pass.

## Design — three phases (each its own PR, independently prod-verified)

### Phase 1 — Handle & resize hit-zones (CSS-only, near-zero risk)

**Files:** `apps/frontend/src/index.css` (handle + resize-control rules); possibly the `handleClassName`/handle `className` props in node components if a class hook is needed.

- Connection handles: keep a tidy ~10–11px visible dot, but add a **large transparent hit zone** (~24×24px) via a `::before` pseudo-element with `pointer-events: auto`, so the grabbable area is generous while the visual stays clean. Preserve the existing hover-grow + connecting pulse.
- Resize handles: enlarge the visible handle to ~10px and add a larger hit zone; make the **bottom-right corner** the prominent, obvious resize affordance; reveal resize affordance on node hover (not only when selected).
- Handles visible on **node hover**, not just selection, so connection points are discoverable.
- Respect the existing low-zoom-bulk rule that hides handles when many nodes are selected at low zoom.

**Why first:** pure CSS, cannot break logic, ships in minutes, and immediately fixes two of the three complaints (connections + resize discoverability). Verify on prod with a connect + resize interaction.

### Phase 2 — Auto-fit node height (structural)

**Files:** `apps/frontend/src/components/canvas/CanvasWorkspace.tsx` (the per-type node-build blocks that set `style.height` from `posData.height`); node component roots/CSS as needed.

- For **text-bearing nodes** (question / transcript / memo / case): stop forcing `style.height` so the node sizes to content (height auto). Persist and apply **width** only; height follows the text. A node must never clip its own title/text.
- For **computed nodes** (charts need an explicit height): keep height resizable, but ensure the default fits the rendered content and never clips the header/result.
- A stored height that is smaller than content must not win over the content — prefer content height (treat stored height as a _minimum_ or ignore for text nodes).
- Verify the **fit/auto-layout algorithm** (`canvasFit.ts` `nodesToBbox`) still frames correctly, since it reads measured dimensions.

**Why second & isolated:** changes node layout, dragging, and fit-view framing — the only genuinely risky part. Gets its own PR with before/after prod screenshots across node types and zoom tiers.

### Phase 3 — Connect tuning + bug cleanup

**Files:** `CanvasWorkspace.tsx` (`<ReactFlow>` props, resize→history), `useCanvasHistory.ts`.

- Add a forgiving `connectionRadius` (≈30) so wires snap to nearby handles on drop.
- Make **resize undoable**: capture node dimension changes into `useCanvasHistory` so Ctrl+Z reverts a resize.
- Computed nodes remain **terminal sinks** (no source handle added) per the resolved decision — documented as intentional.
- Fold in any further "little bugs" surfaced during Phase 1/2 prod verification.

## Testing & verification

- No fast local canvas render here (local backend flaky; prod CORS blocks localhost). Each phase is verified **on prod after deploy** via Playwright: measure handle hit areas, perform a real connect + resize, and confirm no node reports `scrollHeight > clientHeight` (no clipped text) across node types.
- Pre-check the e2e suite before each push for any selector/behavior coupling (lesson from #68): `canvas-advanced` (right-click, zoom), `canvas-analysis`, and any resize/connect specs.
- Node visuals are not in the visual-regression baselines, so snapshots are unaffected.
- Unit-test the pure pieces where they exist (e.g., any height-resolution helper extracted in Phase 2; `canvasFit` already has tests to guard framing).

## Risks & mitigations

- **Auto-fit regresses fit-view framing or drag** → isolate in its own PR; verify `canvasFit` framing on prod; keep width persistence so manual layouts survive.
- **Enlarged handle hit zones swallow clicks meant for the node body** → keep the hit zone confined to the node edge, `pointer-events` only on the handle pseudo, test that node-body double-click-to-edit and text selection still work.
- **Stored-height migration** → don't migrate data; resolve at render (content height wins). No backend change.

## Decisions (resolved with the user, 2026-05-25)

1. **Computed nodes stay terminal sinks** — no output/source handle is added. This pass fixes only their _input_ handle ergonomics. (Phase 3 drops the "decide output handles" item.)
2. **Text nodes use width-only resize** — the user drags to set WIDTH; height always auto-fits the text and can never clip (ComfyUI-style). No free height resize for text nodes. (Computed nodes keep resizable height since their charts need it.)

## Rollout

Three PRs in order (1 → 2 → 3), each merged + deployed + prod-verified before the next, matching the team's small-verified-PR cadence. Rebase onto `main` after PR #70 (computed-node visual unification) lands to avoid overlap in `ComputedNodeShell`/handle styling.

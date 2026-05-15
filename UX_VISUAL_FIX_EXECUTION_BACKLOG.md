# QualCanvas Visual Fix Execution Backlog

Date: 2026-05-14

Purpose: convert the UI/UX review findings into an implementation-ready backlog. This is a planning artifact only; no product code is changed by this document.

Primary references:

- `UX_VISUAL_REMEDIATION_PLAN.md`
- `UX_CANVAS_BENCHMARK_RESEARCH.md`
- `test-results/ui-ux-review-2026-05-14-deep-live-report.md`
- `test-results/live-visual-responsive-pass.mjs`
- `test-results/live-visual-stress-pass.mjs`
- Existing Playwright suites under `e2e/`

## Release Strategy

Fix the graphical canvas in small, verifiable batches. Do not combine mobile layout, auto-layout, modal accessibility, telemetry, and email system work into one large release.

Recommended order:

1. Add/extend regression tests first for the current failures.
2. Fix P0 graphical viewport/menu issues.
3. Fix P1 reliability/accessibility/backend-route issues.
4. Add low-zoom UX enhancements.
5. Add benchmark-derived navigation, organization, graph hygiene, and contextual creation.
6. Build lifecycle email/training engagement after the core canvas is stable.

Deployment rule:

- Do not mark the canvas visually ready until browser QA passes at `320x568`, `390x844`, `568x320`, `768x1024`, `1024x768`, `1024x640`, `1366x768`, and dark narrow mode.

## P0 Tickets

### P0-01 - Dynamic Fit View And First-Load Framing

Problem:

- Mobile and dense canvases open blank/offscreen.
- Initial fit uses a fixed `minZoom: 0.5`.
- Resize/orientation changes do not refit.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/hooks/useCanvasKeyboard.ts`
- Potential helper: `apps/frontend/src/components/canvas/canvasViewport.ts`

Implementation:

- Extract a `fitCanvasView({ reason, viewport, nodeBounds })` helper.
- Replace fixed initial and keyboard fit options with dynamic bounds-aware options.
- Add debounced refit after initial nodes/edges settle.
- Add debounced refit after orientation/viewport size changes.
- Preserve user-controlled viewport after manual pan/zoom unless a canvas switch, orientation change, or explicit Fit View occurs.

Acceptance:

- `320x568` first load shows graph content or an explicit mobile overview state.
- `568x320` rotation recovers graph content.
- Fit View never leaves minimap/status/controls offscreen.
- Edges are visible after fit.

Tests:

- Add `e2e/canvas-responsive-visual.spec.ts`.
- Extend `e2e/mobile-responsive.spec.ts`.
- Re-run `node test-results/live-visual-responsive-pass.mjs`.

### P0-02 - Mobile Canvas Shell

Problem:

- Desktop minimap/status/controls do not fit mobile.
- Status bar can be wider than the viewport.
- Minimap appears at negative x positions.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/components/canvas/StatusBar.tsx`
- `apps/frontend/src/index.css`

Implementation:

- Hide minimap below `768px`.
- Replace desktop React Flow controls with a compact mobile control strip below `640px`.
- Make status bar responsive: compact counts only on mobile, expanded details in a sheet.
- Add safe-area padding for mobile and landscape short-height viewports.

Acceptance:

- No minimap, control, or status element has negative `left/top`.
- Fit View remains tappable at tablet/mobile sizes.
- Mobile screenshots show no clipped status bar.

Tests:

- Add geometry assertions for minimap/status/control bounds.
- Add screenshots for portrait and landscape mobile.

### P0-03 - Responsive Tools And Analyze Menus

Problem:

- Tools menu clips on desktop `1024x640`, tablet portrait, mobile, and dark narrow mode.
- Analyze is not mobile-native and can clip in mobile landscape.

Files:

- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx`
- `apps/frontend/src/components/canvas/panels/AddComputedNodeMenu.tsx`
- New shared component candidate: `apps/frontend/src/components/ui/ResponsiveActionMenu.tsx`

Implementation:

- Create a shared responsive menu primitive.
- Desktop/tablet: collision-aware popover with clamped x/y and internal scroll.
- Mobile/short height: bottom sheet or full-screen drawer with header, close button, and scroll body.
- Reuse the primitive for Tools and Analyze.
- Prevent menu open from shifting the canvas/toolbar left.

Acceptance:

- Tools and Analyze are fully usable at all tested breakpoints.
- No menu extends beyond viewport without internal scroll.
- Every mobile menu has a visible title and close control.

Tests:

- Add `e2e/canvas-popover-placement.spec.ts`.
- Extend `e2e/canvas-toolbar-dropdowns.spec.ts`.
- Re-run responsive QA artifact script.

### P0-04 - Auto-Layout Shape And Edge Preservation

Problem:

- Auto-arrange can create a very tall vertical stack.
- Edges can disappear or become unreadable after auto-layout/focus mode.

Files:

- `apps/frontend/src/hooks/useAutoLayout.ts`
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Existing tests: `apps/frontend/src/hooks/useAutoLayout.test.ts`, `e2e/canvas-deep-layout.spec.ts`

Implementation:

- Add layout presets: layered LR, layered TB, compact grid, clustered.
- Choose preset from node count, edge density, viewport aspect ratio, and selected node count.
- Cap rank/column height and wrap dense layouts into multiple columns.
- Trigger fit after layout animation completes.
- Refresh React Flow internals after layout if edge rendering lags.

Acceptance:

- 50+ node graph does not become a single vertical column.
- Edge count remains visible after auto-layout, fit, focus mode, and select-all.
- Layout remains usable in dark mode.

Tests:

- Add `e2e/canvas-auto-layout-visual.spec.ts`.
- Extend `useAutoLayout.test.ts` for wrapping behavior.
- Re-run `node test-results/live-visual-stress-pass.mjs`.

## P1 Tickets

### P1-01 - Modal Accessibility Pass

Problem:

- Several modal close buttons are icon-only/unnamed.
- Code Weighting has many unnamed buttons.

Files:

- Modal components under `apps/frontend/src/components/canvas/panels/`
- `apps/frontend/src/components/canvas/panels/KeyboardShortcutsModal.tsx`
- `apps/frontend/src/components/canvas/panels/CodeWeightingPanel.tsx`

Implementation:

- Add `aria-label="Close"` to all icon close buttons.
- Add named labels for rating/star buttons.
- Standardize `role="dialog"`, `aria-modal="true"`, and labelled headings.
- Ensure `Escape` and close button both work.

Acceptance:

- Every modal can be closed by `getByRole('button', { name: 'Close' })` or equivalent.
- No unnamed interactive buttons in modal QA except intentionally decorative elements.

Tests:

- Add `e2e/canvas-modal-accessibility.spec.ts`.
- Re-run `node test-results/live-visual-modal-pass.mjs`.

### P1-02 - Research Calendar Legacy Auth State

Problem:

- Calendar shows spinner/401 under legacy access-code auth.

Files:

- `apps/frontend/src/components/canvas/panels/CalendarPanel.tsx`
- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx`
- `apps/frontend/src/services/api.ts`
- `apps/backend/src/routes/calendarRoutes.ts`

Implementation:

- Detect legacy auth before opening Calendar.
- Either hide Calendar for legacy users or show a clear email-auth required state.
- Avoid repeated failing calls when feature is unavailable.

Acceptance:

- Legacy access-code users never see indefinite spinner.
- Email-auth users can still use Calendar.

Tests:

- Add `e2e/canvas-auth-gated-tools.spec.ts`.

### P1-03 - Telemetry Route Mismatch

Problem:

- Frontend `POST /api/v1/events/track` returns `405` in production.

Files:

- `apps/frontend/src/utils/analytics.ts`
- `apps/backend/src/routes/eventsRoutes.ts`
- Deployment/proxy config, if route is hosted outside the frontend app.

Implementation:

- Decide one canonical event endpoint.
- Route `/api/v1/events/track` to backend `/events/track`, or change frontend to the deployed backend route.
- Make analytics failures non-noisy and non-blocking.

Acceptance:

- No `405` telemetry failures during browser QA.
- Analytics calls do not show console errors if network is unavailable.

Tests:

- Add an API smoke check.
- Include telemetry assertion in post-deploy smoke.

### P1-04 - Minimap Flicker

Problem:

- Minimap late-paints and causes visual flicker in repeated screenshots.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/index.css`

Implementation:

- Render minimap only after React Flow bounds are known.
- Fade minimap in deliberately after ready state.
- Hide shell during first layout settle.

Acceptance:

- Repeated idle frame hashes are stable after initial render.
- No blank minimap shell appears before contents.

Tests:

- Re-run stress/responsive artifact scripts and compare stability sections.

## P2 Tickets

### P2-01 - Low-Zoom Overview Mode

Problem:

- Low zoom fits the graph but makes labels unreadable.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Node components under `apps/frontend/src/components/canvas/nodes/`

Implementation:

- Add overview zoom tier.
- Show cluster labels, node type counts, and high-level group boundaries at low zoom.
- Preserve search highlights in overview mode.

Acceptance:

- At 15 percent zoom, graph structure is understandable without reading every node.
- Search results remain visually obvious.

### P2-02 - High-Count Selection Affordance

Problem:

- Select-all at low zoom floods the graph with handles.

Files:

- `apps/frontend/src/components/canvas/panels/SelectionToolbar.tsx`
- Node/selection styling in `CanvasWorkspace.tsx` and CSS.

Implementation:

- When selected node count exceeds a threshold or zoom is low, show group outline/count instead of per-node handles.
- Restore per-node handles when zoomed in.

Acceptance:

- Selecting 50+ nodes remains readable at overview zoom.

### P2-03 - Onboarding Surface Sequencing

Problem:

- First-run checklist/AI surfaces compete with the graph.

Files:

- Onboarding components under `apps/frontend/src/components/onboarding/`
- `apps/frontend/src/components/PlanWelcome.tsx`
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`

Implementation:

- Show only one coaching surface at a time.
- Avoid covering graph controls on small screens.
- Tie onboarding prompts to the lifecycle email/training plan.

Acceptance:

- New-user first canvas opens with one clear next action, not multiple overlays.

### P2-04 - Canvas Navigation Model

Problem:

- Large canvases need more than pan/zoom and Fit View; users need recoverable orientation.
- Current QA shows blank/offscreen mobile states and inconsistent fit behavior after resize/orientation.

Benchmark basis:

- Miro, FigJam/Figma, Obsidian Canvas, and ComfyUI all expose explicit navigation recovery through fit, selection, shortcuts, minimaps, pages, or sidebars.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- `apps/frontend/src/components/canvas/panels/CanvasSearchOverlay.tsx`
- New component candidate: `apps/frontend/src/components/canvas/panels/CanvasNavigatorPanel.tsx`

Implementation:

- Add Home View as a named, persistent viewport anchor.
- Add Fit Selection and Jump To Selection controls.
- Add Jump To Next Search Result and Jump To Section controls.
- Add saved named views/bookmarks with clear visible affordances.
- Add an outline/navigator panel listing sections, search results, codes, transcripts, memos, and presentation path items.

Acceptance:

- Users can recover from any pan/zoom state with one visible control.
- Search result navigation recenters the graph without losing context.
- Saved views survive reload and do not conflict with Fit View.

### P2-05 - Graph Hygiene Toolkit

Problem:

- Dense graphs need organization tools beyond auto-layout; otherwise edges become visual noise.
- The current canvas has no explicit way to route, label, summarize, or diagnose graph complexity.

Benchmark basis:

- Blender and ComfyUI use reroutes/groups; Node-RED exposes inline health/status; Cytoscape emphasizes layout choice by graph structure.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Node and edge components under `apps/frontend/src/components/canvas/`
- Layout utilities under `apps/frontend/src/hooks/useAutoLayout.ts`

Implementation:

- Add reroute/waypoint nodes or edge waypoints for complex connections.
- Add orthogonal edge style and edge label visibility tiers.
- Add edge opacity/bundling controls for dense overview states.
- Add graph health indicators for offscreen nodes, stale analyses, disconnected nodes, unlabeled relations, and export readiness.
- Add a diagnostics panel that explains what needs attention and can jump to each issue.

Acceptance:

- Dense graphs have a readable hygiene mode without deleting or hiding core evidence.
- Users can identify stale, disconnected, or problematic graph areas directly from the canvas.
- Graph health actions deep-link to affected nodes/edges.

### P2-06 - Sections, Subgraphs, And Analysis Blocks

Problem:

- The canvas currently depends too much on whole-graph operations.
- Research work naturally needs phases, clusters, reusable workflows, and collapsible complexity.

Benchmark basis:

- ComfyUI subgraphs, Node-RED subflows, Blender node groups, and FigJam sections all solve dense-workspace complexity by packaging related objects.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas persistence models and API routes for nodes/edges/groups.
- New component candidates under `apps/frontend/src/components/canvas/sections/`

Implementation:

- Add section containers with title, description, color, and optional Markdown notes.
- Add collapse/expand section behavior.
- Add Convert Selection To Section and Convert Section To Analysis Block actions.
- Add reusable analysis block templates for common qualitative workflows.
- Add breadcrumbs for nested section/subgraph editing.

Acceptance:

- Users can reduce a dense graph to meaningful named sections without losing detail.
- Collapsed sections still show counts, health, and summary status.
- Analysis blocks can be reused in another canvas or from a template.

### P2-07 - Contextual Add And Command System

Problem:

- Toolbar-heavy creation does not scale to large canvases or mobile review.
- Users need fast ways to add research objects from the cursor, an edge, a selection, or search.

Benchmark basis:

- Node-RED Quick Add, ComfyUI quick search, n8n command bar, and Figma-style keyboard workflows reduce friction in large visual tools.

Files:

- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx`
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Existing command/search components, if present.
- New component candidate: `apps/frontend/src/components/CommandPalette.tsx`

Implementation:

- Add cursor/double-click Quick Add for transcript, code, memo, note, analysis, relation, and section.
- Add edge-drag suggestions for creating a relation, memo, or computed analysis.
- Add selection-based actions: summarize, code, memo, group, focus, export, share, hide, mark tentative, and create training task.
- Add command palette search across commands, nodes, codes, transcripts, memos, training, and help.
- Track recently used commands per user.

Acceptance:

- Frequent canvas actions can be completed without opening toolbar dropdowns.
- Quick Add places new nodes in visible context and never offscreen.
- Command palette results are keyboard accessible.

### P2-08 - Canvas-As-Research-Story

Problem:

- QualCanvas should not only display graph objects; it should help users turn evidence into a coherent research narrative.
- Current presentation mode is useful, but the graph needs stronger links to reports, stakeholder review, training, and lifecycle email destinations.

Benchmark basis:

- n8n sticky notes, Obsidian durable cards, FigJam sections, and Miro presentation/review patterns all make visual workspaces easier to explain to others.

Files:

- Presentation/report components under `apps/frontend/src/components/`
- Canvas node components and memo/note surfaces.
- Future training destination pages.

Implementation:

- Add a presentation path that can be assembled from selected sections/nodes.
- Add report narrative sections derived from canvas sections and memos.
- Add "Explain this section" generated notes for analysis blocks.
- Add stakeholder view that shows themes, evidence, confidence, and open questions.
- Add training course cards that can be deep-linked from onboarding and lifecycle email.

Acceptance:

- A user can move from canvas exploration to shareable story without manually recreating structure.
- Generated explanations are editable and cite their source nodes.
- Email/training CTAs can deep-link to exact canvas state, section, or task.

### P2-09 - Analysis State, Lineage, And Auditability

Problem:

- AI-assisted analysis can become stale when evidence, codes, prompts, or model settings change.
- Users need visible trust signals and provenance for research claims.

Benchmark basis:

- KNIME traffic-light execution state, Dataiku Flow lineage/explanations, Flowise tracing/evaluation, and Retool block-level logs.

Files:

- Canvas node/edge persistence models.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Analysis/report/export services.
- New component candidate: `apps/frontend/src/components/canvas/panels/CanvasAuditPanel.tsx`

Implementation:

- Add node and section states: new, needs review, stale, failed, validated, export-ready.
- Track lineage from transcript evidence to codes, themes, summaries, reports, and exports.
- Mark downstream artifacts stale when source evidence or analysis settings change.
- Add AI run logs for generated codes, summaries, themes, and reports.
- Add "What changed since last review/export?" panel.

Acceptance:

- Editing a transcript or code marks affected analysis outputs as stale.
- Users can jump from a report claim to supporting source nodes.
- AI-generated outputs expose run metadata and review status.

### P2-10 - Dual Edit, Review, And Present Modes

Problem:

- Dense editing UI is not suitable for stakeholders, mobile users, or training journeys.
- Presentation mode should be integrated with graph state instead of acting as a separate surface.

Benchmark basis:

- Max/MSP presentation mode, Miro/FigJam review workflows, and Obsidian durable canvas cards.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Presentation/report components under `apps/frontend/src/components/`
- Route/state handling for canvas mode.

Implementation:

- Define canvas modes: Edit, Review, Present.
- Keep all modes backed by the same graph data.
- Review mode emphasizes comments, evidence, claims, confidence, and open questions.
- Present mode follows a curated path through sections/nodes.
- Mobile defaults to Review mode for dense canvases and offers desktop handoff for full editing.

Acceptance:

- Stakeholders can review a graph without dense editing controls.
- Presentation path remains linked to current graph nodes and sections.
- Mobile opens a useful review state instead of a clipped desktop editor.

### P2-11 - AI Scaffold Preview And Template Library

Problem:

- Blank canvases are hard for new users.
- AI-generated changes are risky if applied without preview.
- Research setup work is repeated across projects.

Benchmark basis:

- Dify/Langflow/Flowise templates and reusable components, Zapier Canvas AI planning, TouchDesigner OP Snippets, and KNIME reusable components.

Files:

- Template/training surfaces.
- Canvas creation flows.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- New component candidates under `apps/frontend/src/components/templates/`

Implementation:

- Add templates for thematic analysis, framework analysis, case comparison, literature synthesis, open-text survey coding, and stakeholder report.
- Add insertable snippets for import setup, coding loop, memo synthesis, case comparison, and report path.
- Add AI scaffold preview that proposes nodes/sections/edges and shows a diff before applying.
- Add dependency checks for missing transcripts, codes, prompts, models, integrations, permissions, and template versions.
- Add template versioning and upgrade prompts.

Acceptance:

- Users can create a useful first canvas from a guided template.
- AI scaffold changes can be edited, rejected, or applied explicitly.
- Missing dependencies are explained before insertion.

### P2-12 - Spatial Landmarks And Offscreen Awareness

Problem:

- Large graph users need orientation help beyond minimap and Fit View.
- Search results, stale nodes, selected nodes, comments, and failed analyses can be offscreen with no clear route back.

Benchmark basis:

- HCI research on offscreen proxies, visual references/contours, focus+context, overview+detail, and search-plus-context graph exploration.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas edge/node rendering utilities.
- Search overlay and future navigator panel.

Implementation:

- Add persistent section contours/background landmarks visible at low zoom.
- Add offscreen indicators for selected nodes, search results, stale nodes, failed analyses, and open comments.
- Add an important-object compass for next result/issue/section.
- Add search-plus-context mode that expands the local neighborhood around a result.
- Add expand-on-demand controls for dense graph exploration.

Acceptance:

- Users can navigate to selected/search/stale/commented objects without random pan/zoom.
- Low zoom shows landmarks and section meaning.
- Orientation improvements are validated with task-based QA scripts and screenshots.

### P2-13 - Formal Visual Grammar And Typed Research Links

Problem:

- More canvas features will make edges ambiguous unless the product has a formal graph language.
- Research relations have different meanings: coding, evidence support, contradiction, memo reference, AI dependency, review, training, export, and calendar links.

Benchmark basis:

- Dynamo typed ports/status, LabVIEW connector panes, Grasshopper data structures, ATLAS.ti first-class/second-class links, MAXQDA relation views, Substance frames, and Nuke backdrops.

Files:

- Canvas node/edge models and persistence schema.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Edge rendering utilities.
- Analysis/report/export services that read graph relations.

Implementation:

- Define canonical node, edge, port, section, badge, and state types.
- Add typed port compatibility rules.
- Add explicit edge categories and visual treatments for coding, evidence, dependency, memo, contradiction, claim, review, training, export, and calendar links.
- Add relation metadata: direction, confidence, author, created/modified time, comment, source, generated/manual flag, and review state.
- Add validation for invalid edge combinations and missing required inputs.

Acceptance:

- Users can visually distinguish the main research relation types without opening a side panel.
- Invalid analysis blocks produce actionable port-level validation.
- Relation metadata survives export/import and appears in audit/provenance views.

### P2-14 - Non-Destructive Perspectives, Filters, And Scenes

Problem:

- Users need to inspect subsets of large research graphs without deleting or permanently hiding objects.
- Stakeholders, reviewers, trainers, and admins need different graph projections.

Benchmark basis:

- Gephi filter pipelines over graph copies/views, Neo4j Bloom perspectives/scenes, and Dataiku Flow zones/views.

Files:

- Canvas state/persistence models.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Search/filter components.
- New component candidate: `apps/frontend/src/components/canvas/panels/CanvasPerspectivesPanel.tsx`

Implementation:

- Add non-destructive filters for code, case, tag, participant, date, owner, research question, analysis state, and review state.
- Add saved scenes that persist filter, layout, viewport, selection, visible sections, and presentation path state.
- Add role-specific perspectives: researcher, reviewer, stakeholder, trainer, admin.
- Add table/data companion view for nodes, excerpts, codes, themes, claims, relations, and exports.
- Add visible filtered-state indicators and one-click return to full graph.

Acceptance:

- Switching views never mutates the underlying full canvas.
- Saved scenes reload with stable filter, layout, viewport, and selection.
- Stakeholder/reviewer perspectives expose appropriate actions only.

### P2-15 - CAQDAS-Grade Research Maps And Evidence Snapshots

Problem:

- QualCanvas needs qualitative analysis visualizations, not only node editor mechanics.
- Published insights need stable snapshots while remaining linked to evolving source evidence.

Benchmark basis:

- MAXQDA Code Map, Code Matrix Browser, MAXMaps, ATLAS.ti networks, and Dovetail Canvas/Insights.

Files:

- Coding/theme/query services.
- Canvas visualization components.
- Report/insight/presentation components.
- New component candidates under `apps/frontend/src/components/research-maps/`

Implementation:

- Add code co-occurrence and code similarity map modes.
- Add document/case similarity map mode.
- Add code-by-case matrix and code relation browser views.
- Add point-in-time insight snapshots linked to source evidence.
- Add navigation from map clusters/matrix cells to raw excerpts and graph nodes.
- Generate cluster/theme titles as draft suggestions with review state.

Acceptance:

- Users can discover code, document, and theme patterns without manually arranging every object.
- Map and matrix elements deep-link to source evidence.
- Published insights stay stable and show when underlying source evidence changed.

### P2-16 - Observable Analysis Run Mode

Problem:

- AI-generated coding, summaries, themes, reports, imports, exports, and emails need traceable execution.
- Users need to debug failed or suspicious outputs without guessing which step caused the issue.

Benchmark basis:

- Alteryx Results, Power Automate run history, n8n executions/error workflows, UiPath debugging, and LangGraph/LangSmith execution/state traces.

Files:

- Analysis generation services.
- Import/export/report services.
- Canvas node/edge provenance models.
- New component candidate: `apps/frontend/src/components/canvas/panels/RunInspectorPanel.tsx`

Implementation:

- Record per-node/per-step run status, inputs, outputs, timing, errors, retries, and review decisions.
- Store prompt/model/template versions for AI-assisted runs.
- Add Run Inspector panel for selected generated nodes, sections, reports, imports, exports, and email jobs.
- Add rerun-from-node where dependency state allows it.
- Add compare-run view for prompt/model/template changes.
- Add approval breakpoints for bulk recoding, report publish, stakeholder share, and lifecycle email send.
- Add redacted run-log mode.

Acceptance:

- Users can inspect how a generated research output was produced.
- Failed runs focus the affected canvas object and expose actionable details.
- Run metadata remains useful when sensitive content is redacted.

### P2-17 - Collaboration, Version History, And Branching

Problem:

- Multi-user research work needs safe experimentation and recovery.
- AI/template changes, recoding, and report revisions should be reviewable before altering the main canvas.

Benchmark basis:

- Figma branching/version history, Miro board history/restore, tldraw collaboration/session state, Yjs Awareness, and Automerge local-first conflict handling.

Files:

- Canvas persistence/sync models.
- Collaboration/presence infrastructure, if present.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- New component candidate: `apps/frontend/src/components/canvas/panels/CanvasHistoryPanel.tsx`

Implementation:

- Add named versions and restore-as-copy.
- Add deleted-object recovery for nodes, edges, sections, comments, insights, and presentation paths.
- Add branch/merge workflow for major recoding, AI analysis changes, template upgrades, and report revisions.
- Add object-level history for research-critical objects.
- Add collaborator presence, live selections, section edit indicators, and follow mode.
- Separate durable graph state from per-user session state such as viewport, selection, and panel layout.

Acceptance:

- Users can recover deleted content and prior versions without overwriting current work.
- Branch changes can be reviewed and merged explicitly.
- Presence/follow-mode does not pollute research audit history.

### P2-18 - Data Preview And Research Quality Panels

Problem:

- Users need to inspect source evidence, metadata, and quality warnings from the graph.
- Hidden data issues can propagate into generated themes, claims, reports, and emails.

Benchmark basis:

- Tableau Prep profile/data grid, Alteryx Results/Browse, RapidMiner repository/results views, and KNIME/Dataiku lineage views.

Files:

- Canvas node/detail panels.
- Transcript/code/theme/report services.
- New component candidate: `apps/frontend/src/components/canvas/panels/ResearchPreviewPanel.tsx`

Implementation:

- Add selected-node preview for excerpts, code assignments, memos, summaries, themes, claims, reports, exports, and email/training tasks.
- Add before/after comparison for transformed or AI-generated outputs.
- Add metadata panel for speaker, participant, source, tags, timestamps, coding count, owner, and review state.
- Add quality warnings for empty evidence, duplicate excerpts, missing speaker, uncoded material, stale analysis, low confidence, unsupported claims, and missing consent labels.
- Add data-grid companion view for nodes, excerpts, codes, themes, claims, relations, snapshots, and run metadata.

Acceptance:

- Users can inspect evidence and output quality without leaving the canvas.
- Quality warnings jump to affected graph objects.
- Reports/exports surface unsupported or stale claims before publish.

### P2-19 - Accessible Graph Navigator And Non-Drag Controls

Problem:

- The canvas is a visual graph, but important graph tasks should not require visual dragging.
- Keyboard and screen-reader users need a semantic representation of sections, nodes, links, evidence paths, stale outputs, and unresolved issues.

Benchmark basis:

- WCAG 2.2 dragging/target-size guidance, WAI-ARIA drag/drop guidance, Chart Reader, Benthic, and TADA accessible node-link research.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas search/navigator panels.
- Canvas keyboard hooks.
- New component candidate: `apps/frontend/src/components/canvas/panels/AccessibleGraphNavigatorPanel.tsx`

Implementation:

- Add semantic graph outline by section, node, relation, search result, stale state, comment, report, and unresolved issue.
- Add keyboard traversal commands for next connected node, upstream evidence, downstream claims, next issue, and return to selected neighborhood.
- Add non-drag graph actions: move selected node to section, connect selected nodes, group selection, reorder presentation path, and send to saved view.
- Add screen-reader summaries for selected node, relation type, neighborhood, evidence path, review state, stale state, and next recommended action.
- Add accessible table views for evidence, relations, node metadata, and selected graph path.

Acceptance:

- Core graph tasks can be completed without pointer dragging.
- Screen-reader users can understand the selected node neighborhood and evidence/claim path.
- Playwright/a11y coverage includes graph traversal and non-drag graph actions.

### P2-20 - Touch, Pen, And Cross-Device Interaction Model

Problem:

- Phone, tablet, pen, keyboard, and desktop workflows need explicit behavior instead of one compressed desktop UI.
- Touch review and pen annotation will be fragile unless gesture conflicts are designed and tested.

Benchmark basis:

- FigJam for iPad, Apple drag/drop guidance, and Microsoft touch target guidance.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas toolbar and mobile shell components.
- Canvas CSS/touch event handling.
- New utility candidate: `apps/frontend/src/components/canvas/inputMode.ts`

Implementation:

- Define input modes for mouse/keyboard edit, touch review, pen annotation, and keyboard/screen-reader navigation.
- Add touch-safe targets and spacing for mobile/tablet review.
- Add precision select for dense graphs on touch devices.
- Add pen annotations for memos, evidence highlights, path annotations, and stakeholder review comments.
- Add gesture conflict rules and tests for pan, zoom, select, drag, draw, browser gestures, and toolbar/menu controls.

Acceptance:

- Mobile/tablet review uses a purpose-built interaction model, not clipped desktop controls.
- Pen annotations persist as first-class comments or memos attached to graph objects.
- QA recordings show stable pan/zoom/select/draw behavior without gesture collisions.

### P2-21 - Diagram-Grade Connector, Layout, And Layer Controls

Problem:

- Current graph work is too dependent on whole-canvas auto-layout and default edge rendering.
- Users need explicit control over relation paths, labels, layers, and layout intent without corrupting the research model.

Benchmark basis:

- draw.io connector/layer/layout controls, yEd automatic layout families, and Graphviz layout engines.

Files:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx`
- Canvas edge/connector components.
- Canvas layout utilities.
- New panel candidate: `apps/frontend/src/components/canvas/panels/DiagramControlsPanel.tsx`

Implementation:

- Add connector controls for labels, relation type, style, opacity, waypoints, line jumps, routing mode, evidence count, confidence, and review state.
- Add graph layers for evidence, codes, themes, AI outputs, comments, review decisions, reports, and lifecycle email/training objects.
- Add layer hide/show/lock and role-aware default visibility.
- Add layout preview, cancel, apply, and undo flows.
- Add layout presets by research intent: evidence-to-theme, theme-to-claim, timeline, participant journey, code co-occurrence, report narrative, and dependency graph.
- Preserve manual layout anchors during automatic layout.

Acceptance:

- Users can route, label, and style important relations without editing raw graph data.
- Layout changes can be previewed and undone.
- Layers can be hidden, shown, or locked without data loss.

### P2-22 - Facilitated Research Review Sessions

Problem:

- Stakeholder review is currently treated like generic access to the canvas, but review is a structured meeting workflow.
- Reviewers need safe participation controls that do not expose restricted evidence or allow accidental canvas damage.

Benchmark basis:

- Mural facilitation tools, Miro workshop facilitation, FigJam timer/voting, and Apple Freeform cross-device capture/collaboration.

Files:

- Canvas review/presentation mode components.
- Collaboration/presence components.
- Permission and stakeholder-safe view logic.
- New component candidate: `apps/frontend/src/components/canvas/review/ResearchReviewSession.tsx`

Implementation:

- Add review session mode with agenda frames, activity timer, facilitator controls, participant follow/summon, and guest onboarding.
- Add evidence reveal/hide controls for stakeholder-safe sessions.
- Add private voting/ranking on themes, claims, quotes, recommendations, and next actions.
- Add object locking and facilitator-only edit controls.
- Capture session output as decisions, objections, unresolved questions, assigned actions, and follow-up training/email triggers.

Acceptance:

- Stakeholders can join, orient, review, vote/rank, and leave decisions/actions without needing full edit mode.
- Facilitators can guide attention and protect restricted evidence.
- Session output is stored as structured graph data.

### P2-23 - Systems-Map Analytics And Visual Query Cards

Problem:

- Dense research graphs need analytical overlays and reusable questions, not only manual search and pan/zoom.
- Different audiences need different interpretations of the same graph without duplicating the canvas.

Benchmark basis:

- Kumu metrics/views/partial views, Linkurious visual query workflow, and TheBrain networked notes/backlinks/search.

Files:

- Graph query/search utilities.
- Canvas filter/perspective state.
- Canvas analytics services.
- New component candidate: `apps/frontend/src/components/canvas/panels/VisualQueryPanel.tsx`

Implementation:

- Add analytics overlays for centrality, reach, bridge themes, isolated evidence, duplicate clusters, community detection, unsupported claims, and stale outputs.
- Add saved query cards for common research questions, including upstream evidence, stale AI outputs, unsupported claims, participant drivers, and new evidence since last review.
- Add selection-based suggested queries to node, edge, section, report, and review context menus.
- Add partial/perspective views for analysis, stakeholder, teaching, audit, and lifecycle/email training contexts.
- Add relation/backlink previews for connected notes, excerpts, decisions, files, external assets, and report sections.
- Add query ownership, permissions, changelog, and admin raw-query view.

Acceptance:

- Users can answer common research graph questions from query cards without visually hunting.
- Perspective views reuse the same graph model and do not fork data silently.
- Query cards are permissioned and auditable.

### P2-24 - Research Advisor, Impact Analysis, And Canvas Test Harnesses

Problem:

- High-risk graph operations need preflight checks before users rerun AI, publish reports, share evidence, apply major layouts, or send lifecycle emails.
- Templates and lifecycle journeys need dry-run validation before release.

Benchmark basis:

- Simulink Model Advisor, Simulink Dependency Analyzer, Simulink Test, and Unreal Blueprint debugging/search.

Files:

- Canvas validation and graph health utilities.
- AI/run history services.
- Template and lifecycle journey services.
- New component candidates: `ResearchAdvisorPanel.tsx`, `CanvasImpactAnalysisPanel.tsx`, `CanvasTestHarnessPanel.tsx`

Implementation:

- Add Research Advisor checks for unsupported claims, stale outputs, missing evidence, missing consent, broken imports, hidden auth failures, inaccessible objects, incomplete review gates, and publish/send readiness.
- Add impact analysis before edit, layout, AI rerun, report publish, stakeholder share, and lifecycle email send operations.
- Add template and lifecycle journey test harnesses using sample data, generated outcome previews, and expected-output comparison.
- Add debugger affordances for AI/research flows: breakpoints before bulk recoding, watched outputs, step-through transformations, and active data-path inspection.
- Add search/index health checks shared by graph search, accessible navigator, query cards, and report exports.

Acceptance:

- High-risk operations show advisor and impact results before execution.
- Templates/lifecycle journeys can be dry-run in staging without real sends or user-visible changes.
- Debugging/watch output explains how a graph result, report, or email was produced.

### P2-25 - Enterprise Governance, Admin, And Compliance Layer

Problem:

- Organization-wide research use needs admin controls, auditability, content classification, and policy enforcement.
- Sensitive projects cannot safely scale sharing, exports, AI, integrations, or lifecycle emails without a governance layer.

Benchmark basis:

- Figma organization activity logs/admin controls, Miro audit logs and Enterprise Guard, and Dovetail governed research evidence access.

Files:

- Organization/workspace admin surfaces.
- Permission and sharing services.
- Audit/event logging services.
- New component candidates: `EnterpriseGovernancePanel.tsx`, `ContentClassificationBanner.tsx`, `AccessReviewDashboard.tsx`

Implementation:

- Add organization/workspace roles, teams, guests, domain restrictions, default sharing rules, and lifecycle email permissions.
- Add audit logs for organization, canvas, section, object, template, report, lifecycle email, AI run, and integration events.
- Add content classification for transcripts, excerpts, AI outputs, reports, canvases, exports, and lifecycle emails.
- Add policy controls for external sharing, stakeholder review, public links, export/download, AI use, API tokens, and email audiences.
- Add admin dashboards for access review, sensitive content, external shares, AI usage, integration health, and lifecycle email activity.

Acceptance:

- Admins can answer who accessed/shared/exported/changed/sent what, when, and under which policy.
- Sensitive projects can block or require approval for export, public sharing, AI use, and lifecycle emails.
- Audit logs can be queried from product surfaces and APIs.

### P2-26 - Reproducible Research Publishing And Live Reports

Problem:

- Reports, decks, exports, and stakeholder views risk becoming disconnected from the evidence graph.
- Research outputs need reproducibility metadata and regeneration paths.

Benchmark basis:

- Observable notebooks, Quarto publishing, Jupyter notebook/export conventions, and research reproducibility expectations.

Files:

- Report/export services.
- Canvas snapshot/version services.
- AI run/provenance services.
- New component candidates: `ResearchPacketBuilder.tsx`, `LiveReportBlock.tsx`, `RegenerationDiffPanel.tsx`

Implementation:

- Add Research Packet artifact with frozen canvas view, narrative report, evidence table, code/theme summaries, run history, AI versions, permissions, redactions, and export manifest.
- Add live report blocks linked to graph nodes that show stale state when evidence, filters, prompts, or review decisions change.
- Add reproducibility manifests for source data, transformations, AI versions, filters, redactions, reviewer approvals, and generated outputs.
- Add publish targets: internal live report, stakeholder-safe web view, PDF/DOCX, slide deck, CSV/JSON evidence appendix, and notebook-style export.
- Add regenerate-from-graph with diff preview before replacing published artifacts.

Acceptance:

- A report can be traced back to exact graph state, evidence, filters, AI settings, and reviewer approvals.
- Stale report sections are visible after source evidence changes.
- Regeneration shows diffs before replacing stakeholder-visible outputs.

### P2-27 - Evidence-Centric Journey And Service Blueprint Views

Problem:

- Research findings often need to become journeys, service blueprints, opportunities, solutions, and executive summaries.
- These views should be projections of the graph, not separate disconnected documents.

Benchmark basis:

- TheyDo journey/opportunity/solution linkage, Smaply journey/persona/stakeholder maps, UXPressia journey/service-blueprint/persona tooling, and Dovetail evidence clips.

Files:

- Canvas perspective/view-mode state.
- Evidence and quote/video clip models.
- Report/dashboard services.
- New component candidates: `JourneyMapView.tsx`, `ServiceBlueprintView.tsx`, `EvidenceClipPin.tsx`, `ExecutiveJourneyDashboard.tsx`

Implementation:

- Add journey and service-blueprint views with phases, touchpoints, actions, emotions, pain points, channels, backstage processes, opportunities, solutions, owners, and metrics.
- Allow transcript excerpts, quote clips, video/audio moments, codes, and themes to be pinned to journey steps.
- Link opportunities and solutions to recommendations, roadmap items, training tasks, and lifecycle email journeys.
- Add persona-specific overlays and multi-persona comparisons without duplicating evidence.
- Add executive journey dashboards that roll up evidence, owners, metrics, risk, and decision status.

Acceptance:

- Journey/service-blueprint objects preserve source evidence links and graph provenance.
- Persona overlays and executive dashboards reuse the same evidence graph.
- Opportunities/solutions can be traced from insight to owner, metric, recommendation, and follow-up action.

### P2-28 - AI-Assisted Canvas Authoring And Critique

Problem:

- AI generation can accelerate research work but must not silently mutate evidence or create unsupported claims.
- Users need source-grounded proposals and critique tools.

Benchmark basis:

- Miro AI diagram/doc/table/sticky/clustering features, Figma AI text/layer/image assistance, and Smaply AI journey creation.

Files:

- AI action services.
- Canvas proposal/review state.
- Research Advisor and provenance services.
- New component candidates: `AICanvasProposalPanel.tsx`, `AICritiquePanel.tsx`, `AIAuthoringControls.tsx`

Implementation:

- Add AI proposal actions for drafting from selected evidence, clustering themes, naming sections, suggesting relation labels, generating journey maps, drafting report sections, and creating training/email follow-ups.
- Add AI critique actions for unsupported claims, missing evidence, duplicate themes, overclaiming, stale outputs, weak recommendations, and missing consent labels.
- Store AI changes as editable proposals with source evidence, confidence, affected nodes, prompt/model/template versions, and reviewer approval.
- Require generated claims, recommendations, reports, and lifecycle emails to cite evidence nodes or show unsupported status.
- Add organization controls to disable, limit, approve, or audit AI authoring by project sensitivity.

Acceptance:

- AI-generated graph changes are proposals until accepted.
- Every generated claim/recommendation/email/report section cites evidence or is marked unsupported.
- Admin controls can disable or approval-gate AI authoring on sensitive projects.

### P2-29 - Integration, Event, And API Platform

Problem:

- Imports, exports, emails, calendar sync, research repositories, and project-management handoffs need reliable event infrastructure.
- External integrations need scopes, health, retries, diff previews, rollback, and audit logs.

Benchmark basis:

- Miro REST APIs/developer platform, Figma REST API, Figma webhooks, and API/webhook platform practices.

Files:

- Integration services.
- Event/audit logging services.
- Import/export adapters.
- API/schema documentation.
- New component candidates: `IntegrationHub.tsx`, `SyncHealthPanel.tsx`, `WebhookEventLog.tsx`, `ImportDiffPreview.tsx`

Implementation:

- Add Integration Hub for calendar, email, research repositories, storage, data warehouses, CRM, project management, communication tools, and future third-party extensions.
- Add event catalog and webhooks for canvas created/updated, evidence imported, code/theme created, report published, review completed, lifecycle email sent, advisor check failed, and integration sync failed.
- Add import/export adapters with field mapping, dry-run, diff preview, retry, rollback, idempotency, and sync health.
- Add OAuth scopes, API tokens, webhook signing, rate limits, permission review, and audit logs.
- Add developer-facing JSON schema/OpenAPI-style documentation for canvas objects, templates, events, reports, and email/training journeys.

Acceptance:

- Connected accounts show health, last sync, failed syncs, retry status, and permission scope.
- Imports/exports can dry-run and show diffs before writing data.
- Webhooks/API calls are scoped, signed, rate-limited, and auditable.

### P2-30 - Lifecycle Messaging And In-Product Education Journey Builder

Problem:

- Signup, inactivity, feature education, training, and reactivation should be governed journeys, not one-off email templates.
- In-app education, sample canvases, checklists, banners, and training courses need to be coordinated with email.

Benchmark basis:

- Braze Canvas, Customer.io Journeys, Intercom Series, and Appcues Flows/Checklists/analytics.

Files:

- Lifecycle email/training services.
- User/workspace/account event model.
- Notification and in-app education surfaces.
- New component candidates: `LifecycleJourneyBuilder.tsx`, `JourneySafeSendPanel.tsx`, `JourneyMetricsPanel.tsx`

Implementation:

- Add entry/exit criteria, branch conditions, delays, goals, suppression, frequency caps, preview, staging, conversion metrics, and version history.
- Add steps for email, in-app guidance, checklists, banners, training courses, product updates, sample canvases, and stakeholder review prompts.
- Add person/workspace/account/project eligibility so journeys target the right audience without duplicate sends.
- Add control groups, A/B tests, activation metrics, and event-based outcomes.
- Add safe-send checks for consent, content classification, unsubscribe/preferences, role visibility, sample recipient preview, dry-run, and rollback.

Acceptance:

- No journey can go live without eligibility, suppression, consent, preview, and safe-send validation.
- Journey outcomes are measured by activation and product behavior.
- Email and in-app education steps share the same event and permission model.

### P2-31 - Durable Orchestration And Job Recovery

Problem:

- Imports, AI runs, exports, reports, syncs, and lifecycle sends can fail or run long.
- Hidden background failures create user distrust and make support difficult.

Benchmark basis:

- Temporal durable execution, Airflow DAGs, Dagster assets/lineage/backfills, and OpenTelemetry instrumentation.

Files:

- Background job services.
- AI/import/export/report/email/sync services.
- Run history and advisor panels.
- New component candidates: `JobRunInspector.tsx`, `ScheduledJobsPanel.tsx`, `BackfillRunPanel.tsx`

Implementation:

- Add durable jobs for imports, AI runs, exports, reports, calendar sync, lifecycle journeys, and integration sync.
- Add visible job states: queued, running, waiting, retrying, blocked, failed, cancelled, completed, stale, and superseded.
- Add retry policy, timeout, idempotency key, cancellation, resume, rerun-from-step, and rollback behavior.
- Add schedules and backfills for weekly digest, inactivity checks, report refresh, training reminders, and stale-analysis sweeps.
- Emit traces, metrics, logs, and role-aware redacted run history.

Acceptance:

- Failed jobs are visible, inspectable, retryable, cancellable, and recoverable where safe.
- Scheduled/backfilled jobs show who/what/when/why and affected graph objects.
- Job telemetry links frontend action, backend work, and canvas-visible status.

### P2-32 - Research-To-Roadmap Decision Traceability

Problem:

- Research recommendations need ownership, prioritization, roadmap linkage, delivery status, and decision history.
- Stakeholders need to see why a feature, training item, or lifecycle update is justified by evidence.

Benchmark basis:

- Productboard insight-to-feature-roadmap linkage, Jira Product Discovery ideas/insights/plans, and Aha! ideas/prioritization/roadmap workflows.

Files:

- Decision/recommendation models.
- Roadmap/integration services.
- Canvas decision panels.
- New component candidates: `DecisionObjectPanel.tsx`, `PrioritizationView.tsx`, `RoadmapTracePanel.tsx`

Implementation:

- Add decision objects linking evidence, theme, opportunity, recommendation, roadmap item, owner, priority score, confidence, effort, impact, and delivery status.
- Add feedback/insight portals for internal stakeholders to submit evidence, questions, and feature requests tied to graph objects.
- Add prioritization views for impact/effort, evidence strength, participant count, revenue/account importance, risk, urgency, and confidence.
- Add delivery-system links to Jira/Linear/Aha/Productboard-style work items while preserving graph provenance.
- Add decision history for accepted, deferred, rejected, changed, and delivered recommendations.

Acceptance:

- A roadmap item or recommendation traces back to evidence and decision rationale.
- Delivery status updates preserve graph provenance.
- Prioritization views are auditable and explainable.

### P2-33 - Semantic Evidence Graph And Interchange Standards

Problem:

- Canvas data needs stable semantics and provenance if it is exported, imported, shared, or integrated.
- Closed UI-only state will not scale to external graph tools, archives, or compliance review.

Benchmark basis:

- W3C PROV-O, JSON-LD, OpenLineage, and GraphML.

Files:

- Canvas schema and serialization.
- Import/export adapters.
- Provenance/run metadata services.
- New docs/schema candidates: `docs/canvas-schema.md`, `schemas/canvas-evidence-graph.schema.json`

Implementation:

- Define semantic evidence graph schema with stable IDs, typed nodes, typed relations, provenance, permissions, classifications, AI run metadata, and lifecycle outputs.
- Add JSON-LD export for linked research evidence and GraphML export for graph-tool interoperability.
- Map AI/report/email/job lineage to run/job/dataset-style events with extensible facets.
- Add schema migrations, compatibility checks, validation, and versioned manifests for imported/shared canvases.
- Align UI graph state with export/import state so layout, provenance, permissions, and classifications are preserved.

Acceptance:

- Exported/imported canvases preserve graph semantics, layout, provenance, permissions, and classifications.
- Schema/version mismatches produce clear compatibility warnings.
- External graph/provenance exports validate against documented schemas.

### P2-34 - Production UX Observability And Support Loop

Problem:

- Visual failures such as blank canvases, clipped menus, failed fit, flicker, dead clicks, and broken sends need production diagnostics.
- Support and QA need privacy-safe evidence, not user anecdotes.

Benchmark basis:

- Sentry Session Replay, Datadog RUM/Session Replay, Fullstory frustration signals, and OpenTelemetry.

Files:

- Frontend telemetry and event capture.
- Support/debug bundle services.
- Production incident/backlog integration.
- New component candidates: `SupportBundleDialog.tsx`, `UXObservabilityDashboard.tsx`, `CanvasIncidentPanel.tsx`

Implementation:

- Add privacy-aware session replay or replay-like visual event capture for canvas QA, support, and flicker/regression diagnosis.
- Add canvas-specific frustration and quality signals: rage click, dead click, repeated failed drag, blank canvas, clipped menu, flicker, failed fit, failed export, failed send, and unexpected auth gate.
- Add redacted support bundles with canvas state, viewport, browser/device, console/network errors, run IDs, advisor results, and recent user actions.
- Add real-user performance budgets for load, fit, pan/zoom, layout, minimap, AI run start, report publish, and lifecycle send preview.
- Connect production incidents to backlog items with screenshots/replays, affected graph objects, frequency, severity, and owner.

Acceptance:

- Support can reproduce visual/canvas issues from redacted diagnostic bundles.
- Production UX failures produce measurable signals and owners.
- Privacy controls prevent sensitive transcript/evidence leakage in replay or support artifacts.

### P2-35 - Offline/Local-First Collaboration And Conflict Resolution

Problem:

- Field research, workshops, travel, and client environments often have unstable network.
- Collaborative graph edits need conflict handling before canvas work can be trusted for publish, send, share, or roadmap decisions.

Benchmark basis:

- Yjs, Automerge, and tldraw local-first collaboration.

Files:

- Collaboration/sync services and persistence adapters.
- Canvas document/session/presence state boundaries.
- Canvas publish/share/send readiness gates.
- New component candidates: `SyncHealthPanel.tsx`, `ConflictReviewPanel.tsx`, `OfflineChangesDrawer.tsx`

Implementation:

- Separate durable document graph state from transient session and presence state.
- Add offline queue, local snapshot persistence, sync health, last-synced timestamp, and reconnect merge status.
- Add conflict review for code changes, claims, decisions, consent labels, report publish state, and lifecycle journey activation.
- Add offline snapshot migrations and compatibility checks.
- Block publish/send/share while unresolved critical conflicts exist.

Acceptance:

- Users can continue safe edits offline and see exactly what will sync.
- Conflicts are visible and reviewable before publish, send, or share actions.
- Session and presence state do not pollute durable research history.

### P2-36 - Sandboxed Extension Runtime And Plugin Security

Problem:

- Third-party templates, importers, exporters, automations, and AI helpers can expose evidence or mutate canvases if not sandboxed.
- Enterprise adoption needs inspectable permissions, risk metadata, org approval, revocation, and compatibility checks.

Benchmark basis:

- Figma plugin manifests, WASI capability security, and VS Code workspace trust.

Files:

- Template/extension registry services.
- Permission and organization approval services.
- Extension execution/logging sandbox.
- New component candidates: `ExtensionManifestPanel.tsx`, `ExtensionSecurityReview.tsx`, `RestrictedModeBanner.tsx`

Implementation:

- Define an extension manifest schema for author, version, API/schema compatibility, permissions, network domains, data classes, lifecycle hooks, and risk.
- Add capability prompts and organization approval before install or run.
- Add restricted mode for untrusted templates, canvases, and extensions.
- Add execution logs, rate limits, revocation, quarantine, and compatibility scanning.
- Add a redacted sample-canvas test runner for third-party extensions.

Acceptance:

- Extensions cannot access restricted evidence or network domains without declared permission and approval.
- Admins can revoke or quarantine an extension and see affected canvases/templates.
- Third-party extensions pass redacted sample tests before org-wide approval.

### P2-37 - Research Media Ingestion, Transcription, And Evidence Clip Pipeline

Problem:

- Qualitative evidence often arrives as audio, video, transcripts, captions, surveys, PDFs, documents, and meeting recordings.
- Clips, quotes, and highlight reels need source, timestamp, speaker, permission, and redaction metadata.

Benchmark basis:

- Dovetail, ATLAS.ti, and MAXQDA media/transcription workflows.

Files:

- Import services and durable job orchestration.
- Transcript/media/evidence models.
- Evidence panels and report/journey export paths.
- New component candidates: `MediaEvidencePanel.tsx`, `TranscriptReviewPanel.tsx`, `EvidenceReelBuilder.tsx`

Implementation:

- Add imports for audio, video, transcripts, VTT, SRT, surveys, PDFs, documents, and meeting recordings.
- Add transcription jobs with language, vocabulary, diarization, timestamp correction, translation, and human review.
- Add evidence clips that preserve media source, transcript span, timestamp, speaker, code/theme links, consent, redaction, and quote permissions.
- Add highlight reels tied to reports, journeys, training, and lifecycle emails.
- Add quality warnings for low-confidence transcript spans, missing consent, missing speaker, stale translation, and unreviewed AI transcripts.

Acceptance:

- Media clips trace to source, time, speaker, and consent.
- Transcripts can be reviewed and corrected before coding/reporting.
- Reels and exports never expose restricted media by default.

### P2-38 - Hybrid Evidence Search, Retrieval, And Graph RAG

Problem:

- Evidence discovery should work across exact text, tags, metadata, graph relationships, and semantic similarity.
- AI answers and generated reports must explain why evidence was retrieved and cite exact sources.

Benchmark basis:

- Weaviate, Qdrant, Pinecone, and graph-RAG retrieval practices.

Files:

- Search/index services and embedding/reranking configuration.
- Graph query and permission-filter services.
- Evidence/result panels and AI answer inspector.
- New component candidates: `HybridEvidenceSearchPanel.tsx`, `GraphRagAnswerPanel.tsx`, `IndexHealthPanel.tsx`

Implementation:

- Add hybrid text/tag/metadata/graph/vector search with permission filters.
- Add search explanations for keyword match, vector similarity, graph distance, relation type, speaker, recency, and quality.
- Add Graph RAG over selected graph neighborhoods with citations, redaction, and stale-evidence checks.
- Add retrieval eval datasets for common questions and report prompts.
- Add index health, embedding version, chunking strategy, reranker version, and reindex controls.

Acceptance:

- Search results explain why they matched and obey permissions.
- Generated answers cite evidence or mark unsupported claims.
- Index state is visible and rebuildable.

### P2-39 - Model/Provider Operations, Routing, And Cost Controls

Problem:

- AI features need provider reliability, cost visibility, region/data controls, fallbacks, and incident review.
- Model/provider changes can silently affect research outputs, reports, summaries, and lifecycle recommendations.

Benchmark basis:

- Phoenix, Langfuse, Helicone, and OpenRouter model operations.

Files:

- AI provider services and model routing policy.
- AI run inspector, budget/admin services, and incident workflow.
- Telemetry/event models for AI operations.
- New component candidates: `ModelProviderOpsPanel.tsx`, `AICostDashboard.tsx`, `AIIncidentPanel.tsx`

Implementation:

- Log provider, model, prompt, parameters, retrieval context, cost, latency, tokens, failure, retry, fallback, region, and data policy.
- Add provider routing policies for preferred/fallback model, region, BYOK, no-training/data retention, and project sensitivity.
- Add budgets by user, project, organization, AI feature, lifecycle journey, transcription, embedding, and report.
- Add AI incident review for hallucination, unsupported claim, prompt injection, provider outage, cost spike, slow run, and degraded retrieval.
- Add cost/quality dashboards tied to evals and advisor results.

Acceptance:

- AI operations show exact provider, model, cost, latency, and data policy.
- Sensitive projects can restrict providers, regions, and routing.
- Cost spikes and provider failures create actionable incidents.

### P2-40 - Execution Queue, Partial Recompute, And Cache Semantics

Problem:

- Heavy graph operations risk becoming hidden spinners or expensive full-canvas reruns.
- Users need to understand which outputs are fresh, stale, cached, blocked, or failed.

Benchmark basis:

- ComfyUI execution modes, changed-input recompute, validation, queue, and history semantics.

Files:

- Durable job/run services and canvas output state models.
- Canvas stale-state and dependency propagation utilities.
- AI/report/import/export/lifecycle run inspectors.
- New component candidates: `ExecutionQueuePanel.tsx`, `RunHistoryDrawer.tsx`, `CacheInvalidationInspector.tsx`

Implementation:

- Add run queue states for imports, transcriptions, AI analysis, reports, exports, syncs, and lifecycle dry-runs.
- Add dirty-state propagation across evidence, codes, themes, reports, journeys, and lifecycle outputs.
- Add partial recompute from selected node, section, report block, or output.
- Add cache keys and invalidation explanations based on inputs, prompt/model version, evidence version, permissions, redaction policy, and retrieval index version.
- Add queue/history UI with progress, output previews, cancellation, retry, cached, blocked, failed, and cancelled states.

Acceptance:

- Users can see what will run before starting expensive work.
- Changed evidence marks dependent outputs stale without forcing unrelated reruns.
- Cached and recomputed outputs explain why they were reused or invalidated.

### P2-41 - Dataflow Backpressure, Provenance Replay, And Operational Debugging

Problem:

- Imports, transcription, AI runs, report generation, exports, webhooks, and lifecycle sends can overload downstream services.
- Failed work needs replay and failure provenance, not a generic retry button.

Benchmark basis:

- Apache NiFi queue backpressure, provenance search, replay, and flow debugging.

Files:

- Queue/backpressure telemetry services.
- Provenance checkpoint and replay services.
- Canvas support/debug bundle integration.
- New component candidates: `BackpressureOverlay.tsx`, `ReplayCheckpointPanel.tsx`, `OperationalDebuggerPanel.tsx`

Implementation:

- Add visible queue depth and backpressure indicators between heavy graph operations.
- Add replay checkpoints for imports, transcripts, coding passes, report blocks, webhooks, and lifecycle messages.
- Add replay eligibility and cannot-replay explanations for expired content, deleted dependencies, changed permissions, schema migrations, provider changes, or missing integrations.
- Add an operational debugger linking failed canvas outputs to queue item, input evidence, run logs, provider/model, and graph state.
- Add alerts for stalled queues, overloaded projects, blocked provider capacity, and send throttles.

Acceptance:

- Users can distinguish waiting, overloaded, blocked, failed, and replayable work.
- Replays are allowed only when inputs and permissions still make them safe.
- Failed outputs link to exact operational evidence needed for support or repair.

### P2-42 - Product Analytics, Feature Flags, And Engagement Experimentation

Problem:

- Engagement cannot be optimized from signup dates, email opens, or anecdotes alone.
- Canvas, AI, lifecycle, and training improvements need staged rollout and measurable activation impact.

Benchmark basis:

- PostHog, Amplitude, Mixpanel, LaunchDarkly, and Pendo analytics, flags, experiments, cohorts, and in-product guidance.

Files:

- Product analytics/event taxonomy services.
- Feature flag and experiment services.
- Lifecycle journey eligibility and education targeting.
- New component candidates: `ActivationDashboard.tsx`, `FeatureFlagAdminPanel.tsx`, `ExperimentResultsPanel.tsx`

Implementation:

- Define activation milestones: first successful canvas load, first evidence import, first code/theme, first report/share, first invite, first repeat session, and first successful AI-assisted output.
- Add privacy-safe funnels, retention, feature adoption, cohort, and support-friction dashboards.
- Add feature flags and staged rollout controls for major canvas changes, AI features, lifecycle journeys, template marketplace features, and mobile review surfaces.
- Add experiments for onboarding checklists, in-canvas guides, training prompts, email timing, template recommendations, and AI proposal defaults.
- Feed behavior cohorts into lifecycle messaging with suppression, consent, and frequency caps.

Acceptance:

- Lifecycle and training decisions can be tied to activation and retention behavior.
- New risky features can be rolled out, measured, paused, or rolled back.
- Product analytics exclude sensitive research content by default.

### P2-43 - Community Template/Workflow Marketplace Quality And Trust

Problem:

- A template marketplace can accelerate adoption, but untrusted graph logic can leak evidence, break canvases, or create bad research.
- Users need to preview and test templates before importing them into real projects.

Benchmark basis:

- ComfyUI Registry versioning/scanning and n8n template browsing, search, preview, and verified creators.

Files:

- Template marketplace/catalog services.
- Template scanning, signing, dependency, and sandbox import services.
- Organization approval and quarantine controls.
- New component candidates: `TemplateTrustCard.tsx`, `TemplateSandboxPreview.tsx`, `MarketplaceQuarantinePanel.tsx`

Implementation:

- Add template/workflow cards with preview image, graph summary, required integrations, permissions, evidence types, AI providers, version, author, org approval, and risk score.
- Add sandbox try-before-import using sample/redacted data.
- Add verified creator, verified organization, signed package, scan result, install count, rating, deprecation, and compatibility signals.
- Add missing-node/missing-integration detection for imported canvases and workflows.
- Add marketplace abuse reporting, quarantine, dependency lockfiles, and downgrade/rollback paths.

Acceptance:

- Users can inspect what a template needs before importing it.
- Community workflows can be sandboxed and scanned before touching real evidence.
- Admins can quarantine or roll back risky templates and see affected canvases.

### P2-44 - Scientific Workflow Reproducibility And Environment Capture

Problem:

- Research outputs need enough context to rerun, audit, compare, publish, or defend.
- Model, prompt, evidence, integration, feature-flag, and environment drift can silently change outputs.

Benchmark basis:

- Galaxy workflow reuse/publishing, Nextflow/Seqera lineage, and Workflow Run RO-Crate packaging.

Files:

- Reproducibility manifest and run package services.
- Report/export/AI/lifecycle output provenance.
- Research Packet publishing and comparison UI.
- New component candidates: `ReproducibilityManifestPanel.tsx`, `RunPackageInspector.tsx`, `RerunComparisonDialog.tsx`

Implementation:

- Add reproducibility manifests for canvas version, graph schema, template versions, prompts, models, retrieval indexes, integrations, environment, feature flags, evidence checksums, and output checksums.
- Add run packages for reports, exports, AI analyses, lifecycle sends, and research packets.
- Add same-input and current-input rerun comparison paths.
- Add reproducibility warnings when model/provider versions changed, evidence was redacted, content expired, template dependencies changed, or integrations returned different data.
- Add publishable research artifacts that bundle human-readable output with machine-readable provenance.

Acceptance:

- Published outputs carry enough context to audit or reproduce the run.
- Users can compare same-input and current-input reruns.
- Drift warnings appear before reports, exports, or lifecycle decisions are treated as authoritative.

### P2-45 - Data Quality, Contracts, And Evidence Health Gates

Problem:

- AI analysis, reports, lifecycle journeys, and roadmap decisions are only trustworthy if their input evidence meets explicit quality rules.
- Imported data can silently lose fields, change types, duplicate respondents, omit consent, or include restricted content.

Benchmark basis:

- dbt model contracts/data tests and Great Expectations expectation suites/checkpoints.

Files:

- Evidence/source import models and validation services.
- Quality gate services for reports, AI runs, lifecycle sends, and roadmap decisions.
- Validation result storage and review UI.
- New component candidates: `EvidenceContractPanel.tsx`, `ValidationResultsDrawer.tsx`, `QualityGateBanner.tsx`

Implementation:

- Add evidence contracts for source imports, transcripts, survey data, CSVs, CRM data, support tickets, journey events, and lifecycle eligibility data.
- Add validation suites for consent, required metadata, speaker/timestamp integrity, code taxonomy coverage, duplicate respondents, missing segments, PII leakage, and unsupported claims.
- Add quality gates before AI synthesis, report publish, stakeholder export, lifecycle send, and roadmap decision promotion.
- Add validation result panels with failing records, severity, owner, waiver, expiry, and rerun controls.
- Add schema/data-quality drift alerts when imported source shape, field types, or required metadata change.

Acceptance:

- Risky outputs cannot be promoted without passing or explicitly waiving required checks.
- Validation results show exact failing records and owners.
- Source schema/data-quality drift is visible before downstream work consumes it.

### P2-46 - Visual Change Review, Branch Impact, And Merge Governance

Problem:

- Large canvas changes, AI-generated edits, template updates, and lifecycle journey changes need review before merge/publish/send.
- Reviewers need semantic diffs and downstream impact, not only screenshots or raw JSON.

Benchmark basis:

- Figma branch review/version history and Power BI semantic model impact analysis.

Files:

- Canvas version/diff/branch services.
- Review, approval, merge, and restore checkpoint services.
- Impact analysis across reports, exports, journeys, integrations, and templates.
- New component candidates: `CanvasDiffReviewModal.tsx`, `BranchImpactPanel.tsx`, `MergeApprovalDrawer.tsx`

Implementation:

- Add semantic graph diff for nodes, links, sections, evidence, codes, claims, prompts, models, permissions, and lifecycle rules.
- Add side-by-side and overlay review of canvas changes with object-level property diffs and reviewer comments.
- Add approval, suggest-changes, and merge gates for branches, templates, reports, journey changes, and risky AI-generated edits.
- Add impact summaries before merge/publish/send: affected reports, exports, journeys, training objects, lifecycle campaigns, stakeholders, and integrations.
- Add pre-merge checkpoints and restore paths for every approved merge.

Acceptance:

- Reviewers can inspect meaningful graph changes before approval.
- High-impact changes show downstream blast radius before merge or send.
- Approved merges create restoreable checkpoints.

### P2-47 - Connector Schema Drift And Integration Lifecycle Management

Problem:

- Integrations fail gradually through auth expiry, schema drift, deprecation, source-system change, and field mapping breakage.
- Users need to know which canvases, reports, journeys, and outputs depend on a connector before changing it.

Benchmark basis:

- Airbyte connector/spec/status patterns and BI downstream impact analysis.

Files:

- Integration connector registry and auth health services.
- Schema discovery, drift policy, and mapping services.
- Downstream dependency and impact analysis services.
- New component candidates: `ConnectorInventoryPanel.tsx`, `SchemaDriftReviewDialog.tsx`, `IntegrationTimeline.tsx`

Implementation:

- Add connector inventory with owner, status, auth health, scopes, last sync, schema version, source system, and downstream canvas usage.
- Add schema discovery previews and drift policies: ignore, pause/disable, propagate safe fields, or require review.
- Add integration timelines that log schedule changes, schema changes, auth refreshes, failures, retries, and manual overrides.
- Add deprecation warnings for connectors, fields, templates, and lifecycle journeys using deprecated integrations.
- Add downstream impact analysis when a connector schema, auth scope, or field mapping changes.

Acceptance:

- Schema drift creates a visible policy decision before downstream consumption.
- Connector changes show affected canvases, reports, journeys, and outputs.
- Deprecated or unhealthy integrations cannot silently feed authoritative artifacts.

### P2-48 - Stakeholder Portal, Embedded Dashboards, And Subscriptions

Problem:

- Stakeholders need approved, permission-safe views of research, not access to raw working canvases.
- Scheduled updates should avoid sending stale, empty, or unauthorized content.

Benchmark basis:

- Metabase subscriptions/embedding/permissions and Tableau Pulse metric goals/thresholds.

Files:

- Stakeholder portal/report publishing services.
- Subscription, recipient, and permission-filter services.
- Dashboard/metric threshold and stale-content services.
- New component candidates: `StakeholderPortal.tsx`, `SubscriptionBuilder.tsx`, `MetricThresholdPanel.tsx`

Implementation:

- Add a stakeholder portal for approved reports, evidence reels, journey dashboards, training recommendations, roadmap decisions, and activation metrics.
- Add permission-aware embedded dashboards and canvas excerpts that never expose raw evidence by default.
- Add scheduled stakeholder subscriptions with filters, audience-specific views, test send, suppression, attachments, and no-results skip rules.
- Add threshold/goal alerts for research operations and product engagement metrics.
- Add subscription usage analytics, owners, expiry, recipient audit, and stale-report warnings.

Acceptance:

- Stakeholders see only approved, permission-safe artifacts.
- Subscriptions can be tested, filtered, suppressed, audited, and expired.
- Stale or empty outputs do not send unless explicitly configured.

### P2-49 - Scenario Simulation, What-If Optimization, And Visual Debugging

Problem:

- Lifecycle campaigns, feature rollouts, training recommendations, roadmap choices, and report changes should be simulated before activation.
- Complex workflows need breakpoints and watched values to debug why eligibility, retrieval, or claims changed.

Benchmark basis:

- AnyLogic experiments/optimization, Houdini TOPs/PDG work estimation, and Unreal Blueprint debugging.

Files:

- Scenario simulation and dry-run services.
- Lifecycle/report/integration/AI debug hooks.
- Graph execution inspector and work-estimation services.
- New component candidates: `ScenarioSimulatorPanel.tsx`, `GraphBreakpointInspector.tsx`, `WhatIfComparisonView.tsx`

Implementation:

- Add what-if scenarios for lifecycle timing, feature rollout, training recommendations, roadmap prioritization, sample sizes, and research operations capacity.
- Add scenario parameters, constraints, objectives, expected outcomes, risk flags, and compare-to-baseline views.
- Add simulation dry-runs for lifecycle campaigns, stakeholder sends, integration syncs, report generation, and AI workflows.
- Add visual breakpoints/watch values for evidence transforms, AI prompts, search retrieval, journey eligibility, and report claims.
- Add static/dynamic work estimates so users know whether a run has known workload or will expand as data is processed.

Acceptance:

- Users can compare scenario outcomes before activation.
- Dry-runs show expected recipients, outputs, risks, cost, and data dependencies.
- Breakpoints/watch values explain why graph logic produced a result.

### P2-50 - Design Tokens, Visual Regression, And UI State Coverage

Problem:

- Canvas colors, badges, edge styles, focus rings, and density communicate research meaning and cannot drift casually.
- Graphical regressions need component-level and full-canvas visual baselines across states, devices, themes, and browsers.

Benchmark basis:

- Figma variables/modes, Storybook visual tests, and Chromatic visual regression.

Files:

- Canvas/theme/design-token definitions.
- Visual fixture/story infrastructure for canvas components.
- Playwright visual regression and artifact scripts.
- New component candidates: `CanvasTokenInspector.tsx`, `VisualStateMatrixPanel.tsx`, `SemanticContrastReport.tsx`

Implementation:

- Add a visual design-token layer for canvas colors, node states, ports, edge types, badges, density, spacing, shadows, focus rings, and semantic status.
- Add UI-state matrices for light/dark, high contrast, mobile/desktop, empty/loading/error/success, readonly/edit/review/present, and reduced-motion.
- Add isolated visual fixtures for graph nodes, edges, controls, popovers, modals, minimap, inspector panels, and stakeholder views.
- Add cross-browser visual regression baselines for low zoom, dense canvas, selected/focused/hovered, warning/error, and animation-idle states.
- Add design-token review checks so semantic palette/status changes cannot silently break accessibility or research meaning.

Acceptance:

- Every visual state that carries semantic meaning has token coverage and visual regression coverage.
- Token changes show affected components/canvas states before merge.
- Accessibility contrast failures block release unless explicitly waived.

### P2-51 - Data Catalog, Business Glossary, And Research Asset Stewardship

Problem:

- Evidence, reports, templates, AI runs, and integrations become hard to trust when ownership, classification, glossary context, and lineage are scattered.
- Search should find research assets by business meaning and governance state, not just file name.

Benchmark basis:

- Microsoft Purview catalog, glossary, classification, lineage, and asset stewardship patterns.

Files:

- Research asset metadata and catalog services.
- Glossary/classification/lineage indexing services.
- Asset stewardship and certification workflow.
- New component candidates: `ResearchAssetCatalog.tsx`, `GlossaryLineagePanel.tsx`, `AssetStewardshipDrawer.tsx`

Implementation:

- Add a research asset catalog for evidence sources, transcripts, codebooks, themes, reports, journeys, templates, integrations, AI runs, and published artifacts.
- Add owners, stewards, glossary terms, classifications, sensitivity labels, retention labels, quality status, and usage state to research assets.
- Add catalog search/filtering across business term, source, owner, project, classification, consent state, quality state, lineage, and downstream usage.
- Add lineage navigation from business glossary term to evidence, graph node, report claim, lifecycle journey, roadmap item, and stakeholder subscription.
- Add stewardship workflows for certification, deprecation, review reminders, stale owner detection, and asset handoff.

Acceptance:

- Research assets can be searched by owner, glossary term, classification, quality, lineage, and usage.
- Critical assets have an owner/steward and review state.
- Stale or uncertified assets are visible before they feed reports or lifecycle journeys.

### P2-52 - Retention, Legal Hold, eDiscovery, And Disposition

Problem:

- Sensitive research data, media, AI outputs, messages, and support bundles need defensible retention and deletion behavior.
- Legal hold must override user convenience and explain why deletion is blocked.

Benchmark basis:

- Microsoft Purview retention, Google Vault holds, and Slack legal holds/Discovery APIs.

Files:

- Retention label and legal hold services.
- Audit, export, and chain-of-custody services.
- Deletion/disposition review flows.
- New component candidates: `RetentionPolicyPanel.tsx`, `LegalHoldBanner.tsx`, `DispositionReviewDialog.tsx`

Implementation:

- Add retention labels for evidence, transcripts, media, reports, AI runs, lifecycle messages, exports, recordings, and support bundles.
- Add legal hold/eDiscovery locks that preserve relevant evidence, comments, versions, messages, reports, and run logs even if users delete or edit them.
- Add disposition review before permanent deletion, with owner approval, proof of disposition, and blocked deletion when content is under hold.
- Add retention/hold conflict explanations so users understand why content cannot be deleted or why storage grows.
- Add eDiscovery export bundles with permission-safe manifests, chain-of-custody metadata, hashes, and audit trail.

Acceptance:

- Held content cannot be permanently deleted or silently altered.
- Disposition review records who approved deletion and what was deleted.
- eDiscovery exports include manifests, hashes, permissions, and audit metadata.

### P2-53 - Resource Quotas, Cost Budgets, And Compute Capacity Planning

Problem:

- AI, transcription, embedding, media, report, lifecycle, and export workloads can create runaway cost and queue pressure.
- Users need clear quota failures and graceful degradation paths.

Benchmark basis:

- Kubernetes ResourceQuota and AWS Step Functions quotas/throttling/redrive/cost patterns.

Files:

- Quota, budget, and usage metering services.
- Job/resource scheduler and capacity dashboards.
- AI/provider/job/lifecycle cost attribution.
- New component candidates: `QuotaUsagePanel.tsx`, `CapacityPlanningDashboard.tsx`, `QuotaExceededDialog.tsx`

Implementation:

- Add project/org quotas for storage, media duration, transcription minutes, embeddings, AI tokens, report generations, lifecycle sends, exports, active jobs, concurrent runs, and retained histories.
- Add quota-aware UX that explains which limit would be exceeded and suggests upgrade, cleanup, scheduling, or scope reduction.
- Add resource budgets and chargeback/showback for users, projects, teams, features, AI providers, and lifecycle journeys.
- Add capacity planning dashboards for queue depth, throughput, compute spend, provider throttling, storage growth, retention storage, and peak usage.
- Add graceful degradation modes when quotas or provider capacity are exhausted: pause, queue, downsample, summarize, or require approval.

Acceptance:

- Quota failures explain the violated limit and recovery options.
- Admins can see cost/resource usage by project, team, feature, provider, and journey.
- Workloads degrade safely rather than failing as unexplained errors.

### P2-54 - Incident Response, Runbooks, Status Pages, And Postmortems

Problem:

- Production failures in a graphical research tool need formal response, not only support tickets.
- Incidents should create timelines, runbook updates, postmortems, and prevention work.

Benchmark basis:

- PagerDuty incident response, Atlassian incident management, and Statuspage postmortems.

Files:

- Incident, severity, and status communication services.
- Runbook/postmortem/backlog integration.
- Support bundle, telemetry, and feature-flag event timeline aggregation.
- New component candidates: `IncidentCommandPanel.tsx`, `RunbookLauncher.tsx`, `PostmortemEditor.tsx`

Implementation:

- Add severity levels and incident workflows for blank canvases, failed sends, corrupt imports, broken reports, connector outages, AI provider failures, privacy exposure, and data-quality gate bypasses.
- Add runbooks linked to alerts, support bundles, dashboards, owners, dependency graph, and recent changes.
- Add internal/external status updates for affected workspaces, integrations, lifecycle sends, and stakeholder portals.
- Add incident timelines from telemetry, user actions, queue events, deploys, feature flags, provider status, and support notes.
- Add postmortems with impact, root cause, remediation actions, owners, due dates, linked backlog items, runbook updates, and prevention checks.

Acceptance:

- Severe production failures have assigned roles, runbooks, and status communication.
- Incident timelines are generated from operational evidence.
- Postmortem action items link to owners, due dates, backlog items, and prevention checks.

### P2-55 - Enterprise Identity, SSO, SCIM, And Access Lifecycle

Problem:

- Enterprise customers need self-serve SSO, provisioning, deprovisioning, and recurring access reviews.
- Canvas actions need clear identity policy explanations when evidence, AI, exports, sends, or portals are restricted.

Benchmark basis:

- Okta SAML/OIDC/SCIM and Microsoft Entra access reviews.

Files:

- Auth, organization, user, group, role, guest, and access-review services.
- Admin identity settings, SCIM endpoints, audit events, and policy evaluation.
- New component candidates: `EnterpriseIdentitySettings.tsx`, `AccessLifecycleDashboard.tsx`, `AccessReviewPanel.tsx`

Implementation:

- Add OIDC and SAML setup with metadata exchange, certificate rotation, tenant/domain routing, relay-state deep links, and safe admin break-glass access.
- Add SCIM provisioning for users, groups, workspace membership, roles, deactivation, and reactivation.
- Add lifecycle dashboards for inactive users, guests, stale admins, orphaned projects, pending invitations, and over-permissioned integrations.
- Add recurring access reviews for sensitive projects, stakeholder portals, lifecycle sends, exports, AI tools, templates, and integrations.
- Add canvas-level identity policy explanations for blocked or allowed evidence, AI, send, and export actions.

Acceptance:

- Enterprise admins can configure SSO and SCIM without support intervention.
- Deactivated users and removed groups lose access consistently across projects, portals, sends, exports, and integrations.
- Users see actionable policy explanations when identity rules block canvas actions.

### P2-56 - Secrets, Key Management, BYOK, And Credential Hygiene

Problem:

- Integration credentials, webhook secrets, and provider keys must not leak through canvases, templates, exports, logs, screenshots, support bundles, prompts, or lifecycle messages.
- Regulated customers may need customer-managed key policies and visible key lifecycle state.

Benchmark basis:

- HashiCorp Vault and AWS KMS.

Files:

- Secret-reference service, credential vault integration, key policy service, and redaction pipeline.
- Connector credential settings, webhook signing secrets, provider keys, and support bundle scrubbers.
- New component candidates: `SecretReferencePicker.tsx`, `SecretHealthBadge.tsx`, `KeyManagementPanel.tsx`

Implementation:

- Add organization secret vault abstractions for integration credentials, webhook signing secrets, AI provider keys, storage credentials, transcription providers, and email providers.
- Replace raw secret storage in canvases/templates/runs with redacted secret references and health status.
- Add rotation, expiry, owner, usage, last-access, last-rotated, blast-radius, test, revoke, and policy status.
- Add BYOK/CMK options for enterprise tenants, including region, key ownership, disablement consequences, and re-encryption workflows.
- Add secret health badges on connector nodes, workflow nodes, send controls, export controls, and integration dashboards.

Acceptance:

- No raw secrets appear in canvas JSON, exports, support bundles, screenshots, AI prompts, or run logs.
- Admins can rotate, test, revoke, and audit credentials without editing graph content.
- BYOK/CMK status and failure modes are visible before users attempt protected operations.

### P2-57 - API/Event Contract Lifecycle And Developer Trust

Problem:

- Public APIs, webhooks, imports, exports, lifecycle events, and AI/job events need canonical contracts and compatibility governance.
- External automations need versioning, idempotency, signatures, replay, and deprecation warnings.

Benchmark basis:

- OpenAPI, AsyncAPI, and Stripe API safety patterns.

Files:

- Canonical schema package, contract generation, webhook dispatcher, API gateway/middleware, event catalog, and compatibility tests.
- Developer/admin docs and integration dashboard surfaces.
- New component candidates: `DeveloperContractExplorer.tsx`, `WebhookDeliveryLog.tsx`, `ContractDeprecationPanel.tsx`

Implementation:

- Add canonical schemas and generated OpenAPI/AsyncAPI contracts for APIs, events, webhooks, import/export, lifecycle journeys, AI runs, and connector syncs.
- Add versioning, deprecation windows, compatibility tests, sample payloads, correlation IDs, and consumer-impact reports.
- Add idempotency keys for state-changing APIs and lifecycle/send/report/export operations.
- Add webhook signatures, replay protection, endpoint secrets, endpoint API versions, delivery attempts, and redacted event logs.
- Add canvas-level contract warnings when templates, integrations, journeys, or external automations depend on deprecated or incompatible schemas.

Acceptance:

- API/event docs are generated from canonical schemas and fail CI when contracts drift.
- Webhook consumers can verify signatures, replay safe events, and inspect redacted delivery history.
- Deprecations show affected canvases, templates, journeys, and integrations before breaking changes ship.

### P2-58 - Backup, Restore, And Disaster Recovery UX

Problem:

- Backups are not trustworthy until restore paths, coverage, RPO/RTO targets, and configuration recovery are tested.
- Users need safe restore previews rather than destructive blind rollback.

Benchmark basis:

- AWS Backup point-in-time recovery and PostgreSQL WAL/PITR.

Files:

- Backup metadata, restore orchestration, object history, media/index restore, DR runbooks, and lifecycle send suppression.
- Admin recovery dashboards and restore preview UI.
- New component candidates: `RestorePreviewDialog.tsx`, `BackupCoveragePanel.tsx`, `DisasterRecoveryRunbook.tsx`

Implementation:

- Add workspace/project point-in-time restore with preview, diff, affected-object summary, owner approval, and restore-as-copy.
- Add object-level restore for deleted nodes, evidence, transcripts, comments, codes, reports, lifecycle journeys, templates, and published artifacts.
- Add backup coverage status for database, media/files, search/vector indexes, generated artifacts, configuration, secrets metadata, and tenant settings.
- Add RPO/RTO dashboards and scheduled restore drills for production, staging, and customer-specific enterprise environments.
- Add disaster recovery runbooks for data, configuration, identity provider setup, integration secrets, webhook endpoints, background jobs, and lifecycle send suppression.

Acceptance:

- Operators can prove recent restore success and current backup coverage.
- Users can preview point-in-time/object restores before applying them.
- DR runbooks include configuration, identity, secrets metadata, jobs, webhooks, and lifecycle suppression, not only database restore.

### P2-59 - Internationalization, Localization, RTL, And Cultural UX

Problem:

- Global customers need locale-aware UI, emails, exports, reports, transcripts, and training journeys.
- The canvas must survive long translations, CJK text, RTL layouts, and mixed-direction evidence without clipping or corrupting graph meaning.

Benchmark basis:

- Unicode CLDR, ICU MessageFormat, and W3C internationalization guidance.

Files:

- Message catalog infrastructure, locale formatting utilities, email/export localization, transcript translation metadata, and RTL visual fixtures.
- Canvas toolbar/panel/node/edge/minimap/popover layout QA.
- New component candidates: `LocaleSwitcher.tsx`, `TranslationStatusBadge.tsx`, `LocalizedEvidencePanel.tsx`

Implementation:

- Add locale-aware formatting for dates, times, numbers, currencies, names, addresses, durations, quota units, and research sample descriptors.
- Add ICU-style message catalogs for UI, emails, training prompts, validation messages, run errors, export text, and lifecycle journeys.
- Add RTL layout support and QA for toolbars, nodes, edge labels, minimap, panels, popovers, comments, stakeholder portals, and exported reports.
- Add multilingual evidence handling for transcripts, translations, source-language labels, quote-level translation status, and localized evidence reels.
- Add localization visual regression for long German/French labels, compact CJK labels, Arabic/Hebrew RTL flows, and mixed-direction evidence.

Acceptance:

- Core canvas workflows pass visual QA in representative LTR, RTL, CJK, and long-label locales.
- Emails, exports, validation, and run errors use structured message catalogs rather than concatenated strings.
- Evidence can preserve source language, translation status, and quote-level context.

### P2-60 - Design Rules, Constraint Authoring, And Preflight Gates

Problem:

- Canvases can look visually complete while still containing unsupported claims, stale analysis, missing consent, broken integrations, or invalid relation semantics.
- High-consequence actions need explicit preflight checks before publish, export, send, template release, or roadmap promotion.

Benchmark basis:

- KiCad design-rule checking, custom constraints, issue focus, and output readiness patterns.

Files:

- Canvas validation/rule engine, rule schema, rule authoring UI, preflight service, publish/export/send guards, and issue marker overlays.
- Report/template/lifecycle/roadmap promotion gates.
- New component candidates: `CanvasRuleEditor.tsx`, `PreflightGateDialog.tsx`, `CanvasIssueMarkerLayer.tsx`

Implementation:

- Add a canvas design-rule engine for missing evidence, invalid relation types, unsupported claims, uncoded excerpts, circular dependencies, stale AI outputs, missing consent, broken integrations, and export/send blockers.
- Add custom rule authoring for organization research standards, compliance policies, lifecycle send rules, method templates, and stakeholder review criteria.
- Add visual issue markers with severity, owner, waive/justify, focus-in-canvas, and batch-fix actions.
- Add preflight gates before publish, export, stakeholder share, lifecycle send, template release, and roadmap promotion.
- Add rule syntax validation, examples, dry-runs, and "what changed since last clean preflight" summaries.

Acceptance:

- Publish/export/share/send/template/roadmap actions show blocking and non-blocking rule status before completion.
- Users can focus each issue in the canvas, assign ownership, fix, waive with justification, or rerun checks.
- Organization rules can be authored, syntax-checked, dry-run, versioned, and applied to selected projects/templates.

### P2-61 - Parametric Timeline, Dependency Rebuild, And Design History

Problem:

- Users need to understand how a research conclusion evolved, not only the current graph state.
- Upstream changes should visibly invalidate downstream outputs that depend on evidence, prompts, codes, templates, integrations, or model versions.

Benchmark basis:

- Autodesk Fusion parametric timeline and Onshape version/branch history.

Files:

- Event timeline, object history, dependency graph, branch/merge service, rebuild/staleness engine, restore points, and timeline replay UI.
- AI/report/lifecycle/export invalidation metadata.
- New component candidates: `CanvasTimelinePanel.tsx`, `DependencyRebuildPanel.tsx`, `BranchExperimentDialog.tsx`

Implementation:

- Add a canvas timeline that records meaningful graph edits, imports, coding passes, AI runs, layout changes, report generation, journey activation, and publish/send events.
- Add time-scrubbing and replay for research evolution, with reviewer-friendly summaries.
- Add dependency rebuild indicators when upstream changes invalidate downstream nodes, reports, journeys, exports, or roadmap items.
- Add branch experiments for alternate coding schemes, report narratives, journey strategies, AI prompts, and stakeholder views.
- Add rebuild failure panels with affected nodes, stale outputs, recoverable steps, restore points, and recommended reruns.

Acceptance:

- Users can replay a canvas from a previous point and see what changed, why, and by whom.
- Upstream changes mark downstream outputs stale with actionable rerun/rebuild paths.
- Branch experiments can be created, compared, merged, abandoned, or restored without corrupting the main workspace.

### P2-62 - Role-Specific Operational Interfaces And Human-In-The-Loop Workbenches

Problem:

- A single power-user canvas view is too broad for reviewers, admins, support, customer success, executives, and integration owners.
- Operational work needs queues, approvals, and focused actions generated from the same canvas data.

Benchmark basis:

- Airtable Interface Designer, Airtable Automations, and Retool apps/workflows.

Files:

- Workbench view registry, queue/query definitions, role permissions, approval service, automation trigger surface, and audit events.
- Reviewer/support/customer-success/admin/executive/integration owner surfaces.
- New component candidates: `RoleWorkbenchShell.tsx`, `CanvasApprovalQueue.tsx`, `HumanCheckpointPanel.tsx`

Implementation:

- Add role-specific workbenches for researcher, reviewer, customer success, admin, executive, training author, support, and integration owner.
- Generate focused interfaces from the same canvas model rather than separate CRUD/admin screens.
- Add approval queues, evidence triage queues, failed-run queues, stale-report queues, support-escalation queues, and lifecycle-campaign queues.
- Add human-in-the-loop checkpoints for AI synthesis, code merges, sensitive exports, lifecycle sends, connector drift, and roadmap promotion.
- Add interface publishing, permissions, usage analytics, and automation triggers tied to canvas objects and events.

Acceptance:

- Each target role has a focused queue with only relevant canvas objects, actions, and policy context.
- Actions taken in a workbench update the canonical canvas model and audit trail.
- Human checkpoints can block automation until an authorized user reviews, approves, rejects, or requests changes.

### P2-63 - Customer Success Health, Support Feedback, And Adoption Playbooks

Problem:

- Engagement emails and training campaigns need customer-health context, not just elapsed time since signup.
- Support tickets, chats, failed searches, screenshots, and QA recordings should feed product and training improvements.

Benchmark basis:

- HubSpot customer success health scores, Intercom Fin answer testing/inspection, and Pendo Resource Center metrics.

Files:

- Health score service, support feedback ingestion, canvas-state correlation, help answer evaluation, adoption segmentation, and playbook automation.
- Customer success dashboard and support-to-backlog workflows.
- New component candidates: `CustomerHealthDashboard.tsx`, `SupportFrictionClusterPanel.tsx`, `AdoptionPlaybookBuilder.tsx`

Implementation:

- Add account/user health scores based on activation, first canvas value, collaboration depth, evidence import success, graph health, export success, support tickets, NPS/feedback, and inactivity.
- Add customer success playbooks for stalled onboarding, failed imports, blank-canvas confusion, no-collaborator projects, low evidence quality, failed AI runs, and unactivated lifecycle journeys.
- Add support-feedback clustering linked to tickets, chats, failed searches, rage clicks, screenshots, QA recordings, and exact canvas states.
- Add AI support answer inspection for QualCanvas help content, including cited sources, persona simulation, answer quality ratings, and missing-content tasks.
- Add adoption dashboard segments by role, plan, project type, feature exposure, training completion, lifecycle journey, and canvas maturity.

Acceptance:

- Lifecycle journeys can target based on health score and activation state, not only time-based triggers.
- Support issues can be traced to canvas states and converted into product, documentation, training, or QA tasks.
- Help/support AI answers can be tested, inspected, scored, and improved before broad exposure.

### P2-64 - Guided Academy, Credentials, And In-Context Practice

Problem:

- A powerful graphical research tool needs structured hands-on learning, not only static docs and emails.
- Training should map to actual product outcomes and role-specific workflows.

Benchmark basis:

- Salesforce Trailhead modules/projects/trails/trailmixes/superbadges and Pendo in-app guidance/onboarding analytics.

Files:

- Academy content model, demo canvas templates, guided challenge runner, badge/credential tracking, in-context lesson triggers, and training analytics.
- Lifecycle messaging destinations and team learning-path admin.
- New component candidates: `AcademyTrailBrowser.tsx`, `GuidedCanvasChallenge.tsx`, `TrainingOutcomeDashboard.tsx`

Implementation:

- Add a QualCanvas Academy with role-based trails for researcher, moderator, analyst, product manager, executive reviewer, admin, integration owner, and training author.
- Add hands-on canvas challenges using safe demo projects, guided checkpoints, validation rules, and badge/credential completion.
- Add in-context lessons triggered by graph health warnings, first-time workflows, failed preflight checks, empty states, and newly released features.
- Add custom learning paths for teams, mapped to product activation milestones and lifecycle messaging.
- Add training analytics that connect lesson completion to canvas outcomes, support reduction, retention, and feature adoption.

Acceptance:

- Users can complete safe demo-canvas challenges without affecting production data.
- Training recommendations deep-link to exact canvas states, role paths, and validation checkpoints.
- Training analytics show whether learning paths improve activation, graph quality, support deflection, retention, and feature adoption.

### P2-65 - Power-User Workspace Profiles, Hotkeys, And Command Ergonomics

Problem:

- Expert users need speed, repeatability, and task-specific layouts as the graphical surface grows.
- Keyboard-only and power-user flows should not be blocked by menus designed only for casual mouse usage.

Benchmark basis:

- Blender workspaces and VS Code profiles/keybindings.

Files:

- Workspace profile service, keymap editor, command palette metadata, macro recording, layout presets, and profile governance.
- Canvas shell, toolbar, sidebars, keyboard hooks, command registry, and user/org settings.
- New component candidates: `WorkspaceProfileSwitcher.tsx`, `KeymapEditor.tsx`, `MacroRecorderPanel.tsx`

Implementation:

- Add workspace profiles for Research Edit, Coding, Synthesis, Review, Present, Admin, Support, Customer Success, Academy Authoring, and Integration Operations.
- Add customizable keymaps, command palette aliases, context-specific commands, conflict detection, import/export/share profiles, and reset-to-default.
- Add panel-layout presets, density presets, toolbar presets, sidebar presets, and input-mode presets for mouse, trackpad, touch, pen, and keyboard-only use.
- Add macro recording for repeated graph cleanup, import triage, coding passes, report preparation, preflight fixing, and stakeholder packaging.
- Add profile governance so organizations can publish recommended profiles while allowing personal overrides where safe.

Acceptance:

- Users can switch task profiles without losing canvas state.
- Keybinding conflicts are detected and can be resolved before saving.
- Organizations can publish governed profiles and users can apply safe personal overrides.

### P2-66 - Procedural Asset Packaging And Asset Interface Design

Problem:

- Powerful canvas workflows need reusable asset interfaces, not only copied subgraphs.
- Teams need stable, versioned, documented research assets whose internals can evolve safely.

Benchmark basis:

- Houdini Digital Assets.

Files:

- Research asset package schema, asset registry, asset versioning, parameter exposure, locked internals, asset QA, and upgrade preview services.
- Template/subgraph conversion flows and marketplace/registry integration.
- New component candidates: `ResearchAssetBuilder.tsx`, `AssetParameterPanel.tsx`, `AssetUpgradePreview.tsx`

Implementation:

- Add Research Digital Assets that package subgraphs, templates, prompts, validation rules, examples, training links, and output contracts into reusable canvas nodes.
- Add stable internal IDs, human labels, namespaces, branches, semantic versions, compatibility ranges, changelogs, owners, approvals, and deprecation state.
- Add exposed parameters and locked internals so teams can reuse powerful workflows without editing fragile implementation details.
- Add embedded sample evidence, demo canvases, expected outputs, help tabs, and QA checks for each asset.
- Add side-by-side asset upgrade previews so existing canvases can keep old asset versions while new canvases default to approved newer versions.

Acceptance:

- Users can package a working subgraph as a reusable asset with exposed parameters and locked internals.
- Existing canvases continue to run with pinned older asset versions.
- Asset upgrades show compatibility, before/after behavior, and manual follow-up tasks before applying.

### P2-67 - Canvas-Anchored Comments, Mentions, Notifications, And Decision Inbox

Problem:

- Discussion and decisions should attach to exact canvas objects, not drift into disconnected chat or email.
- Reviewers need an inbox for mentions, approvals, preflight waivers, stale outputs, and assigned tasks.

Benchmark basis:

- Figma comments, Miro comments, Linear notifications, and Jira mentions/watchers.

Files:

- Anchored comment model, decision inbox, notification routing, digest preferences, task assignment, permissions, retention, and export redaction.
- Canvas object anchors and mobile review surfaces.
- New component candidates: `AnchoredCommentThread.tsx`, `DecisionInbox.tsx`, `NotificationPreferencePanel.tsx`

Implementation:

- Add comments anchored to nodes, edges, sections, excerpts, evidence clips, report claims, journey steps, preflight issues, timeline events, and exports.
- Add @mentions, assignment, due dates, decision requests, approval requests, read/unread, resolved/unresolved, follow/mute, pin, color/severity, and mobile reply flows.
- Add a decision inbox that aggregates mentions, assigned issues, review requests, stale-output tasks, preflight waivers, lifecycle approvals, and support escalations.
- Add notification digests, urgency levels, quiet hours, workspace/project subscriptions, and role-aware routing.
- Add comment audit and retention behavior that respects legal hold, evidence permissions, stakeholder visibility, and export redaction.

Acceptance:

- Comments can jump users to the exact canvas object and state they refer to.
- Decision inbox items can be resolved, assigned, muted, followed, escalated, or converted to tasks.
- Notifications respect role permissions, quiet hours, digests, retention, and stakeholder-safe visibility.

### P2-68 - Data Residency, Tenant Boundary, And Compliance Scope Transparency

Problem:

- Enterprise admins need to understand what is pinned, what is processed elsewhere, and what third-party apps/providers do with data.
- AI, transcription, lifecycle sends, exports, logs, and support bundles can cross boundaries if residency is not visible at workflow time.

Benchmark basis:

- Atlassian data residency, GitHub Enterprise Cloud data residency, and Google Workspace data regions.

Files:

- Residency metadata, tenant boundary checks, region-aware workflow policy, data-flow maps, subprocessor inventory, migration orchestration, and verification reports.
- Admin compliance dashboards and workflow warnings.
- New component candidates: `ResidencyScopeDashboard.tsx`, `RegionBoundaryWarning.tsx`, `TenantBoundaryEvidencePanel.tsx`

Implementation:

- Add a residency and tenant-boundary dashboard that shows where each class of data lives: evidence, media, transcripts, embeddings, search indexes, AI prompts, AI outputs, logs, telemetry, backups, exports, emails, support bundles, and third-party connector data.
- Add in-scope/out-of-scope explanations for every residency setting, including caches, transient processing, operational logs, AI providers, email providers, and integration apps.
- Add region-aware processing and warnings before users run AI, transcription, export, lifecycle send, webhook, or support-bundle workflows that cross region boundaries.
- Add migration scheduling, migration status, rollback/hold windows, app/integration readiness, and post-migration verification.
- Add tenant isolation evidence for enterprise reviews, including subprocessor inventory, data-flow maps, access path summaries, and testable boundary checks.

Acceptance:

- Admins can see residency status and scope for every major data class and workflow.
- Cross-region workflows warn users before execution and record audit evidence.
- Residency migration status, app readiness, verification, and rollback/hold windows are visible.

### P2-69 - Release, Deprecation, And Migration Assistant

Problem:

- As canvas schema, nodes, templates, AI prompts, integrations, and lifecycle features evolve, customers need impact-aware upgrades.
- Release notes are weaker than migration paths tied to affected canvas states.

Benchmark basis:

- Kubernetes deprecation policy, Stripe changelog/API upgrades, and Next.js codemods.

Files:

- Release-impact service, deprecation policy engine, migration transform runner, dry-run diff engine, version pinning, rollout/rollback controls, and release-note destinations.
- Canvas schema/template/asset/API/event/prompt compatibility checks.
- New component candidates: `ReleaseImpactCenter.tsx`, `MigrationAssistant.tsx`, `DeprecationWarningPanel.tsx`

Implementation:

- Add a release-impact center that shows which users, canvases, templates, assets, integrations, reports, lifecycle journeys, and exports are affected by a change.
- Add deprecation policies for canvas schema, node types, relation types, templates, APIs, events, AI prompts, model providers, extension capabilities, and lifecycle journey features.
- Add migration assistants that dry-run canvas/schema/template/asset upgrades, show before/after diffs, apply safe transformations, and leave manual follow-up tasks where needed.
- Add version pinning, compatibility warnings, rollout windows, rollback paths, upgrade reminders, and audit evidence for accepted migrations.
- Add release notes that deep-link to affected canvas states, guided academy lessons, in-product walkthroughs, support articles, and customer success playbooks.

Acceptance:

- Admins can see which workspaces and artifacts are affected before accepting an upgrade.
- Migrations support dry-run, diff preview, partial application, rollback path, and manual follow-up tasks.
- Deprecation warnings include timeline, impact, owner, recommended action, and linked training/support content.

### P2-70 - Migration Hub, Import Fidelity, And Competitive Tool Offboarding

Problem:

- Customers replacing existing visual/research tools need guided migration, fidelity reporting, cleanup, and rollback.
- Raw imports without object mapping create untrusted canvases and manual cleanup burden.

Benchmark basis:

- Figma file import and Miro diagram migration/import workflows.

Files:

- Import adapters, migration project service, object mapping engine, fidelity scoring, unsupported-object reporting, cleanup actions, and rollback/export support.
- New component candidates: `MigrationHub.tsx`, `ImportMappingPreview.tsx`, `MigrationFidelityReport.tsx`

Implementation:

- Add a Migration Hub for Miro, FigJam/Figma, Mural, Lucidchart, draw.io, Visio, CSV, spreadsheet, JSON, GraphML, transcript archives, and existing QualCanvas exports.
- Add import mapping previews for shapes, sticky notes, comments, sections, links, frames, images, connectors, timestamps, authors, evidence references, and metadata.
- Add unsupported-object reports, fidelity scores, import warnings, object counts, permission/ownership mappings, and before/after visual comparison.
- Add post-import cleanup tools: convert sticky notes to evidence, convert frames to sections, infer relations, relink media, deduplicate authors, and detect orphaned comments.
- Add migration project dashboards for large customers, with status, failures, retry queues, sample validation, stakeholder signoff, and rollback/export paths.

Acceptance:

- Imports produce a migration report with fidelity score, unsupported objects, warnings, and cleanup actions.
- Users can preview mapping before import and compare before/after visually after import.
- Large migrations can be retried, sampled, signed off, rolled back, or exported.

### P2-71 - Procurement Evidence Room, Security Questionnaires, And Trust Automation

Problem:

- Enterprise buyers need security, privacy, AI, accessibility, residency, incident, uptime, and DR evidence before purchase.
- Reanswering bespoke questionnaires manually will become a sales and security bottleneck.

Benchmark basis:

- CSA STAR, Shared Assessments SIG, and SOC 2 procurement patterns.

Files:

- Trust evidence repository, questionnaire parser/exporter, evidence freshness workflow, access/NDA controls, buyer packet generation, and owner routing.
- New component candidates: `TrustEvidenceRoom.tsx`, `QuestionnaireAutomationPanel.tsx`, `BuyerEvidencePacket.tsx`

Implementation:

- Add a Trust/Evidence Room with security overview, architecture diagrams, data-flow maps, SOC 2/ISO/CSA status, pen-test summaries, policies, subprocessors, DPA, incident history, uptime/SLA, BCP/DR evidence, and AI/data-use controls.
- Add questionnaire response automation for CAIQ, SIG, custom XLSX/CSV questionnaires, AI security questionnaires, and accessibility/security procurement bundles.
- Add evidence freshness, owner, review date, source-of-truth link, redaction level, customer eligibility, and NDA/access controls.
- Add buyer-facing export packets with scoped evidence, immutable version, expiry, access log, and sales/customer-success handoff notes.
- Add risk-question routing to the right owner when a response is missing, stale, contradictory, or not backed by evidence.

Acceptance:

- Trust evidence has owners, freshness, access control, and source-of-truth links.
- Questionnaire exports include only eligible evidence and record access/audit history.
- Missing or stale questionnaire answers route to accountable owners.

### P2-72 - Accessibility Conformance Reporting And Assistive-Tech Evidence

Problem:

- Accessibility work needs conformance artifacts for buyers, not just internal fixes.
- Dense graphical tools need explicit assistive-technology evidence, sample sets, known limitations, and remediation traceability.

Benchmark basis:

- ITI VPAT/ACR, Section508.gov, and W3C WCAG-EM.

Files:

- Accessibility conformance repository, VPAT/ACR generator, sample-set definitions, assistive-tech test evidence, known-limitations registry, and remediation roadmap.
- New component candidates: `AccessibilityConformanceDashboard.tsx`, `ACRGenerator.tsx`, `AssistiveTechEvidencePanel.tsx`

Implementation:

- Add an accessibility conformance program for the canvas, including VPAT/ACR generation, WCAG/Section 508/EN 301 549 mapping, known limitations, and remediation backlog links.
- Add assistive-technology evidence for screen readers, keyboard-only operation, high contrast, reduced motion, zoom, touch, pen, voice input, and non-visual graph navigation.
- Add representative accessibility sample sets for dense graphs, modals, menus, comments, timeline, workbenches, exports, reports, and lifecycle journey builder.
- Add accessibility regression artifacts with screenshots, videos, keyboard traces, ARIA snapshots, focus-order maps, and issue severity.
- Add customer-facing accessibility roadmap and release notes tied to conformance gaps and known limitations.

Acceptance:

- ACR/VPAT outputs can be generated from current conformance evidence and known limitations.
- Assistive-tech test evidence links to product areas, issues, versions, and remediation status.
- Accessibility sample sets cover the canvas-specific interactions that generic web audits miss.

### P2-73 - Browser Rendering Pipeline, Worker Offload, And Interaction Performance

Problem:

- Dense graphical canvases need architectural performance work, not only after-the-fact screenshots.
- Heavy layout, import parsing, search/index prep, media handling, and rendering can block interaction feedback.

Benchmark basis:

- MDN OffscreenCanvas/Web Workers, web.dev INP, and Chrome DevTools performance tracing.

Files:

- Rendering architecture docs, workerized layout/import/search services, performance trace collector, INP budgets, progressive rendering hooks, and dense-canvas performance dashboard.
- New component candidates: `PerformanceTraceDashboard.tsx`, `RenderingBudgetPanel.tsx`, `DenseCanvasPerfReport.tsx`

Implementation:

- Add a rendering architecture plan for large canvases: workerized layout, workerized import parsing, workerized search/index prep, OffscreenCanvas/WebGL/WebGPU feasibility, and main-thread interaction budgets.
- Add interaction performance budgets for pan, zoom, drag, select, lasso, comment, context menu, command palette, modal open, fit view, auto-layout, and timeline scrub.
- Add performance trace capture for dense project QA, including INP, long tasks, scripting/rendering/painting cost, memory, layout thrash, frame drops, and input delay.
- Add progressive rendering and interaction prioritization so visual feedback occurs before expensive recalculation.
- Add a performance regression dashboard keyed by project size, node/edge count, media load, comments, overlays, theme, locale, device class, browser, and feature flag.

Acceptance:

- Dense-canvas QA captures browser traces and interaction metrics, not only screenshots.
- Heavy operations can be moved off the main thread or explicitly justified when they cannot.
- User-visible feedback for core interactions occurs within defined budgets on target device classes.

### P2-74 - Research Method Governance, Reporting Checklists, And Ethical Review

Problem:

- Research conclusions should show method quality, consent, sampling, ethics, and reporting completeness.
- AI-generated synthesis and lifecycle decisions should not outrun the quality of the underlying study design.

Benchmark basis:

- EQUATOR qualitative reporting guidelines, COREQ, SRQR, and APA JARS.

Files:

- Method template registry, study protocol model, checklist engine, ethics/readiness gates, consent/risk metadata, and method-quality overlays.
- New component candidates: `StudyProtocolEditor.tsx`, `MethodChecklistPanel.tsx`, `ResearchEthicsGate.tsx`

Implementation:

- Add method governance templates for interviews, focus groups, diary studies, usability tests, surveys, mixed-methods studies, field observations, and evaluative research.
- Add reporting checklists mapped to COREQ, SRQR, APA JARS-Qual, JARS-Quant, and JARS-Mixed where relevant.
- Add study protocol objects with objectives, research questions, sampling, recruitment, consent, incentives, moderator guide, exclusion criteria, risk review, bias/confound notes, and analysis plan.
- Add ethics/readiness gates before evidence collection, participant upload, AI analysis, stakeholder publish, or lifecycle targeting based on research findings.
- Add method-quality overlays on the canvas so reports and recommendations show whether supporting evidence meets the selected method checklist.

Acceptance:

- Research outputs can show the study protocol, method checklist status, consent state, and evidence quality behind them.
- Ethics/readiness gates block high-risk actions until required fields and approvals are complete.
- Method-quality overlays appear in reports, canvas nodes, stakeholder portals, and lifecycle decision previews.

### P2-75 - Nested Subgraphs, Parameter Panels, And Reusable Component Interfaces

Problem:

- Large research workflows need reusable component boundaries without fragile copy/paste.
- Users need to expose safe parameters while hiding internal graph complexity.

Benchmark basis:

- ComfyUI Subgraph, Node-RED Subflows, Blender node groups, and TouchDesigner custom parameters.

Files:

- Subgraph model, component blueprint registry, parameter panel UI, breadcrumb/navigation controls, and blueprint impact analysis.
- New component candidates: `NestedSubgraphCanvas.tsx`, `SubgraphParameterPanel.tsx`, `ComponentBlueprintImpactDialog.tsx`

Implementation:

- Add nested research subgraphs with breadcrumbs, enter/exit affordances, parent-context previews, unpack-to-nodes, and published subgraph blueprints.
- Add exposed inputs/outputs, parameter panels, defaults, visibility controls, validation, examples, owner, and description metadata.
- Add private utility, team-published, and organization-approved component scopes.
- Add per-instance parameter overrides with canonical blueprint linkage and upgrade previews.
- Add impact warnings when blueprint edits affect existing canvases, reports, lifecycle journeys, templates, or exports.

Acceptance:

- Users can convert selections into subgraphs, expose slots/parameters, navigate in/out, unpack, and publish as reusable blueprints.
- Component edits show affected instances and downstream artifacts before risky changes.
- Per-instance overrides are visible and do not silently detach from the canonical blueprint.

### P2-76 - Dependency Resolver, Missing Asset Recovery, And Environment Snapshots

Problem:

- Shared and imported canvases can fail when required assets, versions, connectors, permissions, feature flags, or indexes are missing.
- Reproducing reports and AI outputs requires exact environment state.

Benchmark basis:

- ComfyUI dependencies, ComfyUI Manager, ComfyUI Registry, and Node-RED project dependencies.

Files:

- Dependency manifest schema, resolver service, missing-asset recovery UI, environment snapshot model, and run manifest viewer.
- New component candidates: `CanvasDependencyPanel.tsx`, `MissingAssetRecoveryDialog.tsx`, `EnvironmentSnapshotDrawer.tsx`

Implementation:

- Add dependency resolver for models, prompts, templates, connectors, datasets, transcripts, media files, indexes, feature flags, extensions, and training/email assets.
- Add missing-asset recovery with install/request/access flows, safe fallbacks, owner routing, version choice, and cannot-resolve explanations.
- Add environment snapshots for app version, schema version, template versions, model/provider/index versions, feature flags, locale, permissions, connectors, and residency state.
- Add dependency conflict panels before import, open, publish, share, AI run, export, or lifecycle send.
- Add immutable run dependency manifests for reports, recommendations, exports, and lifecycle decisions.

Acceptance:

- Opening/importing a canvas reports missing, stale, conflicting, inaccessible, and optional dependencies.
- Users get actionable recovery paths or explicit cannot-resolve reasons.
- Reports, exports, and AI outputs include dependency/environment manifests sufficient for reproduction analysis.

### P2-77 - Example Gallery, Recipe Browser, And Insertable Learning Snippets

Problem:

- Complex node systems need runnable examples, not only static help.
- Lifecycle/training CTAs need precise product destinations.

Benchmark basis:

- ComfyUI Workflow Templates, TouchDesigner OP Snippets, and Node-RED example flows.

Files:

- Example gallery, recipe metadata, sample dataset fixtures, snippet insertion flow, and training deep-link routing.
- New component candidates: `ExampleRecipeGallery.tsx`, `RecipePreviewRunner.tsx`, `SnippetInsertModeDialog.tsx`

Implementation:

- Add runnable research recipes for interview coding, theme synthesis, journey mapping, evidence reels, service blueprints, stakeholder reports, lifecycle training, and support triage.
- Add context-aware snippets from node menus, empty states, graph health warnings, template errors, onboarding, and lifecycle emails.
- Require sample data, expected outcome, comments, method notes, dependency status, permissions, and cleanup behavior for every recipe.
- Add "insert as sandbox" and "adapt to my project" modes.
- Add analytics connecting examples to activation, completion, support deflection, and graph quality.

Acceptance:

- Users can open, run, inspect, and insert a recipe without affecting production research data by default.
- Examples disclose dependencies, sample data, expected outputs, permissions, cleanup, and method assumptions.
- Training CTAs and lifecycle messages can deep-link to a specific snippet or recipe state.

### P2-78 - Continuous Canvas Static Analysis, Quality Scores, And Rule Governance

Problem:

- Publish-time validation is too late for complex graphical research workflows.
- Teams need rule severity and enforcement to vary by method, sensitivity, customer, and environment.

Benchmark basis:

- Power Automate Flow Checker static analysis and rule governance.

Files:

- Canvas rule engine, rule profile admin, live checker panel, issue markers, waiver model, and action gate integration.
- New component candidates: `CanvasCheckerPanel.tsx`, `RuleProfileAdmin.tsx`, `CanvasIssueFocusOverlay.tsx`

Implementation:

- Add a live Canvas Checker panel with quality score, grouped issues, severity, object focus, search/filter, rule explanations, and quick fixes.
- Add rule profiles by workspace, method, customer tier, data sensitivity, lifecycle journey type, accessibility target, and deployment environment.
- Add rule categories for visual clarity, method completeness, evidence quality, accessibility, performance risk, permissions, lifecycle send safety, AI provenance, and export readiness.
- Add admin-managed severities, inherited settings, overrides, waivers, and audit trails.
- Add toolbar issue counts and action-specific gates for publish, share, export, send, template release, and AI promotion.

Acceptance:

- Canvas Checker updates as users edit and can focus each issue in the canvas.
- Rule profiles can change severity and enforcement by workspace/environment.
- Waivers are explicit, permissioned, justified, time-bound where needed, and audit logged.

### P2-79 - Solution Packaging, Environment Promotion, And Connection References

Problem:

- Demo, staging, production, customer sandbox, and regulated-region workflows need safe promotion without hardcoded secrets or environment-specific graph edits.
- Enterprise customers need evidence that packages include all required components and pass validation.

Benchmark basis:

- Power Automate solution-aware flows and Node-RED Projects.

Files:

- Solution package manifest, environment variable model, connection reference model, promotion pipeline UI, deployment history, and rollback evidence.
- New component candidates: `SolutionPackageBuilder.tsx`, `EnvironmentPromotionPipeline.tsx`, `ConnectionReferenceMapper.tsx`

Implementation:

- Add QualCanvas Solutions that package canvases, templates, snippets, connectors, journey definitions, reports, permissions, policies, tests, dependency manifests, and documentation.
- Add environment variables and connection references for dev, staging, production, customer sandboxes, demo workspaces, and regulated regions.
- Add promotion pipelines with diff preview, validation gates, approval, dry-run, rollback, run history, and deployment evidence.
- Keep secrets out of canvas files while allowing graph portability and reproducible setup in another environment.
- Add project-level README, changelog, dependency status, environment matrix, and release checklist.

Acceptance:

- A solution package validates before promotion and reports missing dependencies, policies, connection references, and tests.
- Environment-specific values are rebound through references, not hardcoded into graph objects.
- Promotions produce audit evidence, run history, rollback instructions, and release notes.

### P2-80 - Graph Symbol Index, Find References, And Blueprint-Style Navigation

Problem:

- Dense projects become hard to navigate when users cannot find where an object is used or what depends on it.
- Search should understand graph semantics, not only visible labels.

Benchmark basis:

- Unreal Blueprint search, Find References, My Blueprint outline, and Blueprint Bookmarks.

Files:

- Symbol indexer, search/reference API, bookmark model, object outline, dependency traversal UI, and index freshness worker.
- New component candidates: `GraphSymbolSearch.tsx`, `FindReferencesPanel.tsx`, `GraphBookmarksDrawer.tsx`

Implementation:

- Add graph symbol index for evidence objects, codes, themes, relations, variables, templates, prompts, models, exports, decisions, lifecycle journeys, comments, and owners.
- Add Find References, Find Dependents, Find Upstream Evidence, Find Downstream Outputs, and Find Similar Nodes.
- Add bookmark lists for named views, comments, decisions, unresolved issues, review anchors, and recent execution/debug positions.
- Add local and team bookmark scopes.
- Add index freshness indicators and background indexing status for dense projects.

Acceptance:

- Users can find every usage of a code, theme, template, prompt, model, decision, report, comment, or lifecycle journey across the project.
- Bookmarks and search results jump to the correct canvas position, zoom, object, and mode.
- Index freshness status is visible, and stale indexes do not produce silent false confidence.

### P2-81 - Data Inspector, Path Probes, And Pinned Sample Data

Problem:

- Users need to understand data moving through graph edges, mappings, prompts, reports, journeys, and exports.
- Debugging should not require repeated external calls or production side effects.

Benchmark basis:

- Node-RED Debug/sidebar messages and n8n data mapping/pinned data.

Files:

- Data probe model, node/edge inspector UI, pinned sample store, schema-shape preview, redacted fixture generator, and mapping warning system.
- New component candidates: `CanvasDataInspector.tsx`, `PinnedSamplePanel.tsx`, `SchemaShapePreview.tsx`

Implementation:

- Add edge/node data probes for item shape, source evidence, sample values, sequence/batch metadata, redaction status, and permission scope.
- Add copy reference path, copy value, pin field, pin sample, and compare before/after actions.
- Add safe pinned samples for external connectors, AI calls, exports, and lifecycle journeys.
- Add schema-shape previews and mismatch warnings before mapping values into prompts, reports, journey conditions, or exports.
- Add redacted sample data fixtures for support and training.

Acceptance:

- Users can inspect node/edge data shape, copy paths/values, pin samples, and compare transformations without leaving the canvas.
- Pinned samples are clearly marked and ignored or controlled in production contexts.
- Redacted fixtures preserve debugging value without exposing participant/client content.

### P2-82 - Execution Mode Parity, Partial Runs, And Replay-To-Editor Debugging

Problem:

- Manual, partial, production, dry-run, and replay executions can behave differently.
- Production debugging must avoid accidental emails, webhooks, exports, or AI/provider calls.

Benchmark basis:

- n8n manual, partial, production, retry, and debug-in-editor execution patterns.

Files:

- Execution mode model, replay service, side-effect suppression policy, partial-run planner, run history UI, and support bundle metadata.
- New component candidates: `ExecutionModeBadge.tsx`, `ReplayInEditorDialog.tsx`, `PartialRunPlanner.tsx`

Implementation:

- Add execution modes for sandbox/manual, selected-branch/partial, scheduled/production, replay, and dry-run.
- Show mode differences for triggers, pinned samples, saved execution data, permissions, side effects, emails, webhooks, exports, and AI/provider calls.
- Add replay-in-editor from production runs with original workflow/current workflow choice, saved input data, redaction, and side-effect suppression.
- Add branch-focused partial execution with required upstream dependencies and cannot-run explanations.
- Add execution-mode badges on run history, node states, QA artifacts, and support bundles.

Acceptance:

- Every run shows mode and side-effect policy.
- Users can replay production runs in editor with side effects suppressed by default.
- Partial runs explain required upstream dependencies and why a selected branch cannot run.

### P2-83 - Error Workflows, Node Status Signals, And Dead-Letter Operations

Problem:

- Production workflows need routed failure handling, not only console logs or failed job rows.
- Successful runs can still produce bad, empty, stale, or drifted outputs.

Benchmark basis:

- n8n Error Trigger workflows and Node-RED node status/status-node patterns.

Files:

- Error handler registry, node status model, dead-letter queues, routing rules, suspicious-success detectors, and lifecycle suppression integration.
- New component candidates: `ErrorWorkflowRouter.tsx`, `NodeStatusSignalBadge.tsx`, `DeadLetterQueuePanel.tsx`

Implementation:

- Add graph-native error handlers for imports, AI runs, connector syncs, report publishing, lifecycle sends, exports, and scheduled jobs.
- Add node status signals for connected, disconnected, rate-limited, stale, waiting, partial data, warning, degraded, retrying, skipped, and blocked.
- Add dead-letter queues for failed imports, connector events, emails, webhooks, report generations, and AI jobs.
- Add routing rules for support tasks, incident records, retry jobs, owner assignments, and lifecycle suppression.
- Add data-quality failure detection for successful runs that produce empty, low-volume, stale, biased, or schema-drifted outputs.

Acceptance:

- Failures route to configured handlers with execution, node, workflow, owner, and payload-summary metadata.
- Dead-letter queues support retry, suppress, assign, inspect, and export actions with audit history.
- Suspicious-success outputs can block reports, journey sends, exports, and roadmap promotion.

### P2-84 - Work-Item Matrix, Variant/Wedge Experiments, And Scheduler Observability

Problem:

- Batch operations need item-level visibility for status, logs, outputs, costs, retries, and side effects.
- Research teams need controlled variant experiments for prompts, models, codebooks, journeys, reports, and layouts.

Benchmark basis:

- Houdini PDG/TOPs work items, attributes, wedges, and scheduler log/status integration.

Files:

- Work-item model, matrix UI, variant run model, scheduler integration, artifact/log links, and variant comparison/promote/rollback flow.
- New component candidates: `WorkItemMatrix.tsx`, `VariantRunComparison.tsx`, `SchedulerStatusDrawer.tsx`

Implementation:

- Add work-item matrix for imports, transcriptions, coding batches, AI synthesis, report generation, journey sends, connector syncs, and export jobs.
- Add variant/wedge runs for prompt variants, model/provider variants, codebook variants, journey timing, report formats, sampling strategies, and layout algorithms.
- Show item-level attributes, dependencies, status, owner, retry count, logs, output artifacts, costs, duration, and side effects.
- Add scheduler selection/status for in-app jobs, workers, external queues, AI providers, browser workers, and enterprise compute runners.
- Add visual compare for variant outputs and promote/rollback selected variants with audit evidence.

Acceptance:

- Batch jobs expose item-level status, logs, retries, artifacts, cost, duration, and side effects.
- Variant runs can be compared and promoted or rolled back with traceable rationale.
- Scheduler status and log links are visible from the canvas and run history.

### P2-85 - Requirements Perspective, Traceability Matrix, And Coverage Gap Review

Problem:

- Research goals, customer commitments, compliance criteria, accessibility claims, and lifecycle requirements need direct links to evidence, tests, owners, and outputs.
- Coverage gaps should be visible before reports, templates, or lifecycle journeys become authoritative.

Benchmark basis:

- MathWorks Requirements Toolbox, Simulink Requirements Perspective, traceability matrices, and Model Advisor checks.

Files:

- Requirement object model, requirements perspective UI, traceability matrix, coverage gate engine, stale impact analysis, and gap review workflow.
- New component candidates: `RequirementsPerspective.tsx`, `TraceabilityMatrixPanel.tsx`, `CoverageGateReview.tsx`

Implementation:

- Add Requirements Perspective for research goals, customer commitments, accessibility criteria, compliance controls, lifecycle campaign requirements, report acceptance criteria, and training outcomes.
- Add badges and traceability panes showing which canvas nodes, evidence, tests, reports, journeys, and exports satisfy each requirement.
- Add traceability matrices for requirement-to-evidence, requirement-to-test, requirement-to-report, requirement-to-journey, and requirement-to-owner coverage.
- Add missing-link review, orphan requirement detection, stale requirement impact, and gap severity.
- Add coverage gates before publishing reports, activating lifecycle journeys, releasing templates, or making enterprise/compliance claims.

Acceptance:

- Requirements can be linked to canvas objects, evidence, tests, reports, journeys, exports, and owners.
- Traceability matrices reveal missing, stale, orphaned, and untested requirements.
- Coverage gates block high-impact actions when required links or tests are missing.

### P2-86 - Parent/Subflow Execution Correlation And Cross-Workflow Call Graphs

Problem:

- Reusable components and subflows need runtime correlation across parent and child executions.
- Debugging failures or cost spikes requires seeing parent/child call relationships and payload summaries.

Benchmark basis:

- n8n sub-workflow parent/sub-execution links and workflow execution history.

Files:

- Cross-workflow call graph model, parent/child execution links, input/output contract viewer, cross-run search, and blast-radius analysis.
- New component candidates: `CrossWorkflowCallGraph.tsx`, `ParentChildRunTimeline.tsx`, `ComponentBlastRadiusView.tsx`

Implementation:

- Add cross-workflow call graphs for subgraphs, reusable components, lifecycle journeys, templates, reports, connector syncs, and support automations.
- Link parent runs to child runs and child runs back to parent context.
- Show input contracts, returned outputs, execution IDs, mode, status, duration, cost, errors, and redacted payload summaries across boundaries.
- Add cross-run search by execution ID, user, workspace, node, workflow, trigger, component version, and external event.
- Add dependency and blast-radius views for shared components invoked by many canvases or journeys.

Acceptance:

- Parent and child executions link bidirectionally with status, version, mode, duration, cost, errors, and payload summaries.
- Users can search runs across workflow boundaries and jump to the relevant canvas/component state.
- Shared component blast-radius views show which canvases, reports, journeys, and automations depend on each component.

### P2-87 - Custom Node SDK, Node UI Standards, And Extension Test Harnesses

Problem:

- Custom research nodes, importers, AI operators, journeys, reports, and connectors need a safe authoring path before customers, partners, or internal teams create extension logic.
- Without node UI standards and contract tests, new nodes can become inconsistent, inaccessible, unsafe, or impossible to debug.

Benchmark basis:

- ComfyUI custom-node contracts and Manager flows, Node-RED node creation/help guidance, and n8n node creation, UI design, and linter guidance.

Files:

- Node SDK package, developer console, node UI standards, fixture runner, permission manifest validator, compatibility matrix, and contract test runner.
- New component candidates: `CustomNodeDeveloperConsole.tsx`, `NodeContractViewer.tsx`, `ExtensionCompatibilityMatrix.tsx`

Implementation:

- Add a first-party node SDK for research nodes, importer nodes, AI nodes, journey nodes, report nodes, validation nodes, and connector nodes.
- Add node UI standards for names, categories, input/output labels, required/optional fields, help, examples, credentials, progressive disclosure, and error copy.
- Add developer console scaffolds, typed contract previews, sample-canvas fixtures, mocked credentials, permission manifest previews, and package validation.
- Add contract tests for schemas, fixture runs, redaction, accessibility metadata, documentation completeness, compatibility, and error handling.
- Add extension compatibility checks for app version, graph schema version, permissions, connectors, AI/providers, sample data, and migrations.

Acceptance:

- A developer can scaffold, test, preview, lint, package, and validate a custom node without touching production data.
- Custom nodes cannot publish unless required UI/help, permission, schema, fixture, and compatibility checks pass.
- Users can see node purpose, author, permissions, examples, version compatibility, and known risks before install/use.

### P2-88 - Expression And Mapping Workbench With Typed Transform Preview

Problem:

- Report fields, AI prompt variables, lifecycle audience rules, exports, connector mappings, and journey personalization need visible, typed transformations.
- Hidden mappings make generated outputs hard to trust, debug, or review.

Benchmark basis:

- n8n data mapping, per-node data inspection, and expression transformation patterns.

Files:

- Expression editor, mapping graph model, schema picker, sample output preview, mapping diff engine, sandbox evaluator, and lineage capture.
- New component candidates: `ExpressionMappingWorkbench.tsx`, `MappingPreviewPanel.tsx`, `MappingLineageDrawer.tsx`

Implementation:

- Add an expression/mapping workbench for reports, AI prompts, journeys, exports, connectors, and evidence transformations.
- Provide schema-aware autocomplete, prior-node field pickers, type checks, sample output preview, before/after comparison, and redaction/permission warnings.
- Add a safe expression sandbox with timeout, side-effect blocking, cost/row estimates, unsupported function warnings, and deterministic fixture replay.
- Add mapping diffs when upstream evidence, connector, codebook, or prompt schemas change.
- Store mapping lineage for reports, AI prompts, email journeys, exports, support bundles, and audits.

Acceptance:

- Users can preview and validate mapping output before a report, AI run, export, or journey send uses it.
- Unsafe, expensive, missing, stale, or permission-violating mappings produce clear warnings and block configured high-risk actions.
- Generated outputs expose which mappings and source fields produced each result.

### P2-89 - Data Profiling, Browse Nodes, And Sample/Full-Run Boundaries

Problem:

- Evidence and audience quality issues should be visible before AI synthesis, report generation, stakeholder delivery, lifecycle sends, or roadmap promotion.
- Users need to know whether a preview is a fixture, sample, or full dataset.

Benchmark basis:

- Alteryx Browse tool data profiling and KNIME node monitor table/statistics inspection.

Files:

- Browse/Profile node model, data profile panels, sample/full-run scope badges, profile artifact persistence, quality warnings, and support-bundle export.
- New component candidates: `CanvasDataProfilePanel.tsx`, `BrowseNodePreview.tsx`, `SampleScopeBadge.tsx`

Implementation:

- Add Browse/Profile nodes and panels for transcripts, survey tables, evidence sets, code matrices, journey audiences, report datasets, connector syncs, and AI batch inputs.
- Show row/item counts, sample scope, full-run scope, type summaries, missing values, duplicates, outliers, language/locale distribution, consent gaps, and sensitivity labels.
- Add sample/full-run badges on node previews, AI prompts, lifecycle audiences, exports, and reports.
- Add profile warnings before AI synthesis, report generation, stakeholder delivery, lifecycle sends, and roadmap promotion.
- Persist profile artifacts in run history and support bundles.

Acceptance:

- Users can inspect data shape, quality, scope, sensitivity, and consent state from the canvas before running high-impact actions.
- Sample-only previews cannot be mistaken for full-data execution.
- Profile artifacts remain available in run history and support bundles without requiring a rerun.

### P2-90 - Workflow Dependency Paths, Relative Assets, And Portability Hygiene

Problem:

- Shared/imported canvases can break because media, files, templates, models, indexes, connector schemas, or journey assets are missing or tied to local paths.
- Migration, marketplace publishing, solution packaging, and regulated-region relocation need explicit dependency manifests.

Benchmark basis:

- Alteryx Workflow Dependencies and ComfyUI Manager missing-node recovery.

Files:

- Dependency manifest model, path manager UI, missing asset finder, relink workflow, path rewrite dry-run, package exporter, and import remapper.
- New component candidates: `CanvasDependencyPathManager.tsx`, `MissingAssetRecoveryPanel.tsx`, `PortabilityHealthScore.tsx`

Implementation:

- Add a dependency/path manager for media files, transcript sources, imported datasets, model/index references, connector schemas, templates, snippets, journey assets, and export destinations.
- Support relative, workspace, tenant, region, and external URI path modes with clear portability warnings.
- Add missing asset finder, relink workflow, path rewrite dry-run, archive/package export, and import-time dependency remapping.
- Flag local machine paths, expired signed URLs, inaccessible cloud files, cross-region references, missing permissions, and unsupported connector references.
- Add portability health scores before sharing, migration, solution packaging, marketplace publishing, or regulated-region relocation.

Acceptance:

- Users can see, test, relink, package, and remap all required dependencies before sharing/import/export.
- Local-only, missing, expired, inaccessible, or cross-region dependencies produce actionable warnings.
- Portable packages include manifests and import-time dependency recovery.

### P2-91 - Signed Marketplace Artifacts, SBOMs, And Supply-Chain Attestations

Problem:

- Marketplace templates, extensions, connectors, importers, and report packs become a supply-chain risk without signatures, provenance, scans, and policy checks.
- Enterprise buyers need evidence that imported assets were verified and tested.

Benchmark basis:

- SLSA supply-chain levels, Sigstore artifact signing/verification, CycloneDX component/service/dependency inventories, and SPDX software package exchange specifications.

Files:

- Marketplace signature verifier, SBOM/manifest generator, attestation store, admission policy engine, quarantine UI, scan status cards, and trust evidence export.
- New component candidates: `MarketplaceSupplyChainPanel.tsx`, `ArtifactVerificationBadge.tsx`, `SupplyChainEvidenceDrawer.tsx`

Implementation:

- Sign template, extension, connector, importer, report-pack, and workflow-marketplace artifacts and show verification status before install/import.
- Generate SBOM-style manifests for dependencies, permissions, prompts, models, external APIs, build metadata, publisher identity, and compatibility.
- Add admission policies for unsigned, unverified, quarantined, deprecated, high-risk, or policy-incompatible marketplace assets.
- Add attestations for tests, lint, vulnerability scans, license checks, malicious-behavior scans, publisher verification, and sample-canvas QA.
- Surface supply-chain evidence in procurement/trust workflows.

Acceptance:

- Users and admins can distinguish verified, unsigned, quarantined, deprecated, and policy-incompatible marketplace assets before install/import.
- Marketplace assets include machine-readable manifests and visible provenance/test evidence.
- Enterprise trust exports include current marketplace and extension supply-chain evidence.

### P2-92 - Human Fallback, Approval Escalation, And Expert Review Queues For AI Workflows

Problem:

- AI coding, summarization, recommendations, lifecycle decisions, and support automation should not silently continue when confidence, evidence quality, or policy checks fail.
- Human review should be part of the graphical workflow, not an untracked Slack/manual cleanup process.

Benchmark basis:

- n8n AI human fallback workflow pattern.

Files:

- AI fallback queue model, review task UI, escalation policy engine, model trace viewer, correction feedback loop, and canvas/report/journey interruption states.
- New component candidates: `AiHumanFallbackQueue.tsx`, `AiFallbackReviewDrawer.tsx`, `AiEscalationPolicyPanel.tsx`

Implementation:

- Add human fallback queues for low-confidence AI coding, unsupported claims, failed retrieval, ambiguous sentiment, sensitive content, risky lifecycle recommendations, and blocked connector actions.
- Show fallback reason, source evidence, model trace, confidence signals, reviewer role, SLA, recommended action, and accept/edit/reject controls.
- Add escalation rules by project sensitivity, customer tier, evidence type, lifecycle impact, compliance policy, and user role.
- Feed accepted human corrections into eval datasets, training recommendations, help-gap analysis, and prompt/template improvement loops.
- Make AI interruption visible on the canvas and in reports/journeys.

Acceptance:

- AI workflows stop into explicit review queues when configured confidence, evidence, or policy thresholds fail.
- Reviewers can accept, edit, reject, escalate, and document the decision with source evidence and model trace.
- Human corrections are available for eval and training feedback loops.

### P2-93 - Graph Compile Diagnostics, Search, Semantic Diff, And Debug Workbench

Problem:

- Users need a single place to understand why a graph cannot run, publish, export, send, or promote.
- Search, semantic diffs, breakpoints, watches, and node warnings should point to exact graph objects rather than generic logs.

Benchmark basis:

- Unreal Blueprint search/debug/diff tools and Blender Geometry Nodes inspection/warning patterns.

Files:

- Diagnostics model, compiler issue panel, graph search index, semantic diff viewer, breakpoint/watch state, call stack drawer, and node-warning focus actions.
- New component candidates: `GraphDiagnosticsWorkbench.tsx`, `SemanticGraphDiffViewer.tsx`, `GraphDebugWatchPanel.tsx`

Implementation:

- Add a unified diagnostics workbench for compile errors, static-analysis issues, missing inputs, failed mappings, invalid permissions, stale dependencies, unresolved references, and inaccessible outputs.
- Add clickable diagnostics that focus the exact node, edge, port, parameter, section, mapping, requirement, template, or dependency.
- Add semantic graph diff for canvases, templates, journeys, prompts, reports, mappings, permissions, and dependencies.
- Add breakpoints, watches, active path highlighting, execution call stack, and invalid-breakpoint explanations.
- Add background graph indexing for project-wide search across nodes, pins, fields, comments, parameters, mappings, references, and hidden dependencies.

Acceptance:

- Every blocking diagnostic links to a precise canvas object and recommended fix.
- Users can diff meaningful graph changes without reading raw JSON.
- Breakpoints, watches, and call stacks work for supported run types without leaking restricted data.

### P2-94 - Data Trees, Domains, Cardinality, And Collection Semantics

Problem:

- The same evidence values can produce different results depending on whether they are single items, lists, grouped lists, trees, matrices, streams, samples, or full datasets.
- Users need explicit warnings when connecting participant-level, excerpt-level, theme-level, account-level, or recipient-level data incorrectly.

Benchmark basis:

- Grasshopper data trees/Parameter Viewer and Blender Geometry Nodes attribute domains/Viewer/Spreadsheet patterns.

Files:

- Collection-shape model, cardinality badges, branch/path viewer, domain compatibility validator, matching/lacing controls, and mapping preview updates.
- New component candidates: `CollectionShapeBadge.tsx`, `BranchPathViewer.tsx`, `DomainMatchingControls.tsx`

Implementation:

- Add collection semantics for participant sets, evidence excerpts, code instances, theme clusters, journey audiences, report sections, tasks, and message recipients.
- Show cardinality badges on ports and edges: one item, list, grouped list, tree/branch, matrix, stream, sample, and full dataset.
- Add branch/path viewers for grouped evidence, segments, survey responses, code matrices, audience cohorts, and batch work items.
- Add relation-domain warnings for participant-level, excerpt-level, code-level, theme-level, account-level, and journey-recipient-level mismatches.
- Add matching controls for one-to-one, one-to-many, many-to-one, cross product, grouped-by-key, and preserve-branch transformations.

Acceptance:

- Users can inspect collection shape and branch paths before transformations run.
- Mismatched domain/cardinality connections are flagged with clear consequences and fix options.
- Mapping previews show how items are paired, grouped, expanded, or reduced.

### P2-95 - Public Component Interfaces, Parameter Panels, And Environment Bindings

Problem:

- Reusable subgraphs and marketplace workflows need stable public controls without exposing fragile internals.
- Environment-specific settings must be visible and safely promotable across dev, staging, production, customer sandboxes, and regulated regions.

Benchmark basis:

- Blender node groups, TouchDesigner Components/Parameter COMP, and Apache NiFi Parameter Contexts.

Files:

- Component interface schema, parameter panel builder, environment binding model, invalidation preview, override manager, and safe parameter export.
- New component candidates: `ComponentInterfaceDesigner.tsx`, `EnvironmentBindingPanel.tsx`, `ParameterInvalidationPreview.tsx`

Implementation:

- Add a public interface designer for reusable subgraphs, research digital assets, templates, and marketplace workflows.
- Let authors expose curated parameters, hide internals, group controls into panels, set defaults, validation, help, ranges, examples, and role visibility.
- Add environment bindings for workspace, region, connector, model/provider, email provider, storage, permissions, budget, and consent settings.
- Show which component instances will be invalidated, restarted, rerun, or require approval when a parameter/environment binding changes.
- Add parameter-set import/export and per-environment overrides.

Acceptance:

- Reusable components can expose stable public parameters while keeping internals locked or hidden.
- Environment overrides are visible before promotion and never export secret values.
- Parameter changes show blast radius, invalidation behavior, and approval requirements.

### P2-96 - Performance Profiling, Hot-Path Heatmaps, And Run Cost Budgets

Problem:

- Canvas performance, AI cost, connector latency, large mappings, and journey sends need node-level diagnosis, not only global metrics.
- Flicker and interaction drops should create profiler evidence users/support can inspect.

Benchmark basis:

- TouchDesigner Perform DAT and real-time profiling patterns from mature graphical tools.

Files:

- Profiler event model, hot-path overlay renderer, node/edge timing counters, cost budget dashboards, threshold snapshot capture, and support-bundle artifact export.
- New component candidates: `CanvasHotPathOverlay.tsx`, `RunProfilerSnapshotPanel.tsx`, `CostBudgetHeatmap.tsx`

Implementation:

- Add hot-path overlays for slow layout, slow render, heavy search, expensive import, expensive AI call, large mapping, slow export, or high-volume journey send.
- Add node/edge counters for CPU/browser time, worker time, backend time, queue wait, AI tokens/cost, connector latency, and email throughput.
- Add threshold-triggered profiler snapshots for slow frames, dropped interactions, long tasks, runaway mappings, excessive rerenders, or expensive AI/report jobs.
- Add performance tables and flame-style run summaries in support bundles and QA artifacts.
- Add budgets by canvas size, graph density, media volume, evidence count, recipient count, and device class.

Acceptance:

- Slow graph interactions and expensive runs identify the responsible nodes/edges where possible.
- QA artifacts and support bundles include profiler snapshots for threshold breaches.
- Performance budgets produce actionable pass/fail results by canvas/device class.

### P2-97 - Operator Palette, Certified Snippets, And Contextual Node Discovery

Problem:

- Users need to discover the right node, template, importer, report block, journey block, or validation rule from context.
- Example snippets should be certified, governed, and connected to training, not just static documentation.

Benchmark basis:

- TouchDesigner Palette/OP Snippets, Blender node group reuse, and Unreal Blueprint graph search.

Files:

- Contextual operator palette, snippet certification metadata, palette approval controls, discovery search facets, training deep-link hooks, and deprecated-node warning logic.
- New component candidates: `ContextualOperatorPalette.tsx`, `CertifiedSnippetCard.tsx`, `ApprovedPaletteAdminPanel.tsx`

Implementation:

- Add a contextual operator palette that surfaces nodes, snippets, templates, importers, report blocks, journey blocks, and validation rules based on current selection and project method.
- Add certified snippets with sample data, expected output, permissions, dependencies, risk level, author, version, and adaptation steps.
- Add favorites, recents, team-approved palettes, admin-hidden/internal nodes, and deprecated-node warnings.
- Add operator search facets for purpose, input/output types, method, role, permissions, connector, AI/provider, sample availability, and maturity.
- Add snippet-to-training links for lifecycle emails and in-app academy tasks.

Acceptance:

- Node/template/snippet discovery adapts to selection context and project method.
- Certified snippets expose dependencies, permissions, risk, expected output, and adaptation guidance before insertion.
- Admins can hide internal nodes, approve palettes, and warn/block deprecated nodes.

### P2-98 - Versioned Flow States, Registry Buckets, And Parameter Context Promotion

Problem:

- Teams need deployable version states for reusable components, marketplace assets, templates, journeys, report packs, prompt packs, connector packages, and imported canvases.
- Parameter/environment promotion should be explicit and should not export secrets.

Benchmark basis:

- Apache NiFi versioned process groups, registry buckets, version states, nested version conflicts, and Parameter Context behavior.

Files:

- Version-state model, registry bucket UI, promotion workflow, parameter-context merge/replacement rules, nested version conflict detector, and secret omission checks.
- New component candidates: `VersionedFlowStateBadge.tsx`, `RegistryBucketBrowser.tsx`, `ParameterContextPromotionReview.tsx`

Implementation:

- Add version-state badges for reusable components, marketplace assets, templates, journeys, report packs, prompt packs, connector packages, and imported canvases.
- Add registry buckets for team, organization, marketplace, customer sandbox, implementation partner, and regulated-region assets.
- Add local modified/stale/sync-failure states with commit, revert, compare, refresh, and promote actions.
- Add parameter-context promotion rules that preserve or replace environment bindings intentionally and never export secret values.
- Add nested-version conflict handling so parent packages cannot be promoted while child components have unresolved local changes.

Acceptance:

- Versioned graph assets show up-to-date, locally modified, stale, locally modified and stale, or sync-failure states.
- Promotion flows require explicit parameter/environment decisions and omit secret values.
- Parent assets cannot promote while nested child assets have unresolved local changes.

### P3-01 - Portable Canvas DSL And Component Versioning

Problem:

- Reusable analysis blocks need a durable format and migration story.
- Canvas exports should preserve more than screenshots.

Benchmark basis:

- Dify DSL export, Langflow serializable flows, Rivet graph files, Obsidian Canvas JSON, and KNIME reusable components.

Implementation:

- Define a versioned canvas export/import schema for nodes, edges, positions, groups, sections, templates, analysis metadata, and run history.
- Add migration handling for older canvas versions.
- Add template/component version metadata and upgrade prompts.

Acceptance:

- A canvas can be exported/imported without losing layout, groups, lineage, or template metadata.
- Version mismatches produce clear warnings, not broken graphs.

### P3-02 - Live Example Snippets And Training Deep Links

Problem:

- Static help is weaker than insertable examples tied to real canvas actions.
- Lifecycle emails need precise destinations, not generic help pages.

Benchmark basis:

- TouchDesigner OP Snippets, n8n sticky-note documentation, Zapier Canvas planning, and ComfyUI/Node-RED reusable graph patterns.

Implementation:

- Create a snippet library with small, safe, insertable examples.
- Add "learn this pattern" links from templates, node states, and graph health warnings.
- Link lifecycle emails to exact training tasks, canvas sections, and snippets.

Acceptance:

- Users can insert a working example from help/training into a canvas.
- Email/training CTAs open a specific canvas state or guided task.

### P3-03 - Self-Documenting Nodes And Port-Level Help

Problem:

- More powerful canvas semantics will increase learning cost.
- Users need help and validation at the point of construction, not in disconnected documentation.

Benchmark basis:

- Substance visual tooltips/documentation links, Dynamo node documentation, LabVIEW connector panes, and TouchDesigner OP Snippets.

Implementation:

- Add node info drawer with purpose, inputs, outputs, examples, provenance, validation, and next actions.
- Add port hints for expected research object types.
- Add inline error explanations for missing/invalid inputs.
- Add visual previews in the node and template picker.
- Link node help to training snippets and lifecycle email destinations.

Acceptance:

- Users can understand and fix invalid nodes without leaving the canvas.
- Node/template picker explains the result before insertion.
- Help content can deep-link to an insertable example.

### P3-04 - Large Canvas Performance Budget And Level-Of-Detail Rendering

Problem:

- Dense-graph QA already exposed blank states, flicker, clipped overlays, and unstable dense graph behavior.
- New graph features will worsen performance unless scalability is designed explicitly.

Benchmark basis:

- Professional graph tools rely on level-of-detail, progressive rendering, filtered views, and separate overview/detail modes.

Implementation:

- Define performance budgets for first load, fit, pan/zoom, search, filter, layout, auto-arrange, minimap readiness, screenshot stability, memory, node count, and edge count.
- Add node and edge virtualization where safe.
- Add edge label/detail tiers based on zoom and selection.
- Add progressive minimap and overview rendering.
- Add instrumentation for pan/zoom frame drops, fit latency, layout latency, and flicker/idle-frame instability.
- Add dense QA canvases for 50, 150, 500, and 1000 object scenarios.

Acceptance:

- Dense graph performance has objective pass/fail budgets.
- Low-zoom and high-count interactions do not render every label, handle, and edge detail at once.
- QA artifacts report performance metrics alongside screenshots/videos.

### P3-05 - AI Evaluation And Prompt Governance

Problem:

- Prompt/model/template changes can alter research outputs even if the visible graph structure is unchanged.
- AI-assisted analysis needs regression tests and promotion gates.

Benchmark basis:

- LangSmith prompt environments, datasets, evaluators, and W&B Weave prompt versioning/tracing/evaluations.

Implementation:

- Version prompts, models, analysis templates, report templates, email templates, evaluation datasets, and evaluators.
- Add staging/production-like promotion for coding schemes, AI analysis prompts, report templates, and lifecycle email templates.
- Add eval datasets for generated codes, summaries, themes, claims, training recommendations, and report sections.
- Add comparison dashboard for AI output quality across prompt/model/template versions.
- Store exact AI configuration versions in insight/report/run provenance.

Acceptance:

- New AI templates cannot become default without configured eval gates.
- Users can compare output quality before and after AI configuration changes.
- Generated outputs cite exact prompt/model/template/evaluator versions.

### P3-06 - Sensitive Data, Redaction, And Permission Architecture

Problem:

- Research transcripts, comments, AI traces, and lifecycle emails can expose sensitive participant/client data.
- Stakeholder review needs limited evidence visibility without breaking provenance.

Benchmark basis:

- n8n execution redaction, role-specific graph perspectives, and qualitative research provenance expectations.

Implementation:

- Add role-aware visibility for transcripts, excerpts, codes, memos, comments, AI runs, reports, exports, and email/training destinations.
- Add redacted previews and run logs that preserve status, timing, and provenance.
- Add PII/sensitive-data warnings on transcript import, AI analysis, stakeholder share, and export.
- Add consent/data-use labels that travel with excerpts and generated outputs.
- Add stakeholder-safe export/review mode.
- Add lifecycle email permission checks for consent, role, and data-use labels.

Acceptance:

- Stakeholder views and exports do not expose restricted evidence by default.
- AI run logs can be shared without leaking transcript content.
- Email/training campaigns respect consent, role, and data-use constraints.

### P3-07 - Governed Template And Extension Registry

Problem:

- Research templates, lifecycle journeys, snippets, and future extensions need versioning, dependencies, permissions, and deprecation before they become team-wide assets.
- A template ecosystem without governance can insert broken workflows, unsafe permissions, or outdated analysis patterns.

Benchmark basis:

- ComfyUI Registry/templates, Figma plugins/widgets and organization controls, and Miro Marketplace/templates/app management.

Implementation:

- Add a Research Template Registry schema for methods, analysis blocks, report paths, lifecycle email journeys, training tasks, review boards, and future extensions.
- Add semantic versions, version pinning, upgrade/rollback, changelog, author, compatibility, and deprecation metadata.
- Add dependency checks for codes, prompts, models, permissions, integrations, training content, and email consent rules.
- Add organization/team approval controls and permission/risk metadata.
- Add compatibility warnings for imported/shared canvases that reference missing or deprecated templates/extensions.
- Add usage analytics and health metrics for templates/extensions.

Acceptance:

- Template insertion never silently fails on missing dependencies.
- Organizations can approve, block, or deprecate templates/extensions before broad use.
- Users can see permissions, author, changelog, version, compatibility, and deprecation status before insertion.

## Engagement Email System Backlog

Build this after P0/P1 canvas fixes so emails drive users into a stable product.

### ENG-01 - Lifecycle Event Model

Events:

- `signed_up`
- `first_canvas_created`
- `first_transcript_imported`
- `first_code_created`
- `first_export_created`
- `inactive_3_days`
- `inactive_7_days`
- `trial_ending`
- `feature_released`
- `training_recommended`

Acceptance:

- Events are recorded server-side and can be replayed in staging without sending email.

### ENG-02 - Email Preferences And Compliance

Requirements:

- Store unsubscribe/preference state.
- Separate transactional/product-help messages from marketing/product-update messages.
- Respect consent for training/newsletter style emails.
- Include unsubscribe or preference management where required.

Acceptance:

- No lifecycle campaign can send without checking preference state.

### ENG-03 - Email Templates And Destinations

Templates:

- Welcome and first value checklist.
- Import transcript reminder.
- First coding nudge.
- Export/share prompt.
- Inactivity reactivation.
- Training course recommendation.
- New feature update.

Destinations:

- Training Center.
- Sample canvas.
- Import guide.
- Coding quick-start.
- Export/share guide.
- Feature announcement page.

Acceptance:

- Every email has one primary CTA and a corresponding in-app/website destination.

### ENG-04 - Scheduler And Suppression Rules

Implementation:

- Add scheduler/worker or queue.
- Suppress messages when the user already completed the target action.
- Rate-limit lifecycle emails.
- Add admin preview/dry-run mode.

Acceptance:

- User cannot receive conflicting nudges.
- Staging dry-run shows who would receive which email and why.

## Test And Verification Commands

Local quality gates:

```powershell
npm run typecheck
npm run lint
npm run build
```

Targeted Playwright gates:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-deep-layout.spec.ts e2e/canvas-deep-edges.spec.ts e2e/canvas-workspace.spec.ts e2e/mobile-responsive.spec.ts e2e/dark-mode.spec.ts e2e/canvas-toolbar-dropdowns.spec.ts
```

Future enterprise-readiness regression slice after P2-55 through P2-59 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-identity-access-lifecycle.spec.ts e2e/canvas-secrets-key-management.spec.ts e2e/canvas-api-contract-lifecycle.spec.ts e2e/canvas-backup-restore-dr.spec.ts e2e/canvas-i18n-localization.spec.ts
```

Future self-improving operations regression slice after P2-60 through P2-64 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-design-rules-preflight.spec.ts e2e/canvas-parametric-history.spec.ts e2e/canvas-operational-workbenches.spec.ts e2e/canvas-success-support-loop.spec.ts e2e/canvas-academy-guided-practice.spec.ts
```

Future professional-platform ergonomics regression slice after P2-65 through P2-69 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-power-user-profiles.spec.ts e2e/canvas-research-digital-assets.spec.ts e2e/canvas-decision-inbox.spec.ts e2e/canvas-data-residency.spec.ts e2e/canvas-release-migration-assistant.spec.ts
```

Future adoption-readiness regression slice after P2-70 through P2-74 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-migration-hub.spec.ts e2e/canvas-procurement-evidence-room.spec.ts e2e/canvas-accessibility-conformance.spec.ts e2e/canvas-rendering-performance.spec.ts e2e/canvas-research-method-governance.spec.ts
```

Future visual-workflow operability regression slice after P2-75 through P2-80 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-nested-subgraphs.spec.ts e2e/canvas-dependency-resolver.spec.ts e2e/canvas-example-gallery.spec.ts e2e/canvas-static-analysis.spec.ts e2e/canvas-solution-packaging.spec.ts e2e/canvas-symbol-index.spec.ts
```

Future debuggable-research-automation regression slice after P2-81 through P2-86 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-data-inspector.spec.ts e2e/canvas-execution-replay.spec.ts e2e/canvas-error-status-deadletter.spec.ts e2e/canvas-work-item-matrix.spec.ts e2e/canvas-requirements-traceability.spec.ts e2e/canvas-subflow-execution-correlation.spec.ts
```

Future ecosystem-safety regression slice after P2-87 through P2-92 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-custom-node-sdk.spec.ts e2e/canvas-expression-mapping-workbench.spec.ts e2e/canvas-data-profiling-browse.spec.ts e2e/canvas-dependency-path-hygiene.spec.ts e2e/canvas-marketplace-supply-chain.spec.ts e2e/canvas-ai-human-fallback.spec.ts
```

Future professional-graph-engineering regression slice after P2-93 through P2-98 exist:

```powershell
npx playwright test --project=setup --project=chromium e2e/canvas-graph-diagnostics-workbench.spec.ts e2e/canvas-collection-semantics.spec.ts e2e/canvas-component-interface-bindings.spec.ts e2e/canvas-performance-hotpaths.spec.ts e2e/canvas-operator-palette-snippets.spec.ts e2e/canvas-versioned-flow-promotion.spec.ts
```

Artifact QA gates:

```powershell
node test-results/live-visual-qa-deep.mjs
node test-results/live-visual-modal-pass.mjs
node test-results/live-visual-stress-pass.mjs
node test-results/live-visual-responsive-pass.mjs
```

Post-fix acceptance:

- No failed requests or console errors in artifact summaries, excluding explicitly expected auth-gated states.
- All temporary QA canvases report `leftovers: []`.
- Video contact sheets show no blank first mobile viewport, no clipped critical menus, and no obvious flicker.

## Dependency Map

Do first:

- P0-01 Dynamic Fit View, because mobile shell/menu fixes rely on stable viewport behavior.
- P0-02 Mobile Canvas Shell, because it removes minimap/status/control collisions.

Do next:

- P0-03 Responsive Menus, because it needs the mobile shell breakpoints.
- P0-04 Auto-Layout, because it uses the new fit helper.

Then:

- P1-01 Modal Accessibility can happen independently.
- P1-02 Calendar Auth and P1-03 Telemetry can happen independently.
- P1-04 Minimap Flicker should follow P0-02.

Later:

- P2 overview/selection improvements.
- P2-04 Canvas Navigation Model before deeper sections/subgraphs work.
- P2-05 Graph Hygiene Toolkit before calling dense graphs production-grade.
- P2-06 Sections/Subgraphs and P2-07 Contextual Add as the main benchmark-derived product lift.
- P2-08 Canvas-As-Research-Story before broad lifecycle/training campaigns.
- P2-09 Analysis State/Lineage before relying on AI-generated research outputs.
- P2-10 Dual Edit/Review/Present Modes before making mobile/stakeholder review a primary workflow.
- P2-11 AI Scaffold/Templates before heavy onboarding and training campaigns.
- P2-12 Spatial Landmarks after navigator/search foundations are in place.
- P2-13 Typed Research Links before adding more analysis/report relation types.
- P2-14 Non-Destructive Perspectives before stakeholder/reviewer views become default workflows.
- P2-15 CAQDAS Research Maps before positioning the canvas as a serious qualitative analysis surface.
- P2-16 Observable Analysis Run Mode before broad AI automation, reporting, and lifecycle email automation.
- P2-17 Collaboration/Version History before multi-user research review becomes a default workflow.
- P2-18 Data Preview/Quality Panels before adding more generated research outputs.
- P2-19 Accessible Graph Navigator before calling the graph accessible or enterprise-ready.
- P2-20 Touch/Pen Interaction Model before expanding mobile/tablet stakeholder review.
- P2-21 Diagram Controls before calling auto-layout or relation visualization mature.
- P2-22 Facilitated Review Sessions before using the canvas as a default stakeholder workshop surface.
- P2-23 Systems-Map Analytics/Visual Query before positioning the canvas as graph intelligence rather than graph drawing.
- P2-24 Research Advisor/Impact/Test Harnesses before scaling AI reruns, template publishing, stakeholder sharing, or lifecycle email automation.
- P2-25 Enterprise Governance before organization-wide rollout, sensitive-project sharing, broad AI authoring, or lifecycle email automation.
- P2-26 Reproducible Publishing before treating reports/decks/exports as authoritative research deliverables.
- P2-27 Journey/Blueprint Views before using QualCanvas as a service-design or CX operating surface.
- P2-28 AI-Assisted Authoring after provenance/advisor foundations and before broad AI-generated reports, journeys, or lifecycle emails.
- P2-29 Integration/API Platform before external sync, webhooks, bulk import/export automation, or partner integrations.
- P2-30 Lifecycle Journey Builder before activating broad email/training/reactivation campaigns.
- P2-31 Durable Orchestration before relying on background imports, AI runs, exports, reports, syncs, or sends at scale.
- P2-32 Research-To-Roadmap Traceability before using QualCanvas recommendations as delivery commitments.
- P2-33 Semantic Evidence Graph before long-term archive, external graph exchange, or compliance-grade provenance exports.
- P2-34 Production UX Observability before claiming the live graphical tool is production-operable at scale.
- P2-35 Offline/Local-First Collaboration before offline fieldwork, workshop mode, or conflict-prone collaboration.
- P2-36 Sandboxed Extension Runtime before third-party templates, plugins, importers, or exporters can run code.
- P2-37 Media Evidence Pipeline before broad audio/video/transcript-heavy research workflows.
- P2-38 Hybrid Search/RAG before positioning AI answers or reports as evidence-complete.
- P2-39 Model/Provider Ops before broad AI authoring, embeddings, transcription, report generation, or lifecycle AI recommendations.
- P2-40 Execution Queue/Partial Recompute before broad expensive AI/report/import/export workflows.
- P2-41 Dataflow Backpressure/Replay before scaling imports, transcriptions, webhooks, exports, or lifecycle sends.
- P2-42 Product Analytics/Flags/Experiments before optimizing onboarding, lifecycle email timing, training prompts, or risky feature rollouts.
- P2-43 Marketplace Trust before opening template/workflow distribution beyond curated internal templates.
- P2-44 Scientific Reproducibility before treating published reports, research packets, or lifecycle decisions as defensible research artifacts.
- P2-45 Data Quality/Contracts before AI synthesis, report publish, stakeholder export, lifecycle send, or roadmap promotion depends on imported evidence.
- P2-46 Visual Change Review before branch merge, template release, risky AI edit acceptance, report publish, or lifecycle journey activation at scale.
- P2-47 Connector Drift Management before expanding third-party data sources or depending on integrations for authoritative reports/journeys.
- P2-48 Stakeholder Portal/Subscriptions before broad recurring stakeholder delivery, external sharing, or executive dashboards.
- P2-49 Scenario Simulation/Visual Debugging before activating high-impact lifecycle campaigns, roadmap changes, or automated AI/report workflows.
- P2-50 Design Tokens/Visual Regression before broad visual redesign, theme expansion, or claiming graphical state regressions are controlled.
- P2-51 Research Asset Catalog before enterprise-scale evidence libraries, cross-project reuse, or governance-heavy customer rollout.
- P2-52 Retention/Legal Hold before regulated customers, sensitive-project deletion workflows, eDiscovery requests, or long-term support bundle storage.
- P2-53 Resource Quotas/Budgets before scaling AI, transcription, media, lifecycle sends, exports, or large-canvas background jobs.
- P2-54 Incident Response before production commitments for lifecycle sends, stakeholder portals, enterprise SLAs, or regulated research delivery.
- P2-55 Enterprise Identity/Access Lifecycle before enterprise rollout, external stakeholder portals, broad guest review, or regulated customer onboarding.
- P2-56 Secrets/Key Management before expanding third-party integrations, AI providers, email providers, webhook endpoints, or enterprise BYOK commitments.
- P2-57 API/Event Contracts before public API/webhook launch, partner integrations, marketplace automations, lifecycle event consumers, or external data sync guarantees.
- P2-58 Backup/Restore/DR before production SLAs, regulated customer commitments, destructive workspace operations, or high-value research repository migrations.
- P2-59 Internationalization/Localization before global launch, multilingual research delivery, RTL markets, localized lifecycle journeys, or localized stakeholder portals.
- P2-60 Design Rules/Preflight before publish, export, lifecycle send, template release, roadmap promotion, or high-confidence AI output claims.
- P2-61 Parametric Timeline/Dependency Rebuild before branch-heavy research work, alternate coding schemes, model/prompt changes, or audit-sensitive reports.
- P2-62 Operational Workbenches before scaling reviewer, support, customer success, admin, executive, integration-owner, or training-author workflows.
- P2-63 Customer Success/Support Loop before optimizing lifecycle messaging, onboarding nudges, training recommendations, support AI, or churn-risk playbooks.
- P2-64 Guided Academy before broad self-serve onboarding, certification, customer training, partner enablement, or role-specific education campaigns.
- P2-65 Power-User Profiles before broad expert workflow rollout, macro automation, keyboard-first editing, or organization-standard workspaces.
- P2-66 Research Digital Assets before broad reusable workflow distribution, marketplace asset publication, or high-dependency template ecosystems.
- P2-67 Decision Inbox before scaling asynchronous review, approval-heavy workflows, stakeholder comments, or notification-heavy customer success/support processes.
- P2-68 Data Residency/Boundaries before regulated-region sales, cross-region AI/transcription workflows, enterprise app integrations, or residency migration promises.
- P2-69 Release/Migration Assistant before frequent schema/node/template/API/prompt changes, public deprecations, or customer-specific upgrade commitments.
- P2-70 Migration Hub before large customer migrations, competitor replacement promises, migration-assisted onboarding, or import-heavy sales commitments.
- P2-71 Procurement Evidence Room before enterprise sales at scale, security questionnaires, regulated customers, or high-touch security review automation.
- P2-72 Accessibility Conformance before accessibility-backed procurement claims, VPAT/ACR delivery, public sector customers, or enterprise accessibility commitments.
- P2-73 Browser Rendering Pipeline before 500+ object canvases, dense media projects, multi-locale graph rendering, or claiming large-canvas performance is production-grade.
- P2-74 Research Method Governance before using QualCanvas outputs for executive recommendations, lifecycle targeting, product decisions, or regulated/high-stakes research.
- P2-75 Nested Subgraphs before reusable research components, organization-approved subgraph assets, complex template composition, or blueprint-style graph reuse.
- P2-76 Dependency Resolver before broad import sharing, external template adoption, AI/report reproducibility claims, or lifecycle journey execution from shared canvases.
- P2-77 Example Gallery before scaling self-serve onboarding, lifecycle training CTAs, academy challenges, or method-specific in-product education.
- P2-78 Continuous Canvas Static Analysis before enforcing publish/share/export/send gates, customer-specific quality policies, or high-confidence canvas health claims.
- P2-79 Solution Packaging before dev/staging/production promotion, customer sandbox rollout, regulated-region deployment, or implementation-partner delivery.
- P2-80 Graph Symbol Index before very large projects, cross-project reuse, dense review sessions, template dependency analysis, or graph-wide impact navigation.
- P2-81 Data Inspector before complex mapping, prompt/report/journey condition authoring, support debugging, or side-effect-safe workflow iteration.
- P2-82 Execution Replay before production lifecycle sends, scheduled imports, AI/report automation, webhook handling, or customer support replay workflows.
- P2-83 Error/Status/Dead-Letter Operations before activating scheduled production jobs, lifecycle campaigns, connector syncs, or AI/report generation at scale.
- P2-84 Work-Item Matrix before high-volume imports, transcriptions, AI batches, export jobs, variant prompt/model experiments, or multi-recipient journey sends.
- P2-85 Requirements Traceability before enterprise/compliance claims, accessibility claims, regulated reports, lifecycle policy commitments, or executive-ready customer deliverables.
- P2-86 Subflow Execution Correlation before heavy reusable component invocation, cross-workflow automations, shared journey templates, or cost/error attribution across subflows.
- P2-87 Custom Node SDK before third-party node ecosystem, internal extension teams, marketplace nodes, or customer-specific node authoring.
- P2-88 Expression Mapping before complex report/AI/journey/export mappings or non-engineer transformation authoring.
- P2-89 Data Profiling before full-run AI synthesis, bulk imports, survey analysis, segmentation, lifecycle targeting, or executive reports.
- P2-90 Dependency Path Hygiene before portable packages, migrations, workspace export/import, media-heavy research, or regulated-region relocation.
- P2-91 Marketplace Supply Chain before public/community marketplace, enterprise extension approval, implementation-partner assets, or third-party importer/exporter distribution.
- P2-92 AI Human Fallback before autonomous AI coding, AI-generated recommendations, support automation, lifecycle decisions, or high-risk research outputs.
- P2-93 Graph Diagnostics before enforcing publish/export/send/promote gates, complex branch review, broad debugging workflows, or support automation.
- P2-94 Collection Semantics before advanced mappings, bulk evidence transforms, segmentation, audience personalization, code matrices, or batch recipient logic.
- P2-95 Component Interfaces/Environment Bindings before marketplace reusable assets, customer sandbox promotion, regulated-region deployment, or broad reusable journey/report packs.
- P2-96 Performance Hotpaths before 500+ object canvases, high-volume imports, expensive AI/report jobs, lifecycle sends, or production performance SLAs.
- P2-97 Operator Palette/Snippets before broad self-serve node discovery, partner-created snippets, role-specific palettes, or training/email deep-link expansion.
- P2-98 Versioned Flow Promotion before multi-environment template/component rollout, implementation-partner delivery, marketplace promotion, or regulated customer package movement.
- P3-01 Portable Canvas DSL and P3-02 Snippets after core graph model changes stabilize.
- P3-03 Self-Documenting Nodes before broad template/snippet expansion.
- P3-04 Performance Budgets before adding 500+ object canvas workflows.
- P3-05 AI Evaluation/Prompt Governance before productionizing new AI analysis defaults.
- P3-06 Sensitive Data/Redaction before stakeholder sharing and lifecycle emails are expanded.
- P3-07 Governed Template/Extension Registry before broad community, organization, or third-party template distribution.
- Engagement email system after graphical UX is stable.

## Definition Of Done

A fix batch is done only when:

- Implementation is complete.
- Unit/component tests are updated where applicable.
- Relevant Playwright specs pass.
- Production-like artifact script has been rerun.
- Screenshots and videos are reviewed.
- New findings are appended to the review report if anything remains.
- There are no leftover temporary QA canvases.

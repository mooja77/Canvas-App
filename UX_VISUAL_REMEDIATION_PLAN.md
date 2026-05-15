# QualCanvas Visual/UI Remediation Plan

Date: 2026-05-14

Scope: fix the live UI/UX issues found in the production browser reviews, with priority on the graphical canvas experience. This plan intentionally separates fixes from review artifacts so implementation can be done in controlled phases.

Evidence sources:

- `test-results/ui-ux-review-2026-05-14-deep-live-report.md`
- `test-results/ui-ux-review-2026-05-14T10-20-29-345Z-deep-live-visual/`
- `test-results/ui-ux-review-2026-05-14T10-30-35-367Z-supplemental-modals/`
- `test-results/ui-ux-review-2026-05-14T11-17-29-191Z-stress-interactions/`
- `test-results/ui-ux-review-2026-05-14T13-43-13-943Z-responsive-orientation/`
- `UX_CANVAS_BENCHMARK_RESEARCH.md`

Execution backlog:

- `UX_VISUAL_FIX_EXECUTION_BACKLOG.md`

## Priority Order

1. Mobile and responsive canvas framing.
2. Tools/Analyze popover placement and mobile action sheets.
3. Auto-layout shape, edge preservation, and post-layout fit.
4. Minimap/status/controls collision and visual flicker.
5. Modal accessibility, calendar auth state, and telemetry endpoint.
6. Low-zoom legibility, selection affordances, and overview mode.
7. Benchmark-derived navigation, sections, graph hygiene, and contextual creation.
8. Engagement/onboarding improvements and lifecycle email system.
9. Accessibility, cross-device interaction modes, and governed template/extension ecosystems.
10. Diagram-grade controls, facilitated review, visual query, and advisor-grade validation.
11. Enterprise governance, reproducible publishing, journey views, AI authoring, and integration platform.
12. Lifecycle journey orchestration, durable jobs, roadmap traceability, semantic graph interchange, and production UX observability.
13. Offline/local-first collaboration, sandboxed extensions, media evidence pipelines, hybrid search/RAG, and model/provider operations.
14. Queue-aware execution, provenance replay, product engagement analytics, marketplace trust, and reproducible workflow packaging.
15. Data-quality contracts, semantic change review, connector drift handling, stakeholder portals, and scenario simulation/debugging.
16. Design-token governance, research asset catalog, retention/legal hold, quota management, and incident response.
17. Enterprise identity, secrets/key management, API/event contracts, backup/DR, and internationalization.
18. Design-rule preflight, parametric history, role-specific workbenches, customer-success feedback loops, and guided academy.
19. Power-user profiles, procedural asset packaging, spatial decision inboxes, data residency transparency, and release/migration assistance.
20. Migration hub, procurement evidence room, accessibility conformance reporting, browser rendering architecture, and research-method governance.
21. Nested reusable subgraphs, dependency recovery, example-driven learning, live canvas checking, solution packaging, and graph-wide find/reference navigation.
22. Data probes, execution replay, error routing, work-item observability, requirements traceability, and parent/subflow execution correlation.
23. Custom-node SDKs, expression/mapping workbench, data profiling, dependency path hygiene, signed marketplace artifacts, and AI human fallback.
24. Graph compile/debug workbench, collection semantics, public component interfaces, hot-path profiling, operator palettes, and versioned flow promotion.

## Benchmark-Informed Product Bar

The production defects should be fixed first, but the target should not stop at "no clipping/no blank screens." Based on the benchmark research, QualCanvas should aim for:

- Miro-level orientation recovery with explicit home, fit, and saved-view controls.
- ComfyUI and Node-RED-level graph operations, including quick add, selection actions, status indicators, and reusable subgraphs.
- FigJam-level sectioning and tidy-up tools for large visual workspaces.
- Blender-level graph hygiene through reroutes, meaningful colors, breadcrumbs, and reusable grouped logic.
- n8n-level inline documentation through notes, templates, and command-driven actions.
- Obsidian-level durable canvas artifacts that can become notes, reports, training objects, and portable exports.
- Cytoscape-level layout choice by graph purpose rather than one hardcoded auto-layout.

Benchmark-derived workstreams:

- Canvas Navigation Model: home view, fit all, fit selection, jump to search result, jump to section, saved named views, and outline/navigator.
- Responsive Review Mode: mobile overview, bottom-sheet action menus, compact status, comment/review/share-first actions, and desktop handoff for full graph editing.
- Graph Hygiene Toolkit: reroutes, waypoints, orthogonal edges, edge labels, edge opacity/bundling, and graph health warnings.
- Sections, Subgraphs, And Analysis Blocks: titled sections, collapse/expand, convert selection to section, reusable analysis templates, and nested breadcrumbs.
- Contextual Add And Command System: cursor quick add, edge-drag suggestions, selection actions, global command palette, and recent actions.
- Canvas-As-Research-Story: presentation path, report narrative sections, generated explanation notes, stakeholder view, and embedded training course cards.
- Analysis State, Lineage, And Auditability: node/section state badges, stale analysis warnings, evidence-to-theme lineage, impacted exports, and AI run logs.
- Dual Edit/Review Views: full graph editing, clean stakeholder review, synced overview/detail, and mobile handoff to desktop.
- AI Scaffold Preview And Template Library: research-method templates, insertable snippets, AI-generated previews, versioning, and dependency checks.
- Spatial Landmarks And Offscreen Awareness: section contours, offscreen indicators, important-object compass, search-plus-context, and expand-on-demand exploration.
- Formal Visual Grammar And Typed Research Links: typed ports, typed relations, required inputs, confidence, review state, and consistent visuals for research semantics.
- Non-Destructive Perspectives, Filters, And Scenes: code/case/tag/date/review filters, role-specific views, saved scenes, and table/data companion views.
- CAQDAS-Grade Research Maps: code co-occurrence, code similarity, document similarity, code-by-case matrices, and source-linked insight snapshots.
- Self-Documenting Nodes And In-Canvas Learning: node info drawer, port hints, visual previews, example snippets, and inline validation messages.
- Large Canvas Performance And Stability Architecture: virtualization, edge level-of-detail, progressive rendering, performance telemetry, and dense-graph QA budgets.
- Observable Analysis Run Mode: per-node run status, inputs/outputs/timing, rerun from node, compare runs, error workflows, redacted logs, and approval breakpoints.
- Collaboration, Version History, And Branching: named versions, restore-as-copy, deleted-object recovery, branch/merge, object history, presence, live selections, and follow mode.
- Data Preview And Research Quality Panels: selected-node previews, input/output comparison, metadata, quality warnings, evidence inspector, and data-grid companion views.
- AI Evaluation And Prompt Governance: versioned prompts/datasets/evaluators, staging/production promotion, regression evals, and exact AI provenance.
- Sensitive Data, Redaction, And Permission Architecture: redacted run logs, role-aware evidence visibility, PII warnings, consent labels, and stakeholder-safe exports.
- Accessible Graph Navigator: semantic graph outline, keyboard traversal, non-drag alternatives, screen-reader summaries, neighborhood descriptions, and accessible evidence/relation tables.
- Touch, Pen, And Cross-Device Interaction Model: explicit input modes, touch-safe sizing, precision select, pen annotation, mobile review gestures, and gesture conflict tests.
- Governed Template And Extension Registry: versioned templates, dependency checker, organization approval, permission/risk metadata, deprecation/compatibility warnings, and usage analytics.
- Diagram-Grade Connector/Layout/Layer Controls: connector labels/styles/waypoints/line jumps, layer hide/show/lock, layout preview/undo, layout presets by research intent, and manual layout anchors.
- Facilitated Research Review Sessions: agenda frames, timer, participant summon/follow, evidence reveal/hide, private voting, decision/action capture, and guest onboarding.
- Systems-Map Analytics And Visual Query: centrality/community/bridge overlays, saved query cards, selection-based suggested queries, partial views, relation previews, and query governance.
- Research Advisor, Impact Analysis, And Test Harnesses: canvas checks, publish/share/send readiness, change impact analysis, template/lifecycle dry-runs, and watched AI/research outputs.
- Enterprise Governance/Admin/Compliance Layer: organization roles, guest/domain restrictions, audit logs, content classification, export/share controls, AI controls, integration controls, and access reviews.
- Reproducible Research Publishing: Research Packet artifact, live report blocks, reproducibility manifests, regeneration diffs, multi-format publishing, and evidence appendices.
- Evidence-Centric Journey And Service Blueprint Views: journey/service-blueprint projections, personas/touchpoints/opportunities/solutions/owners/metrics, quote clips, and executive dashboards.
- AI-Assisted Canvas Authoring And Critique: source-grounded drafting, clustering, naming, summarization, journey/report/email proposals, unsupported-claim critique, and approval workflows.
- Integration, Event, And API Platform: Integration Hub, event catalog, webhooks, import/export adapters, sync health, OAuth/API scopes, webhook signing, and public schemas.
- Lifecycle Messaging And In-Product Education Journey Builder: entry/exit criteria, branches, delays, suppression, frequency caps, goals, experiments, preview, staging, safe-send checks, and activation metrics.
- Durable Orchestration And Job Recovery: durable imports, AI runs, exports, reports, syncs, sends, retries, cancellation, resume, rollback, schedules, backfills, traces, metrics, logs, and redacted run history.
- Research-To-Roadmap Decision Traceability: decision objects, prioritization views, feedback/insight portals, roadmap/delivery links, owners, confidence, effort, impact, and decision history.
- Semantic Evidence Graph And Interchange Standards: stable IDs, typed nodes/relations, JSON-LD/GraphML exports, provenance mapping, lineage facets, schema validation, migrations, and compatibility manifests.
- Production UX Observability And Support Loop: privacy-safe replay/event capture, canvas-specific frustration signals, redacted support bundles, real-user performance budgets, and incident-to-backlog linking.
- Offline/Local-First Collaboration And Conflict Resolution: offline queue, sync health, document/session/presence separation, conflict review, reconnect merge status, and offline snapshot migrations.
- Sandboxed Extension Runtime And Plugin Security: extension manifests, permissions, network/data capabilities, restricted mode, org approval, logs, revocation, and redacted sample-canvas testing.
- Research Media Ingestion, Transcription, And Evidence Clip Pipeline: audio/video/transcript/VTT/SRT/survey/PDF/doc imports, transcription, translation, diarization, timestamp correction, evidence clips, reels, and quality warnings.
- Hybrid Evidence Search, Retrieval, And Graph RAG: keyword/vector/metadata/graph search, permission-aware retrieval, match explanations, graph-neighborhood RAG, retrieval evals, and index health.
- Model/Provider Operations, Routing, And Cost Controls: provider/model/prompt tracking, cost/latency/token/failure logs, routing/fallback/region/BYOK policies, budgets, and AI incident review.
- Execution Queue, Partial Recompute, And Cache Semantics: run queue, dirty-state propagation, partial reruns, cache keys, invalidation explanations, progress, output previews, cancellation, retry, and run history.
- Dataflow Backpressure, Provenance Replay, And Operational Debugging: queue depth, backpressure, replay checkpoints, replay eligibility, cannot-replay reasons, and failure provenance.
- Product Analytics, Feature Flags, And Engagement Experimentation: activation milestones, funnels, retention, cohorts, staged rollout, experiments, in-product education, and lifecycle optimization.
- Community Template/Workflow Marketplace Quality And Trust: preview cards, signed versions, verified creators, scans, risk scores, sandbox trials, compatibility, quarantine, and rollback.
- Scientific Workflow Reproducibility And Environment Capture: manifests, run packages, evidence/output checksums, model/provider/index versions, feature flags, environment capture, and rerun comparison.
- Data Quality, Contracts, And Evidence Health Gates: evidence contracts, expectation suites, validation checkpoints, failing-record panels, severity, waivers, owners, reruns, and drift alerts.
- Visual Change Review, Branch Impact, And Merge Governance: semantic graph diffs, side-by-side/overlay review, reviewer comments, approvals, suggest-changes, impact summaries, merge gates, and restore checkpoints.
- Connector Schema Drift And Integration Lifecycle Management: connector inventory, auth health, scopes, schema discovery, drift policies, sync timelines, deprecation, and downstream impact.
- Stakeholder Portal, Embedded Dashboards, And Subscriptions: approved report portal, embedded dashboards, filtered subscriptions, test sends, suppression, attachments, threshold alerts, recipient audit, and stale-report warnings.
- Scenario Simulation, What-If Optimization, And Visual Debugging: scenario parameters, constraints, objectives, dry-runs, baseline comparison, breakpoints, watch values, and static/dynamic work estimates.
- Design Tokens, Visual Regression, And UI State Coverage: governed canvas tokens, UI-state matrices, isolated visual fixtures, cross-browser baselines, semantic contrast checks, and token-change review.
- Data Catalog, Business Glossary, And Research Asset Stewardship: asset catalog, owners, stewards, glossary terms, classifications, sensitivity labels, lineage, certification, deprecation, and handoff workflows.
- Retention, Legal Hold, eDiscovery, And Disposition: retention labels, legal hold locks, disposition review, blocked deletion explanations, eDiscovery export bundles, hashes, and audit trails.
- Resource Quotas, Cost Budgets, And Compute Capacity Planning: quotas, budget dashboards, chargeback/showback, throttling, graceful degradation, cleanup, scheduling, and capacity forecasts.
- Incident Response, Runbooks, Status Pages, And Postmortems: severity levels, runbooks, status updates, incident timelines, postmortems, action owners, backlog links, and prevention checks.
- Enterprise Identity, SSO, SCIM, And Access Lifecycle: OIDC/SAML setup, metadata exchange, certificate rotation, tenant/domain routing, relay-state deep links, SCIM provisioning, access reviews, and break-glass admin access.
- Secrets, Key Management, BYOK, And Credential Hygiene: vault-backed secret references, rotation, expiry, owner, last-use, blast-radius, BYOK/CMK policy, redacted logs, and connector secret health.
- API/Event Contract Lifecycle And Developer Trust: OpenAPI/AsyncAPI contracts, versioning, deprecation windows, sample payloads, idempotency, signed webhooks, replay protection, and consumer-impact reports.
- Backup, Restore, And Disaster Recovery UX: point-in-time workspace restore, object-level recovery, backup coverage status, RPO/RTO dashboards, restore drills, and disaster runbooks.
- Internationalization, Localization, RTL, And Cultural UX: locale-aware formatting, ICU-style messages, RTL canvas QA, multilingual evidence, translation status, and localization visual regression.
- Design Rules, Constraint Authoring, And Preflight Gates: rule engine, custom constraints, visual issue markers, waivers, batch fixes, dry-runs, and publish/export/send gates.
- Parametric Timeline, Dependency Rebuild, And Design History: canvas timeline, replay, branch experiments, dependency invalidation, stale downstream outputs, rebuild failures, and restore points.
- Role-Specific Operational Interfaces And Human-In-The-Loop Workbenches: focused researcher/reviewer/admin/support/success/executive interfaces, queues, approvals, permissions, and automation triggers.
- Customer Success Health, Support Feedback, And Adoption Playbooks: health scores, support-feedback clustering, answer inspection, help gaps, adoption segments, and customer-success playbooks.
- Guided Academy, Credentials, And In-Context Practice: role trails, demo canvases, hands-on challenges, badges, contextual lessons, team learning paths, and outcome-linked training analytics.
- Power-User Workspace Profiles, Hotkeys, And Command Ergonomics: workspace profiles, keymaps, command aliases, macro recording, layout/density presets, input-mode presets, and governed profile sharing.
- Procedural Asset Packaging And Asset Interface Design: Research Digital Assets, stable IDs, namespaces, semantic versions, exposed parameters, locked internals, embedded examples, help tabs, and safe upgrade previews.
- Canvas-Anchored Comments, Mentions, Notifications, And Decision Inbox: object-level comments, mentions, assignments, due dates, decision requests, read/resolved/follow state, digests, and role-aware routing.
- Data Residency, Tenant Boundary, And Compliance Scope Transparency: residency dashboard, in-scope/out-of-scope data maps, region-aware warnings, migration status, app readiness, and tenant-boundary evidence.
- Release, Deprecation, And Migration Assistant: impact center, deprecation policies, dry-run migrations, before/after diffs, version pins, rollback windows, and release notes tied to canvas states.
- Migration Hub, Import Fidelity, And Competitive Tool Offboarding: imports from visual/research tools, mapping previews, fidelity scores, unsupported-object reports, cleanup tools, migration dashboards, and rollback/export paths.
- Procurement Evidence Room, Security Questionnaires, And Trust Automation: trust room, CAIQ/SIG/custom questionnaire automation, evidence freshness, access controls, buyer packets, and owner routing.
- Accessibility Conformance Reporting And Assistive-Tech Evidence: VPAT/ACR generation, WCAG/Section 508/EN 301 549 mapping, assistive-tech evidence, sample sets, regression artifacts, and known-limitations roadmap.
- Browser Rendering Pipeline, Worker Offload, And Interaction Performance: workerized layout/import/search, OffscreenCanvas feasibility, interaction budgets, INP traces, progressive rendering, and performance dashboards.
- Research Method Governance, Reporting Checklists, And Ethical Review: method templates, COREQ/SRQR/APA JARS checklists, study protocols, ethics/readiness gates, and method-quality overlays.
- Nested Subgraphs, Parameter Panels, And Reusable Component Interfaces: nested subgraphs, breadcrumbs, exposed slots, parameter panels, private/team/org component scopes, per-instance overrides, and blueprint impact warnings.
- Dependency Resolver, Missing Asset Recovery, And Environment Snapshots: dependency manifests, missing-asset recovery, version/conflict panels, owner routing, environment snapshots, and immutable run manifests.
- Example Gallery, Recipe Browser, And Insertable Learning Snippets: runnable research recipes, context-aware snippets, sample data, expected outcomes, sandbox/adapt insertion, and activation analytics.
- Continuous Canvas Static Analysis, Quality Scores, And Rule Governance: live checker panel, quality score, severity profiles, inline issues, quick fixes, waivers, and action-specific gates.
- Solution Packaging, Environment Promotion, And Connection References: solution packages, environment variables, connection references, promotion pipelines, validation gates, rollback, and deployment evidence.
- Graph Symbol Index, Find References, And Blueprint-Style Navigation: symbol index, find references/dependents, upstream/downstream traversal, bookmark scopes, object outline, and index freshness status.
- Data Inspector, Path Probes, And Pinned Sample Data: edge/node probes, copyable reference paths, pinned fields/samples, before/after comparison, schema-shape previews, and redacted sample fixtures.
- Execution Mode Parity, Partial Runs, And Replay-To-Editor Debugging: manual/partial/production/replay/dry-run modes, mode badges, replay with original/current workflow, side-effect suppression, and cannot-run explanations.
- Error Workflows, Node Status Signals, And Dead-Letter Operations: graph-native error handlers, node status signals, dead-letter queues, routing rules, lifecycle suppression, and suspicious-success detection.
- Work-Item Matrix, Variant/Wedge Experiments, And Scheduler Observability: work-item matrices, variant runs, scheduler status, item logs/costs/artifacts, and variant promote/rollback.
- Requirements Perspective, Traceability Matrix, And Coverage Gap Review: requirement badges, traceability panes, matrices, missing-link review, stale requirement impact, and coverage gates.
- Parent/Subflow Execution Correlation And Cross-Workflow Call Graphs: parent-child run links, input/output contracts, redacted payload summaries, cross-run search, and blast-radius views.
- Custom Node SDK, Node UI Standards, And Extension Test Harnesses: first-party node SDK, developer console, UI standards, fixture runners, permission manifests, contract tests, and compatibility checks.
- Expression And Mapping Workbench With Typed Transform Preview: schema-aware mappings, expression sandboxing, sample output previews, before/after comparisons, redaction warnings, and mapping lineage.
- Data Profiling, Browse Nodes, And Sample/Full-Run Boundaries: profile panels, row/item counts, quality warnings, sample/full-run badges, persisted profile artifacts, and run-history evidence.
- Workflow Dependency Paths, Relative Assets, And Portability Hygiene: path manager, missing asset finder, relinking, path rewrite dry-runs, package export, dependency remapping, and portability scores.
- Signed Marketplace Artifacts, SBOMs, And Supply-Chain Attestations: signed assets, verification status, SBOM-style manifests, scans, attestations, quarantine, and procurement-visible evidence.
- Human Fallback, Approval Escalation, And Expert Review Queues For AI Workflows: AI fallback queues, reviewer SLAs, source evidence, model traces, escalation rules, and accept/edit/reject workflows.
- Graph Compile Diagnostics, Search, Semantic Diff, And Debug Workbench: compile results, graph search, semantic diffs, breakpoints, watches, call stacks, node warnings, and socket inspection.
- Data Trees, Domains, Cardinality, And Collection Semantics: collection-shape badges, branch/path viewers, domain-level warnings, and matching/lacing controls.
- Public Component Interfaces, Parameter Panels, And Environment Bindings: exposed parameters, control panels, environment bindings, invalidation previews, and per-environment overrides.
- Performance Profiling, Hot-Path Heatmaps, And Run Cost Budgets: graph hot-path overlays, timing/cost counters, threshold-triggered profiler snapshots, and support-bundle performance evidence.
- Operator Palette, Certified Snippets, And Contextual Node Discovery: method-aware node discovery, certified snippets, favorites/recents, approved catalogs, hidden/internal nodes, and deprecation warnings.
- Versioned Flow States, Registry Buckets, And Parameter Context Promotion: up-to-date/local/stale/sync-failure badges, registry buckets, commit/revert/compare/promote actions, and safe parameter promotion.

The second benchmark pass adds a stricter product rule: the canvas must not only look correct, it must make research state inspectable. Users should be able to answer "what changed?", "what is stale?", "what evidence supports this?", "where am I?", and "what should I do next?" without reverse-engineering the graph.

The third benchmark pass adds another rule: the graph must become a typed research system, not just a visual board. Every node, edge, section, filter, scene, and exported insight should have stable semantics that can be validated, explained, searched, filtered, reviewed, and rendered differently for different audiences.

The fourth benchmark pass adds an operational rule: QualCanvas must be observable and recoverable. Users should be able to inspect how a result was produced, compare versions, restore work, debug failed analysis, validate AI quality, and redact sensitive evidence without leaving the canvas model.

The fifth benchmark pass adds an inclusion/ecosystem rule: QualCanvas must be usable without direct visual dragging, touch/pen should be designed as explicit modes, and templates/extensions need governance before they become distribution channels.

The sixth benchmark pass adds a maturity rule: QualCanvas should behave like a graphical research operating system. Users need diagram-grade control, facilitated review workflows, visual query/analytics, and advisor-style validation before the canvas can be trusted for serious research delivery.

The seventh benchmark pass adds a deployment rule: QualCanvas must be governable, publishable, integratable, and reproducible before lifecycle email automation, AI authoring, and organization-wide adoption can safely scale.

The eighth benchmark pass adds an operations rule: lifecycle engagement, background jobs, roadmap decisions, graph interchange, and production UX failures all need first-class observability and recovery paths. The email/training system should be a governed journey layer, not a collection of cron-triggered templates.

The ninth benchmark pass adds a resilience rule: QualCanvas must still work when users are offline, data arrives as media, extensions run third-party logic, evidence retrieval spans text/vector/graph indexes, and AI providers change or fail.

The tenth benchmark pass adds an operability rule: QualCanvas must expose how work runs, queues, caches, replays, experiments, imports, and publishes so research outputs and engagement systems can be audited rather than guessed.

The eleventh benchmark pass adds a decision-delivery rule: QualCanvas must validate input quality, review meaningful changes, manage connector drift, control stakeholder delivery, and simulate consequences before research outputs drive action.

The twelfth benchmark pass adds an enterprise-operability rule: QualCanvas must govern visual semantics, catalog research assets, respect retention/legal holds, expose quota/cost limits, and run a formal incident process when the graphical product fails.

The thirteenth benchmark pass adds an enterprise-readiness rule: QualCanvas must externalize identity cleanly, keep secrets out of the graph, publish trustworthy API/event contracts, productize restore workflows, and validate the canvas across locales and writing directions.

The fourteenth benchmark pass adds a self-improving operations rule: QualCanvas must validate canvas work with explicit rules, explain research history, create role-specific queues from the same graph, feed support friction back into product quality, and train users through hands-on canvas practice.

The fifteenth benchmark pass adds a professional-platform ergonomics rule: QualCanvas must support expert customization, reusable procedural assets, spatial collaboration inboxes, transparent residency boundaries, and safe migration workflows as the product evolves.

The sixteenth benchmark pass adds an adoption-readiness rule: QualCanvas must help customers migrate from existing tools, satisfy procurement and accessibility review, keep browser performance architecturally sound, and make research method quality defensible.

The seventeenth benchmark pass adds a visual-workflow operability rule: QualCanvas must support nested reusable components, recover missing dependencies, teach through runnable examples, continuously check canvas quality, package solutions for environment promotion, and make large graphs searchable by references and meaning.

The eighteenth benchmark pass adds a debuggable-research-automation rule: QualCanvas must expose data flowing through the graph, make execution modes replayable, route failures/status changes, show batch/variant work as inspectable items, prove requirements coverage, and correlate parent/child workflow executions.

The nineteenth benchmark pass adds an ecosystem-safety rule: QualCanvas must make custom node creation testable and documented, expressions previewable and typed, data profiles visible, dependencies portable, marketplace assets signed/SBOM-backed, and AI automation interruptible by human fallback.

The twentieth benchmark pass adds a professional-graph-engineering rule: QualCanvas must compile, search, diff, debug, profile, version, and explain collection structure at the same level as mature node tools, with diagnostics and performance evidence tied to exact graph objects.

## Phase 1 - Fix Canvas Framing And Mobile First View

Problems:

- Mobile loads as visually blank/offscreen.
- Fit view does not produce a useful mobile viewport.
- Orientation changes do not recover the graph.
- Initial fit uses a fixed zoom floor that is too high for dense/wide canvases.

Likely code areas:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:96` - fixed `INITIAL_FIT_VIEW_OPTIONS`.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:780` - delayed initial fit.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:798` - current note that resize does not auto-fit.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2109` - ReactFlow `fitView`.
- `apps/frontend/src/hooks/useCanvasKeyboard.ts:277` and `apps/frontend/src/hooks/useCanvasKeyboard.ts:305` - shortcut fit options.

Implementation plan:

- Add a shared `fitCanvasView(mode)` helper in `CanvasWorkspace` that computes bounds and chooses min zoom dynamically from graph size and viewport.
- Use a lower mobile/tablet min zoom when graph bounds exceed viewport, but do not rely on zoom alone for mobile.
- Re-run a debounced fit pass after canvas data settles, after orientation/viewport resize, and after sidebar/toolbar height changes.
- Add breakpoint behavior: below `640px`, hide the Code Navigator by default, hide minimap, compress status, and expose a primary `Overview / Fit all` control.
- For landscape mobile heights below `480px`, keep only essential toolbar actions visible and move the rest into `More`.

Acceptance criteria:

- At `320x568`, first load shows meaningful graph content or a clear mobile overview state, not an empty canvas.
- At `390x844`, `568x320`, `768x1024`, `1024x768`, and `1024x640`, Fit View brings graph content into view without controls/minimap offscreen.
- Status and controls remain inside viewport bounds.
- Edge count is present after fit, resize, and orientation change unless intentionally hidden by an overview mode.

## Phase 2 - Replace Desktop Dropdowns With Responsive Menus

Problems:

- Tools menu clips offscreen at `1024x640`, tablet portrait, compact mobile, and dark narrow viewport.
- Analyze is better on desktop/tablet but still consumes too much of compact mobile and clips in mobile landscape.
- Mobile toolbar is too wide and effectively scrolls/clips without a mobile information architecture.

Likely code areas:

- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx:36` - `ToolbarDropdown`.
- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx:768` - Research Calendar item.
- `apps/frontend/src/components/canvas/panels/CanvasToolbar.tsx:848` - Presentation Mode item.
- `apps/frontend/src/components/canvas/panels/AddComputedNodeMenu.tsx:102` - Analyze button wrapper.
- `apps/frontend/src/components/canvas/panels/AddComputedNodeMenu.tsx:128` - Analyze dropdown placement and height.

Implementation plan:

- Create a shared responsive popover primitive for toolbar menus.
- Use collision-aware placement on desktop/tablet: clamp menu x/y to viewport and set `max-height: calc(100vh - top - safe-bottom)`.
- On widths below `640px` or heights below `480px`, render Tools and Analyze as bottom sheets or full-screen drawers with internal scroll and a visible close button.
- Move less frequent items into grouped sections: Manage, Analysis, Export/Share, View.
- Ensure menu open/close does not shift the canvas viewport left, as seen in mobile Analyze measurements.

Acceptance criteria:

- Tools and Analyze menus are fully usable at `1024x640`, `900x700` dark, `768x1024`, `320x568`, and `568x320`.
- No menu has negative `left/top` or extends beyond viewport without internal scroll.
- Mobile menus have a clear title, close affordance, and scrollable content.

## Phase 3 - Make Auto-Layout Viewport-Aware

Problems:

- Auto-arrange can turn a dense graph into a tall vertical stack.
- Edge rendering/measurement drops after some auto-layout and focus-mode states.
- Selection handles overwhelm the graph at low zoom.

Likely code areas:

- `apps/frontend/src/hooks/useAutoLayout.ts:26` - `computeLayout`.
- `apps/frontend/src/hooks/useAutoLayout.ts:36` - dagre direction.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:1695` - current `applyLayout(nodes, edges, { direction: 'LR', nodeSpacing: 60, rankSpacing: 120 })`.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:1700` - post-layout fit.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2207` - selection toolbar.

Implementation plan:

- Add layout presets based on node count, graph aspect ratio, and viewport: compact grid, layered LR, layered TB, and clustered.
- Cap column height and wrap ranks into multiple columns when graph height would exceed a viewport-scaled threshold.
- After layout animation completes, trigger a fit using the same dynamic fit helper from Phase 1.
- Keep edge rendering stable while nodes animate: delay visible-element virtualization updates if needed, or explicitly refresh React Flow internals after layout.
- At low zoom or large selection counts, show a single selection group outline/count instead of per-node handles.

Acceptance criteria:

- Auto-layout for 50+ nodes produces a readable multi-column/multi-rank layout, not a single long column.
- Edges remain visible after auto-layout, focus mode, select-all, and fit.
- Selecting 50+ nodes at 15 percent zoom does not flood the canvas with handles.

## Phase 4 - Fix Controls, Minimap, Status, And Flicker

Problems:

- Minimap overlaps or blocks controls on tablet/mobile.
- Status bar width exceeds mobile viewport.
- Minimap late-paints and causes visible flicker in repeated frames.

Likely code areas:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2135` - React Flow `Controls`.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2142` - `MiniMap`.
- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2567` and `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:2598` - status/bookmark/scroll controls.
- `apps/frontend/src/index.css:146` - minimap/control polish.

Implementation plan:

- Hide minimap under `768px`; use a compact overview button instead.
- Add layout-safe zones so controls and status never occupy the same hit area.
- Make mobile status a compact horizontal strip or bottom sheet, not a 500px-wide overlay.
- Delay minimap shell render until contents are ready, or fade it in intentionally after a stable frame.

Acceptance criteria:

- Fit View control is clickable on tablet and mobile.
- No minimap/control/status element has negative coordinates or extends beyond viewport in tested breakpoints.
- Repeated idle screenshots are stable except for intentional cursor/animation states.

## Phase 5 - Accessibility, Auth States, And Telemetry

Problems:

- Modal close buttons and rating controls are not consistently named.
- Research Calendar spins/fails for legacy access-code auth.
- Telemetry endpoint reports `405` in production.

Likely code areas:

- Modal files under `apps/frontend/src/components/canvas/panels/`.
- `apps/frontend/src/components/canvas/panels/KeyboardShortcutsModal.tsx:121` - example of dialog semantics.
- `apps/frontend/src/components/canvas/panels/CalendarPanel.tsx:172` and `apps/frontend/src/components/canvas/panels/CalendarPanel.tsx:179`.
- `apps/frontend/src/services/api.ts:497` - calendar events client.
- `apps/frontend/src/utils/analytics.ts:72` - frontend `POST /api/v1/events/track`.
- `apps/backend/src/routes/eventsRoutes.ts:47` - backend `/events/track`.

Implementation plan:

- Add `aria-label="Close"` to all icon-only close buttons.
- Add accessible labels to star/rating controls and unnamed icon actions.
- Standardize modal wrappers with `role="dialog"`, `aria-modal="true"`, and labelled headings.
- Detect legacy access-code auth before opening Research Calendar; show a clear "email login required" state or hide the item.
- Align analytics frontend URL with the deployed backend route, or proxy `/api/v1/events/track` to the backend route.

Acceptance criteria:

- Playwright can close every modal by accessible name.
- Legacy access-code users never see an indefinite Calendar spinner.
- No production `POST /api/v1/events/track 405` appears during smoke QA.

## Phase 6 - Improve Low-Zoom Meaning And Dense Graph UX

Problems:

- Manual fit shows all nodes but labels become unreadable.
- Dense graphs need a semantic overview, not just smaller nodes.
- Search and presentation mode work well and should be protected.

Likely code areas:

- `apps/frontend/src/components/canvas/CanvasWorkspace.tsx` zoom tier state and node rendering.
- Node components under `apps/frontend/src/components/canvas/nodes/`.
- `apps/frontend/src/components/canvas/panels/CanvasSearchOverlay.tsx`.

Implementation plan:

- Add an overview zoom tier that shows cluster labels, group counts, and node type summaries.
- Add optional "show clusters" mode at low zoom.
- Keep search highlight behavior, but ensure it still works in overview mode.
- Keep presentation mode as a separate shareable summary surface.

Acceptance criteria:

- At 15 percent zoom, users can identify graph structure without reading every node label.
- Search results remain visible and understandable at low zoom.
- Presentation mode snapshots remain clean after graph layout fixes.

## Phase 7 - Engagement Email And Training System

Problems/opportunities:

- Users need help after signup, after inactivity, and when new features/training are available.
- The app needs website/training surfaces to back lifecycle emails.

Implementation plan:

- Define lifecycle events: signup, first canvas created, first transcript imported, first coding created, first export, inactive 3/7/14 days, trial ending, new feature available.
- Add user email preferences and unsubscribe handling before broad sends.
- Create email templates: welcome, first value checklist, import transcript reminder, coding reminder, export/share prompt, training course recommendation, feature update, reactivation.
- Add website/app destinations for each email: Training Center, sample canvas, quick-start course, export guide, sharing guide.
- Use analytics events to suppress irrelevant emails, e.g. do not send "import transcript" if transcript count is already greater than zero.
- Keep all lifecycle emails transactional/product-help oriented unless explicit marketing consent is present.

Acceptance criteria:

- Every automated email maps to a clear in-app action and has unsubscribe/preference handling where required.
- Events can be replayed in staging without sending real user email.
- Engagement emails are measured by activation outcome, not just open/click rate.

## Phase 8 - Add Research State, Lineage, And Auditability

Problems/opportunities:

- AI-assisted codes, summaries, themes, and reports can become stale when evidence changes.
- Users need to trust the graph as an analysis artifact, not just a drawing.
- Dense canvases need health/status signals that explain what changed and what needs review.

Benchmark basis:

- KNIME execution states, Dataiku Flow lineage/explanations, Flowise tracing/evaluations, and Retool block-level logs.

Implementation plan:

- Add state badges for nodes and sections: new, reviewed, stale, failed, validated, export-ready.
- Track evidence-to-code-to-theme-to-report lineage and show impacted downstream artifacts.
- Add AI run history for generated codes, summaries, and reports, including prompt/model/version where available.
- Add a "What changed?" panel for canvas updates since last review/export.
- Add generated handoff/audit document for a canvas or section.

Acceptance criteria:

- When evidence changes, affected summaries/themes/reports are marked stale.
- Users can jump from a report claim to supporting evidence and back.
- AI-generated analysis has inspectable provenance and review state.

## Phase 9 - Separate Edit, Review, And Presentation Surfaces

Problems/opportunities:

- The graph editing UI is too dense for stakeholders, mobile users, and training journeys.
- Presentation mode exists, but it should become a deliberate review/story surface rather than a parallel feature.

Benchmark basis:

- Max/MSP presentation mode, Miro/FigJam stakeholder review, and Obsidian durable cards.

Implementation plan:

- Define three canvas modes: Edit, Review, and Present.
- Keep all modes backed by the same graph data, avoiding duplicated presentation artifacts.
- In Review mode, prioritize comments, claims, evidence, confidence, and unresolved questions.
- In Present mode, follow a curated path through sections and generated narrative notes.
- Let mobile default to Review mode for dense canvases, with a clear "continue editing on desktop" handoff.

Acceptance criteria:

- Stakeholders can review a canvas without seeing dense implementation clutter.
- Presentation paths update when source sections or claims change.
- Mobile users land in a useful review state, not a broken editor state.

## Phase 10 - Add AI Scaffold Preview, Templates, And Snippets

Problems/opportunities:

- New users face a blank-canvas problem.
- Existing users repeat research setup work across studies.
- AI should not silently mutate the canvas without preview.

Benchmark basis:

- Dify/Langflow/Flowise templates and reusable components, Zapier Canvas AI-assisted planning, TouchDesigner OP Snippets, and KNIME reusable components.

Implementation plan:

- Add a template library for common qualitative research methods.
- Add insertable canvas snippets: import setup, coding loop, memo synthesis, case comparison, stakeholder report, training task.
- Add AI scaffold preview: generate proposed nodes/sections/relations, show diff, then apply only after user confirmation.
- Add template dependency checks for missing transcripts, codes, prompts, models, integrations, or permissions.
- Version templates and show upgrade/diff prompts when a template changes.

Acceptance criteria:

- A new user can create a useful first canvas from a guided template.
- AI-generated graph changes are previewed, editable, and reversible before applying.
- Reused templates do not break silently when dependencies are missing.

## Phase 11 - Add Spatial Landmarks And Offscreen Awareness

Problems/opportunities:

- Large graph navigation cannot rely only on minimap and Fit View.
- Users need landmarks, nearby context, and indicators for important offscreen objects.

Benchmark basis:

- Large graph HCI research on offscreen proxies, visual references/contours, search-plus-context, expand-on-demand, and focus+context views.

Implementation plan:

- Add section contours or background regions that remain visible at low zoom.
- Add offscreen indicators for selected nodes, search results, stale nodes, failed analyses, and open review comments.
- Add an important-object compass that points to next issue/result/section.
- Add search-plus-context view that expands local neighborhoods around search results.
- Add expand-on-demand local graph exploration for dense graphs.

Acceptance criteria:

- Users can find selected/search/stale/commented objects without repeated random pan/zoom.
- Low zoom shows spatial landmarks and section meaning, not just tiny node cards.
- Navigation improvements are validated with task-based Playwright/manual QA, not only static screenshots.

## Phase 12 - Define Visual Grammar And Typed Research Links

Problems/opportunities:

- Current graph edges risk becoming visually ambiguous as more node types and research workflows are added.
- Qualitative analysis needs different relation semantics: coding, evidence support, contradiction, memo reference, generated dependency, training, export, calendar, and review.

Benchmark basis:

- Dynamo/LabVIEW typed ports, Grasshopper data structures, ATLAS.ti named and unnamed links, MAXQDA relation views, and Substance/Nuke graph organization.

Implementation plan:

- Define canonical node, port, edge, section, state, and badge types.
- Add typed ports and typed edge compatibility rules for research objects.
- Add visual rules for implicit codings versus explicit named relations.
- Add edge metadata for direction, confidence, author, created/modified time, comment, source, and review state where relevant.
- Add validation for invalid/missing inputs and unsupported edge combinations.

Acceptance criteria:

- Users can visually distinguish coding, evidence, dependency, memo, contradiction, claim, training, export, and review links.
- Invalid analysis blocks show actionable port-level validation.
- Relation metadata is preserved in export/import and report/provenance views.

## Phase 13 - Add Non-Destructive Perspectives, Filters, And Scenes

Problems/opportunities:

- Large research graphs need subsets for different questions and audiences.
- Filtering should never delete or permanently hide research objects.

Benchmark basis:

- Gephi filtered graph views/copies, Neo4j Bloom perspectives/scenes, and Dataiku Flow zones/views.

Implementation plan:

- Add filtered canvas views for code, case, tag, participant, date, owner, research question, analysis state, and review status.
- Add saved scenes that preserve filter, layout, viewport, selected objects, visible sections, and presentation path state.
- Add role-specific perspectives for researcher, reviewer, stakeholder, trainer, and admin.
- Add a data/table companion view for nodes, excerpts, codes, themes, claims, relations, and exports.
- Add clear "view is filtered" indicators and one-click return to full graph.

Acceptance criteria:

- Users can switch between full graph, filtered graph, saved scene, and table view without losing underlying data.
- Stakeholder/reviewer perspectives expose only appropriate objects and actions.
- Saved scenes reload with stable layout, filter, and viewport.

## Phase 14 - Add CAQDAS-Grade Research Maps And Evidence Snapshots

Problems/opportunities:

- QualCanvas needs qualitative analysis visualizations, not only node editor ergonomics.
- Reports and insights need stable snapshots linked to changing source evidence.

Benchmark basis:

- MAXQDA Code Map, Code Matrix Browser, MAXMaps, ATLAS.ti networks, and Dovetail Canvas/Insights.

Implementation plan:

- Add code co-occurrence and code similarity map modes.
- Add document/case similarity map mode.
- Add code-by-case matrix and code relation browser companion views.
- Add point-in-time insight snapshots that preserve cited evidence as it existed at publication/export time.
- Add jump paths from map clusters/matrix cells to raw excerpts and back.

Acceptance criteria:

- Users can discover code/theme/document patterns without manually arranging every node.
- Every generated map can jump to source evidence and related graph objects.
- Published insights remain stable while still showing when underlying source data changed.

## Phase 15 - Add Self-Documenting Nodes And Large-Canvas Performance Budgets

Problems/opportunities:

- More powerful graph semantics will increase learning cost unless help is embedded in the build surface.
- Dense research canvases need explicit performance targets before more graph features are layered on.

Benchmark basis:

- Substance visual tooltips/documentation links, Dynamo node documentation, TouchDesigner OP Snippets, LabVIEW connector panes, and the existing live QA flicker/mobile/dense-graph findings.

Implementation plan:

- Add a node info drawer with purpose, inputs, outputs, examples, validation, provenance, and next actions.
- Add port hints and inline error explanations.
- Add visual previews in node/template pickers.
- Add insertable snippets linked from help, onboarding, graph health warnings, and lifecycle emails.
- Define performance budgets for load, fit, pan/zoom, search, filter, layout, screenshot stability, memory, node count, and edge count.
- Add virtualization/level-of-detail strategy for nodes, edges, labels, handles, selection, and minimap.

Acceptance criteria:

- Users can understand and fix an invalid node without leaving the canvas.
- Template/node picker teaches what a node does before insertion.
- Dense-graph QA has measurable pass/fail thresholds instead of subjective visual review only.

## Phase 16 - Add Observable Analysis Run Mode

Problems/opportunities:

- AI coding, summarization, import, export, and report generation need transparent execution history.
- Current user trust risk: a generated result may look plausible but be hard to debug or reproduce.

Benchmark basis:

- Alteryx Results, Power Automate run history, n8n executions/error workflows, UiPath debugging, and LangGraph/LangSmith state traces.

Implementation plan:

- Record analysis runs with per-node status, inputs, outputs, timing, errors, retries, model/prompt/template versions, and review decisions.
- Add a Run Inspector panel for selected AI nodes, exports, imports, reports, and lifecycle email jobs.
- Add rerun-from-node for generated coding/summarization/report workflows where data dependencies allow it.
- Add compare-run view for prompt/template/model changes.
- Add approval breakpoints for bulk recoding, report publish, stakeholder share, and lifecycle email send.
- Add redacted run-log mode for sensitive transcript data.

Acceptance criteria:

- Users can inspect how a generated code/theme/claim/report was produced.
- Failed runs focus the affected node/section and show actionable details.
- Sensitive content can be hidden while preserving operational metadata.

## Phase 17 - Add Collaboration, Version History, And Branching

Problems/opportunities:

- Research projects involve multiple people and high-consequence edits.
- Users need safe experimentation for AI-generated changes, template upgrades, recoding, and report revisions.

Benchmark basis:

- Figma branching/version history, Miro board history/restore, tldraw collaboration/session state, Yjs Awareness, and Automerge local-first conflict handling.

Implementation plan:

- Add named canvas versions and restore-as-copy.
- Add deleted-object recovery for nodes, edges, sections, comments, and insights.
- Add branch/merge for major analysis changes and template/prompt upgrades.
- Add object-level history for research-critical objects.
- Add collaborator presence, live selections, section edit indicators, and follow mode.
- Separate durable graph state from per-user session state such as viewport, selection, and panel layout.

Acceptance criteria:

- Users can recover deleted graph content and prior versions without overwriting current work.
- Risky AI/template changes can be reviewed before merging into the main canvas.
- Collaboration presence is visible without polluting audit history.

## Phase 18 - Add Data Preview And Research Quality Panels

Problems/opportunities:

- Users need to see the evidence/data behind each node without leaving the canvas.
- Quality problems in transcripts, codes, and AI outputs should be visible before they affect reports.

Benchmark basis:

- Tableau Prep profile/data grid, Alteryx Results/Browse, RapidMiner repository/results views, and KNIME/Dataiku lineage views.

Implementation plan:

- Add selected-node preview for transcript excerpts, code assignments, memos, summaries, themes, claims, reports, and exports.
- Add before/after comparison for AI-generated or transformed analysis outputs.
- Add metadata panel for speaker, participant, source, tags, timestamps, coding count, owner, and review state.
- Add quality warnings for empty evidence, duplicate excerpts, missing speaker, uncoded material, stale analysis, low confidence, and unsupported claims.
- Add data-grid companion view for nodes, excerpts, codes, themes, claims, relations, and evidence snapshots.

Acceptance criteria:

- Users can inspect source evidence and output quality from any analysis node.
- Quality warnings can jump to affected nodes/excerpts.
- Reports and exports surface unsupported or stale claims before publish.

## Phase 19 - Add AI Evaluation And Prompt Governance

Problems/opportunities:

- Prompt/model/template changes can alter research outputs even when the canvas looks unchanged.
- AI-assisted analysis needs regression testing and promotion gates.

Benchmark basis:

- LangSmith prompt environments/datasets/evaluators and W&B Weave prompt versioning/tracing/evaluations.

Implementation plan:

- Version prompts, models, templates, evaluation datasets, and evaluators used by analysis nodes.
- Add staging/production-like promotion for coding schemes, report templates, lifecycle emails, and AI analysis templates.
- Add eval datasets for generated codes, summaries, theme recommendations, claims, and training recommendations.
- Add comparison dashboard for AI output quality across prompt/model/template versions.
- Store exact prompt/model/template/evaluator versions in report and insight provenance.

Acceptance criteria:

- New AI templates cannot become default without passing configured eval gates.
- Users can compare output quality before/after a prompt/model/template change.
- Report provenance includes exact AI configuration versions.

## Phase 20 - Add Sensitive Data, Redaction, And Permission Architecture

Problems/opportunities:

- Qualitative research often contains participant PII, confidential client data, and sensitive comments.
- Collaboration, AI traces, lifecycle emails, and stakeholder review can leak data if visibility is not explicit.

Benchmark basis:

- n8n execution redaction, role-specific perspectives from graph tools, and research-tool evidence/provenance expectations.

Implementation plan:

- Add role-aware visibility rules for transcripts, excerpts, codes, memos, comments, AI runs, reports, and training/email destinations.
- Add redacted previews and redacted run logs that preserve status, timing, and provenance.
- Add PII/sensitive-data warnings on transcript import and stakeholder export.
- Add consent/data-use labels that travel with excerpts and generated outputs.
- Add stakeholder-safe export mode and review mode.
- Add lifecycle email permission checks before sending training, feature, or engagement emails.

Acceptance criteria:

- Stakeholder views and exports do not expose restricted evidence by default.
- Run logs and AI traces can be shared without transcript leakage.
- Email/training campaigns respect consent, role, and data-use labels.

## Phase 21 - Add Accessible Graph Navigator And Non-Drag Controls

Problems/opportunities:

- A graphical research canvas is not accessible if the only useful representation is visual.
- Drag-only editing excludes keyboard, screen-reader, and some motor-impaired users from core graph tasks.

Benchmark basis:

- WCAG 2.2 dragging/target-size guidance, WAI-ARIA drag/drop guidance, Chart Reader, Benthic, and TADA accessible node-link research.

Implementation plan:

- Add a semantic graph outline organized by sections, nodes, links, selected object, search results, stale analysis, comments, reports, and unresolved issues.
- Add keyboard graph traversal: next connected node, previous connected node, upstream evidence, downstream claims, next unresolved issue, and jump to selected object's neighborhood.
- Add non-drag actions for move to section, connect selected objects, group selection, reorder presentation path, and send to saved view.
- Add screen-reader summaries for node purpose, relation type, neighborhood, incoming/outgoing evidence, stale state, review state, and next actions.
- Add accessible table representations for evidence, relations, node metadata, and selected path.

Acceptance criteria:

- Core graph tasks can be completed without pointer dragging.
- Screen-reader users can understand a selected node's neighborhood and its path to evidence or claims.
- Accessibility QA covers graph traversal and non-drag graph operations, not only modal labels.

## Phase 22 - Add Touch, Pen, And Cross-Device Interaction Model

Problems/opportunities:

- Dense desktop graph editing does not translate directly to phone, tablet, or pen workflows.
- Current mobile review risk is that controls get squeezed, clipped, or made too small instead of redesigned.

Benchmark basis:

- FigJam for iPad, Apple drag/drop guidance, and Microsoft touch target guidance.

Implementation plan:

- Define explicit input modes: mouse/keyboard edit, touch review, pen annotation, and keyboard/screen-reader navigation.
- Add larger touch targets and spacing for mobile/tablet review mode.
- Add pen-first annotation for memos, highlighted evidence paths, and stakeholder review comments.
- Add precision select mode for dense graphs on touch devices.
- Add gesture conflict rules and tests for pan, zoom, select, draw, drag, browser gestures, and canvas controls.

Acceptance criteria:

- Mobile/tablet review does not expose clipped desktop controls as the primary experience.
- Pen annotations save as first-class comments or memos attached to graph objects.
- Pan/zoom/select/draw gestures do not conflict in QA recordings.

## Phase 23 - Add Governed Template And Extension Registry

Problems/opportunities:

- Templates, snippets, lifecycle journeys, and future extensions will become unsafe if they can be inserted without versioning, dependencies, and permissions.
- Reusable research workflows need compatibility and deprecation handling before they are shared across teams.

Benchmark basis:

- ComfyUI Registry/templates, Figma plugins/widgets and organization controls, and Miro Marketplace/templates/app management.

Implementation plan:

- Add a Research Template Registry for methods, analysis blocks, report paths, lifecycle email journeys, training tasks, and stakeholder review boards.
- Add semantic versions with pin, upgrade, rollback, changelog, author, compatibility, and deprecation metadata.
- Add dependency checks for codes, prompts, models, permissions, integrations, training content, and email consent rules.
- Add organization/team approval and permission/risk metadata for templates and future extensions.
- Add usage analytics and health reporting for installed templates/extensions.

Acceptance criteria:

- Template insertion never silently fails because of missing dependencies.
- Organizations can approve, block, or deprecate templates/extensions before team-wide use.
- Users can see permissions, changelog, author, version, compatibility, and deprecation status before use.

## Phase 24 - Add Diagram-Grade Connector, Layout, And Layer Controls

Problems/opportunities:

- Current graph fixes focus on visibility and auto-layout, but world-class diagram tools give users direct control over connectors, layers, and layout intent.
- One opaque auto-arrange action is not enough for evidence maps, code maps, report paths, stakeholder views, and email/training flows.

Benchmark basis:

- draw.io connector/layer/layout controls, yEd automatic layout families, and Graphviz layout engines.

Implementation plan:

- Add connector controls for label, relation type, style, opacity, waypoints, line jumps, routing mode, evidence count, confidence, and review state.
- Add diagram layers for evidence, codes, themes, AI outputs, comments, review decisions, reports, and lifecycle email/training objects.
- Add layer hide/show/lock and role-aware default visibility.
- Add layout preview and undo before applying graph layout changes.
- Add layout presets by research intent: evidence-to-theme, theme-to-claim, timeline, participant journey, code co-occurrence, report narrative, and dependency graph.
- Preserve manual layout anchors so automatic layout can improve the graph without destroying analyst intent.

Acceptance criteria:

- Users can route and label important relations without editing raw data.
- Layout changes can be previewed, applied, undone, or cancelled.
- Role-specific layers can be hidden, shown, or locked without corrupting the underlying graph.

## Phase 25 - Add Facilitated Research Review Sessions

Problems/opportunities:

- Stakeholder review is a meeting/workshop workflow, not just a shared edit mode.
- Reviewers need safe participation tools that do not expose restricted evidence or allow accidental canvas damage.

Benchmark basis:

- Mural facilitation tools, Miro workshop facilitation, FigJam timer/voting, and Apple Freeform cross-device capture/collaboration.

Implementation plan:

- Add a Research Review Session mode with agenda frames, activity timer, facilitator controls, participant follow/summon, and guest onboarding.
- Add evidence reveal/hide controls for stakeholder-safe sessions.
- Add private voting/ranking on themes, claims, quotes, recommendations, and next actions.
- Add object locking and facilitator-only edit controls for live sessions.
- Capture review output as structured decisions, objections, unresolved questions, assigned actions, and follow-up training/email triggers.

Acceptance criteria:

- A stakeholder can join a review session, understand where to look, vote/rank safely, and leave decisions/actions behind.
- Facilitators can guide attention without exposing restricted evidence by default.
- Session output becomes structured graph data, not just comments lost in the canvas.

## Phase 26 - Add Systems-Map Analytics And Visual Query

Problems/opportunities:

- Dense research graphs need analytical overlays and query cards so users can ask questions of the graph instead of visually hunting.
- Different audiences need different interpretations of the same graph without duplicating or deleting objects.

Benchmark basis:

- Kumu metrics/views/partial views, Linkurious visual query workflow, and TheBrain networked notes/backlinks/search.

Implementation plan:

- Add graph analytics overlays for centrality, reach, bridge themes, isolated evidence, duplicate clusters, community detection, unsupported claims, and stale outputs.
- Add saved visual query cards such as "show upstream evidence", "show stale AI outputs", "show unsupported claims", "show participants driving this theme", and "show new evidence since last review".
- Add selection-based suggested queries from node, edge, section, report, and review context menus.
- Add partial/perspective views for analysis, stakeholder, teaching, audit, and lifecycle/email training contexts.
- Add relation/backlink previews for connected notes, excerpts, decisions, files, external assets, and report sections.
- Add query ownership, permissions, changelog, and admin raw-query view.

Acceptance criteria:

- Users can answer common research graph questions from query cards without manually panning/searching.
- Perspective views reuse the same graph model and do not fork data silently.
- Query cards are permissioned and auditable.

## Phase 27 - Add Research Advisor, Impact Analysis, And Canvas Test Harnesses

Problems/opportunities:

- Users need a preflight system before AI reruns, stakeholder sharing, report publishing, layout changes, or lifecycle emails.
- Templates and journeys should be testable with sample data before they are released.

Benchmark basis:

- Simulink Model Advisor, Simulink Dependency Analyzer, Simulink Test, and Unreal Blueprint debugging/search.

Implementation plan:

- Add a Research Advisor that checks unsupported claims, stale outputs, missing evidence, missing consent, broken imports, hidden auth failures, inaccessible objects, incomplete review gates, and publish/send readiness.
- Add impact analysis before edit, layout, AI rerun, report publish, stakeholder share, and lifecycle email send operations.
- Add template and lifecycle journey test harnesses that run sample data, preview generated canvas/report/email outcomes, and compare outputs to expected baselines.
- Add debugger affordances for AI/research flows: breakpoints before bulk recoding, watched outputs, step-through transformations, and active data-path inspection.
- Add search/index health checks shared by graph search, accessible navigator, query cards, and report exports.

Acceptance criteria:

- High-risk operations show clear advisor results and impact before execution.
- Templates/lifecycle journeys can be dry-run in staging without affecting real users.
- Debugging and watch outputs explain how a graph result, report, or email was produced.

## Phase 28 - Add Enterprise Governance, Admin, And Compliance Layer

Problems/opportunities:

- Organization-wide research use needs an admin/control plane before sharing, exports, AI, integrations, and lifecycle emails scale.
- Sensitive participant/client evidence needs classification, policy enforcement, and auditability at more than one level.

Benchmark basis:

- Figma organization activity logs/admin controls, Miro audit logs and Enterprise Guard, and Dovetail governed research evidence access.

Implementation plan:

- Add organization/workspace roles, teams, guests, domain restrictions, default sharing rules, and lifecycle email permissions.
- Add audit logs for organization, canvas, section, object, template, report, lifecycle email, AI run, and integration events.
- Add content classification for transcripts, excerpts, AI outputs, reports, canvases, exports, and lifecycle emails.
- Add policy controls for external sharing, stakeholder review, public links, export/download, AI use, API tokens, and email audiences.
- Add admin dashboards for access review, sensitive content, external shares, AI usage, integration health, and lifecycle email activity.

Acceptance criteria:

- Admins can answer who accessed/shared/exported/changed/sent what, when, and under which policy.
- Sensitive projects can block or require approval for export, public sharing, AI use, and lifecycle emails.
- Audit events are queryable without relying on browser console logs or ad hoc database inspection.

## Phase 29 - Add Reproducible Research Publishing And Live Reports

Problems/opportunities:

- Reports and exports should not be disconnected screenshots or stale copies of graph state.
- Research outputs need reproducibility metadata and regeneration paths.

Benchmark basis:

- Observable notebooks, Quarto publishing, Jupyter notebook/export conventions, and research reproducibility expectations.

Implementation plan:

- Add a Research Packet artifact containing frozen canvas view, narrative report, evidence table, code/theme summaries, run history, AI versions, permissions, redactions, and export manifest.
- Add live report blocks linked to graph nodes that show stale/out-of-date state when evidence, filters, prompts, or review decisions change.
- Add reproducibility manifests for source data, transformations, AI versions, filters, redactions, reviewer approvals, and generated outputs.
- Add publish targets: internal live report, stakeholder-safe web view, PDF/DOCX, slide deck, CSV/JSON evidence appendix, and notebook-style export.
- Add regenerate-from-graph with diff preview before replacing published artifacts.

Acceptance criteria:

- A published report can be traced back to the exact graph state, evidence, filters, AI settings, and reviewer approvals.
- Stale report sections are visible after source evidence changes.
- Regeneration shows a diff before replacing stakeholder-visible outputs.

## Phase 30 - Add Evidence-Centric Journey And Service Blueprint Views

Problems/opportunities:

- Qualitative findings often need to become customer journeys, service blueprints, opportunities, solutions, and executive summaries.
- These views should be projections of the evidence graph, not separate disconnected files.

Benchmark basis:

- TheyDo journey/opportunity/solution linkage, Smaply journey/persona/stakeholder maps, UXPressia journey/service-blueprint/persona tooling, and Dovetail evidence clips.

Implementation plan:

- Add journey and service-blueprint views over the same graph model with phases, touchpoints, actions, emotions, pain points, channels, backstage processes, opportunities, solutions, owners, and metrics.
- Allow transcript excerpts, quote clips, video/audio moments, codes, and themes to be pinned to journey steps.
- Link opportunities and solutions to recommendations, roadmap items, training tasks, and lifecycle email journeys.
- Add persona-specific overlays and multi-persona comparisons without duplicating evidence.
- Add executive journey dashboards that roll up evidence, owners, metrics, risk, and decision status.

Acceptance criteria:

- Journey/service-blueprint objects keep source evidence links and graph provenance.
- Persona overlays and executive dashboards reuse the same evidence graph.
- Opportunities/solutions can be traced from insight to owner, metric, recommendation, and follow-up action.

## Phase 31 - Add AI-Assisted Canvas Authoring And Critique

Problems/opportunities:

- AI should accelerate analysis and communication without silently mutating evidence or creating unsupported claims.
- Users need source-grounded proposals and critique tools, not just one-shot generation.

Benchmark basis:

- Miro AI diagram/doc/table/sticky/clustering features, Figma AI text/layer/image assistance, and Smaply AI journey creation.

Implementation plan:

- Add AI proposal actions for drafting from selected evidence, clustering themes, naming sections, suggesting relation labels, generating journey maps, drafting report sections, and creating training/email follow-ups.
- Add AI critique actions for unsupported claims, missing evidence, duplicate themes, overclaiming, stale outputs, weak recommendations, and missing consent labels.
- Keep AI changes as editable proposals with source evidence, confidence, affected nodes, prompt/model/template versions, and reviewer approval.
- Require generated claims, recommendations, reports, and lifecycle emails to cite evidence nodes or show unsupported status.
- Add organization controls to disable, limit, approve, or audit AI authoring by project sensitivity.

Acceptance criteria:

- AI-generated graph changes are proposals until accepted.
- Every generated claim/recommendation/email/report section cites evidence or is marked unsupported.
- Admin controls can disable or approval-gate AI authoring on sensitive projects.

## Phase 32 - Add Integration, Event, And API Platform

Problems/opportunities:

- Imports, exports, emails, calendar sync, research repositories, and project-management handoffs need reliable event infrastructure.
- External integrations need scopes, health, retries, diff previews, rollback, and audit logs.

Benchmark basis:

- Miro REST APIs/developer platform, Figma REST API, Figma webhooks, and API/webhook platform practices.

Implementation plan:

- Add an Integration Hub for calendar, email, research repositories, storage, data warehouses, CRM, project management, communication tools, and future third-party extensions.
- Add a stable event catalog and webhooks for canvas created/updated, evidence imported, code/theme created, report published, review completed, lifecycle email sent, advisor check failed, and integration sync failed.
- Add import/export adapters with field mapping, dry-run, diff preview, retry, rollback, idempotency, and sync health.
- Add OAuth scopes, API tokens, webhook signing, rate limits, permission review, and audit logs.
- Add developer-facing JSON schema/OpenAPI-style documentation for canvas objects, templates, events, reports, and email/training journeys.

Acceptance criteria:

- Connected accounts show health, last sync, failed syncs, retry status, and permission scope.
- Imports/exports can dry-run and show diffs before writing data.
- Webhooks/API calls are scoped, signed, rate-limited, and auditable.

## Phase 33 - Add Lifecycle Messaging And In-Product Education Journey Builder

Problems/opportunities:

- The email/training system needs behavioral journeys, suppression, goals, consent checks, and safe previews before it sends at scale.
- Training and feature adoption should use in-app guidance, checklists, banners, sample canvases, and courses in addition to email.

Benchmark basis:

- Braze Canvas, Customer.io Journeys, Intercom Series, and Appcues Flows/Checklists/analytics.

Implementation plan:

- Add Lifecycle Journey Builder with entry/exit criteria, branch conditions, delays, goals, suppression, frequency caps, preview, staging, conversion metrics, and version history.
- Add journey steps for email, in-app guidance, checklists, banners, training courses, product updates, sample canvases, and stakeholder review prompts.
- Add person/workspace/account/project eligibility so journeys can target the right audience without duplicate sends.
- Add control groups, A/B tests, journey-level activation metrics, and event-based outcomes.
- Add safe-send checks for consent, content classification, unsubscribe/preferences, role visibility, sample recipient preview, dry-run, and rollback.

Acceptance criteria:

- No lifecycle journey can go live without eligibility, suppression, consent, preview, and safe-send validation.
- Journey outcomes are measured by activation and product behavior, not only opens/clicks.
- Email and in-app education steps share the same event and permission model.

## Phase 34 - Add Durable Orchestration And Job Recovery

Problems/opportunities:

- Imports, AI runs, exports, reports, syncs, and lifecycle sends are long-running or failure-prone operations.
- Users need clear job state, retry, cancellation, resume, and recovery instead of hidden background failures.

Benchmark basis:

- Temporal durable execution, Airflow DAGs, Dagster assets/lineage/backfills, and OpenTelemetry instrumentation.

Implementation plan:

- Add durable jobs for imports, AI runs, exports, reports, calendar sync, lifecycle journeys, and integration sync.
- Add visible job states: queued, running, waiting, retrying, blocked, failed, cancelled, completed, stale, and superseded.
- Add retry policy, timeout, idempotency key, cancellation, resume, rerun-from-step, and rollback behavior for background operations.
- Add schedules and backfills for weekly digest, inactivity checks, report refresh, training reminders, and stale-analysis sweeps.
- Emit traces, metrics, logs, and role-aware redacted run history.

Acceptance criteria:

- Failed jobs are visible, inspectable, retryable, cancellable, and recoverable where safe.
- Scheduled and backfilled jobs show who/what/when/why and affected graph objects.
- Job telemetry links frontend user action, backend work, and canvas-visible status.

## Phase 35 - Add Research-To-Roadmap Decision Traceability

Problems/opportunities:

- Research recommendations lose value if they cannot connect to prioritization, ownership, roadmap items, delivery status, and decision rationale.
- Stakeholders need to see why a feature, training item, or lifecycle update is justified by evidence.

Benchmark basis:

- Productboard insight-to-feature-roadmap linkage, Jira Product Discovery ideas/insights/plans, and Aha! ideas/prioritization/roadmap workflows.

Implementation plan:

- Add decision objects linking evidence, theme, opportunity, recommendation, roadmap item, owner, priority score, confidence, effort, impact, and delivery status.
- Add feedback/insight portals for internal stakeholders to submit evidence, questions, and feature requests tied to graph objects.
- Add prioritization views for impact/effort, evidence strength, participant count, revenue/account importance, risk, urgency, and confidence.
- Add delivery-system links to Jira/Linear/Aha/Productboard-style work items while preserving graph provenance.
- Add decision history for accepted, deferred, rejected, changed, and delivered recommendations.

Acceptance criteria:

- A roadmap item or product recommendation can be traced back to evidence and decision rationale.
- Delivery status updates do not break graph provenance.
- Prioritization views are auditable and explainable to stakeholders.

## Phase 36 - Add Semantic Evidence Graph And Interchange Standards

Problems/opportunities:

- The canvas should not become a closed visual island.
- Exports/imports need stable semantics, provenance, compatibility, and schema validation.

Benchmark basis:

- W3C PROV-O, JSON-LD, OpenLineage, and GraphML.

Implementation plan:

- Define a semantic evidence graph schema with stable IDs, typed nodes, typed relations, provenance, permissions, classifications, AI run metadata, and lifecycle outputs.
- Add JSON-LD export for linked research evidence and GraphML export for graph-tool interoperability.
- Map AI/report/email/job lineage to run/job/dataset-style events with extensible facets.
- Add schema migrations, compatibility checks, validation, and versioned manifests for imported/shared canvases.
- Align UI graph state with export/import state so layout, provenance, permissions, and classifications are preserved.

Acceptance criteria:

- Exported/imported canvases preserve graph semantics, layout, provenance, permissions, and classifications.
- Schema/version mismatches produce clear compatibility warnings.
- External graph/provenance exports can be validated against documented schemas.

## Phase 37 - Add Production UX Observability And Support Loop

Problems/opportunities:

- Visual failures such as blank canvases, clipped menus, failed fit, flicker, dead clicks, and broken sends need production diagnostics.
- Support and QA need privacy-safe evidence, not user anecdotes.

Benchmark basis:

- Sentry Session Replay, Datadog RUM/Session Replay, Fullstory frustration signals, and OpenTelemetry.

Implementation plan:

- Add privacy-aware session replay or replay-like visual event capture for canvas QA, support, and flicker/regression diagnosis.
- Add canvas-specific frustration and quality signals: rage click, dead click, repeated failed drag, blank canvas, clipped menu, flicker, failed fit, failed export, failed send, and unexpected auth gate.
- Add redacted support bundles with canvas state, viewport, browser/device, console/network errors, run IDs, advisor results, and recent user actions.
- Add real-user performance budgets for load, fit, pan/zoom, layout, minimap, AI run start, report publish, and lifecycle send preview.
- Connect production incidents to backlog items with screenshots/replays, affected graph objects, frequency, severity, and owner.

Acceptance criteria:

- Support can reproduce visual/canvas issues from redacted diagnostic bundles.
- Production UX failures produce measurable signals and owners.
- Privacy controls prevent sensitive transcript/evidence leakage in replay or support artifacts.

## Phase 38 - Add Offline/Local-First Collaboration And Conflict Resolution

Problems/opportunities:

- Field research, workshops, travel, and client environments often have unstable network.
- Collaborative graph state needs conflict handling before it can be trusted for high-stakes research decisions.

Benchmark basis:

- Yjs, Automerge, and tldraw local-first collaboration patterns.

Implementation plan:

- Separate durable document graph state from transient session and presence state.
- Add offline queue, local snapshot persistence, sync health, last-synced timestamp, and reconnect merge status.
- Add conflict review for research-critical fields: code changes, claims, decision status, consent labels, report publish, and lifecycle journey activation.
- Add offline snapshot migrations and compatibility checks.
- Add publish/send/share gates while unresolved conflicts exist.

Acceptance criteria:

- Users can continue safe edits offline and see exactly what will sync.
- Conflicts are visible and reviewable before publish, send, or share actions.
- Session and presence state do not pollute durable research history.

## Phase 39 - Add Sandboxed Extension Runtime And Plugin Security

Problems/opportunities:

- Third-party templates, importers, exporters, automations, and AI helpers can expose evidence or mutate canvases if not sandboxed.
- Enterprise adoption needs inspectable extension permissions and revocation.

Benchmark basis:

- Figma plugin manifests, WASI capability security, and VS Code workspace trust.

Implementation plan:

- Add an extension manifest schema for author, version, API/schema compatibility, permissions, network domains, data classes, lifecycle hooks, and risk.
- Add capability prompts and organization approval before install or run.
- Add restricted mode for untrusted templates, canvases, and extensions.
- Add execution logs, rate limits, revocation, quarantine, and compatibility scanning.
- Add a redacted sample-canvas test runner for third-party extensions.

Acceptance criteria:

- Extensions cannot access restricted evidence or network domains without declared permission and approval.
- Admins can revoke or quarantine an extension and see affected canvases/templates.
- Third-party extensions pass redacted sample tests before org-wide approval.

## Phase 40 - Add Research Media Ingestion, Transcription, And Evidence Clip Pipeline

Problems/opportunities:

- Research evidence often arrives as audio, video, transcripts, captions, surveys, PDFs, documents, and meeting recordings.
- Clips and quotes need source, timestamp, speaker, permission, and redaction metadata.

Benchmark basis:

- Dovetail, ATLAS.ti, and MAXQDA media/transcription workflows.

Implementation plan:

- Add imports for audio, video, transcripts, VTT, SRT, surveys, PDFs, documents, and meeting recordings.
- Add transcription jobs with language, vocabulary, diarization, timestamp correction, translation, and human review.
- Add evidence clips that preserve media source, transcript span, timestamp, speaker, code/theme links, consent, redaction, and quote permissions.
- Add highlight reels tied to reports, journeys, training, and lifecycle emails.
- Add quality warnings for low-confidence transcript spans, missing consent, missing speaker, stale translation, and unreviewed AI transcripts.

Acceptance criteria:

- Media clips trace to source, time, speaker, and consent.
- Transcripts can be reviewed and corrected before coding/reporting.
- Reels and exports never expose restricted media by default.

## Phase 41 - Add Hybrid Evidence Search, Retrieval, And Graph RAG

Problems/opportunities:

- Evidence discovery should work across exact text, tags, metadata, graph relationships, and semantic similarity.
- AI answers and generated reports must show why evidence was retrieved and where it came from.

Benchmark basis:

- Weaviate, Qdrant, Pinecone, and graph-RAG retrieval practices.

Implementation plan:

- Add hybrid text/tag/metadata/graph/vector search with permission filters.
- Add search explanations for keyword match, vector similarity, graph distance, relation type, speaker, recency, and quality.
- Add Graph RAG over selected graph neighborhoods with citations, redaction, and stale-evidence checks.
- Add retrieval eval datasets for common questions and report prompts.
- Add index health, embedding version, chunking strategy, reranker version, and reindex controls.

Acceptance criteria:

- Search results explain why they matched and obey permissions.
- Generated answers cite evidence or mark unsupported claims.
- Index state is visible and rebuildable.

## Phase 42 - Add Model/Provider Operations, Routing, And Cost Controls

Problems/opportunities:

- AI features need provider reliability, cost visibility, region/data controls, fallbacks, and incident review.
- Model/provider changes can silently affect research outputs, reports, summaries, and lifecycle recommendations.

Benchmark basis:

- Phoenix, Langfuse, Helicone, and OpenRouter model operations.

Implementation plan:

- Log provider, model, prompt, parameters, retrieval context, cost, latency, tokens, failure, retry, fallback, region, and data policy.
- Add provider routing policies for preferred/fallback model, region, BYOK, no-training/data retention, and project sensitivity.
- Add budgets by user, project, organization, AI feature, lifecycle journey, transcription, embedding, and report.
- Add AI incident review for hallucination, unsupported claim, prompt injection, provider outage, cost spike, slow run, and degraded retrieval.
- Add cost/quality dashboards tied to evals and advisor results.

Acceptance criteria:

- AI operations show exact provider, model, cost, latency, and data policy.
- Sensitive projects can restrict providers, regions, and routing.
- Cost spikes and provider failures create actionable incidents.

## Phase 43 - Add Execution Queue, Partial Recompute, And Cache Semantics

Problems/opportunities:

- Heavy graph operations currently risk becoming hidden spinners or full-canvas reruns.
- Users need to understand which outputs are fresh, stale, cached, blocked, or failed.

Benchmark basis:

- ComfyUI execution modes, changed-input recompute, validation, queue, and history semantics.

Implementation plan:

- Add a run queue for imports, transcriptions, AI analysis, reports, exports, syncs, and lifecycle dry-runs.
- Add dirty-state propagation across evidence, codes, themes, reports, journeys, and lifecycle outputs.
- Add partial recompute from selected node, section, report block, or output.
- Add cache keys and invalidation explanations based on inputs, prompt/model version, evidence version, permissions, redaction policy, and retrieval index version.
- Add queue/history UI with waiting, running, blocked, cached, failed, cancelled, progress, output preview, cancellation, and retry states.

Acceptance criteria:

- Users can see what will run before starting expensive work.
- Changed evidence marks dependent outputs stale without forcing unrelated reruns.
- Cached and recomputed outputs explain why they were reused or invalidated.

## Phase 44 - Add Dataflow Backpressure, Provenance Replay, And Operational Debugging

Problems/opportunities:

- Imports, transcription, AI runs, report generation, exports, webhooks, and lifecycle sends can overload downstream services.
- Failed work needs replay and failure provenance, not a generic retry button.

Benchmark basis:

- Apache NiFi queue backpressure, provenance search, replay, and flow debugging.

Implementation plan:

- Add visible queue depth and backpressure indicators between heavy graph operations.
- Add replay checkpoints for imports, transcripts, coding passes, report blocks, webhooks, and lifecycle messages.
- Add replay eligibility and "cannot replay" explanations for expired content, deleted dependencies, changed permissions, schema migrations, provider changes, or missing integrations.
- Add an operational debugger linking failed canvas outputs to queue item, input evidence, run logs, provider/model, and graph state.
- Add alerts for stalled queues, overloaded projects, blocked provider capacity, and send throttles.

Acceptance criteria:

- Users can distinguish waiting, overloaded, blocked, failed, and replayable work.
- Replays are allowed only when inputs and permissions still make them safe.
- Failed outputs link to exact operational evidence needed for support or repair.

## Phase 45 - Add Product Analytics, Feature Flags, And Engagement Experimentation

Problems/opportunities:

- Engagement cannot be optimized from signup dates, email opens, or anecdotes alone.
- Canvas, AI, lifecycle, and training improvements need staged rollout and measurable activation impact.

Benchmark basis:

- PostHog, Amplitude, Mixpanel, LaunchDarkly, and Pendo analytics, flags, experiments, cohorts, and in-product guidance.

Implementation plan:

- Define activation milestones: first successful canvas load, first evidence import, first code/theme, first report/share, first invite, first repeat session, and first successful AI-assisted output.
- Add privacy-safe funnels, retention, feature adoption, cohort, and support-friction dashboards.
- Add feature flags and staged rollout controls for major canvas changes, AI features, lifecycle journeys, template marketplace features, and mobile review surfaces.
- Add experiments for onboarding checklists, in-canvas guides, training prompts, email timing, template recommendations, and AI proposal defaults.
- Feed behavior cohorts into lifecycle messaging with suppression, consent, and frequency caps.

Acceptance criteria:

- Lifecycle and training decisions can be tied to activation and retention behavior.
- New risky features can be rolled out, measured, paused, or rolled back.
- Product analytics exclude sensitive research content by default.

## Phase 46 - Add Community Template/Workflow Marketplace Quality And Trust

Problems/opportunities:

- A template marketplace can accelerate adoption, but untrusted graph logic can leak evidence, break canvases, or create bad research.
- Users need to preview and test templates before importing them into real projects.

Benchmark basis:

- ComfyUI Registry versioning/scanning and n8n template browsing, search, preview, and verified creators.

Implementation plan:

- Add template/workflow cards with preview image, graph summary, required integrations, permissions, evidence types, AI providers, version, author, org approval, and risk score.
- Add sandbox try-before-import using sample/redacted data.
- Add verified creator, verified organization, signed package, scan result, install count, rating, deprecation, and compatibility signals.
- Add missing-node/missing-integration detection for imported canvases and workflows.
- Add marketplace abuse reporting, quarantine, dependency lockfiles, and downgrade/rollback paths.

Acceptance criteria:

- Users can inspect what a template needs before importing it.
- Community workflows can be sandboxed and scanned before touching real evidence.
- Admins can quarantine or roll back risky templates and see affected canvases.

## Phase 47 - Add Scientific Workflow Reproducibility And Environment Capture

Problems/opportunities:

- Research outputs need enough context to rerun, audit, compare, publish, or defend.
- Model, prompt, evidence, integration, feature-flag, and environment drift can silently change outputs.

Benchmark basis:

- Galaxy workflow reuse/publishing, Nextflow/Seqera lineage, and Workflow Run RO-Crate packaging.

Implementation plan:

- Add reproducibility manifests for canvas version, graph schema, template versions, prompts, models, retrieval indexes, integrations, environment, feature flags, evidence checksums, and output checksums.
- Add run packages for reports, exports, AI analyses, lifecycle sends, and research packets.
- Add "rerun with same inputs" and "rerun with current inputs" comparison paths.
- Add reproducibility warnings when model/provider versions changed, evidence was redacted, content expired, template dependencies changed, or integrations returned different data.
- Add publishable research artifacts that bundle human-readable output with machine-readable provenance.

Acceptance criteria:

- Published outputs carry enough context to audit or reproduce the run.
- Users can compare same-input and current-input reruns.
- Drift warnings appear before reports, exports, or lifecycle decisions are treated as authoritative.

## Phase 48 - Add Data Quality, Contracts, And Evidence Health Gates

Problems/opportunities:

- AI analysis, reports, lifecycle journeys, and roadmap decisions are only trustworthy if their input evidence meets explicit quality rules.
- Imported data can silently lose fields, change types, duplicate respondents, omit consent, or include restricted content.

Benchmark basis:

- dbt model contracts/data tests and Great Expectations expectation suites/checkpoints.

Implementation plan:

- Add evidence contracts for source imports, transcripts, survey data, CSVs, CRM data, support tickets, journey events, and lifecycle eligibility data.
- Add validation suites for consent, required metadata, speaker/timestamp integrity, code taxonomy coverage, duplicate respondents, missing segments, PII leakage, and unsupported claims.
- Add quality gates before AI synthesis, report publish, stakeholder export, lifecycle send, and roadmap decision promotion.
- Add validation result panels with failing records, severity, owner, waiver, expiry, and rerun controls.
- Add schema/data-quality drift alerts when imported source shape, field types, or required metadata change.

Acceptance criteria:

- Risky outputs cannot be promoted without passing or explicitly waiving required checks.
- Validation results show exact failing records and owners.
- Source schema/data-quality drift is visible before downstream work consumes it.

## Phase 49 - Add Visual Change Review, Branch Impact, And Merge Governance

Problems/opportunities:

- Large canvas changes, AI-generated edits, template updates, and lifecycle journey changes need review before merge/publish/send.
- Reviewers need semantic diffs and downstream impact, not only screenshots or raw JSON.

Benchmark basis:

- Figma branch review/version history and Power BI semantic model impact analysis.

Implementation plan:

- Add semantic graph diff for nodes, links, sections, evidence, codes, claims, prompts, models, permissions, and lifecycle rules.
- Add side-by-side and overlay review of canvas changes with object-level property diffs and reviewer comments.
- Add approval, suggest-changes, and merge gates for branches, templates, reports, journey changes, and risky AI-generated edits.
- Add impact summaries before merge/publish/send: affected reports, exports, journeys, training objects, lifecycle campaigns, stakeholders, and integrations.
- Add pre-merge checkpoints and restore paths for every approved merge.

Acceptance criteria:

- Reviewers can inspect meaningful graph changes before approval.
- High-impact changes show downstream blast radius before merge or send.
- Approved merges create restoreable checkpoints.

## Phase 50 - Add Connector Schema Drift And Integration Lifecycle Management

Problems/opportunities:

- Integrations fail gradually through auth expiry, schema drift, deprecation, source-system change, and field mapping breakage.
- Users need to know which canvases, reports, journeys, and outputs depend on a connector before changing it.

Benchmark basis:

- Airbyte connector/spec/status patterns and BI downstream impact analysis.

Implementation plan:

- Add connector inventory with owner, status, auth health, scopes, last sync, schema version, source system, and downstream canvas usage.
- Add schema discovery previews and drift policies: ignore, pause/disable, propagate safe fields, or require review.
- Add integration timelines that log schedule changes, schema changes, auth refreshes, failures, retries, and manual overrides.
- Add deprecation warnings for connectors, fields, templates, and lifecycle journeys using deprecated integrations.
- Add downstream impact analysis when a connector schema, auth scope, or field mapping changes.

Acceptance criteria:

- Schema drift creates a visible policy decision before downstream consumption.
- Connector changes show affected canvases, reports, journeys, and outputs.
- Deprecated or unhealthy integrations cannot silently feed authoritative artifacts.

## Phase 51 - Add Stakeholder Portal, Embedded Dashboards, And Subscriptions

Problems/opportunities:

- Stakeholders need approved, permission-safe views of research, not access to raw working canvases.
- Scheduled updates should avoid sending stale, empty, or unauthorized content.

Benchmark basis:

- Metabase subscriptions/embedding/permissions and Tableau Pulse metric goals/thresholds.

Implementation plan:

- Add a stakeholder portal for approved reports, evidence reels, journey dashboards, training recommendations, roadmap decisions, and activation metrics.
- Add permission-aware embedded dashboards and canvas excerpts that never expose raw evidence by default.
- Add scheduled stakeholder subscriptions with filters, audience-specific views, test send, suppression, attachments, and no-results skip rules.
- Add threshold/goal alerts for research operations and product engagement metrics.
- Add subscription usage analytics, owners, expiry, recipient audit, and stale-report warnings.

Acceptance criteria:

- Stakeholders see only approved, permission-safe artifacts.
- Subscriptions can be tested, filtered, suppressed, audited, and expired.
- Stale or empty outputs do not send unless explicitly configured.

## Phase 52 - Add Scenario Simulation, What-If Optimization, And Visual Debugging

Problems/opportunities:

- Lifecycle campaigns, feature rollouts, training recommendations, roadmap choices, and report changes should be simulated before activation.
- Complex workflows need breakpoints and watched values to debug why eligibility, retrieval, or claims changed.

Benchmark basis:

- AnyLogic experiments/optimization, Houdini TOPs/PDG work estimation, and Unreal Blueprint debugging.

Implementation plan:

- Add what-if scenarios for lifecycle timing, feature rollout, training recommendations, roadmap prioritization, sample sizes, and research operations capacity.
- Add scenario parameters, constraints, objectives, expected outcomes, risk flags, and compare-to-baseline views.
- Add simulation dry-runs for lifecycle campaigns, stakeholder sends, integration syncs, report generation, and AI workflows.
- Add visual breakpoints/watch values for evidence transforms, AI prompts, search retrieval, journey eligibility, and report claims.
- Add static/dynamic work estimates so users know whether a run has known workload or will expand as data is processed.

Acceptance criteria:

- Users can compare scenario outcomes before activation.
- Dry-runs show expected recipients, outputs, risks, cost, and data dependencies.
- Breakpoints/watch values explain why graph logic produced a result.

## Phase 53 - Add Design Tokens, Visual Regression, And UI State Coverage

Problems/opportunities:

- Canvas colors, badges, edge styles, focus rings, and density communicate research meaning and cannot drift casually.
- Graphical regressions need component-level and full-canvas visual baselines across states, devices, themes, and browsers.

Benchmark basis:

- Figma variables/modes, Storybook visual tests, and Chromatic visual regression.

Implementation plan:

- Add a visual design-token layer for canvas colors, node states, ports, edge types, badges, density, spacing, shadows, focus rings, and semantic status.
- Add UI-state matrices for light/dark, high contrast, mobile/desktop, empty/loading/error/success, readonly/edit/review/present, and reduced-motion.
- Add isolated visual fixtures for graph nodes, edges, controls, popovers, modals, minimap, inspector panels, and stakeholder views.
- Add cross-browser visual regression baselines for low zoom, dense canvas, selected/focused/hovered, warning/error, and animation-idle states.
- Add design-token review checks so semantic palette/status changes cannot silently break accessibility or research meaning.

Acceptance criteria:

- Every visual state that carries semantic meaning has token coverage and visual regression coverage.
- Token changes show affected components/canvas states before merge.
- Accessibility contrast failures block release unless explicitly waived.

## Phase 54 - Add Data Catalog, Business Glossary, And Research Asset Stewardship

Problems/opportunities:

- Evidence, reports, templates, AI runs, and integrations become hard to trust when ownership, classification, glossary context, and lineage are scattered.
- Search should find research assets by business meaning and governance state, not just file name.

Benchmark basis:

- Microsoft Purview catalog, glossary, classification, lineage, and asset stewardship patterns.

Implementation plan:

- Add a research asset catalog for evidence sources, transcripts, codebooks, themes, reports, journeys, templates, integrations, AI runs, and published artifacts.
- Add owners, stewards, glossary terms, classifications, sensitivity labels, retention labels, quality status, and usage state to research assets.
- Add catalog search/filtering across business term, source, owner, project, classification, consent state, quality state, lineage, and downstream usage.
- Add lineage navigation from business glossary term to evidence, graph node, report claim, lifecycle journey, roadmap item, and stakeholder subscription.
- Add stewardship workflows for certification, deprecation, review reminders, stale owner detection, and asset handoff.

Acceptance criteria:

- Research assets can be searched by owner, glossary term, classification, quality, lineage, and usage.
- Critical assets have an owner/steward and review state.
- Stale or uncertified assets are visible before they feed reports or lifecycle journeys.

## Phase 55 - Add Retention, Legal Hold, eDiscovery, And Disposition

Problems/opportunities:

- Sensitive research data, media, AI outputs, messages, and support bundles need defensible retention and deletion behavior.
- Legal hold must override user convenience and explain why deletion is blocked.

Benchmark basis:

- Microsoft Purview retention, Google Vault holds, and Slack legal holds/Discovery APIs.

Implementation plan:

- Add retention labels for evidence, transcripts, media, reports, AI runs, lifecycle messages, exports, recordings, and support bundles.
- Add legal hold/eDiscovery locks that preserve relevant evidence, comments, versions, messages, reports, and run logs even if users delete or edit them.
- Add disposition review before permanent deletion, with owner approval, proof of disposition, and blocked deletion when content is under hold.
- Add retention/hold conflict explanations so users understand why content cannot be deleted or why storage grows.
- Add eDiscovery export bundles with permission-safe manifests, chain-of-custody metadata, hashes, and audit trail.

Acceptance criteria:

- Held content cannot be permanently deleted or silently altered.
- Disposition review records who approved deletion and what was deleted.
- eDiscovery exports include manifests, hashes, permissions, and audit metadata.

## Phase 56 - Add Resource Quotas, Cost Budgets, And Compute Capacity Planning

Problems/opportunities:

- AI, transcription, embedding, media, report, lifecycle, and export workloads can create runaway cost and queue pressure.
- Users need clear quota failures and graceful degradation paths.

Benchmark basis:

- Kubernetes ResourceQuota and AWS Step Functions quotas/throttling/redrive/cost patterns.

Implementation plan:

- Add project/org quotas for storage, media duration, transcription minutes, embeddings, AI tokens, report generations, lifecycle sends, exports, active jobs, concurrent runs, and retained histories.
- Add quota-aware UX that explains which limit would be exceeded and suggests upgrade, cleanup, scheduling, or scope reduction.
- Add resource budgets and chargeback/showback for users, projects, teams, features, AI providers, and lifecycle journeys.
- Add capacity planning dashboards for queue depth, throughput, compute spend, provider throttling, storage growth, retention storage, and peak usage.
- Add graceful degradation modes when quotas or provider capacity are exhausted: pause, queue, downsample, summarize, or require approval.

Acceptance criteria:

- Quota failures explain the violated limit and recovery options.
- Admins can see cost/resource usage by project, team, feature, provider, and journey.
- Workloads degrade safely rather than failing as unexplained errors.

## Phase 57 - Add Incident Response, Runbooks, Status Pages, And Postmortems

Problems/opportunities:

- Production failures in a graphical research tool need formal response, not only support tickets.
- Incidents should create timelines, runbook updates, postmortems, and prevention work.

Benchmark basis:

- PagerDuty incident response, Atlassian incident management, and Statuspage postmortems.

Implementation plan:

- Add severity levels and incident workflows for blank canvases, failed sends, corrupt imports, broken reports, connector outages, AI provider failures, privacy exposure, and data-quality gate bypasses.
- Add runbooks linked to alerts, support bundles, dashboards, owners, dependency graph, and recent changes.
- Add internal/external status updates for affected workspaces, integrations, lifecycle sends, and stakeholder portals.
- Add incident timelines from telemetry, user actions, queue events, deploys, feature flags, provider status, and support notes.
- Add postmortems with impact, root cause, remediation actions, owners, due dates, linked backlog items, runbook updates, and prevention checks.

Acceptance criteria:

- Severe production failures have assigned roles, runbooks, and status communication.
- Incident timelines are generated from operational evidence.
- Postmortem action items link to owners, due dates, backlog items, and prevention checks.

## Phase 58 - Add Enterprise Identity, SSO, SCIM, And Access Lifecycle

Problems/opportunities:

- Enterprise customers need self-serve identity setup, provisioning, deprovisioning, and access reviews.
- Graphical evidence tools need identity policy explanations directly where evidence, AI actions, exports, and sends occur.

Benchmark basis:

- Okta SAML/OIDC/SCIM and Microsoft Entra access review patterns.

Implementation plan:

- Add OIDC and SAML admin setup with metadata exchange, certificate rotation, tenant/domain routing, relay-state deep links, and safe admin break-glass access.
- Add SCIM provisioning for users, groups, workspace membership, roles, deactivation, and reactivation.
- Add dashboards for inactive users, guests, stale admins, orphaned projects, pending invitations, and over-permissioned integrations.
- Add recurring access reviews for sensitive projects, stakeholder portals, lifecycle sends, exports, AI tools, templates, and integrations.
- Add canvas-level identity policy explanations for blocked or allowed evidence, AI, send, and export actions.

Acceptance criteria:

- Enterprise admins can configure SSO and SCIM without support intervention.
- Deactivated users and removed groups lose access consistently across projects, portals, sends, exports, and integrations.
- Users see actionable policy explanations when identity rules block canvas actions.

## Phase 59 - Add Secrets, Key Management, BYOK, And Credential Hygiene

Problems/opportunities:

- Integration credentials, webhook secrets, and provider keys must not appear in canvases, logs, exports, screenshots, prompts, or support bundles.
- Regulated customers may require customer-managed keys and key lifecycle controls.

Benchmark basis:

- HashiCorp Vault centralized secret lifecycle and AWS KMS key management/BYOK patterns.

Implementation plan:

- Add organization secret vault abstractions for integration credentials, webhook signing secrets, AI provider keys, storage credentials, transcription providers, and email providers.
- Replace raw secret storage in canvases/templates/runs with redacted secret references and health status.
- Add rotation, expiry, owner, usage, last-access, last-rotated, blast-radius, test, revoke, and policy status.
- Add BYOK/CMK options for enterprise tenants, including region, key ownership, disablement consequences, and re-encryption workflows.
- Add secret health badges on connector nodes, workflow nodes, send controls, export controls, and integration dashboards.

Acceptance criteria:

- No raw secrets appear in canvas JSON, exports, support bundles, screenshots, AI prompts, or run logs.
- Admins can rotate, test, revoke, and audit credentials without editing graph content.
- BYOK/CMK status and failure modes are visible before users attempt protected operations.

## Phase 60 - Add API/Event Contract Lifecycle And Developer Trust

Problems/opportunities:

- Public APIs, webhooks, imports, exports, lifecycle events, and AI/job events need stable machine-readable contracts.
- External automations need versioning, idempotency, signatures, replay, and deprecation governance.

Benchmark basis:

- OpenAPI, AsyncAPI, and Stripe API versioning/idempotency/webhook safety patterns.

Implementation plan:

- Add canonical schemas and generated OpenAPI/AsyncAPI contracts for APIs, events, webhooks, import/export, lifecycle journeys, AI runs, and connector syncs.
- Add versioning, deprecation windows, compatibility tests, sample payloads, correlation IDs, and consumer-impact reports.
- Add idempotency keys for state-changing APIs and lifecycle/send/report/export operations.
- Add webhook signatures, replay protection, endpoint secrets, endpoint API versions, delivery attempts, and redacted event logs.
- Add canvas-level contract warnings when templates, integrations, journeys, or external automations depend on deprecated or incompatible schemas.

Acceptance criteria:

- API/event docs are generated from canonical schemas and fail CI when contracts drift.
- Webhook consumers can verify signatures, replay safe events, and inspect redacted delivery history.
- Deprecations show affected canvases, templates, journeys, and integrations before breaking changes ship.

## Phase 61 - Add Backup, Restore, And Disaster Recovery UX

Problems/opportunities:

- Users and operators need confidence that workspaces, evidence, media, reports, indexes, configuration, and tenant settings can be restored.
- Restore operations need previews and drills, not just invisible backup jobs.

Benchmark basis:

- AWS Backup point-in-time restore and PostgreSQL WAL/PITR patterns.

Implementation plan:

- Add workspace/project point-in-time restore with preview, diff, affected-object summary, owner approval, and restore-as-copy.
- Add object-level restore for deleted nodes, evidence, transcripts, comments, codes, reports, lifecycle journeys, templates, and published artifacts.
- Add backup coverage status for database, media/files, search/vector indexes, generated artifacts, configuration, secrets metadata, and tenant settings.
- Add RPO/RTO dashboards and scheduled restore drills for production, staging, and customer-specific enterprise environments.
- Add disaster recovery runbooks for data, configuration, identity provider setup, integration secrets, webhook endpoints, background jobs, and lifecycle send suppression.

Acceptance criteria:

- Operators can prove recent restore success and current backup coverage.
- Users can preview point-in-time/object restores before applying them.
- DR runbooks include configuration, identity, secrets metadata, jobs, webhooks, and lifecycle suppression, not only database restore.

## Phase 62 - Add Internationalization, Localization, RTL, And Cultural UX

Problems/opportunities:

- Global customers need locale-aware UI, emails, exports, transcripts, reports, and training journeys.
- The graphical canvas must not clip, invert, or misroute content under long translations, CJK text, RTL layouts, or mixed-direction evidence.

Benchmark basis:

- Unicode CLDR, ICU MessageFormat, and W3C internationalization guidance.

Implementation plan:

- Add locale-aware formatting for dates, times, numbers, currencies, names, addresses, durations, quota units, and research sample descriptors.
- Add ICU-style message catalogs for UI, emails, training prompts, validation messages, run errors, export text, and lifecycle journeys.
- Add RTL layout support and QA for toolbars, nodes, edge labels, minimap, panels, popovers, comments, stakeholder portals, and exported reports.
- Add multilingual evidence handling for transcripts, translations, source-language labels, quote-level translation status, and localized evidence reels.
- Add localization visual regression for long German/French labels, compact CJK labels, Arabic/Hebrew RTL flows, and mixed-direction evidence.

Acceptance criteria:

- Core canvas workflows pass visual QA in representative LTR, RTL, CJK, and long-label locales.
- Emails, exports, validation, and run errors use structured message catalogs rather than concatenated strings.
- Evidence can preserve source language, translation status, and quote-level context.

## Phase 63 - Add Design Rules, Constraint Authoring, And Preflight Gates

Problems/opportunities:

- Research canvases can look visually complete while still containing unsupported claims, stale analysis, missing consent, broken integrations, or invalid relation semantics.
- Publish/export/send actions need explicit preflight gates before the canvas drives decisions.

Benchmark basis:

- KiCad design-rule checking, custom design rules, issue focus, and output readiness patterns.

Implementation plan:

- Add a canvas design-rule engine for missing evidence, invalid relation types, unsupported claims, uncoded excerpts, circular dependencies, stale AI outputs, missing consent, broken integrations, and export/send blockers.
- Add custom rule authoring for organization research standards, compliance policies, lifecycle send rules, method templates, and stakeholder review criteria.
- Add visual issue markers with severity, owner, waive/justify, focus-in-canvas, and batch-fix actions.
- Add preflight gates before publish, export, stakeholder share, lifecycle send, template release, and roadmap promotion.
- Add rule syntax validation, examples, dry-runs, and "what changed since last clean preflight" summaries.

Acceptance criteria:

- Publish/export/share/send/template/roadmap actions show blocking and non-blocking rule status before completion.
- Users can focus each issue in the canvas, assign ownership, fix, waive with justification, or rerun checks.
- Organization rules can be authored, syntax-checked, dry-run, versioned, and applied to selected projects/templates.

## Phase 64 - Add Parametric Timeline, Dependency Rebuild, And Design History

Problems/opportunities:

- Users need to understand how a research conclusion evolved, not only the current graph state.
- Changing upstream evidence, prompts, codes, templates, integrations, or model versions should visibly invalidate downstream outputs.

Benchmark basis:

- Autodesk Fusion parametric timeline and Onshape version/branch history patterns.

Implementation plan:

- Add a canvas timeline that records meaningful graph edits, imports, coding passes, AI runs, layout changes, report generation, journey activation, and publish/send events.
- Add time-scrubbing and replay for research evolution, with reviewer-friendly summaries.
- Add dependency rebuild indicators when upstream changes invalidate downstream nodes, reports, journeys, exports, or roadmap items.
- Add branch experiments for alternate coding schemes, report narratives, journey strategies, AI prompts, and stakeholder views.
- Add rebuild failure panels with affected nodes, stale outputs, recoverable steps, restore points, and recommended reruns.

Acceptance criteria:

- Users can replay a canvas from a previous point and see what changed, why, and by whom.
- Upstream changes mark downstream outputs stale with actionable rerun/rebuild paths.
- Branch experiments can be created, compared, merged, abandoned, or restored without corrupting the main workspace.

## Phase 65 - Add Role-Specific Operational Interfaces And Human-In-The-Loop Workbenches

Problems/opportunities:

- A single power-user canvas view is too broad for reviewers, admins, support, customer success, executives, and integration owners.
- Operational work needs queues, approvals, and focused actions generated from the same canvas data.

Benchmark basis:

- Airtable Interface Designer, Airtable Automations, and Retool apps/workflows patterns.

Implementation plan:

- Add role-specific workbenches for researcher, reviewer, customer success, admin, executive, training author, support, and integration owner.
- Generate focused interfaces from the same canvas model rather than separate CRUD/admin screens.
- Add approval queues, evidence triage queues, failed-run queues, stale-report queues, support-escalation queues, and lifecycle-campaign queues.
- Add human-in-the-loop checkpoints for AI synthesis, code merges, sensitive exports, lifecycle sends, connector drift, and roadmap promotion.
- Add interface publishing, permissions, usage analytics, and automation triggers tied to canvas objects and events.

Acceptance criteria:

- Each target role has a focused queue with only relevant canvas objects, actions, and policy context.
- Actions taken in a workbench update the canonical canvas model and audit trail.
- Human checkpoints can block automation until an authorized user reviews, approves, rejects, or requests changes.

## Phase 66 - Add Customer Success Health, Support Feedback, And Adoption Playbooks

Problems/opportunities:

- Engagement emails and training campaigns need customer-health context, not just elapsed time since signup.
- Support tickets, chats, failed searches, screenshots, and QA recordings should feed product and training improvements.

Benchmark basis:

- HubSpot customer success health scores, Intercom Fin answer testing/inspection, and Pendo Resource Center metrics.

Implementation plan:

- Add account/user health scores based on activation, first canvas value, collaboration depth, evidence import success, graph health, export success, support tickets, NPS/feedback, and inactivity.
- Add customer success playbooks for stalled onboarding, failed imports, blank-canvas confusion, no-collaborator projects, low evidence quality, failed AI runs, and unactivated lifecycle journeys.
- Add support-feedback clustering linked to tickets, chats, failed searches, rage clicks, screenshots, QA recordings, and exact canvas states.
- Add AI support answer inspection for QualCanvas help content, including cited sources, persona simulation, answer quality ratings, and missing-content tasks.
- Add adoption dashboard segments by role, plan, project type, feature exposure, training completion, lifecycle journey, and canvas maturity.

Acceptance criteria:

- Lifecycle journeys can target based on health score and activation state, not only time-based triggers.
- Support issues can be traced to canvas states and converted into product, documentation, training, or QA tasks.
- Help/support AI answers can be tested, inspected, scored, and improved before broad exposure.

## Phase 67 - Add Guided Academy, Credentials, And In-Context Practice

Problems/opportunities:

- A powerful graphical research tool needs structured hands-on learning, not only static docs and emails.
- Training should map to actual product outcomes and role-specific workflows.

Benchmark basis:

- Salesforce Trailhead modules/projects/trails/trailmixes/superbadges and Pendo in-app guidance/onboarding analytics.

Implementation plan:

- Add a QualCanvas Academy with role-based trails for researcher, moderator, analyst, product manager, executive reviewer, admin, integration owner, and training author.
- Add hands-on canvas challenges using safe demo projects, guided checkpoints, validation rules, and badge/credential completion.
- Add in-context lessons triggered by graph health warnings, first-time workflows, failed preflight checks, empty states, and newly released features.
- Add custom learning paths for teams, mapped to product activation milestones and lifecycle messaging.
- Add training analytics that connect lesson completion to canvas outcomes, support reduction, retention, and feature adoption.

Acceptance criteria:

- Users can complete safe demo-canvas challenges without affecting production data.
- Training recommendations deep-link to exact canvas states, role paths, and validation checkpoints.
- Training analytics show whether learning paths improve activation, graph quality, support deflection, retention, and feature adoption.

## Phase 68 - Add Power-User Workspace Profiles, Hotkeys, And Command Ergonomics

Problems/opportunities:

- Expert users need speed, repeatability, and task-specific layouts as the graphical surface grows.
- Keyboard-only and power-user flows should not be blocked by menus designed only for casual mouse usage.

Benchmark basis:

- Blender workspaces and VS Code profiles/keybindings.

Implementation plan:

- Add workspace profiles for Research Edit, Coding, Synthesis, Review, Present, Admin, Support, Customer Success, Academy Authoring, and Integration Operations.
- Add customizable keymaps, command palette aliases, context-specific commands, conflict detection, import/export/share profiles, and reset-to-default.
- Add panel-layout presets, density presets, toolbar presets, sidebar presets, and input-mode presets for mouse, trackpad, touch, pen, and keyboard-only use.
- Add macro recording for repeated graph cleanup, import triage, coding passes, report preparation, preflight fixing, and stakeholder packaging.
- Add profile governance so organizations can publish recommended profiles while allowing personal overrides where safe.

Acceptance criteria:

- Users can switch task profiles without losing canvas state.
- Keybinding conflicts are detected and can be resolved before saving.
- Organizations can publish governed profiles and users can apply safe personal overrides.

## Phase 69 - Add Procedural Asset Packaging And Asset Interface Design

Problems/opportunities:

- Powerful canvas workflows need reusable asset interfaces, not only copied subgraphs.
- Teams need stable, versioned, documented research assets whose internals can evolve safely.

Benchmark basis:

- Houdini Digital Assets.

Implementation plan:

- Add Research Digital Assets that package subgraphs, templates, prompts, validation rules, examples, training links, and output contracts into reusable canvas nodes.
- Add stable internal IDs, human labels, namespaces, branches, semantic versions, compatibility ranges, changelogs, owners, approvals, and deprecation state.
- Add exposed parameters and locked internals so teams can reuse powerful workflows without editing fragile implementation details.
- Add embedded sample evidence, demo canvases, expected outputs, help tabs, and QA checks for each asset.
- Add side-by-side asset upgrade previews so existing canvases can keep old asset versions while new canvases default to approved newer versions.

Acceptance criteria:

- Users can package a working subgraph as a reusable asset with exposed parameters and locked internals.
- Existing canvases continue to run with pinned older asset versions.
- Asset upgrades show compatibility, before/after behavior, and manual follow-up tasks before applying.

## Phase 70 - Add Canvas-Anchored Comments, Mentions, Notifications, And Decision Inbox

Problems/opportunities:

- Discussion and decisions should attach to exact canvas objects, not drift into disconnected chat or email.
- Reviewers need an inbox for mentions, approvals, preflight waivers, stale outputs, and assigned tasks.

Benchmark basis:

- Figma comments, Miro comments, Linear notifications, and Jira mentions/watchers.

Implementation plan:

- Add comments anchored to nodes, edges, sections, excerpts, evidence clips, report claims, journey steps, preflight issues, timeline events, and exports.
- Add @mentions, assignment, due dates, decision requests, approval requests, read/unread, resolved/unresolved, follow/mute, pin, color/severity, and mobile reply flows.
- Add a decision inbox that aggregates mentions, assigned issues, review requests, stale-output tasks, preflight waivers, lifecycle approvals, and support escalations.
- Add notification digests, urgency levels, quiet hours, workspace/project subscriptions, and role-aware routing.
- Add comment audit and retention behavior that respects legal hold, evidence permissions, stakeholder visibility, and export redaction.

Acceptance criteria:

- Comments can jump users to the exact canvas object and state they refer to.
- Decision inbox items can be resolved, assigned, muted, followed, escalated, or converted to tasks.
- Notifications respect role permissions, quiet hours, digests, retention, and stakeholder-safe visibility.

## Phase 71 - Add Data Residency, Tenant Boundary, And Compliance Scope Transparency

Problems/opportunities:

- Enterprise admins need to understand what is pinned, what is processed elsewhere, and what third-party apps/providers do with data.
- AI, transcription, lifecycle sends, exports, logs, and support bundles can cross boundaries if residency is not visible at workflow time.

Benchmark basis:

- Atlassian data residency, GitHub Enterprise Cloud data residency, and Google Workspace data regions.

Implementation plan:

- Add a residency and tenant-boundary dashboard that shows where each class of data lives: evidence, media, transcripts, embeddings, search indexes, AI prompts, AI outputs, logs, telemetry, backups, exports, emails, support bundles, and third-party connector data.
- Add in-scope/out-of-scope explanations for every residency setting, including caches, transient processing, operational logs, AI providers, email providers, and integration apps.
- Add region-aware processing and warnings before users run AI, transcription, export, lifecycle send, webhook, or support-bundle workflows that cross region boundaries.
- Add migration scheduling, migration status, rollback/hold windows, app/integration readiness, and post-migration verification.
- Add tenant isolation evidence for enterprise reviews, including subprocessor inventory, data-flow maps, access path summaries, and testable boundary checks.

Acceptance criteria:

- Admins can see residency status and scope for every major data class and workflow.
- Cross-region workflows warn users before execution and record audit evidence.
- Residency migration status, app readiness, verification, and rollback/hold windows are visible.

## Phase 72 - Add Release, Deprecation, And Migration Assistant

Problems/opportunities:

- As canvas schema, nodes, templates, AI prompts, integrations, and lifecycle features evolve, customers need impact-aware upgrades.
- Release notes are weaker than migration paths tied to affected canvas states.

Benchmark basis:

- Kubernetes deprecation policy, Stripe changelog/API upgrades, and Next.js codemods.

Implementation plan:

- Add a release-impact center that shows which users, canvases, templates, assets, integrations, reports, lifecycle journeys, and exports are affected by a change.
- Add deprecation policies for canvas schema, node types, relation types, templates, APIs, events, AI prompts, model providers, extension capabilities, and lifecycle journey features.
- Add migration assistants that dry-run canvas/schema/template/asset upgrades, show before/after diffs, apply safe transformations, and leave manual follow-up tasks where needed.
- Add version pinning, compatibility warnings, rollout windows, rollback paths, upgrade reminders, and audit evidence for accepted migrations.
- Add release notes that deep-link to affected canvas states, guided academy lessons, in-product walkthroughs, support articles, and customer success playbooks.

Acceptance criteria:

- Admins can see which workspaces and artifacts are affected before accepting an upgrade.
- Migrations support dry-run, diff preview, partial application, rollback path, and manual follow-up tasks.
- Deprecation warnings include timeline, impact, owner, recommended action, and linked training/support content.

## Phase 73 - Add Migration Hub, Import Fidelity, And Competitive Tool Offboarding

Problems/opportunities:

- Customers replacing existing visual/research tools need guided migration, fidelity reporting, cleanup, and rollback.
- Raw imports without object mapping create untrusted canvases and manual cleanup burden.

Benchmark basis:

- Figma file import and Miro diagram migration/import workflows.

Implementation plan:

- Add a Migration Hub for Miro, FigJam/Figma, Mural, Lucidchart, draw.io, Visio, CSV, spreadsheet, JSON, GraphML, transcript archives, and existing QualCanvas exports.
- Add import mapping previews for shapes, sticky notes, comments, sections, links, frames, images, connectors, timestamps, authors, evidence references, and metadata.
- Add unsupported-object reports, fidelity scores, import warnings, object counts, permission/ownership mappings, and before/after visual comparison.
- Add post-import cleanup tools: convert sticky notes to evidence, convert frames to sections, infer relations, relink media, deduplicate authors, and detect orphaned comments.
- Add migration project dashboards for large customers, with status, failures, retry queues, sample validation, stakeholder signoff, and rollback/export paths.

Acceptance criteria:

- Imports produce a migration report with fidelity score, unsupported objects, warnings, and cleanup actions.
- Users can preview mapping before import and compare before/after visually after import.
- Large migrations can be retried, sampled, signed off, rolled back, or exported.

## Phase 74 - Add Procurement Evidence Room, Security Questionnaires, And Trust Automation

Problems/opportunities:

- Enterprise buyers need security, privacy, AI, accessibility, residency, incident, uptime, and DR evidence before purchase.
- Reanswering bespoke questionnaires manually will become a sales and security bottleneck.

Benchmark basis:

- CSA STAR, Shared Assessments SIG, and SOC 2 procurement patterns.

Implementation plan:

- Add a Trust/Evidence Room with security overview, architecture diagrams, data-flow maps, SOC 2/ISO/CSA status, pen-test summaries, policies, subprocessors, DPA, incident history, uptime/SLA, BCP/DR evidence, and AI/data-use controls.
- Add questionnaire response automation for CAIQ, SIG, custom XLSX/CSV questionnaires, AI security questionnaires, and accessibility/security procurement bundles.
- Add evidence freshness, owner, review date, source-of-truth link, redaction level, customer eligibility, and NDA/access controls.
- Add buyer-facing export packets with scoped evidence, immutable version, expiry, access log, and sales/customer-success handoff notes.
- Add risk-question routing to the right owner when a response is missing, stale, contradictory, or not backed by evidence.

Acceptance criteria:

- Trust evidence has owners, freshness, access control, and source-of-truth links.
- Questionnaire exports include only eligible evidence and record access/audit history.
- Missing or stale questionnaire answers route to accountable owners.

## Phase 75 - Add Accessibility Conformance Reporting And Assistive-Tech Evidence

Problems/opportunities:

- Accessibility work needs conformance artifacts for buyers, not just internal fixes.
- Dense graphical tools need explicit assistive-technology evidence, sample sets, known limitations, and remediation traceability.

Benchmark basis:

- ITI VPAT/ACR, Section508.gov, and W3C WCAG-EM.

Implementation plan:

- Add an accessibility conformance program for the canvas, including VPAT/ACR generation, WCAG/Section 508/EN 301 549 mapping, known limitations, and remediation backlog links.
- Add assistive-technology evidence for screen readers, keyboard-only operation, high contrast, reduced motion, zoom, touch, pen, voice input, and non-visual graph navigation.
- Add representative accessibility sample sets for dense graphs, modals, menus, comments, timeline, workbenches, exports, reports, and lifecycle journey builder.
- Add accessibility regression artifacts with screenshots, videos, keyboard traces, ARIA snapshots, focus-order maps, and issue severity.
- Add customer-facing accessibility roadmap and release notes tied to conformance gaps and known limitations.

Acceptance criteria:

- ACR/VPAT outputs can be generated from current conformance evidence and known limitations.
- Assistive-tech test evidence links to product areas, issues, versions, and remediation status.
- Accessibility sample sets cover the canvas-specific interactions that generic web audits miss.

## Phase 76 - Add Browser Rendering Pipeline, Worker Offload, And Interaction Performance

Problems/opportunities:

- Dense graphical canvases need architectural performance work, not only after-the-fact screenshots.
- Heavy layout, import parsing, search/index prep, media handling, and rendering can block interaction feedback.

Benchmark basis:

- MDN OffscreenCanvas/Web Workers, web.dev INP, and Chrome DevTools performance tracing.

Implementation plan:

- Add a rendering architecture plan for large canvases: workerized layout, workerized import parsing, workerized search/index prep, OffscreenCanvas/WebGL/WebGPU feasibility, and main-thread interaction budgets.
- Add interaction performance budgets for pan, zoom, drag, select, lasso, comment, context menu, command palette, modal open, fit view, auto-layout, and timeline scrub.
- Add performance trace capture for dense project QA, including INP, long tasks, scripting/rendering/painting cost, memory, layout thrash, frame drops, and input delay.
- Add progressive rendering and interaction prioritization so visual feedback occurs before expensive recalculation.
- Add a performance regression dashboard keyed by project size, node/edge count, media load, comments, overlays, theme, locale, device class, browser, and feature flag.

Acceptance criteria:

- Dense-canvas QA captures browser traces and interaction metrics, not only screenshots.
- Heavy operations can be moved off the main thread or explicitly justified when they cannot.
- User-visible feedback for core interactions occurs within defined budgets on target device classes.

## Phase 77 - Add Research Method Governance, Reporting Checklists, And Ethical Review

Problems/opportunities:

- Research conclusions should show method quality, consent, sampling, ethics, and reporting completeness.
- AI-generated synthesis and lifecycle decisions should not outrun the quality of the underlying study design.

Benchmark basis:

- EQUATOR qualitative reporting guidelines, COREQ, SRQR, and APA JARS.

Implementation plan:

- Add method governance templates for interviews, focus groups, diary studies, usability tests, surveys, mixed-methods studies, field observations, and evaluative research.
- Add reporting checklists mapped to COREQ, SRQR, APA JARS-Qual, JARS-Quant, and JARS-Mixed where relevant.
- Add study protocol objects with objectives, research questions, sampling, recruitment, consent, incentives, moderator guide, exclusion criteria, risk review, bias/confound notes, and analysis plan.
- Add ethics/readiness gates before evidence collection, participant upload, AI analysis, stakeholder publish, or lifecycle targeting based on research findings.
- Add method-quality overlays on the canvas so reports and recommendations show whether supporting evidence meets the selected method checklist.

Acceptance criteria:

- Research outputs can show the study protocol, method checklist status, consent state, and evidence quality behind them.
- Ethics/readiness gates block high-risk actions until required fields and approvals are complete.
- Method-quality overlays appear in reports, canvas nodes, stakeholder portals, and lifecycle decision previews.

## Phase 78 - Add Nested Subgraphs, Parameter Panels, And Reusable Component Interfaces

Problems/opportunities:

- Large research workflows need reusable component boundaries without forcing users to copy/paste fragile graph regions.
- Component internals should be hideable while exposed inputs, outputs, parameters, ownership, examples, and validation stay visible.

Benchmark basis:

- ComfyUI Subgraph, Node-RED Subflows, Blender node groups, and TouchDesigner custom parameters.

Implementation plan:

- Add nested research subgraphs with breadcrumbs, enter/exit affordances, parent-context previews, unpack-to-nodes, and published subgraph blueprints.
- Add explicit component interfaces with exposed inputs/outputs, parameter panels, defaults, visibility controls, validation, examples, and owner/description metadata.
- Add private utility subgraphs, team-published subgraphs, and organization-approved reusable components.
- Add per-instance parameter overrides with canonical blueprint linkage and upgrade previews.
- Add impact warnings when blueprint edits affect existing canvases, reports, lifecycle journeys, templates, or exports.

Acceptance criteria:

- Users can convert a selection into a subgraph, expose slots/parameters, navigate into it, exit it, unpack it, and publish it as a reusable blueprint.
- Reusable components show owners, descriptions, examples, validation, and affected-instance impact before risky edits.
- Per-instance overrides are visible and do not silently detach from the canonical blueprint.

## Phase 79 - Add Dependency Resolver, Missing Asset Recovery, And Environment Snapshots

Problems/opportunities:

- Shared workflows fail when required models, templates, connectors, datasets, indexes, permissions, or feature flags are missing.
- Imported canvases and reproduced reports need explicit environment state, not guesswork.

Benchmark basis:

- ComfyUI dependencies, ComfyUI Manager, ComfyUI Registry, and Node-RED project dependencies.

Implementation plan:

- Add a workflow dependency resolver for models, prompts, templates, connectors, datasets, transcripts, media files, indexes, feature flags, extensions, and training/email assets.
- Add missing-asset recovery with install/request/access flows, safe fallbacks, owner routing, version choice, and cannot-resolve explanations.
- Add environment snapshots for runnable canvases, including app version, schema version, template versions, model/provider/index versions, feature flags, locale, permissions, connectors, and residency state.
- Add dependency conflict panels before import, open, publish, share, AI run, export, or lifecycle send.
- Add immutable run dependency manifests for reports, recommendations, exports, and lifecycle decisions.

Acceptance criteria:

- Opening/importing a canvas reports missing, stale, conflicting, inaccessible, and optional dependencies.
- Users get actionable recovery paths or explicit cannot-resolve reasons.
- Reports, exports, and AI outputs include dependency/environment manifests sufficient for reproduction analysis.

## Phase 80 - Add Example Gallery, Recipe Browser, And Insertable Learning Snippets

Problems/opportunities:

- Users learn complex node systems faster from runnable examples than from static documentation.
- Training and lifecycle emails need destinations that create real in-product progress.

Benchmark basis:

- ComfyUI Workflow Templates, TouchDesigner OP Snippets, and Node-RED example flows.

Implementation plan:

- Add an example gallery with runnable research recipes for interview coding, theme synthesis, journey mapping, evidence reels, service blueprints, stakeholder reports, lifecycle training, and support triage.
- Add context-aware snippets from node menus, empty states, graph health warnings, template errors, onboarding, and lifecycle emails.
- Require each example to include sample data, expected outcome, comments, method notes, dependency status, permissions, and cleanup behavior.
- Add "insert as sandbox" and "adapt to my project" modes.
- Add analytics connecting examples to activation, completion, support deflection, and graph quality.

Acceptance criteria:

- Users can open, run, inspect, and insert a recipe without affecting production research data by default.
- Examples disclose dependencies, sample data, expected outputs, permissions, cleanup, and method assumptions.
- Training CTAs and lifecycle messages can deep-link to a specific snippet or recipe state.

## Phase 81 - Add Continuous Canvas Static Analysis, Quality Scores, And Rule Governance

Problems/opportunities:

- Publish-time validation is too late for complex graphical research workflows.
- Teams need rule severity, waivers, and enforcement to vary by method, sensitivity, customer, and environment.

Benchmark basis:

- Power Automate Flow Checker static analysis and rule governance.

Implementation plan:

- Add a live Canvas Checker panel with quality score, grouped issues, severity, object focus, search/filter, rule explanations, and quick fixes.
- Add rule profiles by workspace, method, customer tier, data sensitivity, lifecycle journey type, accessibility target, and deployment environment.
- Add rule categories for visual clarity, method completeness, evidence quality, accessibility, performance risk, permissions, lifecycle send safety, AI provenance, and export readiness.
- Add admin-managed severities, inherited settings, overrides, waivers, and audit trails.
- Add toolbar issue counts and action-specific gates for publish, share, export, send, template release, and AI promotion.

Acceptance criteria:

- Canvas Checker updates as users edit and can focus each issue in the canvas.
- Rule profiles can change severity and enforcement by workspace/environment.
- Waivers are explicit, permissioned, justified, time-bound where needed, and audit logged.

## Phase 82 - Add Solution Packaging, Environment Promotion, And Connection References

Problems/opportunities:

- Visual workflows need a safe path from demo/sandbox to staging/production without editing secrets or environment-specific values inside the graph.
- Enterprise customers need evidence that solution packages contain every required component and pass validation before promotion.

Benchmark basis:

- Power Automate solution-aware flows and Node-RED Projects.

Implementation plan:

- Add QualCanvas Solutions that package canvases, templates, snippets, connectors, journey definitions, reports, permissions, policies, tests, dependency manifests, and documentation.
- Add environment variables and connection references for dev, staging, production, customer sandboxes, demo workspaces, and regulated regions.
- Add promotion pipelines with diff preview, validation gates, approval, dry-run, rollback, run history, and deployment evidence.
- Keep secrets out of canvas files while allowing graph portability and reproducible setup in another environment.
- Add project-level README, changelog, dependency status, environment matrix, and release checklist.

Acceptance criteria:

- A solution package can be validated before promotion and reports missing dependencies, policies, connection references, and tests.
- Environment-specific values are rebound through references, not hardcoded into graph objects.
- Promotions produce audit evidence, run history, rollback instructions, and release notes.

## Phase 83 - Add Graph Symbol Index, Find References, And Blueprint-Style Navigation

Problems/opportunities:

- Dense visual research projects become hard to navigate when users cannot find where an object is used or what depends on it.
- Search should understand graph semantics, not only visible labels.

Benchmark basis:

- Unreal Blueprint search, Find References, My Blueprint outline, and Blueprint Bookmarks.

Implementation plan:

- Add a graph symbol index for evidence objects, codes, themes, relations, variables, templates, prompts, models, exports, decisions, lifecycle journeys, comments, and owners.
- Add Find References, Find Dependents, Find Upstream Evidence, Find Downstream Outputs, and Find Similar Nodes.
- Add bookmark lists for named views, comments, decisions, unresolved issues, review anchors, and recent execution/debug positions.
- Add local and team bookmark scopes.
- Add index freshness indicators and background indexing status for dense projects.

Acceptance criteria:

- Users can find every usage of a code, theme, template, prompt, model, decision, report, comment, or lifecycle journey across the project.
- Bookmarks and search results jump to the correct canvas position, zoom, object, and mode.
- Index freshness status is visible, and stale indexes do not produce silent false confidence.

## Phase 84 - Add Data Inspector, Path Probes, And Pinned Sample Data

Problems/opportunities:

- Graph users need to understand the data moving through nodes and edges, not only the visible diagram.
- Re-running external connectors, AI calls, exports, or lifecycle sends during debugging can be slow, costly, risky, or side-effectful.

Benchmark basis:

- Node-RED Debug/sidebar messages and n8n data mapping/pinned data.

Implementation plan:

- Add edge/node data probes that show current item shape, source evidence, sample values, sequence/batch metadata, redaction status, and permission scope.
- Add "copy reference path", "copy value", "pin field", "pin sample", and "compare before/after" actions for evidence, codes, themes, AI outputs, report blocks, and lifecycle payloads.
- Add safe pinned samples for external connectors, AI calls, exports, and lifecycle journeys so users can iterate without repeatedly calling services or touching production data.
- Add schema-shape previews and mismatch warnings before mapping values into prompts, reports, journey conditions, or exports.
- Add redacted sample data fixtures for support and training.

Acceptance criteria:

- Users can inspect node/edge data shape, copy paths/values, pin samples, and compare transformations without leaving the canvas.
- Pinned samples are clearly marked and ignored or controlled in production contexts.
- Redacted fixtures preserve debugging value without exposing participant/client content.

## Phase 85 - Add Execution Mode Parity, Partial Runs, And Replay-To-Editor Debugging

Problems/opportunities:

- Manual tests, partial runs, production triggers, dry-runs, and replayed executions can behave differently.
- Production run debugging needs safe replay without accidentally sending emails, webhooks, exports, or AI/provider calls.

Benchmark basis:

- n8n manual, partial, production, retry, and debug-in-editor execution patterns.

Implementation plan:

- Add explicit execution modes for sandbox/manual, selected-branch/partial, scheduled/production, replay, and dry-run.
- Show mode differences for triggers, pinned samples, saved execution data, permissions, side effects, emails, webhooks, exports, and AI/provider calls.
- Add "replay in editor" from a production run with original workflow/current workflow choice, saved input data, redaction, and side-effect suppression.
- Add branch-focused partial execution for selected node/section/report/journey path, including required upstream dependencies and cannot-run explanations.
- Add execution-mode badges on run history, node states, QA artifacts, and support bundles.

Acceptance criteria:

- Every run shows its mode and side-effect policy.
- Users can replay a production run in editor with original/current workflow choice and side effects suppressed by default.
- Partial runs explain required upstream dependencies and why a selected branch cannot run.

## Phase 86 - Add Error Workflows, Node Status Signals, And Dead-Letter Operations

Problems/opportunities:

- Production workflows need routed failure handling, not only console logs or failed job rows.
- Successful executions can still produce suspicious outputs that should not drive reports, decisions, or lifecycle sends.

Benchmark basis:

- n8n Error Trigger workflows and Node-RED node status/status-node patterns.

Implementation plan:

- Add graph-native error handlers for imports, AI runs, connector syncs, report publishing, lifecycle sends, exports, and scheduled jobs.
- Add node status signals for connected, disconnected, rate-limited, stale, waiting, partial data, warning, degraded, retrying, skipped, and blocked.
- Add dead-letter queues for failed imports, failed connector events, failed emails, failed webhooks, failed report generations, and failed AI jobs.
- Add routing rules that create support tasks, incident records, retry jobs, owner assignments, and lifecycle suppression when failures occur.
- Add data-quality failure detection for "successful" runs that produce empty, low-volume, stale, biased, or schema-drifted outputs.

Acceptance criteria:

- Failures route to configured handlers with execution, node, workflow, owner, and payload-summary metadata.
- Dead-letter queues support retry, suppress, assign, inspect, and export actions with audit history.
- Suspicious-success outputs can block reports, journey sends, exports, and roadmap promotion.

## Phase 87 - Add Work-Item Matrix, Variant/Wedge Experiments, And Scheduler Observability

Problems/opportunities:

- Batch operations need item-level observability for status, logs, outputs, costs, retries, and side effects.
- Research teams need controlled variant experiments for prompts, models, codebooks, journeys, reports, and layouts.

Benchmark basis:

- Houdini PDG/TOPs work items, attributes, wedges, and scheduler log/status integration.

Implementation plan:

- Add a work-item matrix for imports, transcriptions, coding batches, AI synthesis, report generation, journey sends, connector syncs, and export jobs.
- Add variant/wedge runs for prompt variants, model/provider variants, codebook variants, journey timing, report formats, sampling strategies, and layout algorithms.
- Show item-level attributes, dependencies, status, owner, retry count, logs, output artifacts, costs, duration, and side effects.
- Add scheduler selection/status for in-app jobs, workers, external queues, AI providers, browser workers, and future enterprise compute runners.
- Add visual compare for variant outputs and promote/rollback selected variants with audit evidence.

Acceptance criteria:

- Batch jobs expose item-level status, logs, retries, artifacts, cost, duration, and side effects.
- Variant runs can be compared and promoted or rolled back with traceable rationale.
- Scheduler status and log links are visible from the canvas and run history.

## Phase 88 - Add Requirements Perspective, Traceability Matrix, And Coverage Gap Review

Problems/opportunities:

- Research goals, customer commitments, compliance criteria, accessibility claims, and lifecycle requirements need direct links to evidence, tests, owners, and outputs.
- Coverage gaps should be visible before reports, templates, or lifecycle journeys become authoritative.

Benchmark basis:

- MathWorks Requirements Toolbox, Simulink Requirements Perspective, traceability matrices, and Model Advisor checks.

Implementation plan:

- Add a Requirements Perspective for research goals, customer commitments, accessibility criteria, compliance controls, lifecycle campaign requirements, report acceptance criteria, and training outcomes.
- Add badges and traceability panes showing which canvas nodes, evidence, tests, reports, journeys, and exports satisfy each requirement.
- Add traceability matrices for requirement-to-evidence, requirement-to-test, requirement-to-report, requirement-to-journey, and requirement-to-owner coverage.
- Add missing-link review, orphan requirement detection, stale requirement impact, and gap severity.
- Add coverage gates before publishing reports, activating lifecycle journeys, releasing templates, or making enterprise/compliance claims.

Acceptance criteria:

- Requirements can be linked to canvas objects, evidence, tests, reports, journeys, exports, and owners.
- Traceability matrices reveal missing, stale, orphaned, and untested requirements.
- Coverage gates block high-impact actions when required links or tests are missing.

## Phase 89 - Add Parent/Subflow Execution Correlation And Cross-Workflow Call Graphs

Problems/opportunities:

- Reusable components and subflows need runtime correlation across parent and child executions.
- Debugging a failure or cost spike requires seeing which parent run invoked which child runs and with what inputs/outputs.

Benchmark basis:

- n8n sub-workflow parent/sub-execution links and workflow execution history.

Implementation plan:

- Add cross-workflow call graphs for subgraphs, reusable components, lifecycle journeys, templates, reports, connector syncs, and support automations.
- Link parent runs to child runs and child runs back to parent context.
- Show input contracts, returned outputs, execution IDs, mode, status, duration, cost, errors, and redacted payload summaries across boundaries.
- Add cross-run search by execution ID, user, workspace, node, workflow, trigger, component version, and external event.
- Add dependency and blast-radius views for shared components invoked by many canvases or journeys.

Acceptance criteria:

- Parent and child executions link bidirectionally with status, version, mode, duration, cost, errors, and payload summaries.
- Users can search runs across workflow boundaries and jump to the relevant canvas/component state.
- Shared component blast-radius views show which canvases, reports, journeys, and automations depend on each component.

## Phase 90 - Add Custom Node SDK, Node UI Standards, And Extension Test Harnesses

Problems/opportunities:

- Custom research nodes, importers, connectors, AI operators, report nodes, and journey nodes need a safe authoring path before third-party or customer-specific extension work scales.
- Without SDKs, fixtures, and UI standards, every new node becomes a one-off UX and security risk.

Benchmark basis:

- ComfyUI custom-node properties and Manager flows, Node-RED node creation/help conventions, and n8n node creation, UI design, and linter guidance.

Implementation plan:

- Add a first-party node SDK for research nodes, importer nodes, AI nodes, journey nodes, report nodes, validation nodes, and connector nodes.
- Add node UI standards for names, categories, labels, required/optional fields, progressive disclosure, help, examples, credentials, error copy, and empty states.
- Add a developer console with scaffold generation, typed contract viewer, sample-canvas fixtures, mocked credentials, permission manifest preview, and package validation.
- Add contract tests for input/output schemas, fixture runs, errors, redaction, accessibility metadata, documentation completeness, compatibility, and permission behavior.
- Add an extension compatibility matrix for app version, graph schema version, permissions, connectors, AI/providers, sample data, and migrations.

Acceptance criteria:

- A developer can scaffold, test, preview, lint, package, and validate a custom node without editing production data.
- Custom nodes cannot publish unless required UI/help, permission, schema, fixture, and compatibility checks pass.
- Users can see node purpose, author, permissions, examples, version compatibility, and known risks before install/use.

## Phase 91 - Add Expression And Mapping Workbench With Typed Transform Preview

Problems/opportunities:

- Report fields, AI prompt variables, lifecycle audience rules, exports, connector mappings, and journey personalization need visible, typed transformations.
- Hidden mappings make generated outputs hard to trust, debug, or review.

Benchmark basis:

- n8n data mapping, per-node data inspection, and expression transformation patterns.

Implementation plan:

- Add an expression/mapping workbench for reports, AI prompts, journeys, exports, connectors, and evidence transformations.
- Provide schema-aware autocomplete, prior-node field pickers, type checks, sample output preview, before/after comparison, and redaction/permission warnings.
- Add a safe expression sandbox with timeout, side-effect blocking, cost/row estimates, unsupported function warnings, and deterministic fixture replay.
- Add mapping diffs when upstream evidence, connector, codebook, or prompt schemas change.
- Store mapping lineage for reports, AI prompts, email journeys, exports, support bundles, and audits.

Acceptance criteria:

- Users can preview and validate mapping output before a report, AI run, export, or journey send uses it.
- Unsafe, expensive, missing, stale, or permission-violating mappings produce clear warnings and block configured high-risk actions.
- Generated outputs expose which mappings and source fields produced each result.

## Phase 92 - Add Data Profiling, Browse Nodes, And Sample/Full-Run Boundaries

Problems/opportunities:

- Evidence and audience quality issues should be visible before AI synthesis, report generation, stakeholder delivery, lifecycle sends, or roadmap promotion.
- Users need to know whether a preview is a fixture, sample, or full dataset.

Benchmark basis:

- Alteryx Browse tool data profiling and KNIME node monitor table/statistics inspection.

Implementation plan:

- Add Browse/Profile nodes and panels for transcripts, survey tables, evidence sets, code matrices, journey audiences, report datasets, connector syncs, and AI batch inputs.
- Show row/item counts, sample scope, full-run scope, type summaries, missing values, duplicates, outliers, language/locale distribution, consent gaps, and sensitivity labels.
- Add sample/full-run badges on node previews, AI prompts, lifecycle audiences, exports, and reports.
- Add profile warnings before AI synthesis, report generation, stakeholder delivery, lifecycle sends, and roadmap promotion.
- Persist profile artifacts in run history and support bundles.

Acceptance criteria:

- Users can inspect data shape, quality, scope, sensitivity, and consent state from the canvas before running high-impact actions.
- Sample-only previews cannot be mistaken for full-data execution.
- Profile artifacts remain available in run history and support bundles without requiring a rerun.

## Phase 93 - Add Workflow Dependency Paths, Relative Assets, And Portability Hygiene

Problems/opportunities:

- Imported/shared canvases can break because media, files, templates, models, indexes, connector schemas, or journey assets are missing or tied to local paths.
- Migration, marketplace publishing, solution packaging, and regulated-region relocation need explicit dependency manifests.

Benchmark basis:

- Alteryx Workflow Dependencies and ComfyUI Manager missing-node recovery.

Implementation plan:

- Add a dependency/path manager for media files, transcript sources, imported datasets, model/index references, connector schemas, templates, snippets, journey assets, and export destinations.
- Support relative, workspace, tenant, region, and external URI path modes with clear portability warnings.
- Add missing asset finder, relink workflow, path rewrite dry-run, archive/package export, and import-time dependency remapping.
- Flag local machine paths, expired signed URLs, inaccessible cloud files, cross-region references, missing permissions, and unsupported connector references.
- Add portability health scores before sharing, migration, solution packaging, marketplace publishing, or regulated-region relocation.

Acceptance criteria:

- Users can see, test, relink, package, and remap all required dependencies before sharing/import/export.
- Local-only, missing, expired, inaccessible, or cross-region dependencies produce actionable warnings.
- Portable packages include manifests and import-time dependency recovery.

## Phase 94 - Add Signed Marketplace Artifacts, SBOMs, And Supply-Chain Attestations

Problems/opportunities:

- Marketplace templates, extensions, connectors, importers, and report packs become a supply-chain risk without signatures, provenance, scans, and policy checks.
- Enterprise buyers need evidence that imported assets were verified and tested.

Benchmark basis:

- SLSA supply-chain levels, Sigstore artifact signing/verification, CycloneDX component/service/dependency inventories, and SPDX software package exchange specifications.

Implementation plan:

- Sign template, extension, connector, importer, report-pack, and workflow-marketplace artifacts and show verification status before install/import.
- Generate SBOM-style manifests for dependencies, permissions, prompts, models, external APIs, build metadata, publisher identity, and compatibility.
- Add admission policies for unsigned, unverified, quarantined, deprecated, high-risk, or policy-incompatible marketplace assets.
- Add attestations for tests, lint, vulnerability scans, license checks, malicious-behavior scans, publisher verification, and sample-canvas QA.
- Surface supply-chain evidence in procurement/trust workflows.

Acceptance criteria:

- Users and admins can distinguish verified, unsigned, quarantined, deprecated, and policy-incompatible marketplace assets before install/import.
- Marketplace assets include machine-readable manifests and visible provenance/test evidence.
- Enterprise trust exports include current marketplace and extension supply-chain evidence.

## Phase 95 - Add Human Fallback, Approval Escalation, And Expert Review Queues For AI Workflows

Problems/opportunities:

- AI coding, summarization, recommendations, lifecycle decisions, and support automation should not silently continue when confidence, evidence quality, or policy checks fail.
- Human review should be part of the graphical workflow, not an untracked Slack/manual cleanup process.

Benchmark basis:

- n8n AI human fallback workflow pattern.

Implementation plan:

- Add human fallback queues for low-confidence AI coding, unsupported claims, failed retrieval, ambiguous sentiment, sensitive content, risky lifecycle recommendations, and blocked connector actions.
- Show fallback reason, source evidence, model trace, confidence signals, reviewer role, SLA, recommended action, and accept/edit/reject controls.
- Add escalation rules by project sensitivity, customer tier, evidence type, lifecycle impact, compliance policy, and user role.
- Feed accepted human corrections into eval datasets, training recommendations, help-gap analysis, and prompt/template improvement loops.
- Make AI interruption visible on the canvas and in reports/journeys.

Acceptance criteria:

- AI workflows stop into explicit review queues when configured confidence, evidence, or policy thresholds fail.
- Reviewers can accept, edit, reject, escalate, and document the decision with source evidence and model trace.
- Human corrections are available for eval and training feedback loops.

## Phase 96 - Add Graph Compile Diagnostics, Search, Semantic Diff, And Debug Workbench

Problems/opportunities:

- Users need a single place to understand why a graph cannot run, publish, export, send, or promote.
- Search, semantic diffs, breakpoints, watches, and node warnings should point to exact graph objects rather than generic logs.

Benchmark basis:

- Unreal Blueprint search/debug/diff tools and Blender Geometry Nodes inspection/warning patterns.

Implementation plan:

- Add a unified diagnostics workbench for compile errors, static-analysis issues, missing inputs, failed mappings, invalid permissions, stale dependencies, unresolved references, and inaccessible outputs.
- Add clickable diagnostics that focus the exact node, edge, port, parameter, section, mapping, requirement, template, or dependency.
- Add semantic graph diff for canvases, templates, journeys, prompts, reports, mappings, permissions, and dependencies.
- Add breakpoints, watches, active path highlighting, execution call stack, and invalid-breakpoint explanations.
- Add background graph indexing for project-wide search across nodes, pins, fields, comments, parameters, mappings, references, and hidden dependencies.

Acceptance criteria:

- Every blocking diagnostic links to a precise canvas object and recommended fix.
- Users can diff meaningful graph changes without reading raw JSON.
- Breakpoints, watches, and call stacks work for supported run types without leaking restricted data.

## Phase 97 - Add Data Trees, Domains, Cardinality, And Collection Semantics

Problems/opportunities:

- The same evidence values can produce different results depending on whether they are single items, lists, grouped lists, trees, matrices, streams, samples, or full datasets.
- Users need explicit warnings when connecting participant-level, excerpt-level, theme-level, account-level, or recipient-level data incorrectly.

Benchmark basis:

- Grasshopper data trees/Parameter Viewer and Blender Geometry Nodes attribute domains/Viewer/Spreadsheet patterns.

Implementation plan:

- Add collection semantics for participant sets, evidence excerpts, code instances, theme clusters, journey audiences, report sections, tasks, and message recipients.
- Show cardinality badges on ports and edges: one item, list, grouped list, tree/branch, matrix, stream, sample, and full dataset.
- Add branch/path viewers for grouped evidence, segments, survey responses, code matrices, audience cohorts, and batch work items.
- Add relation-domain warnings for participant-level, excerpt-level, code-level, theme-level, account-level, and journey-recipient-level mismatches.
- Add matching controls for one-to-one, one-to-many, many-to-one, cross product, grouped-by-key, and preserve-branch transformations.

Acceptance criteria:

- Users can inspect collection shape and branch paths before transformations run.
- Mismatched domain/cardinality connections are flagged with clear consequences and fix options.
- Mapping previews show how items are paired, grouped, expanded, or reduced.

## Phase 98 - Add Public Component Interfaces, Parameter Panels, And Environment Bindings

Problems/opportunities:

- Reusable subgraphs and marketplace workflows need stable public controls without exposing fragile internals.
- Environment-specific settings must be visible and safely promotable across dev, staging, production, customer sandboxes, and regulated regions.

Benchmark basis:

- Blender node groups, TouchDesigner Components/Parameter COMP, and Apache NiFi Parameter Contexts.

Implementation plan:

- Add a public interface designer for reusable subgraphs, research digital assets, templates, and marketplace workflows.
- Let authors expose curated parameters, hide internals, group controls into panels, set defaults, validation, help, ranges, examples, and role visibility.
- Add environment bindings for workspace, region, connector, model/provider, email provider, storage, permissions, budget, and consent settings.
- Show which component instances will be invalidated, restarted, rerun, or require approval when a parameter/environment binding changes.
- Add parameter-set import/export and per-environment overrides.

Acceptance criteria:

- Reusable components can expose stable public parameters while keeping internals locked or hidden.
- Environment overrides are visible before promotion and never export secret values.
- Parameter changes show blast radius, invalidation behavior, and approval requirements.

## Phase 99 - Add Performance Profiling, Hot-Path Heatmaps, And Run Cost Budgets

Problems/opportunities:

- Canvas performance, AI cost, connector latency, large mappings, and journey sends need node-level diagnosis, not only global metrics.
- Flicker and interaction drops should create profiler evidence users/support can inspect.

Benchmark basis:

- TouchDesigner Perform DAT and real-time profiling patterns from mature graphical tools.

Implementation plan:

- Add hot-path overlays for slow layout, slow render, heavy search, expensive import, expensive AI call, large mapping, slow export, or high-volume journey send.
- Add node/edge counters for CPU/browser time, worker time, backend time, queue wait, AI tokens/cost, connector latency, and email throughput.
- Add threshold-triggered profiler snapshots for slow frames, dropped interactions, long tasks, runaway mappings, excessive rerenders, or expensive AI/report jobs.
- Add performance tables and flame-style run summaries in support bundles and QA artifacts.
- Add budgets by canvas size, graph density, media volume, evidence count, recipient count, and device class.

Acceptance criteria:

- Slow graph interactions and expensive runs identify the responsible nodes/edges where possible.
- QA artifacts and support bundles include profiler snapshots for threshold breaches.
- Performance budgets produce actionable pass/fail results by canvas/device class.

## Phase 100 - Add Operator Palette, Certified Snippets, And Contextual Node Discovery

Problems/opportunities:

- Users need to discover the right node, template, importer, report block, journey block, or validation rule from context.
- Example snippets should be certified, governed, and connected to training, not just static documentation.

Benchmark basis:

- TouchDesigner Palette/OP Snippets, Blender node group reuse, and Unreal Blueprint graph search.

Implementation plan:

- Add a contextual operator palette that surfaces nodes, snippets, templates, importers, report blocks, journey blocks, and validation rules based on current selection and project method.
- Add certified snippets with sample data, expected output, permissions, dependencies, risk level, author, version, and adaptation steps.
- Add favorites, recents, team-approved palettes, admin-hidden/internal nodes, and deprecated-node warnings.
- Add operator search facets for purpose, input/output types, method, role, permissions, connector, AI/provider, sample availability, and maturity.
- Add snippet-to-training links for lifecycle emails and in-app academy tasks.

Acceptance criteria:

- Node/template/snippet discovery adapts to selection context and project method.
- Certified snippets expose dependencies, permissions, risk, expected output, and adaptation guidance before insertion.
- Admins can hide internal nodes, approve palettes, and warn/block deprecated nodes.

## Phase 101 - Add Versioned Flow States, Registry Buckets, And Parameter Context Promotion

Problems/opportunities:

- Teams need deployable version states for reusable components, marketplace assets, templates, journeys, report packs, prompt packs, connector packages, and imported canvases.
- Parameter/environment promotion should be explicit and should not export secrets.

Benchmark basis:

- Apache NiFi versioned process groups, registry buckets, version states, nested version conflicts, and Parameter Context behavior.

Implementation plan:

- Add version-state badges for reusable components, marketplace assets, templates, journeys, report packs, prompt packs, connector packages, and imported canvases.
- Add registry buckets for team, organization, marketplace, customer sandbox, implementation partner, and regulated-region assets.
- Add local modified/stale/sync-failure states with commit, revert, compare, refresh, and promote actions.
- Add parameter-context promotion rules that preserve or replace environment bindings intentionally and never export secret values.
- Add nested-version conflict handling so parent packages cannot be promoted while child components have unresolved local changes.

Acceptance criteria:

- Versioned graph assets show up-to-date, locally modified, stale, locally modified and stale, or sync-failure states.
- Promotion flows require explicit parameter/environment decisions and omit secret values.
- Parent assets cannot promote while nested child assets have unresolved local changes.

## Regression Test Plan

Add or extend Playwright specs:

- `e2e/canvas-responsive-visual.spec.ts` for `320x568`, `390x844`, `568x320`, `768x1024`, `1024x768`, `1024x640`, and `1366x768`.
- `e2e/canvas-popover-placement.spec.ts` for Tools, Analyze, Share, Export, and context menus.
- `e2e/canvas-auto-layout-visual.spec.ts` for 50+ nodes, select-all, auto-arrange, focus mode, and fit.
- `e2e/canvas-modal-accessibility.spec.ts` for modal close controls and dialog semantics.
- `e2e/canvas-auth-gated-tools.spec.ts` for Research Calendar under legacy access-code auth.
- `e2e/canvas-accessible-graph-navigator.spec.ts` for keyboard graph traversal, non-drag graph actions, and screen-reader summaries.
- `e2e/canvas-touch-pen-interactions.spec.ts` for touch review, precision select, pen annotation, and gesture conflicts.
- `e2e/canvas-template-registry.spec.ts` for template dependency checks, permission prompts, version pinning, and deprecation warnings.
- `e2e/canvas-diagram-controls.spec.ts` for connector labels, waypoints, line jumps, layers, layout preview, and manual anchor preservation.
- `e2e/canvas-review-session.spec.ts` for agenda frames, follow/summon, evidence reveal, private voting, object locking, and decision capture.
- `e2e/canvas-visual-query.spec.ts` for analytics overlays, query cards, suggested queries, perspective views, and relation previews.
- `e2e/canvas-research-advisor.spec.ts` for advisor checks, impact analysis, test harness dry-runs, breakpoints, and watched outputs.
- `e2e/canvas-enterprise-governance.spec.ts` for roles, guest policies, classification, audit events, export/share controls, and AI/email policy gates.
- `e2e/canvas-research-publishing.spec.ts` for Research Packet creation, stale report detection, reproducibility manifests, regeneration diffs, and multi-format export readiness.
- `e2e/canvas-journey-blueprint.spec.ts` for journey/service-blueprint projections, persona overlays, evidence pins, opportunity/solution linkage, and executive dashboard rollups.
- `e2e/canvas-ai-authoring.spec.ts` for AI proposals, evidence citations, unsupported-claim critique, acceptance/rejection, and admin AI controls.
- `e2e/canvas-integration-platform.spec.ts` for integration health, dry-run imports, diff previews, webhook events, OAuth scopes, and retry/rollback flows.
- `e2e/canvas-lifecycle-journey-builder.spec.ts` for journey eligibility, entry/exit, suppression, frequency caps, preview, dry-run, rollback, consent, and activation metrics.
- `e2e/canvas-durable-jobs.spec.ts` for job states, retries, cancellation, resume, rollback, schedules, backfills, and redacted run history.
- `e2e/canvas-roadmap-traceability.spec.ts` for decision objects, evidence links, prioritization, delivery links, and decision history.
- `e2e/canvas-semantic-export.spec.ts` for JSON-LD/GraphML export, schema validation, compatibility warnings, provenance, permissions, and layout preservation.
- `e2e/canvas-production-observability.spec.ts` for visual failure signals, redacted support bundles, replay privacy, performance budgets, and incident-to-backlog metadata.
- `e2e/canvas-offline-sync.spec.ts` for offline queueing, reconnect merge status, conflict review, and publish/send/share gates.
- `e2e/canvas-extension-sandbox.spec.ts` for extension manifests, permission prompts, restricted mode, revocation, quarantine, and redacted sample tests.
- `e2e/canvas-media-evidence.spec.ts` for media imports, transcription review, evidence clips, consent/redaction metadata, and safe reels.
- `e2e/canvas-hybrid-search-rag.spec.ts` for hybrid search, permission-aware retrieval, result explanations, Graph RAG citations, and index health.
- `e2e/canvas-model-ops.spec.ts` for provider routing, cost/latency/token logs, budgets, fallback handling, and AI incident creation.
- `e2e/canvas-execution-queue.spec.ts` for run queues, dirty-state propagation, partial recompute, cache invalidation, cancellation, retry, and run history.
- `e2e/canvas-dataflow-replay.spec.ts` for backpressure indicators, replay checkpoints, replay eligibility, cannot-replay reasons, and operational failure provenance.
- `e2e/canvas-product-analytics-flags.spec.ts` for activation milestones, cohort dashboards, staged rollouts, experiments, and lifecycle cohort targeting.
- `e2e/canvas-marketplace-trust.spec.ts` for template previews, signed versions, scans, sandbox import, missing dependency detection, quarantine, and rollback.
- `e2e/canvas-reproducibility-manifest.spec.ts` for manifests, checksums, environment capture, same-input/current-input reruns, drift warnings, and run packages.
- `e2e/canvas-data-quality-contracts.spec.ts` for evidence contracts, validation checkpoints, failing-record panels, waivers, reruns, and drift alerts.
- `e2e/canvas-change-review-impact.spec.ts` for semantic diffs, side-by-side/overlay review, approval gates, merge checkpoints, and downstream impact summaries.
- `e2e/canvas-connector-drift.spec.ts` for connector inventory, auth health, schema discovery, drift policies, deprecation warnings, sync timelines, and impact analysis.
- `e2e/canvas-stakeholder-portal-subscriptions.spec.ts` for portal permissions, embedded dashboards, filtered subscriptions, test sends, no-results suppression, threshold alerts, and stale-report warnings.
- `e2e/canvas-scenario-simulation-debugger.spec.ts` for what-if scenarios, baseline comparison, dry-runs, breakpoints, watch values, and static/dynamic work estimates.
- `e2e/canvas-design-token-visual-regression.spec.ts` for semantic tokens, theme modes, contrast checks, visual fixtures, cross-browser baselines, and token-change impact.
- `e2e/canvas-research-asset-catalog.spec.ts` for owners, glossary terms, classifications, lineage, certification, deprecation, search filters, and stewardship workflows.
- `e2e/canvas-retention-legal-hold.spec.ts` for retention labels, legal holds, blocked deletion, disposition review, eDiscovery exports, hashes, and audit trails.
- `e2e/canvas-resource-quotas.spec.ts` for storage/media/AI/job/send quotas, budget dashboards, quota errors, graceful degradation, and chargeback/showback.
- `e2e/canvas-incident-response.spec.ts` for severity levels, runbooks, status updates, incident timelines, postmortems, action owners, and prevention checks.
- `e2e/canvas-identity-access-lifecycle.spec.ts` for SSO metadata, SCIM provisioning, group/role mapping, deactivation, guests, access reviews, and policy explanations.
- `e2e/canvas-secrets-key-management.spec.ts` for secret references, redaction, rotation, expiry, revocation, BYOK/CMK status, and connector secret health.
- `e2e/canvas-api-contract-lifecycle.spec.ts` for OpenAPI/AsyncAPI generation, contract validation, versioning, idempotency, signed webhooks, replay, and deprecation warnings.
- `e2e/canvas-backup-restore-dr.spec.ts` for backup coverage, point-in-time restore previews, object restore, RPO/RTO status, restore drills, and lifecycle send suppression.
- `e2e/canvas-i18n-localization.spec.ts` for locale formatting, message catalogs, long labels, CJK text, RTL layouts, mixed-direction evidence, and localized exports.
- `e2e/canvas-design-rules-preflight.spec.ts` for custom rules, issue markers, focus-in-canvas, waivers, dry-runs, and publish/export/send gates.
- `e2e/canvas-parametric-history.spec.ts` for timeline replay, branches, upstream edits, stale downstream outputs, rebuild failures, and restore points.
- `e2e/canvas-operational-workbenches.spec.ts` for role-specific queues, approvals, human checkpoints, permissions, and canonical canvas updates.
- `e2e/canvas-success-support-loop.spec.ts` for health scores, playbooks, support clustering, answer inspection, adoption segments, and lifecycle targeting.
- `e2e/canvas-academy-guided-practice.spec.ts` for role trails, demo canvases, guided challenges, validation checkpoints, badges, and outcome analytics.
- `e2e/canvas-power-user-profiles.spec.ts` for workspace profiles, keymaps, command aliases, macro recording, profile import/export, and governed profile publishing.
- `e2e/canvas-research-digital-assets.spec.ts` for asset packaging, exposed parameters, locked internals, version pinning, embedded examples, QA checks, and upgrade previews.
- `e2e/canvas-decision-inbox.spec.ts` for anchored comments, mentions, assignments, approval requests, read/resolved/follow state, digests, and permission-safe notifications.
- `e2e/canvas-data-residency.spec.ts` for residency maps, in-scope/out-of-scope explanations, region warnings, migration scheduling, app readiness, and tenant-boundary evidence.
- `e2e/canvas-release-migration-assistant.spec.ts` for impact reports, deprecation warnings, dry-run migrations, before/after diffs, version pins, rollout windows, and rollback paths.
- `e2e/canvas-migration-hub.spec.ts` for file imports, mapping previews, fidelity scores, unsupported-object reports, cleanup actions, migration dashboards, signoff, and rollback/export paths.
- `e2e/canvas-procurement-evidence-room.spec.ts` for trust evidence, questionnaire automation, evidence freshness, scoped export packets, NDA/access controls, and owner routing.
- `e2e/canvas-accessibility-conformance.spec.ts` for VPAT/ACR generation, sample sets, assistive-tech evidence, known limitations, focus/ARIA artifacts, and remediation roadmap links.
- `e2e/canvas-rendering-performance.spec.ts` for workerized operations, INP budgets, trace capture, progressive rendering, frame drops, long tasks, and dense-canvas device-class dashboards.
- `e2e/canvas-research-method-governance.spec.ts` for method templates, study protocols, COREQ/SRQR/JARS checklist state, ethics gates, consent, bias notes, and method-quality overlays.
- `e2e/canvas-nested-subgraphs.spec.ts` for subgraph creation, breadcrumbs, exposed slots, parameter panels, unpacking, publication, per-instance overrides, and blueprint impact warnings.
- `e2e/canvas-dependency-resolver.spec.ts` for missing assets, version conflicts, permission blockers, recovery actions, owner routing, environment snapshots, and immutable run manifests.
- `e2e/canvas-example-gallery.spec.ts` for recipe browsing, sample data, expected outputs, sandbox insertion, adapt-to-project flows, cleanup, and lifecycle/training deep links.
- `e2e/canvas-static-analysis.spec.ts` for live checker scores, inline issues, severity profiles, quick fixes, waivers, audit trails, and action-specific gates.
- `e2e/canvas-solution-packaging.spec.ts` for solution manifests, connection references, environment variables, promotion validation, rollback evidence, and deployment history.
- `e2e/canvas-symbol-index.spec.ts` for find references, dependents, upstream/downstream traversal, bookmark scopes, object outline, jump targets, and index freshness.
- `e2e/canvas-data-inspector.spec.ts` for edge/node probes, copyable paths, pinned samples, before/after comparison, schema mismatch warnings, and redacted fixtures.
- `e2e/canvas-execution-replay.spec.ts` for manual/partial/production/replay/dry-run modes, original/current workflow replay, side-effect suppression, and cannot-run explanations.
- `e2e/canvas-error-status-deadletter.spec.ts` for error handlers, node status signals, dead-letter queues, retry/assign/suppress actions, and suspicious-success gates.
- `e2e/canvas-work-item-matrix.spec.ts` for batch item status, attributes, scheduler logs, retries, costs, artifacts, variant comparison, and promote/rollback.
- `e2e/canvas-requirements-traceability.spec.ts` for requirement badges, traceability panes, matrices, missing-link review, stale impacts, and coverage gates.
- `e2e/canvas-subflow-execution-correlation.spec.ts` for parent/child run links, input/output contracts, cross-run search, payload summaries, and blast-radius views.
- `e2e/canvas-custom-node-sdk.spec.ts` for custom node scaffolds, UI standards, fixture runs, permission manifests, contract tests, and compatibility checks.
- `e2e/canvas-expression-mapping-workbench.spec.ts` for schema-aware mappings, sandboxing, sample previews, before/after comparisons, redaction warnings, and lineage.
- `e2e/canvas-data-profiling-browse.spec.ts` for profile panels, sample/full-run badges, missingness, duplicates, outliers, consent gaps, and persisted profile artifacts.
- `e2e/canvas-dependency-path-hygiene.spec.ts` for dependency manifests, local path warnings, missing asset relinking, path rewrite dry-runs, packaging, and import remapping.
- `e2e/canvas-marketplace-supply-chain.spec.ts` for signed marketplace assets, SBOM-style manifests, attestations, scans, quarantine, and trust-room evidence.
- `e2e/canvas-ai-human-fallback.spec.ts` for AI fallback queues, confidence/policy escalation, source evidence, model traces, reviewer SLAs, and accept/edit/reject flows.
- `e2e/canvas-graph-diagnostics-workbench.spec.ts` for compile diagnostics, project search, semantic diffs, breakpoints, watches, call stacks, warnings, and object-focused fixes.
- `e2e/canvas-collection-semantics.spec.ts` for cardinality badges, branch/path viewers, domain warnings, matching/lacing controls, and mapping preview item pairing.
- `e2e/canvas-component-interface-bindings.spec.ts` for public parameter panels, locked internals, environment overrides, invalidation previews, and safe secret omission.
- `e2e/canvas-performance-hotpaths.spec.ts` for hot-path overlays, node/edge timing counters, cost budgets, profiler snapshots, and QA/support performance artifacts.
- `e2e/canvas-operator-palette-snippets.spec.ts` for contextual node discovery, certified snippets, approved catalogs, hidden/internal nodes, and deprecated-node warnings.
- `e2e/canvas-versioned-flow-promotion.spec.ts` for version-state badges, registry buckets, local/stale/sync-failure states, parameter-context promotion, and nested conflict blocking.

Visual assertions:

- Graph content visible on first load or explicit mobile overview state visible.
- No critical overlay has negative `left/top` or extends beyond viewport without scroll.
- Edges visible after fit, resize, and auto-layout.
- Minimap/status/controls do not overlap.
- Idle frame hash stability, excluding intentional animations.

Manual QA after implementation:

- Run the production-like artifact scripts in `test-results/`.
- Run the standard canvas Playwright suite.
- Verify screenshots and contact sheets before deployment.

## Suggested Implementation Sequence

1. Implement dynamic fit helper and resize/orientation re-fit.
2. Hide/rework minimap/status/control layout on mobile.
3. Replace Tools/Analyze dropdowns with responsive popover/bottom-sheet primitive.
4. Improve auto-layout presets and post-layout fit.
5. Add modal accessibility labels and Calendar auth gating.
6. Fix telemetry route mismatch.
7. Add regression specs and snapshot artifacts.
8. Add home view, fit selection, saved views, and an outline/navigator panel.
9. Add low-zoom overview, graph health, and high-count selection affordances.
10. Add sections/subgraphs, analysis blocks, and contextual quick add.
11. Add canvas-as-research-story flows for report/presentation/training destinations.
12. Add research state, lineage, stale analysis warnings, and AI run audit views.
13. Split canvas into Edit, Review, and Present modes backed by the same data model.
14. Add AI scaffold preview, template library, and insertable snippets.
15. Add spatial landmarks, offscreen indicators, search-plus-context, and expand-on-demand exploration.
16. Define formal visual grammar, typed ports, typed links, and relation metadata.
17. Add non-destructive perspectives, filters, saved scenes, and table/data companion views.
18. Add CAQDAS-grade code maps, relation maps, matrices, and source-linked evidence snapshots.
19. Add self-documenting nodes, port hints, inline validation, and in-canvas learning.
20. Add dense-canvas performance budgets, virtualization, and level-of-detail rendering.
21. Add observable analysis run mode with run inspector, rerun, compare-run, redacted logs, and approval breakpoints.
22. Add collaboration history, deleted-object recovery, branching/merge, presence, and follow mode.
23. Add data preview and research quality panels.
24. Add accessible graph navigator and non-drag graph controls.
25. Add explicit touch, pen, and cross-device interaction modes.
26. Add diagram-grade connector, layout, and layer controls.
27. Add facilitated research review sessions.
28. Add systems-map analytics and visual query cards.
29. Add Research Advisor, impact analysis, and canvas test harnesses.
30. Add enterprise governance, admin controls, compliance policy, classification, and audit dashboards.
31. Add reproducible research publishing, live reports, Research Packets, and regeneration diffs.
32. Add evidence-centric journey and service-blueprint views.
33. Add AI-assisted canvas authoring and critique with source-grounded proposals.
34. Add integration, event, webhook, and API platform.
35. Add lifecycle messaging and in-product education journey builder.
36. Add durable orchestration and job recovery for imports, AI runs, exports, reports, syncs, and sends.
37. Add research-to-roadmap decision traceability.
38. Add semantic evidence graph and interchange standards.
39. Add production UX observability and support loop.
40. Add offline/local-first collaboration and conflict review.
41. Add sandboxed extension runtime and plugin security.
42. Add research media ingestion, transcription, and evidence clip pipeline.
43. Add hybrid evidence search, retrieval, and Graph RAG.
44. Add model/provider operations, routing, and cost controls.
45. Add execution queue, partial recompute, and cache semantics.
46. Add dataflow backpressure, provenance replay, and operational debugging.
47. Add product analytics, feature flags, and engagement experimentation.
48. Add community template/workflow marketplace quality and trust.
49. Add scientific workflow reproducibility and environment capture.
50. Add data quality, contracts, and evidence health gates.
51. Add visual change review, branch impact, and merge governance.
52. Add connector schema drift and integration lifecycle management.
53. Add stakeholder portal, embedded dashboards, and subscriptions.
54. Add scenario simulation, what-if optimization, and visual debugging.
55. Add design tokens, visual regression, and UI state coverage.
56. Add data catalog, business glossary, and research asset stewardship.
57. Add retention, legal hold, eDiscovery, and disposition.
58. Add resource quotas, cost budgets, and compute capacity planning.
59. Add incident response, runbooks, status pages, and postmortems.
60. Add enterprise identity, SSO, SCIM, and access lifecycle.
61. Add secrets, key management, BYOK, and credential hygiene.
62. Add API/event contract lifecycle and developer trust.
63. Add backup, restore, and disaster recovery UX.
64. Add internationalization, localization, RTL, and cultural UX.
65. Add design rules, constraint authoring, and preflight gates.
66. Add parametric timeline, dependency rebuild, and design history.
67. Add role-specific operational interfaces and human-in-the-loop workbenches.
68. Add customer success health, support feedback, and adoption playbooks.
69. Add guided academy, credentials, and in-context practice.
70. Add power-user workspace profiles, hotkeys, and command ergonomics.
71. Add procedural asset packaging and asset interface design.
72. Add canvas-anchored comments, mentions, notifications, and decision inbox.
73. Add data residency, tenant boundary, and compliance scope transparency.
74. Add release, deprecation, and migration assistant.
75. Add migration hub, import fidelity, and competitive tool offboarding.
76. Add procurement evidence room, security questionnaires, and trust automation.
77. Add accessibility conformance reporting and assistive-tech evidence.
78. Add browser rendering pipeline, worker offload, and interaction performance.
79. Add research method governance, reporting checklists, and ethical review.
80. Add nested subgraphs, parameter panels, and reusable component interfaces.
81. Add dependency resolver, missing asset recovery, and environment snapshots.
82. Add example gallery, recipe browser, and insertable learning snippets.
83. Add continuous canvas static analysis, quality scores, and rule governance.
84. Add solution packaging, environment promotion, and connection references.
85. Add graph symbol index, find references, and blueprint-style navigation.
86. Add data inspector, path probes, and pinned sample data.
87. Add execution mode parity, partial runs, and replay-to-editor debugging.
88. Add error workflows, node status signals, and dead-letter operations.
89. Add work-item matrix, variant/wedge experiments, and scheduler observability.
90. Add requirements perspective, traceability matrix, and coverage gap review.
91. Add parent/subflow execution correlation and cross-workflow call graphs.
92. Add custom node SDK, node UI standards, developer console, contract tests, and compatibility checks.
93. Add expression and mapping workbench with typed previews, safe sandboxing, redaction warnings, and lineage.
94. Add data profiling, Browse/Profile nodes, sample/full-run boundaries, and persisted profile artifacts.
95. Add workflow dependency path hygiene with missing asset recovery, relinking, packaging, and portability scores.
96. Add signed marketplace artifacts, SBOM-style manifests, attestations, scans, quarantine, and trust evidence.
97. Add AI human fallback queues with confidence/policy escalation, source evidence, model traces, and review workflows.
98. Add graph compile diagnostics, search, semantic diff, breakpoints, watches, call stacks, and node warning workbench.
99. Add data-tree, domain, cardinality, branch/path, and matching/lacing semantics.
100. Add public component interface designer, parameter panels, environment bindings, invalidation previews, and per-environment overrides.
101. Add performance profiling, hot-path heatmaps, node/edge timing counters, threshold snapshots, and run cost budgets.
102. Add operator palette, certified snippets, contextual node discovery, approved catalogs, and deprecated-node warnings.
103. Add versioned flow states, registry buckets, parameter-context promotion, and nested version conflict handling.
104. Add AI eval and prompt governance.
105. Add sensitive-data redaction and permission architecture.
106. Add governed template/extension registry with dependency and permission checks.
107. Activate lifecycle email/training journeys after governed journey infrastructure, product analytics, model/job observability, identity, secrets, contracts, recovery, localization, preflight, support feedback, guided academy, residency, migration assistance, migration hub, procurement evidence, accessibility conformance, rendering architecture, method governance, nested subgraphs, dependency recovery, example gallery, live canvas checking, solution packaging, graph reference navigation, data inspection, execution replay, error routing, work-item observability, requirements traceability, subflow execution correlation, custom-node SDKs, expression mapping, data profiling, dependency path hygiene, marketplace supply-chain trust, AI human fallback, graph diagnostics, collection semantics, public component interfaces, performance hot-path profiling, operator palette governance, and versioned flow promotion are stable.
